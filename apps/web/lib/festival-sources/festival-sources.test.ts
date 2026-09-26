import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { validRuntimeDataset } from "../existing/archive";
import { daysBetween } from "../kto/history";
import { readNationalDatasets, readRegistrationPeriods, runFestivalSources, type RunOptions } from "./index";
import { backfillWindows, catalogueCode, standardWindows } from "./national";
import { acquireLock, writeChecked } from "./store";

const KEY = "k3y/with+special=chars%2Bx";
const TYPES: Record<string, string> = { "1": "현지인(a)", "2": "외지인(b)", "3": "외국인(c)" };
const NAMES: Record<string, string> = { "44230": "논산시", "45750": "임실군", "36110": "세종특별자치시", "99999": "없는구", "42110": "춘천시", "51110": "춘천시", "44150": "공주시", "44760": "부여군" };
const iso = (ymd: string | null) => `${ymd!.slice(0, 4)}-${ymd!.slice(4, 6)}-${ymd!.slice(6, 8)}`;
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status });
const visit = (code: string, date: string, bump = 0) => 1000 + Number(date.slice(8)) + Number(code.slice(2)) + bump;

/** Official-shaped DataLab rows: a conflict (old+new Gangwon code) on 09-10, a missing type on 09-11, a bad value on 09-12. */
function visits(start: string, end: string, options: { bump?: number; drop?: string[] } = {}) {
  const rows: Record<string, unknown>[] = [];
  for (const date of daysBetween(start, end)) for (const code of Object.keys(NAMES)) {
    if ((code === "42110" && date !== "2025-09-10") || options.drop?.includes(code)) continue;
    for (const type of ["1", "2", "3"]) {
      if (code === "44150" && date === "2025-09-11" && type === "3") continue;
      rows.push({ baseYmd: date.replaceAll("-", ""), signguCode: code, signguNm: NAMES[code], touDivCd: type, touDivNm: TYPES[type],
        touNum: code === "44760" && date === "2025-09-12" ? "abc" : type === "2" ? String(visit(code, date, options.bump)) : "12.5" });
    }
  }
  return rows;
}
type Fest = { id: string; title: string; regn: string; signgu: string; start?: string; end?: string };
const festRow = (f: Fest) => ({ contentid: f.id, contenttypeid: "15", title: f.title, lDongRegnCd: f.regn, lDongSignguCd: f.signgu,
  eventstartdate: f.start ?? "", eventenddate: f.end ?? "", modifiedtime: "20260101000000" });

type Provider = { datalab?: (start: string, end: string) => Record<string, unknown>[] | Response; pageCap?: number;
  registry?: (pageNo: number) => Fest[] | Response; failOnce?: string; urls: string[] };
