import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import bundled from "../../data/region-history.json";
import { regionRef } from "./identity";
import { parseFestivalSearch, parseSchedule } from "./request";
import { createExistingService } from "./server";
import { collectRegionEvents, EVENT_PAGE_SIZE, lookupCurrent, type TourCall, type TourOperation, type TourPage } from "./tour";
import type { DataFreshness } from "./types";

const FRESH: DataFreshness = { mode: "archive-only", collectedAt: null, runtimeCollectedAt: null, refresh: { status: "not-configured", retryable: false } };
const AT = "2026-09-23T01:00:00.000Z";
const nonsan = regionRef("44", "230")!, range = { start: "2026-03-01", end: "2026-05-31" };
const ev = (id: number, start: string | null, end: string | null, extra: Record<string, unknown> = {}) =>
  ({ contentid: String(id), contenttypeid: "15", title: `행사${id}`, addr1: "논산", lDongRegnCd: "44", lDongSignguCd: "230", eventstartdate: start ?? "", eventenddate: end ?? "", ...extra });
/** searchFestival2 fake serving `rows` in pages; `tamper` may rewrite a page to simulate source faults. */
function paged(rows: Record<string, unknown>[], tamper: (page: number, p: TourPage) => TourPage = (_, p) => p) {
  const calls: [TourOperation, Record<string, string>][] = [];
  const call: TourCall = async (op, params) => {
    calls.push([op, params]);
    if (op !== "searchFestival2") throw new Error("unexpected");
    const n = Number(params.pageNo), size = Number(params.numOfRows);
    return tamper(n, { total: rows.length, pageNo: n, rows: rows.slice((n - 1) * size, n * size), collectedAt: AT });
  };
  return { call, calls };
}
const service = (tour: TourCall) => createExistingService({ archive: async () => ({ datasets: bundled, freshness: FRESH, runtime: [], runtimeRegions: [] }), regionList: async () => { throw new Error("resources not used"); }, tour, now: () => "2026-09-23T03:00:00.000Z" });
const schedule = (tour: TourCall) => service(tour).loadSchedule(parseSchedule(new URLSearchParams(`province=44&district=230&start=${range.start}&end=${range.end}`)));
const many = (n: number) => Array.from({ length: n }, (_, i) => ev(1000 + i, "20260410", "20260412"));

test("regional events: every page must arrive before counts; unknown dates stay listed without counting as overlap", async () => {
  const rows = [...many(148), ev(1, null, null), ev(2, "20260415", "bad")];
  const t = paged(rows), s = await schedule(t.call);
  assert.equal(t.calls.length, 2, "150 rows = two pages of 100");
  assert.deepEqual(t.calls[0][1], { eventStartDate: "20260301", eventEndDate: "20260531", lDongRegnCd: "44", lDongSignguCd: "230", numOfRows: String(EVENT_PAGE_SIZE), pageNo: "1", arrange: "A" });
  assert.deepEqual([s.events.status, s.events.items.length, s.summary.events], ["complete", 150, { status: "complete", count: 150, overlapping: 148, cancelled: 0, undated: 2 }]);
  const undated = s.events.items.filter(e => !e.datesKnown);
  assert.deepEqual(undated.map(e => [e.id, e.start, e.end, e.overlapDays, e.scheduleStatus]), [["1", null, null, null, "registered"], ["2", null, null, null, "registered"]]);
  assert.equal(s.events.collectedAt, AT);
});

test("regional events: partial pagination, drifting totals, duplicates, foreign or unverified regions and wrong types reject the whole block", async () => {
  const rows = many(150);
  const faults: [string, (n: number, p: TourPage) => TourPage][] = [
    ["short second page", (n, p) => n === 2 ? { ...p, rows: p.rows.slice(1) } : p],
    ["total drift", (n, p) => n === 2 ? { ...p, total: 151 } : p],
    ["wrong page number", (n, p) => n === 2 ? { ...p, pageNo: 1 } : p],
    ["duplicate across pages", (n, p) => n === 2 ? { ...p, rows: [rows[0], ...p.rows.slice(1)] } : p],
    ["other district row", (n, p) => n === 2 ? { ...p, rows: [{ ...p.rows[0], lDongSignguCd: "150" }, ...p.rows.slice(1)] } : p],
    ["unverified lDong pair", (n, p) => n === 1 ? { ...p, rows: [{ ...p.rows[0], lDongRegnCd: "99", lDongSignguCd: "999" }, ...p.rows.slice(1)] } : p],
    ["non-festival type", (n, p) => n === 1 ? { ...p, rows: [{ ...p.rows[0], contenttypeid: "12" }, ...p.rows.slice(1)] } : p],
    ["malformed contentid", (n, p) => n === 1 ? { ...p, rows: [{ ...p.rows[0], contentid: "abc" }, ...p.rows.slice(1)] } : p],
    ["over the page bound", (_, p) => ({ ...p, total: 1001 })],
  ];
  for (const [name, tamper] of faults) {
    const s = await schedule(paged(rows, tamper).call);
    assert.deepEqual([s.events.status, s.events.items, s.summary.events.count, s.summary.events.overlapping], ["unavailable", [], null, null], name);
    assert.equal(s.summary.holidays.status, "complete", `${name}: holidays stay independent`);
  }
  const zero = await schedule(paged([]).call);
  assert.deepEqual([zero.events.status, zero.summary.events.count, zero.summary.events.overlapping], ["empty", 0, 0], "confirmed zero registrations");
});

