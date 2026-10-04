import test from "node:test";
import assert from "node:assert/strict";
import bundled from "../../data/region-history.json";
import { classificationCode, classificationLabel, FESTIVAL_TYPES, festivalType, isFestivalTypeCode } from "./festival-types";
import { InvalidRequest, festivalsKey, parseFestivalSearch } from "./request";
import { createExistingService } from "./server";
import { collectTypeEvents, EVENT_PAGE_SIZE, KEYWORD_PAGE_SIZE, type TourCall, type TourOperation, type TourPage } from "./tour";
import type { DataFreshness } from "./types";

const FRESH: DataFreshness = { mode: "archive-only", collectedAt: null, runtimeCollectedAt: null, refresh: { status: "not-configured", retryable: false } };
const AT = "2026-09-23T01:00:00.000Z", TODAY = "2026-09-23";
const SPECIALTY = "EV010300", CULTURE_TOURISM = "EV010100";
const row = (id: string, regn: string, signgu: string, start: string, type: string, extra: Record<string, unknown> = {}) =>
  ({ contentid: id, contenttypeid: "15", title: `축제${id}`, addr1: "주소", lDongRegnCd: regn, lDongSignguCd: signgu, eventstartdate: start, eventenddate: start, lclsSystm1: type.slice(0, 2), lclsSystm2: type.slice(0, 4), lclsSystm3: type, ...extra });
/** One fake operation serving `rows` in pages; `tamper` rewrites a page to simulate source faults. */
function paged(op: TourOperation, rows: Record<string, unknown>[], tamper: (page: number, p: TourPage) => TourPage = (_, p) => p) {
  const calls: [TourOperation, Record<string, string>][] = [];
  const call: TourCall = async (o, params) => {
    calls.push([o, params]);
    if (o !== op) throw new Error("unexpected");
    const n = Number(params.pageNo), size = Number(params.numOfRows);
    return tamper(n, { total: rows.length, pageNo: n, rows: rows.slice((n - 1) * size, n * size), collectedAt: AT });
  };
  return { call, calls };
}
const service = (tour: TourCall) => createExistingService({ archive: async () => ({ datasets: bundled, freshness: FRESH, runtime: [], runtimeRegions: [] }), regionList: async () => { throw new Error("resources not used"); }, tour, now: () => "2026-09-23T03:00:00.000Z" });
const search = (tour: TourCall, query: string) => service(tour).loadFestivals(parseFestivalSearch(new URLSearchParams(query), TODAY));
const typeFilter = (type: string) => ({ lclsSystm1: "EV", lclsSystm2: "EV01", lclsSystm3: type });

test("festival types: six registered festival kinds, other kinds keep their own names, nothing is guessed", () => {
  assert.deepEqual(FESTIVAL_TYPES.map(t => t.code), ["EV010100", "EV010200", "EV010300", "EV010400", "EV010500", "EV010600"]);
  assert.ok(isFestivalTypeCode(SPECIALTY));
  for (const bad of ["EV020100", "EV01", "ev010300", "", null, 10300]) assert.equal(isFestivalTypeCode(bad), false, String(bad));
  assert.deepEqual([festivalType(SPECIALTY)?.label, festivalType(SPECIALTY)?.hint], ["지역특산물축제", "먹거리"]);
  assert.deepEqual([classificationLabel(CULTURE_TOURISM), classificationLabel("EV030100"), classificationLabel("EV029999"), classificationLabel(null)], ["문화관광", "전시회", null, null]);
  assert.deepEqual([classificationCode("EV010300"), classificationCode("EV0103"), classificationCode(" EV010300"), classificationCode(123)], ["EV010300", null, null, null]);
});

test("request: a type is one festival code, part of the canonical key, and rejected otherwise", () => {
  const r = parseFestivalSearch(new URLSearchParams(`type=${SPECIALTY}`), TODAY);
  assert.deepEqual([r.type, r.q, r.province, r.start, r.end], [SPECIALTY, "", null, "2026-01-01", "2026-12-31"]);
  assert.notEqual(festivalsKey(r), festivalsKey(parseFestivalSearch(new URLSearchParams(""), TODAY)));
  for (const bad of ["EV020100", "food", "EV01030"]) assert.throws(() => parseFestivalSearch(new URLSearchParams(`type=${bad}`), TODAY), (e: unknown) => e instanceof InvalidRequest && e.field === "type", bad);
  assert.equal(parseFestivalSearch(new URLSearchParams("type="), TODAY).type, null);
});