function provider(p: Provider): typeof fetch {
  return async (input) => {
    const url = new URL(String(input)), q = url.searchParams, pageNo = Number(q.get("pageNo")), size = Number(q.get("numOfRows"));
    p.urls.push(url.pathname);
    if (p.failOnce && url.search.includes(p.failOnce)) { p.failOnce = undefined; throw new Error(`socket closed ${KEY}`); }
    if (url.pathname.endsWith("/DataLabService/locgoRegnVisitrDDList")) {
      const all = (p.datalab ?? visits)(iso(q.get("startYmd")), iso(q.get("endYmd")));
      if (all instanceof Response) return all;
      const cap = Math.min(size, p.pageCap ?? size), slice = all.slice((pageNo - 1) * cap, pageNo * cap);
      const reported = all.length === 0 ? 0 : pageNo === 1 ? Math.min(cap, all.length) : slice.length;
      return json({ response: { header: { resultCode: "0000", resultMsg: "OK" }, body: { totalCount: all.length, pageNo, numOfRows: reported, items: slice.length ? { item: slice } : "" } } });
    }
    if (url.pathname.endsWith("/KorService2/searchFestival2")) {
      assert.equal(q.get("numOfRows"), "100"); assert.match(q.get("eventStartDate")!, /^\d{4}0101$/);
      const all = p.registry?.(pageNo) ?? [];
      if (all instanceof Response) return all;
      const slice = all.slice((pageNo - 1) * 100, pageNo * 100).map(festRow);
      return json({ response: { header: { resultCode: "0000" }, body: { totalCount: all.length, pageNo, numOfRows: Math.min(100, all.length), items: slice.length ? { item: slice } : "" } } });
    }
    return json({}, 404);
  };
}
async function store(t: test.TestContext) {
  const dir = await mkdtemp(join(tmpdir(), "festival-sources-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  return dir;
}
const run = (dir: string, p: Provider, now: string, extra: Partial<RunOptions> = {}) => runFestivalSources(dir, KEY, { now, fetch: provider(p), pauseMs: 0, ...extra });
async function everyFile(dir: string): Promise<string[]> {
  const out: string[] = [];
  for (const e of await readdir(dir, { withFileTypes: true })) out.push(...(e.isDirectory() ? await everyFile(join(dir, e.name)) : [join(dir, e.name)]));
  return out;
}
const NOW = "2025-10-02T03:00:00.000Z"; // Korea 2025-10-02: months Jul..Oct touch the last 90 days
const fests: Fest[] = Array.from({ length: 150 }, (_, i) => ({ id: String(9000 + i), title: `행사 ${i}`, regn: "44", signgu: "230", start: "20250501", end: "20250502" }));

test("catalogue codes: exact, verified migrations and Sejong only", () => {
  assert.equal(catalogueCode("44230"), "44230");
  assert.equal(catalogueCode("42110"), "51110");
  assert.equal(catalogueCode("45750"), "52750");
  assert.equal(catalogueCode("36110"), "3611036110");
  assert.equal(catalogueCode("46110"), "12110"); // official one-to-one membership crosswalk
  assert.equal(catalogueCode("46230"), "12190"); // suffix changes; never truncate prefixes
  assert.equal(catalogueCode("29110"), "12210");
  for (const split of ["28110", "28140", "28260"]) assert.equal(catalogueCode(split), null);
  assert.equal(catalogueCode("99999"), null);
  assert.equal(catalogueCode("4423"), null);
  assert.deepEqual(standardWindows("2025-10-02"), [{ start: "2025-10-01", end: "2025-10-01" }, { start: "2025-09-01", end: "2025-09-30" },
    { start: "2025-08-01", end: "2025-08-31" }, { start: "2025-07-01", end: "2025-07-31" }]);
  assert.deepEqual(standardWindows("2025-10-01").at(0), { start: "2025-09-01", end: "2025-09-30" });
  assert.equal(backfillWindows("2023-03-15").length, 2);
  assert.equal(backfillWindows("2026-09-26")[0].start, "2026-08-01");
});

test("an uninitialized store reads empty", async (t) => {
  const dir = await store(t);
  assert.deepEqual(await readNationalDatasets(dir), []);
  assert.deepEqual(await readRegistrationPeriods(dir, "123", "44230"), []);
  assert.deepEqual(await readNationalDatasets(join(dir, "absent")), []);
});

test("standard run stores exact catalogue series without leaking the key", async (t) => {
  const dir = await store(t), p: Provider = { urls: [], registry: () => fests };
  const result = await run(dir, p, NOW);
  assert.deepEqual(result, { status: "success", calls: 6, regions: 6, registrations: 150, national: "ok", registry: "ok" });
  const datasets = await readNationalDatasets(dir), byCode = new Map(datasets.map(d => [d.region.code, d]));
  assert.deepEqual([...byCode.keys()], ["3611036110", "44150", "44230", "44760", "51110", "52750"]);
  assert.deepEqual(datasets.map(d => d.region.name), ["세종특별자치시", "공주시", "논산시", "부여군", "춘천시", "임실군"]);
  for (const d of datasets) { assert.ok(validRuntimeDataset(d, Date.parse(NOW))); assert.equal(d.points.length, 93); assert.equal(d.collectedAt, NOW); }
  const at = (code: string, date: string) => byCode.get(code)!.points.find(x => x.date === date)!;
  assert.deepEqual(at("44230", "2025-09-15"), { date: "2025-09-15", value: visit("44230", "2025-09-15"), quality: "complete", collectedAt: NOW });
  assert.equal(at("52750", "2025-07-01").value, visit("45750", "2025-07-01")); // only outside residents, from the old Jeonbuk code
  assert.deepEqual(at("51110", "2025-09-10"), { date: "2025-09-10", value: null, quality: "invalid", collectedAt: NOW }); // old+new code same day: no pick, no sum
  assert.equal(at("51110", "2025-09-11").quality, "complete");
  assert.equal(at("44150", "2025-09-11").quality, "invalid"); // a visitor type is missing
  assert.equal(at("44760", "2025-09-12").quality, "invalid"); // malformed value
  assert.deepEqual((await readNationalDatasets(dir, { codes: ["44230"] })).map(d => d.region.code), ["44230"]);
  for (const file of await everyFile(dir)) {
    const text = await readFile(file, "utf8");
    for (const secret of [KEY, encodeURIComponent(KEY), "apis.data.go.kr"]) assert.ok(!text.includes(secret), file);
  }
  assert.ok(!JSON.stringify(result).includes(KEY));
  const again = await run(dir, p, "2025-10-02T09:00:00.000Z");
  assert.deepEqual(again, { status: "success", calls: 0, regions: 6, registrations: 150, national: "fresh", registry: "fresh" });
});

test("a failed or regressed refresh keeps the last valid month; a corrupt month falls back to its previous version", async (t) => {
  const dir = await store(t);
  await run(dir, { urls: [], registry: () => fests }, NOW);
  const before = await readNationalDatasets(dir);
  const failed = await run(dir, { urls: [], registry: () => fests, datalab: () => json({ response: { header: { resultCode: "0000" }, body: { pageNo: 1, items: "" } } }) }, "2025-10-03T03:00:00.000Z");
  assert.equal(failed.status, "partial"); assert.equal(failed.national, "history-provider-error"); assert.equal(failed.registry, "ok");
  assert.deepEqual((await readNationalDatasets(dir)).map(d => d.points), before.map(d => d.points));
  const regressed = await run(dir, { urls: [], registry: () => fests, datalab: (s, e) => visits(s, e, { drop: s === "2025-08-01" ? ["44230"] : [] }) }, "2025-10-04T03:00:00.000Z");
  assert.equal(regressed.national, "partial:national-coverage-regressed");
  assert.equal((await readNationalDatasets(dir, { codes: ["44230"] }))[0].points.find(x => x.date === "2025-08-05")!.quality, "complete");
  await run(dir, { urls: [], registry: () => fests, datalab: (s, e) => visits(s, e, { bump: 7 }) }, "2025-10-05T03:00:00.000Z");
  const value = async () => (await readNationalDatasets(dir, { codes: ["44230"] }))[0].points.find(x => x.date === "2025-09-15")!.value;
  assert.equal(await value(), visit("44230", "2025-09-15", 7));
  await writeFile(join(dir, "national", "months", "2025-09.json"), "{\"schemaVersion\":1,\"checksum\":\"0\",\"payload\":{}}\n");
  assert.equal(await value(), visit("44230", "2025-09-15")); // preserved previous valid version
});

test("calls stay within the daily budget and an attempted request is never resent that day", async (t) => {
  const dir = await store(t), p: Provider = { urls: [], registry: () => fests, pageCap: 200 };
  const first = await run(dir, p, NOW); // needs 1+4+4+4 district pages; 12 are allowed per day
  assert.equal(first.national, "partial:national-budget-stop"); assert.equal(first.calls, 2 + 10); assert.equal(first.status, "partial");
  const again = await run(dir, p, "2025-10-02T05:00:00.000Z");
  assert.equal(again.calls, 0); assert.equal(again.national, "national-budget-stop");
  const attempts = (await readFile(join(dir, "attempts", "2025-10-02.jsonl"), "utf8")).trim().split("\n").map(l => JSON.parse(l));
  assert.equal(attempts.length, 12); assert.equal(new Set(attempts.map(a => a.id)).size, 12);
  assert.ok(attempts.every(a => !JSON.stringify(a).includes(KEY)));
  const next = await run(dir, p, "2025-10-03T03:00:00.000Z");
  assert.ok(next.calls <= 30);
  const small = await run(await store(t), { urls: [], registry: () => fests }, NOW, { maxCalls: 4 });
  assert.ok(small.calls <= 4); assert.equal(small.registry, "ok"); // 2 registry + 2 district calls
  assert.equal((await run(dir, p, NOW, { maxCalls: 31 })).national, "invalid-options");

  const dir2 = await store(t), flaky: Provider = { urls: [], registry: () => fests, failOnce: "startYmd=20250901" };
  const interrupted = await run(dir2, flaky, NOW);
  assert.equal(interrupted.national, "partial:history-network-error");
  const retry = await run(dir2, flaky, "2025-10-02T04:00:00.000Z");
  assert.equal(retry.national, "national-attempted-today"); assert.equal(retry.calls, 0);
  const tomorrow = await run(dir2, flaky, "2025-10-03T03:00:00.000Z");
  assert.equal(tomorrow.national, "ok");
});

test("backfill is resumable and bounded each day without permanently blocking remaining months", async (t) => {
  const dir = await store(t), p: Provider = { urls: [], registry: () => fests };
  const now = "2023-03-15T03:00:00.000Z";
  const first = await run(dir, p, now, { backfill: true });
  assert.deepEqual([first.status, first.calls, first.national], ["success", 4, "ok"]);
  assert.deepEqual((await readNationalDatasets(dir))[0].points.map(x => x.date).slice(0, 1), ["2023-01-01"]);
  const second = await run(dir, p, "2023-03-16T03:00:00.000Z", { backfill: true });
  assert.deepEqual([second.calls, second.national], [2, "fresh"]); // registry refresh only
  assert.equal((await run(dir, p, now, { backfill: true, maxCalls: 181 })).national, "invalid-options");

  const capped = await store(t);
  await mkdir(join(capped, "attempts"), { recursive: true });
  await writeFile(join(capped, "attempts", "2023-03-15.jsonl"), Array.from({length:161}, (_,i) => JSON.stringify({id:`previous-${i}`,source:"national",mode:"backfill",at:now})).join("\n") + "\n");
  const limited = await run(capped, p, now, { backfill: true });
  assert.equal(limited.national, "partial:national-budget-stop");
  assert.equal((await readNationalDatasets(capped))[0].points[0].date, "2023-02-01"); // newest month first
  const recent = await run(capped, p, now);
  assert.equal(recent.calls, 0); // backfill + recent share the 162 national / 180 total daily ceiling
  assert.equal(recent.national, "national-budget-stop");
  const resumed = await run(capped, p, "2023-03-16T03:00:00.000Z", {backfill:true});
  assert.equal(resumed.status, "success");
  assert.equal((await readNationalDatasets(capped))[0].points[0].date, "2023-01-01");
});

test("successful empty responses are stored as empty; malformed responses store nothing", async (t) => {
  const dir = await store(t);
  const empty = await run(dir, { urls: [], datalab: () => [], registry: () => [] }, NOW);
  assert.deepEqual(empty, { status: "success", calls: 5, regions: 0, registrations: 0, national: "ok", registry: "empty" });
  assert.deepEqual(await readNationalDatasets(dir), []);
  assert.equal((await readdir(join(dir, "national", "months"))).filter(n => n.endsWith(".json")).length, 4);
  const other = await store(t);
  const malformed = await run(other, { urls: [], datalab: () => json({ response: { header: { resultCode: "0000" }, body: { totalCount: 3, pageNo: 1, items: "" } } }),
    registry: () => json({ response: { header: { resultCode: "0000" }, body: { totalCount: 2, pageNo: 1, items: { item: [festRow(fests[0])] } } } }) }, NOW);
  assert.equal(malformed.status, "failed");
  assert.equal(malformed.national, "history-provider-error");
  assert.equal(malformed.registry, "registry-pagination-error"); // a short page is never a smaller registry
  assert.deepEqual(await readdir(join(other, "national", "months")), []);
  const quota = await run(await store(t), { urls: [], registry: () => json({ response: { header: { resultCode: "22", resultMsg: `LIMITED ${KEY}` } } }) }, NOW);
  assert.equal(quota.registry, "registry-access-or-quota-stop"); assert.ok(!JSON.stringify(quota).includes(KEY));
});

test("registration periods: exact content and region, latest per start year, never inferred", async (t) => {
  const dir = await store(t);
  let rows: Fest[] = [
    { id: "501", title: "딸기축제", regn: "44", signgu: "230", start: "20260305", end: "20260308" },
    { id: "502", title: "지역 불명", regn: "99", signgu: "999", start: "20260305", end: "20260308" },
    { id: "503", title: "날짜 없음", regn: "44", signgu: "230" },
    { id: "504", title: "세종 축제", regn: "36110", signgu: "36110", start: "20260410", end: "20260412" },
  ];
  const p: Provider = { urls: [], datalab: () => [], registry: () => rows };
  const day = (n: number) => `2026-03-${String(n).padStart(2, "0")}T03:00:00.000Z`;
  assert.equal((await run(dir, p, day(1))).registrations, 2);
  rows = [{ ...rows[0], title: "논산딸기축제", start: "20260312", end: "20260315" }, ...rows.slice(1)]; // same-year correction and rename
  await run(dir, p, day(2));
  rows = [{ ...rows[0], start: "20270304", end: "20270307" }, ...rows.slice(1)]; // next edition registered on the same content
  await run(dir, p, day(3));
  rows = [{ ...rows[0], signgu: "150", start: "20270401", end: "20270403" }, ...rows.slice(1)]; // same content now in another district
  await run(dir, p, day(4));
  const periods = await readRegistrationPeriods(dir, "501", "44230");
  assert.deepEqual(periods.map(x => [x.start, x.end, x.name, x.collectedAt]), [
    ["2026-03-12", "2026-03-15", "논산딸기축제", day(2)], ["2027-03-04", "2027-03-07", "논산딸기축제", day(3)]]);
  assert.ok(periods.every(x => /^[A-Za-z0-9-]{1,100}$/.test(x.id) && x.contentId === "501" && x.regionCode === "44230"));
  assert.deepEqual((await readRegistrationPeriods(dir, "501", "44150")).map(x => x.start), ["2027-04-01"]);
  assert.deepEqual(await readRegistrationPeriods(dir, "501", "44760"), []);
  assert.deepEqual(await readRegistrationPeriods(dir, "502", "99999"), []);
  assert.deepEqual(await readRegistrationPeriods(dir, "503", "44230"), []);
  assert.deepEqual((await readRegistrationPeriods(dir, "504", "3611036110")).map(x => x.start), ["2026-04-10"]);
  assert.deepEqual(await readRegistrationPeriods(dir, "501 OR 1", "44230"), []);
  rows = rows.slice(1); // disappearance is not a cancellation: history keeps observed registrations
  await run(dir, p, day(5));
  assert.equal((await readRegistrationPeriods(dir, "501", "44230")).length, 2);
});

test("an incomplete or duplicated sweep keeps the last complete registry", async (t) => {
  const dir = await store(t), base = fests.map(f => ({ ...f, start: "20260501", end: "20260503" }));
  await run(dir, { urls: [], datalab: () => [], registry: () => base }, "2026-03-01T03:00:00.000Z");
  const before = await readRegistrationPeriods(dir, "9000", "44230");
  assert.equal(before.length, 1);
  const changed = base.map(f => ({ ...f, start: "20260601", end: "20260603" }));
  const growing = await run(dir, { urls: [], datalab: () => [], registry: n => n === 1 ? changed : [...changed, { ...changed[0], id: "9999" }] }, "2026-03-02T03:00:00.000Z");
  assert.equal(growing.registry, "registry-incomplete-sweep");
  const duplicated = await run(dir, { urls: [], datalab: () => [], registry: () => changed.map((f, i) => i === 120 ? { ...f, id: "9000" } : f) }, "2026-03-03T03:00:00.000Z");
  assert.equal(duplicated.registry, "registry-duplicate-row");
  assert.deepEqual(await readRegistrationPeriods(dir, "9000", "44230"), before);
  assert.equal(duplicated.registrations, 150);
});

test("a live kernel lock blocks a second run; leftover lock file never blocks a restarted run", async (t) => {
  const dir = await store(t);
  const release = await acquireLock(dir);
  const blocked = await run(dir, { urls: [] }, NOW);
  assert.deepEqual([blocked.status, blocked.calls, blocked.national], ["failed", 0, "sources-locked"]);
  await release();
  await writeFile(join(dir, "run.lock"), String(process.pid));
  assert.equal((await run(dir, { urls: [], registry: () => fests }, NOW)).status, "success");
  assert.ok((await stat(join(dir, "run.lock"))).isFile());
  assert.equal((await runFestivalSources(dir, "  ", { now: NOW })).national, "sources-key-missing");
});