test("region-list festival search reuses the verified collector and keeps undated registrations", async () => {
  const t = paged([ev(5, null, null), ev(6, "20260326", "20260329")]);
  const r = await service(t.call).loadFestivals(parseFestivalSearch(new URLSearchParams("province=44&district=230&start=2026-03-01&end=2026-05-31"), "2026-09-23"));
  assert.deepEqual([r.current.mode, r.current.status, r.current.total, r.current.next], ["region-list", "complete", 2, null]);
  assert.deepEqual(r.current.items.map(i => [i.id, i.start, i.datesVerified]), [["current:44230:6", "2026-03-26", true], ["current:44230:5", null, false]]);
  const failed = await service(paged(many(2), (_, p) => ({ ...p, rows: p.rows.slice(1) })).call).loadFestivals(parseFestivalSearch(new URLSearchParams("q=&province=44&district=230"), "2026-09-23"));
  assert.deepEqual([failed.current.status, failed.current.items.length, failed.archive.status], ["unavailable", 0, "complete"]);
  assert.ok((await collectRegionEvents(paged([ev(7, "20260401", "20260402")]).call, nonsan, range)).items[0].datesKnown);
});

// ---- identity lookup strictness ----
const common = (extra: Record<string, unknown> = {}) => ({ contentid: "525292", contenttypeid: "15", title: "논산딸기축제", addr1: "논산", lDongRegnCd: "44", lDongSignguCd: "230", ...extra });
const intro = (extra: Record<string, unknown> = {}) => ({ contentid: "525292", contenttypeid: "15", eventstartdate: "20260326", eventenddate: "20260329", ...extra });
function detail(commonRows: Record<string, unknown>[], introRows: Record<string, unknown>[] | Error, commonTotal = commonRows.length): TourCall {
  return async op => {
    if (op === "detailCommon2") return { total: commonTotal, pageNo: 1, rows: commonRows, collectedAt: AT };
    if (op === "detailIntro2") { if (introRows instanceof Error) throw introRows; return { total: introRows.length, pageNo: 1, rows: introRows, collectedAt: AT }; }
    throw new Error("unexpected");
  };
}

test("dates are verified only from one intro row with explicit matching contentid and type 15", async () => {
  const verified = await lookupCurrent(detail([common()], [intro()]), "525292", nonsan);
  assert.deepEqual([verified.result, verified.festival?.datesVerified, verified.festival?.fields.start, verified.festival?.fields.end], ["verified", true, "2026-03-26", "2026-03-29"]);
  const weakIntros: [string, Record<string, unknown>[] | Error][] = [
    ["missing intro contentid", [intro({ contentid: undefined })]], ["other contentid", [intro({ contentid: "1" })]],
    ["missing intro type", [intro({ contenttypeid: undefined })]], ["other type", [intro({ contenttypeid: "12" })]],
    ["two intro rows", [intro(), intro()]], ["no intro row", []], ["invalid dates", [intro({ eventenddate: "20260301" })]], ["intro failure", new Error("down")]];
  for (const [name, rows] of weakIntros) {
    const r = await lookupCurrent(detail([common()], rows), "525292", nonsan);
    assert.deepEqual([r.result, r.festival?.datesVerified, r.festival?.fields.start, r.festival?.fields.end, r.festival?.fields.title], ["verified", false, null, null, "논산딸기축제"], name);
  }
});