test("type list: one type nationwide over the year, date order, unverified places omitted and counted, past records only through links", async () => {
  const rows = [row("901", "52", "750", "20260801", CULTURE_TOURISM), row("525292", "44", "230", "20260326", CULTURE_TOURISM), row("902", "99", "999", "20260101", CULTURE_TOURISM)];
  const t = paged("searchFestival2", rows), r = await search(t.call, `type=${CULTURE_TOURISM}`);
  assert.deepEqual(t.calls.map(c => c[1]), [{ eventStartDate: "20260101", eventEndDate: "20261231", numOfRows: String(EVENT_PAGE_SIZE), pageNo: "1", arrange: "A", ...typeFilter(CULTURE_TOURISM) }]);
  assert.deepEqual([r.current.mode, r.current.status, r.current.total, r.current.omitted, r.current.next], ["type-list", "complete", 3, 1, null]);
  assert.deepEqual(r.current.items.map(i => [i.id, i.type, i.start, i.datesVerified]), [["current:44230:525292", CULTURE_TOURISM, "2026-03-26", true], ["current:52750:901", CULTURE_TOURISM, "2026-08-01", true]]);
  // The reviewed link 525292 ↔ 논산딸기축제 brings that record; other recorded festivals have no registration of this type here.
  assert.deepEqual(r.archive.items.map(f => f.id), ["archive:nonsan-strawberry"]);
  const all = await search(paged("searchFestival2", []).call, "");
  assert.ok(all.archive.items.length > 1, "without a type every recorded festival stays a starting choice");
});

test("type list: a row of another type, a short page or a drifting total rejects the whole list; past records then wait too", async () => {
  const many = Array.from({ length: 150 }, (_, i) => row(String(1000 + i), "44", "230", "20260410", SPECIALTY));
  const faults: [string, Record<string, unknown>[], (n: number, p: TourPage) => TourPage][] = [
    ["other type", [row("1", "44", "230", "20260410", "EV010200")], (_, p) => p],
    ["missing type", [row("1", "44", "230", "20260410", SPECIALTY, { lclsSystm3: "" })], (_, p) => p],
    ["short second page", many, (n, p) => n === 2 ? { ...p, rows: p.rows.slice(1) } : p],
    ["total drift", many, (n, p) => n === 2 ? { ...p, total: 151 } : p],
    ["duplicate", many, (n, p) => n === 2 ? { ...p, rows: [many[0], ...p.rows.slice(1)] } : p],
    ["over the page bound", many, (_, p) => ({ ...p, total: 1001 })],
  ];
  for (const [name, rows, tamper] of faults) {
    const r = await search(paged("searchFestival2", rows, tamper).call, `type=${SPECIALTY}`);
    assert.deepEqual([r.current.status, r.current.mode, r.current.items, r.archive.items], ["unavailable", "type-list", [], []], name);
  }
  const two = paged("searchFestival2", many), listed = await collectTypeEvents(two.call, SPECIALTY, { start: "2026-01-01", end: "2026-12-31" });
  assert.deepEqual([two.calls.length, listed.items.length, listed.status], [2, 150, "complete"]);
  assert.equal((await collectTypeEvents(paged("searchFestival2", []).call, SPECIALTY, { start: "2026-01-01", end: "2026-12-31" })).status, "empty");
});

test("a type narrows the name search and the district list at the source, with the same strictness", async () => {
  const k = paged("searchKeyword2", [row("525292", "44", "230", "20260326", SPECIALTY)]);
  const byName = await search(k.call, `q=딸기&type=${SPECIALTY}`);
  assert.deepEqual(k.calls[0][1], { keyword: "딸기", contentTypeId: "15", numOfRows: String(KEYWORD_PAGE_SIZE), pageNo: "1", arrange: "A", ...typeFilter(SPECIALTY) });
  assert.deepEqual([byName.current.mode, byName.current.items.map(i => i.type)], ["keyword", [SPECIALTY]]);
  const wrong = await search(paged("searchKeyword2", [row("1", "44", "230", "20260326", "EV010600")]).call, `q=딸기&type=${SPECIALTY}`);
  assert.equal(wrong.current.status, "unavailable");

  const d = paged("searchFestival2", [row("525292", "44", "230", "20260326", SPECIALTY)]);
  const byDistrict = await search(d.call, `province=44&district=230&type=${SPECIALTY}`);
  assert.deepEqual(d.calls[0][1], { eventStartDate: "20260101", eventEndDate: "20261231", lDongRegnCd: "44", lDongSignguCd: "230", numOfRows: String(EVENT_PAGE_SIZE), pageNo: "1", arrange: "A", ...typeFilter(SPECIALTY) });
  assert.deepEqual([byDistrict.current.mode, byDistrict.current.items.map(i => i.type), byDistrict.archive.items.map(f => f.id)], ["region-list", [SPECIALTY], ["archive:nonsan-strawberry"]]);
  const none = await search(paged("searchFestival2", []).call, `province=44&district=230&type=${SPECIALTY}`);
  assert.deepEqual([none.current.status, none.archive.items], ["empty", []], "no registration of the type: the district's record is not shown as that type");

  // Without a type nothing changes: no classification parameters, and the row's own class is still reported.
  const plain = paged("searchFestival2", [row("525292", "44", "230", "20260326", "EV020700")]);
  const untyped = await search(plain.call, "province=44&district=230");
  assert.equal("lclsSystm3" in plain.calls[0][1], false);
  assert.deepEqual(untyped.current.items.map(i => i.type), ["EV020700"]);
});
