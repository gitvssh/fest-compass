import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import catalogue from "../../data/festival-editions.json";
import bundled from "../../data/region-history.json";
import expanded from "../../data/regional-history-expanded.json";
import calendar from "../../data/nonsan-calendar.json";
import { REGIONS, type Dataset } from "../region/model";
import type { Edition } from "../comparison/types";
import type { Query, ResourceResult } from "../region/types";
import { archiveCatalogue, currentFestival, currentId, IDENTITY_LINKS, mergeCurrentItems, parseFestivalId, regionByCode, regionRef, searchArchive, verifiedLdongRegion } from "./identity";
import { defaultYear, editionHistory, monthlyMeans, periodSummary, yearCoverage, type EditionInput } from "./history";
import { resourceRows } from "./resources";
import { holidaySummary, overlapDays, scheduleEvents, summarizeSchedule, type HolidayCalendar } from "./schedule";
import { historyKey, festivalsKey, InvalidRequest, parseFestivalSearch, parseHistory, parseResources, parseSchedule } from "./request";
import { defaultHostVisits } from "../datalab/host-visits";
import { defaultVisitorProfile } from "../datalab/visitor-profile";
import { createExistingService, loadHistory as productionHistory, regionObservations } from "./server";
import { createTourCall, KEYWORD_PAGE_SIZE, type TourCall, type TourOperation, type TourPage } from "./tour";
import type { CurrentFestival, DataFreshness, ResourceItem } from "./types";

const editions = catalogue.editions as Edition[], archive: Dataset[] = [...bundled, ...expanded.datasets], cal = calendar as HolidayCalendar;
// Root's independent recalculation (days, observed days, raw mean, peak date, peak value, chart days start-7..end+7).
const expected: Record<string, [number, number, number, string, number, number]> = {
  "nonsan-strawberry-2023": [5, 5, 68590.9, "2023-03-11", 120599.5, 19], "nonsan-strawberry-2024": [4, 4, 90412.875, "2024-03-23", 126164.5, 18],
  "nonsan-strawberry-2025": [4, 4, 85212.75, "2025-03-29", 113466.5, 18], "imsil-cheese-2023": [4, 4, 51570.75, "2023-10-08", 67791.5, 18],
  "imsil-cheese-2024": [4, 4, 51277.625, "2024-10-05", 64372, 18], "imsil-cheese-2025": [5, 5, 65880.5, "2025-10-08", 109833.5, 19],
  "baekje-gongju-2024": [9, 9, 95441.88888888889, "2024-09-28", 130382, 23] };
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));
const NOW = "2026-09-23T03:00:00.000Z";
const empty = (q: Query, status: ResourceResult["status"] = "empty"): ResourceResult => ({ status, message: "internal upstream text 600건", items: [], total: status === "unavailable" ? null : 0, pages: 1, collectedAt: "2026-09-23T02:00:00.000Z", source: "s" });
const noTour: TourCall = async () => { throw new Error("tour must not be called"); };
const FRESH: DataFreshness = { mode: "archive-only", collectedAt: "2026-09-10T09:15:37.552Z", runtimeCollectedAt: null, refresh: { status: "not-configured", retryable: false } };
const arch = (datasets: Dataset[]) => async () => ({ datasets, freshness: FRESH, runtime: [], runtimeRegions: [] });
// A single-page searchFestival2 answer for the verified collector (rows carry type 15 and the region's lDong pair).
const evRow = (id: string, title: string, start: string | null, end: string | null, regn = "44", signgu = "230") =>
  ({ contentid: id, contenttypeid: "15", title, addr1: "주소", lDongRegnCd: regn, lDongSignguCd: signgu, eventstartdate: start ?? "", eventenddate: end ?? "", modifiedtime: "20260901120000" });
const eventsTour = (rows: Record<string, unknown>[]): TourCall => async op => {
  if (op !== "searchFestival2") throw new Error("unexpected");
  return { total: rows.length, pageNo: 1, rows, collectedAt: "2026-09-23T01:30:00.000Z" };
};
function service(over: Partial<Parameters<typeof createExistingService>[0]> = {}) {
  return createExistingService({ archive: arch(archive), regionList: async q => empty(q), tour: noTour, now: () => NOW, today: () => "2026-09-23", ...over });
}
const req = (s: string) => new URLSearchParams(s);

test("history matches root's independent full-period expectations for every archive edition", async () => {
  const svc = service();
  for (const festival of ["nonsan-strawberry", "imsil-cheese", "baekje-gongju"]) {
    const ids = editions.filter(e => e.festivalId === festival).map(e => e.id).slice(0, 3);
    const res = await svc.loadHistory(parseHistory(req(`festival=${festival}&editions=${ids.join(",")}`)));
    for (const h of res.editions) {
      const x = expected[h.editionId]; assert.ok(x, h.editionId);
      assert.equal(h.state, "available"); assert.equal(h.summary.status, "available");
      if (h.summary.status !== "available") continue;
      assert.deepEqual([h.days, h.summary.denominator, h.summary.mean, h.summary.peak.dates[0], h.summary.peak.value, h.points.length], x);
    }
  }
  assert.equal(Object.keys(expected).length, 7);
  const nonsan = await svc.loadHistory(parseHistory(req("festival=nonsan-strawberry")));
  assert.deepEqual(nonsan.editions.map(e => e.editionId), ["nonsan-strawberry-2025", "nonsan-strawberry-2024"], "default = latest two comparable");
  assert.equal(nonsan.retrievedAt, NOW);
  assert.ok(nonsan.editions.every(e => e.source.visits?.collectedAt && e.source.visits.collectedAt !== NOW), "source time is separate from response time");
});