test("identity lookup rejects ambiguous or mismatched common rows instead of choosing the first", async () => {
  const cases: [string, Record<string, unknown>[], number, string][] = [
    ["two rows", [common(), common({ contentid: "9" })], 2, "unavailable"], ["wrong id", [common({ contentid: "1" })], 1, "unavailable"],
    ["missing id", [common({ contentid: undefined })], 1, "unavailable"], ["missing type", [common({ contenttypeid: undefined })], 1, "unavailable"],
    ["rows without total", [], 3, "unavailable"], ["not found", [], 0, "not-found"], ["tourist site", [common({ contenttypeid: "12" })], 1, "not-festival"],
    ["other district", [common({ lDongSignguCd: "150" })], 1, "region-mismatch"], ["unverified pair", [common({ lDongRegnCd: "99", lDongSignguCd: "999" })], 1, "region-mismatch"]];
  for (const [name, rows, total, outcome] of cases) {
    const r = await service(detail(rows, [intro()], total)).loadFestivals(parseFestivalSearch(new URLSearchParams("id=current:44230:525292"), "2026-09-23"));
    assert.equal(r.current.status === "unavailable" ? "unavailable" : r.current.lookup, outcome, name);
    if (outcome !== "unavailable") assert.deepEqual([r.current.status, r.current.items], ["empty", []], name);
  }
});

test("keyword continuation must see the same source total; a changed listing asks the UI to restart", async () => {
  const kw = (total: number): TourCall => async (op, p) => ({ total, pageNo: Number(p.pageNo), collectedAt: AT,
    rows: Array.from({ length: Math.min(20, Math.max(0, total - (Number(p.pageNo) - 1) * 20)) }, (_, i) => ({ contentid: String(100 + i + Number(p.pageNo) * 100), contenttypeid: "15", title: `축제${i}`, lDongRegnCd: "44", lDongSignguCd: "230" })) });
  const first = await service(kw(45)).loadFestivals(parseFestivalSearch(new URLSearchParams("q=축제"), "2026-09-23"));
  assert.deepEqual([first.current.next, first.current.continuity], [{ page: 2, total: 45 }, null]);
  const same = await service(kw(45)).loadFestivals(parseFestivalSearch(new URLSearchParams("q=축제&page=2&total=45"), "2026-09-23"));
  assert.deepEqual([same.current.status, same.current.continuity, same.current.next], ["complete", "consistent", { page: 3, total: 45 }]);
  const changed = await service(kw(46)).loadFestivals(parseFestivalSearch(new URLSearchParams("q=축제&page=2&total=45"), "2026-09-23"));
  assert.deepEqual([changed.current.status, changed.current.continuity, changed.current.items, changed.current.next], ["unavailable", "changed", [], null]);
});

// ---- side effects ----
test("server data path never reaches the logging TourAPI client or Prisma, and every API route is GET-only", () => {
  const web = resolve(__dirname, "../.."), seen = new Set<string>(), bad: string[] = [];
  const resolveSpec = (from: string, s: string) => {
    const base = s.startsWith("@/") ? join(web, s.slice(2)) : s.startsWith(".") ? join(dirname(from), s) : null;
    if (!base || s.endsWith(".json")) return null;
    return [`${base}.ts`, `${base}.tsx`, join(base, "index.ts")].find(existsSync) ?? null;
  };
  const visit = (file: string) => {
    if (seen.has(file)) return; seen.add(file);
    const text = readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'])\/\/.*$/gm, "$1"); // code only, not comments
    if (/loggedGet|apiCallLog|prisma\.\w+\.(create|update|upsert|delete)/.test(text)) bad.push(file);
    for (const [, from, bare] of text.matchAll(/(?:import|export)[^"';]*?from\s+["']([^"']+)["']|import\s+["']([^"']+)["']/g)) {
      const s = from ?? bare ?? "";
      if (/kto\/client|lib\/db|\/db$|@prisma/.test(s)) bad.push(`${file}: ${s}`);
      const next = resolveSpec(file, s); if (next) visit(next);
    }
  };
  const routes = readdirSync(join(web, "app/api/existing")).map(d => join(web, "app/api/existing", d, "route.ts"));
  for (const r of routes) {
    visit(r);
    const exported = [...readFileSync(r, "utf8").matchAll(/export\s+(?:async\s+)?(?:function|const)\s+(\w+)/g)].map(m => m[1]).sort();
    assert.deepEqual(exported, ["GET", "dynamic"], r);
  }
  assert.equal(routes.length, 5);
  assert.deepEqual(bad, []);
  assert.ok([...seen].some(f => f.endsWith("existing/tour.ts")) && [...seen].some(f => f.endsWith("region/service.ts")));
});
