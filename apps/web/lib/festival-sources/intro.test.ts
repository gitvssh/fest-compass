import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { INTRO, introCandidates, readIntroStore, validateIntroStore, type IntroStore } from "./intro";
import { readRegistrySnapshot } from "./registry";
import { runFestivalIntros, runFestivalSources } from "./run";

const KEY = "k3y/with+special=chars%2Bx";
type Fest = { id: string; regn?: string; signgu?: string; start?: string; end?: string; type?: string; modified?: string };
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status });
const festRow = (f: Fest) => ({ contentid: f.id, contenttypeid: "15", title: `행사 ${f.id}`, lDongRegnCd: f.regn ?? "44", lDongSignguCd: f.signgu ?? "230",
  eventstartdate: f.start ?? "", eventenddate: f.end ?? "", modifiedtime: f.modified ?? "20260101000000", lclsSystm1: "EV", lclsSystm2: (f.type ?? "EV010300").slice(0, 4), lclsSystm3: f.type ?? "EV010300" });
type Intro = Record<string, unknown> | null | Response | "wrong-id";
/** Official-shaped fakes: the nationwide sweep (searchFestival2), introductions (detailIntro2), an empty DataLab. */
function provider(registry: () => Fest[], intro: (id: string) => Intro, calls: string[] = []): typeof fetch {
  return async input => {
    const url = new URL(String(input)), q = url.searchParams, pageNo = Number(q.get("pageNo"));
    if (url.pathname.endsWith("/KorService2/searchFestival2")) {
      const all = registry(), slice = all.slice((pageNo - 1) * 100, pageNo * 100).map(festRow);
      return json({ response: { header: { resultCode: "0000" }, body: { totalCount: all.length, pageNo, numOfRows: Math.min(100, all.length), items: slice.length ? { item: slice } : "" } } });
    }
    if (url.pathname.endsWith("/KorService2/detailIntro2")) {
      const id = q.get("contentId")!;
      calls.push(id);
      assert.equal(q.get("contentTypeId"), "15");
      const row = intro(id);
      if (row instanceof Response) return row;
      const item = row === null ? "" : { item: [{ contentid: row === "wrong-id" ? "1" : id, contenttypeid: "15", ...(row === "wrong-id" ? {} : row) }] };
      return json({ response: { header: { resultCode: "0000", resultMsg: "OK" }, body: { totalCount: row === null ? 0 : 1, pageNo: 1, numOfRows: 1, items: item } } });
    }
    return json({ response: { header: { resultCode: "0000" }, body: { totalCount: 0, pageNo: 1, numOfRows: 0, items: "" } } });
  };
}
async function store(t: test.TestContext) {
  const dir = await mkdtemp(join(tmpdir(), "festival-intros-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  return dir;
}
const DAY = (d: number) => `2026-10-${String(d).padStart(2, "0")}T03:00:00.000Z`; // Korea days 2026-10-dd
const sweep = (dir: string, rows: () => Fest[], now: string) => runFestivalSources(dir, KEY, { now, fetch: provider(rows, () => null), pauseMs: 0, maxCalls: 30 });
const introsRun = (dir: string, rows: () => Fest[], intro: (id: string) => Intro, now: string, calls: string[] = [], maxCalls?: number) =>
  runFestivalIntros(dir, KEY, { now, fetch: provider(rows, intro, calls), pauseMs: 0, maxCalls });
const programme = { program: "1. 개막식<br>2. 딸기 따기 체험, 키즈존", usetimefestival: "입장료 무료", agelimit: "", subevent: "" };

test("the sweep keeps each registration's provider class for later reading", async (t) => {
  const dir = await store(t);
  await sweep(dir, () => [{ id: "1", start: "20261010", end: "20261012", type: "EV010500" }, { id: "2", start: "20261010", end: "20261012", type: "EV030100" }], DAY(1));
  assert.deepEqual((await readRegistrySnapshot(dir))!.items.map(r => [r.contentId, r.type]), [["1", "EV010500"], ["2", "EV030100"]]);
});

test("introductions: bootstrap budget, then the daily budget; one attempt per registration per day; own attempt log", async (t) => {
  const dir = await store(t), rows = Array.from({ length: 260 }, (_, i) => ({ id: String(5000 + i), start: "20261101", end: "20261103" }));
  await sweep(dir, () => rows, DAY(1));
  const calls: string[] = [];
  const first = await introsRun(dir, () => rows, () => programme, DAY(1), calls);
  assert.deepEqual([first.status, first.calls, first.collected, first.entries], ["success", INTRO.bootstrapCalls, INTRO.bootstrapCalls, INTRO.bootstrapCalls]);
  const again = await introsRun(dir, () => rows, () => programme, DAY(1), calls);
  assert.deepEqual([again.calls, again.entries], [0, INTRO.bootstrapCalls], "the day's budget is spent");
  const next = await introsRun(dir, () => rows, () => programme, DAY(2), calls);
  assert.deepEqual([next.calls, next.entries], [INTRO.dailyCalls, INTRO.bootstrapCalls + INTRO.dailyCalls], "past the bootstrap only the daily budget");
  assert.equal(new Set(calls).size, calls.length, "no registration read twice while others wait");
  const logs = await readdir(join(dir, "attempts"));
  assert.ok(logs.includes("intro-2026-10-01.jsonl") && logs.includes("2026-10-01.jsonl"));
  assert.ok(!(await readFile(join(dir, "attempts", "2026-10-01.jsonl"), "utf8")).includes("intro"), "the source log never holds introductions");
  const saved = (await readIntroStore(dir))!.entries["44230:5000"];
  assert.deepEqual([saved.found, saved.program, saved.fee, saved.sourceModifiedAt], [true, "1. 개막식\n2. 딸기 따기 체험, 키즈존", "입장료 무료", "20260101000000"]);
  const limited = await introsRun(dir, () => rows, () => programme, DAY(3), [], 5);
  assert.equal(limited.calls, 5, "a smaller manual limit is honoured");
});

test("order: upcoming festivals first, then past ones, changed registrations, and performances last", async (t) => {
  const dir = await store(t);
  const rows: Fest[] = [
    { id: "1", start: "20261201", end: "20261203" }, { id: "2", start: "20261020", end: "20261022" }, { id: "3", start: "20260301", end: "20260303" },
    { id: "4", start: "20260801", end: "20260803" }, { id: "5", start: "20261015", end: "20261016", type: "EV020700" }, { id: "6" },
    { id: "7", regn: "99", signgu: "999", start: "20261011", end: "20261012" },
  ];
  await sweep(dir, () => rows, DAY(10));
  const snapshot = (await readRegistrySnapshot(dir))!;
  assert.deepEqual(introCandidates(snapshot, null, "2026-10-10").map(c => c.contentId), ["2", "1", "6", "4", "3", "5"], "unverified places are never read");
  const read: IntroStore = { updatedAt: DAY(10), entries: Object.fromEntries(["1", "2", "3", "4", "5", "6"].map(id => [`44230:${id}`, {
    contentId: id, regionCode: "44230", collectedAt: id === "1" ? "2026-08-01T00:00:00.000Z" : DAY(9), sourceModifiedAt: id === "4" ? "20250101000000" : "20260101000000", found: false, program: "", subevent: "", agelimit: "", fee: "" }])) };
  assert.deepEqual(introCandidates(snapshot, validateIntroStore(read), "2026-10-10").map(c => c.contentId), ["4", "1"], "a changed registration, then an upcoming one read long ago");
});

test("failures: a quota stop ends the run, three faults in a row end it, saved entries stay and the key never leaves", async (t) => {
  const dir = await store(t), rows = Array.from({ length: 12 }, (_, i) => ({ id: String(7000 + i), start: "20261101", end: "20261103" }));
  await sweep(dir, () => rows, DAY(1));
  const quota = json({ response: { header: { resultCode: "22", resultMsg: `LIMITED ${KEY}` } } });
  const stopped = await introsRun(dir, () => rows, id => id === "7002" ? quota : programme, DAY(1));
  assert.deepEqual([stopped.status, stopped.collected, stopped.intro], ["partial", 2, "intro-access-or-quota-stop"]);
  const faulty = await introsRun(dir, () => rows, id => id === "7003" ? null : "wrong-id", DAY(2));
  // 7002 (retried next day) and 7004..7006 answer for another content; 7003 has no introduction row: the third fault in a row stops.
  assert.deepEqual([faulty.status, faulty.calls, faulty.collected, faulty.intro], ["partial", 5, 1, "intro-row-contract-error"]);
  const store1 = (await readIntroStore(dir))!;
  assert.equal(store1.entries["44230:7003"].found, false, "no introduction row is stored as read-and-empty");
  assert.equal(Object.keys(store1.entries).length, 3);
  const thrown: typeof fetch = async () => { throw new Error(`socket ${KEY}`); };
  const down = await runFestivalIntros(dir, KEY, { now: DAY(3), fetch: thrown, pauseMs: 0 });
  assert.deepEqual([down.status, down.calls, down.intro], ["failed", 3, "intro-network-error"]);
  for (const name of await readdir(dir, { recursive: true })) {
    const path = join(dir, String(name));
    if (!/\.(json|jsonl)$/.test(path)) continue;
    assert.ok(!(await readFile(path, "utf8")).includes(KEY.slice(0, 6)), `${name} holds no key`);
  }
  assert.deepEqual((await runFestivalIntros(dir, "  ", { now: DAY(3) })).intro, "sources-key-missing");
  assert.equal((await runFestivalIntros(join(dir, "none"), KEY, { now: DAY(3), fetch: thrown })).intro, "intro-registry-missing");
});

test("the store validator refuses malformed or oversized introductions", () => {
  const entry = { contentId: "1", regionCode: "44230", collectedAt: DAY(1), sourceModifiedAt: null, found: true, program: "체험", subevent: "", agelimit: "", fee: "" };
  assert.ok(validateIntroStore({ updatedAt: DAY(1), entries: { "44230:1": entry } }));
  for (const bad of [{ "44150:1": entry }, { "44230:1": { ...entry, program: "가".repeat(1201) } }, { "44230:1": { ...entry, found: false } }, { "44230:1": { ...entry, sourceModifiedAt: "x" } }]) {
    assert.throws(() => validateIntroStore({ updatedAt: DAY(1), entries: bad }), /invalid-intro-store/);
  }
});