test("custom or padded chart ranges never change the original festival denominator", async () => {
  const svc = service(), base = await svc.loadHistory(parseHistory(req("festival=nonsan-strawberry&editions=nonsan-strawberry-2023")));
  const trimmed = await svc.loadHistory(parseHistory(req("festival=nonsan-strawberry&editions=nonsan-strawberry-2023&windows=nonsan-strawberry-2023:2023-03-10:2023-03-11")));
  const outside = await svc.loadHistory(parseHistory(req("festival=nonsan-strawberry&editions=nonsan-strawberry-2023&windows=nonsan-strawberry-2023:2023-06-01:2023-06-30")));
  const padded = await svc.loadHistory(parseHistory(req("festival=nonsan-strawberry&editions=nonsan-strawberry-2023&before=30&after=0")));
  for (const r of [trimmed, outside, padded]) assert.deepEqual(r.editions[0].summary, base.editions[0].summary);
  assert.deepEqual([trimmed.editions[0].points.length, trimmed.editions[0].windowSource, outside.editions[0].points.length, padded.editions[0].points.length], [2, "custom", 30, 35]);
  assert.equal(outside.editions[0].points.some(p => p.inFestival), false);
  assert.notEqual(historyKey(trimmed.request), historyKey(base.request));
  // Missing padding days never alter the period summary either.
  const holed = archive.map(d => ({ ...d, points: d.points.map(p => p.date === "2023-03-01" ? { ...p, value: null, quality: "missing" } : p) }));
  const gap = await service({ archive: arch(holed) }).loadHistory(parseHistory(req("festival=nonsan-strawberry&editions=nonsan-strawberry-2023")));
  assert.equal(gap.editions[0].points[0].value, null); assert.deepEqual(gap.editions[0].summary, base.editions[0].summary);
  await assert.rejects(service().loadHistory(parseHistory(req("festival=nonsan-strawberry&windows=imsil-cheese-2023:2023-01-01:2023-01-02"))), InvalidRequest);
});

test("newest explicit missing row wins over an older value and keeps its source time", async () => {
  const newer: Dataset = { snapshotId: "runtime-x", collectedAt: "2026-09-20T00:00:00.000Z", source: "s", region: { code: "44230", name: "논산시" },
    points: [{ date: "2025-03-28", value: null, quality: "missing" }, { date: "2025-03-29", value: 999, quality: "invalid" }] };
  const svc = service({ archive: arch([...archive, newer]) });
  const h = (await svc.loadHistory(parseHistory(req("festival=nonsan-strawberry&editions=nonsan-strawberry-2025")))).editions[0];
  assert.deepEqual(h.summary, { status: "incomplete", denominator: 4, observedDays: 2, missingDates: ["2025-03-28", "2025-03-29"] });
  assert.deepEqual(h.points.filter(p => p.value === null).map(p => [p.date, p.collectedAt]), [["2025-03-28", newer.collectedAt], ["2025-03-29", newer.collectedAt]]);
  const march = (await svc.loadMonthly({ province: "44", district: "230", year: 2025 })).months[2];
  assert.deepEqual([march.status, march.observedDays, march.missingDays, march.mean], ["partial", 29, 2, null]);
  assert.equal(regionObservations([...archive, newer], "44", "230", { start: "2025-03-28", end: "2025-03-28" })[0].value, null);
  // Older rows collected later than a newer snapshot? Order is by collectedAt, not array position.
  assert.equal(regionObservations([newer, ...archive], "44", "230", { start: "2025-03-28", end: "2025-03-28" })[0].value, null);
});

test("incompatible or cancelled editions are withheld individually while others stay usable", async () => {
  const bad = clone(editions); bad.find(e => e.id === "nonsan-strawberry-2024")!.visits!.method = "KTO-other-method";
  const res = await service({ editions: bad }).loadHistory(parseHistory(req("festival=nonsan-strawberry&editions=nonsan-strawberry-2025,nonsan-strawberry-2024")));
  const [ok, withheld] = res.editions;
  assert.equal(ok.state, "available");
  assert.deepEqual([withheld.state, withheld.points.length, withheld.window, withheld.comparable, withheld.summary.status], ["incompatible", 0, null, false, "incompatible"]);
  assert.ok(withheld.withheld?.message);
  assert.equal(res.sharedYMax, Math.max(...ok.points.map(p => p.value ?? 0)), "incompatible values stay off the shared axis");
  // A definition mismatch also removes the edition from the default comparison.
  const defaults = (await service({ editions: bad }).loadFestivals(parseFestivalSearch(req("id=archive:nonsan-strawberry"), "2026-09-23"))).archive.items[0];
  assert.deepEqual(defaults.defaultEditionIds, ["nonsan-strawberry-2025", "nonsan-strawberry-2023"]);
  assert.equal(defaults.editions.find(e => e.editionId === "nonsan-strawberry-2024")!.comparable, false);
  const cancelled = clone(editions); cancelled.find(e => e.id === "nonsan-strawberry-2025")!.status = "취소";
  const svc = service({ editions: cancelled });
  const c = (await svc.loadHistory(parseHistory(req("festival=nonsan-strawberry&editions=nonsan-strawberry-2025")))).editions[0];
  assert.deepEqual([c.state, c.summary.status, c.points.length, c.points.some(p => p.inFestival), c.comparable], ["cancelled", "cancelled", 18, false, false]);
  const f = (await svc.loadFestivals(parseFestivalSearch(req("id=archive:nonsan-strawberry"), "2026-09-23"))).archive.items[0];
  assert.deepEqual(f.defaultEditionIds, ["nonsan-strawberry-2024", "nonsan-strawberry-2023"]);
  assert.equal(f.editions.find(e => e.editionId === "nonsan-strawberry-2025")!.cancelled, true);
});

test("undated Wonju 2022 stays a searchable archive target with honest no-dates history and working region queries", async () => {
  const svc = service({ regionList: async q => ({ ...empty(q, "complete"), total: 1, items: [{ id: "7", title: "원주 관광지", address: "원주", longitude: null, latitude: null, start: null, end: null, modifiedAt: null }] }),
    tour: eventsTour([evRow("8", "원주 행사", null, null, "51", "130")]) });
  const all = await svc.loadFestivals(parseFestivalSearch(req(""), "2026-09-23"));
  const wonju = all.archive.items.find(f => f.id === "archive:wonju-peach")!;
  assert.deepEqual([wonju.hasDates, wonju.hasHistory, wonju.defaultEditionIds, wonju.region.code], [false, false, [], "51130"]);
  assert.equal(all.current.status, "not-requested");
  assert.deepEqual((await svc.loadFestivals(parseFestivalSearch(req("id=archive:wonju-peach"), "2026-09-23"))).archive.items.map(f => f.id), ["archive:wonju-peach"]);
  assert.deepEqual(searchArchive(all.archive.items, "복숭아", null).map(f => f.id), ["archive:wonju-peach"]);
  const h = await svc.loadHistory(parseHistory(req("festival=wonju-peach")));
  assert.deepEqual(h.editions.map(e => [e.state, e.withheld?.reason, e.points.length, e.summary.status]), [["no-dates", "no-dates", 0, "no-dates"]]);
  assert.equal(h.sharedYMax, null);
  const r = await svc.loadResources(parseResources(req("province=51&district=130&types=12")));
  assert.deepEqual([r.byType[0].status, r.byType[0].items[0].point], ["complete", null], "missing coordinates stay listed");
  const s = await svc.loadSchedule(parseSchedule(req("province=51&district=130&start=2026-07-01&end=2026-07-31")));
  assert.deepEqual([s.region.code, s.events.status, s.summary.events.count, s.summary.events.overlapping, s.summary.events.undated], ["51130", "complete", 1, 0, 1]);
});

// ---- national keyword search and current identity verification (fake TourAPI, no live calls) ----
const row = (id: string, title: string, regn: string, signgu: string, extra: Record<string, unknown> = {}) => ({ contentid: id, contenttypeid: "15", title, addr1: "주소", mapx: "127.1", mapy: "36.2", lDongRegnCd: regn, lDongSignguCd: signgu, modifiedtime: "20260901120000", ...extra });
function fakeTour(pages: Partial<Record<TourOperation, (p: Record<string, string>) => TourPage | Error>>) {
  const calls: [TourOperation, Record<string, string>][] = [];
  const call: TourCall = async (op, params) => { calls.push([op, params]); const r = pages[op]?.(params); if (!r || r instanceof Error) throw r ?? new Error("x"); return r; };
  return { call, calls };
}
const page = (total: number, pageNo: number, rows: Record<string, unknown>[]): TourPage => ({ total, pageNo, rows, collectedAt: "2026-09-23T01:00:00.000Z" });

test("national keyword search: optional region, verified lDong only, dates null, continuation and page failures", async () => {
  const rows = [row("525292", "논산딸기축제", "44", "230"), row("525292", "논산딸기축제", "44", "230"), row("1", "세종 축제", "36110", "36110"),
    row("2", "5자리 표기 축제", "44", "44230"), row("3", "모호한 지역", "99", "999"), ...Array.from({ length: 15 }, (_, i) => row(String(100 + i), `축제${i}`, "44", "150"))];
  const tour = fakeTour({ searchKeyword2: p => p.pageNo === "1" ? page(45, 1, rows) : p.pageNo === "2" ? page(45, 2, rows.slice(0, 19)) : page(45, 3, rows.slice(0, 5)) });
  const svc = service({ tour: tour.call });
  const first = await svc.loadFestivals(parseFestivalSearch(req("q=딸기"), "2026-09-23"));
  const c = first.current;
  assert.deepEqual([c.mode, c.status, c.page, c.next, c.total, c.omitted, c.continuity], ["keyword", "complete", 1, { page: 2, total: 45 }, 45, 1, null]);
  assert.equal(c.items.filter(i => i.contentId === "525292").length, 1, "identical ids collapse");
  assert.ok(c.items.every(i => i.start === null && i.end === null && !i.datesVerified && i.linkedArchiveId === null));
  assert.deepEqual(c.items.slice(0, 3).map(i => i.id), ["current:44230:525292", "current:3611036110:1", "current:44230:2"]);
  assert.deepEqual(first.archive.items.map(f => f.id), ["archive:nonsan-strawberry"], "archive stays independent of current ids with the same name");
  assert.deepEqual(tour.calls[0][1], { keyword: "딸기", contentTypeId: "15", numOfRows: String(KEYWORD_PAGE_SIZE), pageNo: "1", arrange: "A" });
  const short = await svc.loadFestivals(parseFestivalSearch(req("q=딸기&page=2"), "2026-09-23"));
  assert.deepEqual([short.current.status, short.current.error, short.current.items, short.archive.status], ["unavailable", { code: "source-unavailable", retryable: true }, [], "complete"]);
  const last = await svc.loadFestivals(parseFestivalSearch(req("q=딸기&page=3"), "2026-09-23"));
  assert.deepEqual([last.current.status, last.current.next], ["complete", null]);
  assert.notEqual(festivalsKey(first.request), festivalsKey(last.request), "page is part of the key");
  const wrongPage = await service({ tour: fakeTour({ searchKeyword2: () => page(1, 9, [rows[0]]) }).call }).loadFestivals(parseFestivalSearch(req("q=x"), "2026-09-23"));
  assert.equal(wrongPage.current.status, "unavailable");
  const regional = fakeTour({ searchKeyword2: () => page(2, 1, [rows[0], row("9", "다른 지역", "44", "150")]) });
  const mismatch = await service({ tour: regional.call }).loadFestivals(parseFestivalSearch(req("q=축제&province=44&district=230"), "2026-09-23"));
  assert.equal(mismatch.current.status, "unavailable", "a row outside the requested region fails the page");
  assert.deepEqual([regional.calls[0][1].lDongRegnCd, regional.calls[0][1].lDongSignguCd], ["44", "230"]);
  const failing = await service({ tour: async () => { throw new Error("upstream secret text"); } }).loadFestivals(parseFestivalSearch(req("q=딸기"), "2026-09-23"));
  assert.deepEqual([failing.current.status, failing.archive.items.length], ["unavailable", 1]);
  assert.ok(!JSON.stringify(failing).includes("secret"));
  const merged = mergeCurrentItems(c.items, [c.items[0], { ...c.items[0], id: "current:44230:777", contentId: "777" }]);
  assert.equal(merged.length, c.items.length + 1);
});

test("current id restore is verified server-side and never trusts URL metadata", async () => {
  const common = (r: Record<string, unknown>) => () => page(1, 1, [r]);
  const ok = fakeTour({ detailCommon2: common(row("525292", "논산딸기축제", "44", "230")), detailIntro2: () => page(1, 1, [{ contentid: "525292", contenttypeid: "15", eventstartdate: "20260326", eventenddate: "20260329" }]) });
  const verified = await service({ tour: ok.call }).loadFestivals(parseFestivalSearch(req("id=current:44230:525292"), "2026-09-23"));
  assert.deepEqual([verified.current.mode, verified.current.lookup, verified.current.status, verified.archive.status], ["lookup", "verified", "complete", "not-requested"]);
  assert.deepEqual([verified.current.items[0].name, verified.current.items[0].start, verified.current.items[0].end, verified.current.items[0].datesVerified], ["논산딸기축제", "2026-03-26", "2026-03-29", true]);
  assert.deepEqual(ok.calls.map(c => c[0]), ["detailCommon2", "detailIntro2"]);
  const introFails = fakeTour({ detailCommon2: common(row("525292", "논산딸기축제", "44", "230")), detailIntro2: () => new Error("down") });
  const noDates = (await service({ tour: introFails.call }).loadFestivals(parseFestivalSearch(req("id=current:44230:525292"), "2026-09-23"))).current;
  assert.deepEqual([noDates.lookup, noDates.items[0].start, noDates.items[0].datesVerified], ["verified", null, false]);
  const cases: [Record<string, unknown> | null, string][] = [[row("525292", "논산딸기축제", "44", "150"), "region-mismatch"], [row("525292", "관광지", "44", "230", { contenttypeid: "12" }), "not-festival"], [null, "not-found"], [row("525292", "x", "99", "999"), "region-mismatch"]];
  for (const [r, result] of cases) {
    const t = fakeTour({ detailCommon2: () => r ? page(1, 1, [r]) : page(0, 1, []) });
    const cur = (await service({ tour: t.call }).loadFestivals(parseFestivalSearch(req("id=current:44230:525292"), "2026-09-23"))).current;
    assert.deepEqual([cur.status, cur.lookup, cur.items], ["empty", result, []]);
  }
  const down = (await service({ tour: fakeTour({}).call }).loadFestivals(parseFestivalSearch(req("id=current:44230:525292"), "2026-09-23"))).current;
  assert.deepEqual([down.status, down.lookup, down.error?.retryable], ["unavailable", null, true]);
});

test("region ids round-trip for every verified region, including Sejong 36110/36110", () => {
  for (const r of REGIONS) {
    const ref = regionRef(r.provinceCode, r.districtCode)!, parsed = parseFestivalId(currentId(ref, "42"));
    assert.deepEqual(parsed, { source: "current", province: r.provinceCode, district: r.districtCode, contentId: "42" });
    assert.equal(regionByCode(ref.code)?.code, ref.code);
  }
  assert.equal(parseFestivalId("current:3611036110:5")?.source, "current");
  for (const bad of ["current:99999:1", "current:36110:1", "current:4423:1", "current:44230:", "kto-1", "archive:Bad Id"]) assert.equal(parseFestivalId(bad), null, bad);
  assert.equal(verifiedLdongRegion("36110", "36110")?.districtName, "세종특별자치시");
  assert.equal(verifiedLdongRegion("44", "44230")?.code, "44230");
  assert.equal(verifiedLdongRegion("44", "999"), null);
  assert.equal(verifiedLdongRegion("", "230"), null);
});

test("read-only TourAPI adapter: no key, caching, bounded calls and no key/upstream text in errors", async () => {
  let fetches = 0; const secret = "SECRET-KEY-VALUE";
  const body = (o: unknown) => new Response(JSON.stringify(o), { status: 200 });
  const good = { response: { header: { resultCode: "0000", resultMsg: "OK" }, body: { totalCount: 1, pageNo: 1, numOfRows: 20, items: { item: [row("1", "a", "44", "230")] } } } };
  const call = createTourCall({ key: () => secret, fetch: (async (url: URL) => { fetches++; assert.ok(String(url).includes("searchKeyword2")); return body(good); }) as unknown as typeof fetch, maxCalls: 2 });
  const p = { keyword: "a", pageNo: "1" };
  assert.equal((await call("searchKeyword2", p)).rows.length, 1);
  await call("searchKeyword2", p); assert.equal(fetches, 1, "cached");
  await call("searchKeyword2", { keyword: "b", pageNo: "1" });
  await assert.rejects(call("searchKeyword2", { keyword: "c", pageNo: "1" }), (e: Error) => e.message === "tour-unavailable", "call budget bounded");
  await assert.rejects(createTourCall({ key: () => undefined })("detailCommon2", { contentId: "1" }), (e: Error) => e.message === "tour-unavailable");
  const leaky = createTourCall({ key: () => secret, fetch: (async () => { throw new Error(`boom ${secret}`); }) as unknown as typeof fetch });
  await assert.rejects(leaky("detailCommon2", { contentId: "1" }), (e: Error) => !e.message.includes(secret));
  const gateway = createTourCall({ key: () => secret, fetch: (async () => body({ response: { header: { resultCode: "30", resultMsg: `bad ${secret}` } } })) as unknown as typeof fetch });
  await assert.rejects(gateway("detailCommon2", { contentId: "1" }), (e: Error) => e.message === "tour-unavailable");
});

test("public responses never carry hashes, snapshot ids, raw notes or upstream messages", async () => {
  const svc = service({ regionList: async q => ({ ...empty(q, "unavailable") }), tour: async () => { throw new Error("upstream 600건 /var/forecast/x.json"); } });
  const bodies = [await svc.loadHistory(parseHistory(req("festival=nonsan-strawberry"))), await svc.loadMonthly({ province: "44", district: "230", year: null }),
    await svc.loadFestivals(parseFestivalSearch(req("q=딸기&province=44&district=230"), "2026-09-23")), await svc.loadResources(parseResources(req("province=44&district=230"))),
    await svc.loadSchedule(parseSchedule(req("province=44&district=230&start=2026-10-01&end=2026-10-31")))];
  for (const b of bodies) {
    const text = JSON.stringify(b);
    for (const leak of ["sha256", "snapshotId", "sourceSha256", "contentHash", "\"note\"", "600건", "upstream", "sourcePages", "de14d21e"]) assert.ok(!text.includes(leak), `${leak} leaked`);
  }
});

test("resource types fail independently and distances need a chosen center", async () => {
  const svc = service({ regionList: async q => q.kind === "14" ? empty(q, "unavailable") : { ...empty(q, "complete"), total: 2, items: [
    { id: "1", title: "나", address: "a", longitude: 127.18, latitude: 36.19, start: null, end: null, modifiedAt: null },
    { id: "2", title: "가", address: "b", longitude: null, latitude: null, start: null, end: null, modifiedAt: null }] } });
  const r = await svc.loadResources(parseResources(req("province=44&district=230")));
  assert.deepEqual(r.byType.map(b => [b.kind, b.status, b.items.length]), [["12", "complete", 2], ["14", "unavailable", 0]]);
  const items: ResourceItem[] = r.byType[0].items;
  const plain = resourceRows(items, null, { sort: "distance", radiusKm: 5 });
  assert.deepEqual([plain.rows.map(x => x.item.id), plain.counts], [["2", "1"], { returned: 2, withCoordinates: 1, withinRadius: null }]);
  const near = resourceRows(items, { latitude: 36.19, longitude: 127.18 }, { sort: "distance", radiusKm: 5 });
  assert.deepEqual(near.rows.map(x => [x.item.id, x.withinRadius]), [["1", true], ["2", null]]);
  assert.deepEqual(near.counts, { returned: 2, withCoordinates: 1, withinRadius: 1 });
});

test("schedule: holiday unknown vs none, cancelled/undated events never count as confirmed overlaps, full range only", async () => {
  assert.deepEqual([holidaySummary({ start: "2026-10-01", end: "2026-10-10" }, cal).holidayDays, holidaySummary({ start: "2026-06-08", end: "2026-06-12" }, cal).holidayDays], [3, 0]);
  const partial = holidaySummary({ start: "2027-01-25", end: "2027-03-05" }, cal);
  assert.deepEqual([partial.status, partial.holidayDays, partial.uncovered], ["partial", null, [{ start: "2027-02-02", end: "2027-03-05" }]]);
  assert.equal(holidaySummary({ start: "2028-05-01", end: "2028-05-05" }, cal).status, "unknown");
  const range = { start: "2026-12-28", end: "2027-01-03" };
  const r = (id: string, start: string | null, end: string | null, cancelled?: boolean) => ({ id, title: id, address: "", longitude: null, latitude: null, start, end, modifiedAt: null, cancelled });
  const events = scheduleEvents([r("a", "2026-12-20", "2026-12-29"), r("b", "2027-01-01", "2027-01-05", true), r("c", null, null), r("d", "2027-01-03", "2027-01-03")], range);
  assert.deepEqual(events.map(e => [e.id, e.scheduleStatus, e.datesKnown, e.overlapDays]), [["a", "registered", true, 2], ["b", "cancelled", true, 3], ["d", "registered", true, 1], ["c", "registered", false, null]]);
  const full = summarizeSchedule(range, cal, { status: "complete", range, items: events });
  assert.deepEqual([full.totalDays, full.weekendDays, full.events], [7, 2, { status: "complete", count: 4, overlapping: 2, cancelled: 1, undated: 1 }]);
  const monthOnly = summarizeSchedule(range, cal, { status: "complete", range: { start: "2026-12-01", end: "2026-12-31" }, items: events });
  assert.deepEqual([monthOnly.events.count, monthOnly.events.overlapping], [null, null]);
  assert.equal(overlapDays({ start: "2027-02-01", end: "2027-02-02" }, range), 0);
  const svc = service({ tour: eventsTour([evRow("91", "연말 행사", "20261231", "20270101")]) });
  const s = await svc.loadSchedule(parseSchedule(req("province=44&district=230&start=2026-12-28&end=2027-01-03")));
  assert.deepEqual([s.summary.events.count, s.summary.events.overlapping, s.events.items[0].scheduleStatus], [1, 1, "registered"]);
  const failed = await service({ tour: async () => { throw new Error("x"); } }).loadSchedule(parseSchedule(req("province=44&district=230&start=2026-12-28&end=2027-01-03")));
  assert.deepEqual([failed.events.status, failed.summary.events.count, failed.summary.holidays.status], ["unavailable", null, "complete"], "holidays stay independent of an event failure");
});

test("pure period, monthly and catalogue rules", () => {
  const v = new Map<string, number | null>([["2025-03-01", 0], ["2025-03-02", 10], ["2025-03-03", 20]]);
  assert.deepEqual(periodSummary(v, "2025-03-01", "2025-03-03"), { status: "available", numerator: 30, denominator: 3, mean: 10, rounded: 10, peak: { value: 20, dates: ["2025-03-03"] } });
  v.set("2025-03-02", null);
  assert.deepEqual(periodSummary(v, "2025-03-01", "2025-03-03"), { status: "incomplete", denominator: 3, observedDays: 2, missingDates: ["2025-03-02"] });
  const input: EditionInput = { editionId: "e", year: 2025, start: "2025-03-01", end: "2025-03-03", status: "확인", source: { title: "t", url: "u", checkedAt: null, publishedAt: null }, regionCode: "44230", linked: null };
  assert.equal(editionHistory(input, []).state, "no-history");
  assert.equal(editionHistory({ ...input, start: null, status: "취소" }, []).state, "cancelled");
  const obs = regionObservations(archive, "44", "230", { start: "2025-01-01", end: "2025-12-31" });
  assert.deepEqual(monthlyMeans(obs, 2025).map(m => m.rounded), [43616, 42853, 51620, 47321, 53956, 47779, 44142, 49821, 45212, 55910, 48046, 42882]);
  const holed = monthlyMeans(obs.map(o => o.date === "2025-02-10" ? { ...o, value: null } : o.date === "2025-02-11" ? { ...o, value: 0 } : o), 2025)[1];
  assert.deepEqual([holed.status, holed.observedDays, holed.missingDays, holed.zeroDays, holed.mean], ["partial", 27, 1, 1, null]);
  const years = yearCoverage(regionObservations(archive, "44", "230", { start: "2025-01-01", end: "2026-12-31" }));
  assert.deepEqual([years.map(y => [y.year, y.complete]), defaultYear(years)], [[[2025, true], [2026, false]], 2025]);
  const cat = archiveCatalogue(editions, () => true);
  assert.deepEqual(cat.map(f => f.festivalId).sort(), ["baekje-gongju", "imsil-cheese", "nonsan-strawberry", "wonju-peach"]);
  assert.equal(IDENTITY_LINKS.length, 0);
  const cur: CurrentFestival = currentFestival(regionRef("44", "230")!, { id: "9", title: "논산딸기축제", address: "", latitude: 36.2, longitude: 127.1, start: "2026-03-26", end: "2026-03-29", modifiedAt: null }, false, null);
  assert.deepEqual([cur.start, cur.linkedArchiveId, cur.provenance.collectedAt], [null, null, null], "unverified dates are not published");
});

test("request parsing: pages, windows, regions and canonical keys", () => {
  assert.throws(() => parseSchedule(req("province=44&district=999&start=2026-01-01&end=2026-01-02")), (e: unknown) => e instanceof InvalidRequest && e.field === "region");
  assert.deepEqual(parseSchedule(req("province=36110&district=36110&start=2026-12-01&end=2027-02-28")).province, "36110");
  assert.throws(() => parseSchedule(req("province=44&district=230&start=2026-01-01&end=2027-01-03")), InvalidRequest);
  assert.throws(() => parseHistory(req("festival=a&editions=a,b,c,d")), InvalidRequest);
  assert.throws(() => parseHistory(req("festival=a&windows=a:2025-01-02:2025-01-01")), InvalidRequest);
  assert.throws(() => parseHistory(req("festival=a&windows=a:2025-01-01:2025-06-01")), InvalidRequest);
  assert.throws(() => parseHistory(req("festival=a&editions=x&windows=y:2025-01-01:2025-01-02")), InvalidRequest);
  const h = parseHistory(req("festival=archive:a&editions=x,y&windows=y:2025-01-01:2025-01-02,x:2025-02-01:2025-02-02"));
  assert.equal(historyKey(h), historyKey(parseHistory(req("festival=a&editions=x,y&windows=x:2025-02-01:2025-02-02,y:2025-01-01:2025-01-02"))));
  const s = parseFestivalSearch(req("q=  논산  딸기 &page=2"), "2026-09-23");
  assert.deepEqual(s, { q: "논산 딸기", province: null, district: null, start: "2026-01-01", end: "2026-12-31", page: 2, total: null, id: null });
  assert.equal(parseFestivalSearch(req("q=a&page=2&total=45"), "2026-09-23").total, 45);
  assert.notEqual(festivalsKey(parseFestivalSearch(req("q=a&page=2&total=45"), "2026-09-23")), festivalsKey(parseFestivalSearch(req("q=a&page=2"), "2026-09-23")));
  for (const bad of ["page=0", "page=51", "page=x", "province=44", "id=kto-1", "total=-1", "total=x"]) assert.throws(() => parseFestivalSearch(req(bad), "2026-09-23"), InvalidRequest, bad);
  assert.equal(parseFestivalSearch(req("id=current:3611036110:1"), "2026-09-23").id, "current:3611036110:1");
  assert.deepEqual(parseResources(req("province=44&district=230&types=14")).types, ["14"]);
  assert.throws(() => parseResources(req("province=44&district=230&types=")), InvalidRequest);
});

test("client-safe modules never reach server-only, node built-ins, DB, forecast or kto history code", () => {
  const root = resolve(__dirname), seen = new Set<string>(), banned: string[] = [];
  const visit = (file: string) => {
    if (seen.has(file)) return; seen.add(file);
    for (const [, from, bare] of readFileSync(file, "utf8").matchAll(/(?:import|export)[^"';]*?from\s+["']([^"']+)["']|import\s+["']([^"']+)["']/g)) {
      const s = from ?? bare ?? ""; if (!s) continue;
      if (s === "server-only" || s.startsWith("node:") || /forecast|kto\/|\/db|prisma/.test(s)) banned.push(`${file}: ${s}`);
      if (s.startsWith(".") && !s.endsWith(".json")) visit(join(dirname(file), `${s}.ts`));
    }
  };
  for (const m of ["types", "identity", "history", "resources", "schedule", "request"]) visit(join(root, `${m}.ts`));
  assert.deepEqual(banned, []);
  assert.ok(seen.size >= 6);
});

test("host-area visit mix: selected verified editions only, independent of chart windows and district daily coverage", async () => {
  const svc = service({ hostVisits: defaultHostVisits });
  const two = await svc.loadHistory(parseHistory(req("festival=imsil-cheese&editions=imsil-cheese-2023,imsil-cheese-2025")));
  assert.deepEqual(two.hostVisits?.editions.map(e => e.editionId), two.editions.map(e => e.editionId));
  assert.deepEqual(two.hostVisits?.editions.map(e => [e.editionId, e.days, e.outside]), [["imsil-cheese-2025", 5, 127842], ["imsil-cheese-2023", 4, 79355]]);
  const windowed = await svc.loadHistory(parseHistory(req("festival=imsil-cheese&editions=imsil-cheese-2023,imsil-cheese-2025&windows=imsil-cheese-2025:2025-10-09:2025-10-10&before=30")));
  assert.deepEqual(windowed.hostVisits, two.hostVisits, "chart range never changes the festival-period block");
  const noDaily = await service({ hostVisits: defaultHostVisits, archive: arch(archive.filter(d => d.region.code !== "52750")) }).loadHistory(parseHistory(req("festival=imsil-cheese&editions=imsil-cheese-2025")));
  assert.notEqual(noDaily.editions[0].state, "available");
  assert.deepEqual(noDaily.hostVisits?.editions.map(e => e.editionId), ["imsil-cheese-2025"], "missing district daily data keeps the verified festival-period block");
  assert.equal((await svc.loadHistory(parseHistory(req("festival=nonsan-strawberry")))).hostVisits, null);
  assert.equal((await service().loadHistory(parseHistory(req("festival=imsil-cheese")))).hostVisits, null, "no resolver injected -> null");
  const text = JSON.stringify(two);
  for (const leak of ["sha256", "docs/research", "commit", "\"raw\"", "evidence", "github.com"]) assert.ok(!text.includes(leak), `${leak} leaked`);
});

test("a failing host-visits resolver omits only its block and logs a fixed category", async () => {
  const logged: unknown[][] = [], original = console.error;
  console.error = (...args: unknown[]) => { logged.push(args); };
  try {
    const r = await service({ hostVisits: () => { throw new Error("secret /var/data path"); } }).loadHistory(parseHistory(req("festival=imsil-cheese&editions=imsil-cheese-2025")));
    assert.equal(r.hostVisits, null);
    assert.equal(r.editions[0].editionId, "imsil-cheese-2025");
  } finally { console.error = original; }
  assert.deepEqual(logged, [["datalab-host-visits: resolver-failed"]]);
});

test("production history wiring uses the verified host-area resolver", async () => {
  const r = await productionHistory(parseHistory(req("festival=imsil-cheese&editions=imsil-cheese-2025,imsil-cheese-2024")));
  assert.deepEqual(r.hostVisits?.editions.map(e => e.editionId), ["imsil-cheese-2025", "imsil-cheese-2024"]);
  assert.equal(r.hostVisits?.source.url, "https://datalab.visitkorea.or.kr/datalab/portal/fes/getFesDataForm.do");
  assert.deepEqual(r.visitorProfile?.editions.map(e => e.editionId), ["imsil-cheese-2024", "imsil-cheese-2025"], "production injects the verified profiles, oldest first");
  assert.deepEqual(r.visitorProfile?.editions.map(e => e.source.url), Array(2).fill("https://datalab.visitkorea.or.kr/datalab/portal/fes/getFesDataForm.do"));
});

test("visitor profile: only selected reviewed editions, one or two ascending, independent of chart windows and daily coverage", async () => {
  const svc = service({ visitorProfile: defaultVisitorProfile });
  const profiles = async (q: string) => (await svc.loadHistory(parseHistory(req(q)))).visitorProfile?.editions.map(e => e.editionId) ?? null;
  const both = await svc.loadHistory(parseHistory(req("festival=imsil-cheese&editions=imsil-cheese-2025,imsil-cheese-2023")));
  assert.deepEqual(both.visitorProfile?.editions.map(e => e.editionId), ["imsil-cheese-2023", "imsil-cheese-2025"], "ascending, whatever the chart order");
  assert.deepEqual(both.editions.map(e => e.editionId), ["imsil-cheese-2025", "imsil-cheese-2023"], "the history chart keeps its own order");
  assert.deepEqual(both.visitorProfile?.editions.map(e => e.destinationGroups.map(g => g.group)), Array(2).fill(["outside", "local", "all"]));
  const windowed = await svc.loadHistory(parseHistory(req("festival=imsil-cheese&editions=imsil-cheese-2025,imsil-cheese-2023&windows=imsil-cheese-2025:2025-10-09:2025-10-10&before=30")));
  assert.deepEqual(windowed.visitorProfile, both.visitorProfile, "chart range never changes the profile");
  assert.deepEqual(await profiles("festival=imsil-cheese&editions=imsil-cheese-2024,imsil-cheese-2023"), ["imsil-cheese-2023", "imsil-cheese-2024"], "prior editions compare without 2025");
  assert.deepEqual(await profiles("festival=imsil-cheese&editions=imsil-cheese-2024"), ["imsil-cheese-2024"], "one selected -> single profile");
  assert.deepEqual(await profiles("festival=imsil-cheese"), ["imsil-cheese-2024", "imsil-cheese-2025"], "default selection");
  assert.deepEqual(await profiles("festival=imsil-cheese&editions=imsil-cheese-2023,imsil-cheese-2024,imsil-cheese-2025"), ["imsil-cheese-2024", "imsil-cheese-2025"], "never more than two");
  assert.equal(await profiles("festival=nonsan-strawberry"), null);
  const noDaily = await service({ visitorProfile: defaultVisitorProfile, archive: arch(archive.filter(d => d.region.code !== "52750")) }).loadHistory(parseHistory(req("festival=imsil-cheese&editions=imsil-cheese-2025")));
  assert.notEqual(noDaily.editions[0].state, "available");
  assert.deepEqual(noDaily.visitorProfile?.editions.map(e => e.editionId), ["imsil-cheese-2025"], "missing district daily data keeps the reviewed profile");
  const cancelled = service({ visitorProfile: defaultVisitorProfile, editions: editions.map(e => e.id === "imsil-cheese-2024" ? { ...e, status: "취소" } : e) });
  const partly = await cancelled.loadHistory(parseHistory(req("festival=imsil-cheese&editions=imsil-cheese-2024,imsil-cheese-2025")));
  assert.deepEqual(partly.visitorProfile?.editions.map(e => e.editionId), ["imsil-cheese-2025"], "a cancelled edition drops out; the other stays single");
  const plain = await service().loadHistory(parseHistory(req("festival=imsil-cheese&editions=imsil-cheese-2025")));
  assert.equal(plain.visitorProfile, null, "no resolver injected -> null");
  assert.equal(plain.editions[0].editionId, "imsil-cheese-2025", "original history still works without the profile");
  const text = JSON.stringify(both.visitorProfile);
  for (const leak of ["sha256", "docs/research", "KCTF0061", "52750340", "evidence", "SRCH", "_TOT", "baseYears", "display"]) assert.ok(!text.includes(leak), `${leak} leaked`);
});

test("a failing visitor-profile resolver omits only its block and logs a fixed category", async () => {
  const logged: unknown[][] = [], original = console.error;
  console.error = (...args: unknown[]) => { logged.push(args); };
  try {
    const r = await service({ hostVisits: defaultHostVisits, visitorProfile: () => { throw new Error("secret /var/data path"); } })
      .loadHistory(parseHistory(req("festival=imsil-cheese&editions=imsil-cheese-2025")));
    assert.equal(r.visitorProfile, null);
    assert.equal(r.hostVisits?.editions[0].editionId, "imsil-cheese-2025", "the other optional block survives");
    assert.equal(r.editions[0].editionId, "imsil-cheese-2025");
  } finally { console.error = original; }
  assert.deepEqual(logged, [["datalab-visitor-profile: resolver-failed"]]);
});
