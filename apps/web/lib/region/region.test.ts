import test from "node:test";
import assert from "node:assert/strict";
import bundled from "../../data/region-history.json";
import expanded from "../../data/regional-history-expanded.json";
import { fetchRegionalPage, regionalDatasets } from "./history-collection";
import { hash, monthWindows } from "../kto/history";
import { collectResources, RESOURCE_MESSAGES, resourceMaxPages, type PageLoader } from "./service";
import { dates, lineSegments, mapResource, parseQuery, regionOf, REGIONS, selectHistory, SOURCE, TYPES } from "./model";
import { encodeEvidence, makeEvidence, parseEvidence } from "./evidence";
import type { Query, RegionResult } from "./types";
import { groupResources, hasPosition, NATIONAL_BOUNDS, resourceBounds } from "./map-view";
import { BOUNDARIES, boundaryBounds, boundaryReference } from "./boundaries";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
const q: Query = { province: "44", district: "230", start: "2025-03-01", end: "2025-03-31", kind: "12" };
// Tourism list rows state the requested type explicitly (areaBasedList2 contenttypeid).
const row = (id = "123", kind = "12") => ({ contentid: id, contenttypeid: kind, title: "자료", lDongRegnCd: "44", lDongSignguCd: "230", mapx: "127.1", mapy: "36.2" });

test("expanded source snapshots preserve all 2192 regional dates and reviewed identities without mixing populations", () => {
  assert.equal(expanded.calls, 108); assert.equal(expanded.pages.length, 108);
  for (const d of expanded.datasets) {
    const { snapshotId, ...content } = d; assert.equal(hash(JSON.stringify(content)), snapshotId);
    assert.equal(d.points.length, 1096); assert.equal(new Set(d.points.map(p => p.date)).size, 1096);
    assert.ok(d.points.every(p => p.quality === "complete" && p.value !== null && p.value >= 0));
  }
  const query = { ...q, district: "150", start: "2024-09-28", end: "2024-09-28" };
  assert.equal(selectHistory(query, [...bundled, ...expanded.datasets]).points[0].value, 130382);
  assert.equal(selectHistory({ ...query, province: "52", district: "750", start: "2024-10-03", end: "2024-10-03" }, expanded.datasets).points[0].value, 50526);
  assert.equal(selectHistory({ ...query, district: "760" }, expanded.datasets).status, "unavailable");
  assert.equal(selectHistory({ ...query, start: "2026-01-01", end: "2026-01-01" }, expanded.datasets).points[0].value, null);
  const bad = structuredClone(expanded.datasets); bad[0].region.name = "논산시"; assert.equal(selectHistory(query, bad).status, "unavailable");
});
const regionalRows = (code: string, name: string, value: string) => ["현지인(a)", "외지인(b)", "외국인(c)"].map((touDivNm, i) => ({ baseYmd: "20231006", signguCode: code, signguNm: name, touDivCd: String(i + 1), touDivNm, touNum: value }));
async function regionalPage(rows: Record<string, unknown>[]) {
  return fetchRegionalPage({ start: "2023-10-06", end: "2023-10-06", pageNo: 1, pageSize: 10000 }, "private-test-key", async () => new Response(JSON.stringify({ response: { header: { resultCode: "0000" }, body: { pageNo: 1, numOfRows: rows.length, totalCount: rows.length, items: { item: rows } } } })));
}
test("regional collection retains historical aliases, rejects alias double-counting and never treats missing as zero", async () => {
  const windows = monthWindows("2023-10-06", "2023-10-06");
  const page = await regionalPage([...regionalRows("44150", "공주시", "0"), ...regionalRows("45750", "임실군", "12.5")]);
  assert.ok(!JSON.stringify(page).includes("private-test-key"));
  const data = regionalDatasets([page], windows); assert.equal(data[0].points[0].value, 0); assert.equal(data[1].points[0].value, 12.5); assert.deepEqual(data[1].sourceRegionCodes, ["45750"]); assert.equal(data[1].region.code, "52750");
  const double = await regionalPage([...regionalRows("45750", "임실군", "12.5"), ...regionalRows("52750", "임실군", "12.5")]);
  const invalid = regionalDatasets([double], windows); assert.equal(invalid[1].points[0].quality, "invalid"); assert.equal(invalid[1].points[0].value, null); assert.equal(invalid[0].points[0].quality, "missing");
  const wrong = await regionalPage(regionalRows("44150", "임실군", "3")); assert.ok(regionalDatasets([wrong], windows).every(d => d.points[0].quality === "invalid"));
  assert.throws(() => regionalDatasets([{ ...page, totalCount: 20000 }], windows), /incomplete/);
  assert.throws(() => regionalDatasets([page, page], windows), /incomplete/);
});
test("all published geometry assets match the verified source build and selectable catalogue", () => {
  const report = JSON.parse(readFileSync(new URL("../../../../docs/validation/evidence/2026-09-09-boundary-build.json", import.meta.url), "utf8"));
  assert.equal(report.version, BOUNDARIES.version);
  const seen = new Set<string>();
  for (const [name, info] of Object.entries(report.files) as [string, { bytes: number; sha256: string }][]) {
    const data = readFileSync(new URL(`../../public/data/boundaries/${BOUNDARIES.version}/${name}`, import.meta.url));
    assert.equal(data.length, info.bytes); assert.equal(createHash("sha256").update(data).digest("hex"), info.sha256);
    const collection = JSON.parse(data.toString()); assert.equal(collection.version, BOUNDARIES.version);
    if (name !== "national.json") for (const f of collection.features) {
      const key = `${name.slice(9, -5)}:${f.properties.id}`;
      assert.equal(BOUNDARIES.regions[key]?.status, "available"); assert.equal(seen.has(key), false); seen.add(key);
    }
  }
  assert.equal(seen.size, 234);
});
test("official crosswalk preserves numeric collisions, Sejong and ordinary-city aggregation", () => {
  assert.deepEqual(boundaryReference("26", "110")?.codes, ["21010"]);
  assert.deepEqual(boundaryReference("36110", "36110")?.codes, ["29010"]);
  assert.equal(boundaryReference("41", "110")?.codes.length, 4);
  assert.deepEqual(boundaryReference("44", "230")?.codes, ["34060"]);
  assert.ok(boundaryBounds("44", "230")![0] < 127.1);
});
test("changed regions never acquire old reference shapes by name or parent inference", () => {
  assert.equal(Object.values(BOUNDARIES.regions).filter(r => r.status === "available").length, 234);
  for (const [p, d] of [["12", "110"], ["28", "125"], ["41", "597"], ["11", "999"]]) {
    assert.equal(boundaryReference(p, d), null); assert.equal(boundaryBounds(p, d), undefined);
  }
});
test("boundary evidence survives export, remains immutable and rejects mismatched scope or source", async () => {
  const result: RegionResult = { query: q, region: regionOf(q), resources: await collectResources(q, async () => ({ total: 1, rows: [row()] })), history: selectHistory(q, bundled) };
  const boundary = boundaryReference("44", "230")!;
  const evidence = await makeEvidence(result, { resourceId: "123", boundary }, "경계 참고");
  boundary.codes[0] = "99999";
  const encoded = encodeEvidence([evidence]), roundTrip = parseEvidence(encoded)[0];
  assert.ok("resourceId" in roundTrip.selection && roundTrip.selection.boundary?.codes[0] === "34060");
  for (const change of [{ source: "javascript:alert(1)" }, { district: "150" }, { codes: ["34060", "34060"] }, { boundaryDate: "invalid" }]) {
    const bad = JSON.parse(encoded); Object.assign(bad.items[0].selection.boundary, change); assert.throws(() => parseEvidence(JSON.stringify(bad)));
  }
  const old = await makeEvidence(result, { resourceId: "123" }, "이전 근거");
  assert.equal(parseEvidence(encodeEvidence([old])).length, 1);
});
test("map bounds retain islands and all valid resource positions without inventing missing coordinates", () => {
  assert.deepEqual(resourceBounds([], ""), NATIONAL_BOUNDS);
  assert.ok(NATIONAL_BOUNDS[0] < 124.7 && NATIONAL_BOUNDS[2] > 131.9 && NATIONAL_BOUNDS[1] < 33.1);
  const one = mapResource(row(), q), two = { ...one, id: "456", longitude: 127.4, latitude: 36.6 };
  const missing = { ...one, id: "missing", longitude: null, latitude: null };
  assert.equal(hasPosition(missing), false); assert.equal(hasPosition({ ...one, latitude: Infinity }), false);
  const b = resourceBounds([missing, one, two], "44");
  assert.ok(b[0] < one.longitude! && b[1] < one.latitude! && b[2] > two.longitude && b[3] > two.latitude);
  const single = resourceBounds([one], "44"); assert.ok(single[0] < single[2] && single[1] < single[3]);
  assert.notDeepEqual(resourceBounds([missing], "44"), NATIONAL_BOUNDS);
});
test("map clusters keep catalogue numbering and identities through missing and duplicate coordinates", () => {
  const one = mapResource(row(), q), two = { ...one, id: "456" }, missing = { ...one, id: "missing", longitude: null };
  const far = { ...one, id: "789", longitude: 128.5 };
  const result = groupResources([missing, one, two, far], (x, y) => ({ x: x * 100, y: y * 100 }));
  assert.deepEqual(result.map(g => g.map(r => r.number)), [[2, 3], [4]]);
  assert.deepEqual(result.flat().map(r => r.resource.id), ["123", "456", "789"]);
});
test("adjacent grid cells do not hide near-identical resources behind another cluster", () => {
  const one = mapResource(row(), q);
  const resources = [127.099,127.101,127.8].map((longitude,i)=>({...one,id:String(i),longitude}));
  const groups = groupResources(resources, x=>({x:(x-127)*420,y:0}));
  assert.deepEqual(groups.map(g=>g.map(r=>r.number)),[[1,2],[3]]);
});
test("directory preserves current codes and the verified Sejong exception", () => {
  assert.equal(REGIONS.length, 269); assert.equal(new Set(REGIONS.map(r => r.provinceCode)).size, 16);
  assert.equal(parseQuery(new URLSearchParams({ ...q, province: "36110", district: "36110" })).province, "36110");
  assert.ok(REGIONS.some(r => r.provinceCode === "12"));
  assert.throws(() => parseQuery(new URLSearchParams({ ...q, province: "36", district: "110" })));
  assert.throws(() => parseQuery(new URLSearchParams({ ...q, province: "11", district: "999" })));
});
test("date limits reject normalized impossible dates and unbounded public queries", () => {
  assert.equal(dates("2024-01-01", "2024-12-31").length, 366);
  assert.throws(() => dates("2025-02-29", "2025-03-02")); assert.throws(() => dates("2024-01-01", "2025-12-31"));
});
test("coordinates stay missing instead of mapping zero; wrong-region rows are rejected", () => {
  assert.equal(mapResource({ ...row(), mapx: "", mapy: "0" }, q).longitude, null);
  assert.throws(() => mapResource({ ...row(), lDongRegnCd: "11" }, q));
  assert.throws(() => mapResource({ ...row(), eventstartdate: "20260201", eventenddate: "20260204" }, { ...q, kind: "15" }));
});
test("tourism rows must state the requested type explicitly; festival rows keep the legacy date checks only", () => {
  for (const kind of ["12", "14", "39", "32"] as const) assert.equal(mapResource(row("1", kind), { ...q, kind }).id, "1");
  assert.throws(() => mapResource(row("1", "32"), { ...q, kind: "39" }));
  assert.throws(() => mapResource(row("1", "15"), { ...q, kind: "12" }));
  for (const contenttypeid of [undefined, null, ""]) assert.throws(() => mapResource({ ...row(), contenttypeid }, q));
  const festival: Query = { ...q, kind: "15", start: "2026-09-05", end: "2026-09-06" };
  assert.equal(mapResource({ ...row(), contenttypeid: undefined, eventstartdate: "20260905", eventenddate: "20260905" }, festival).start, "2026-09-05");
});
test("all four tourism kinds and festivals are supported query kinds with their labels", () => {
  const base = { province: "44", district: "230", start: "2026-09-01", end: "2026-09-30" };
  for (const kind of ["12", "14", "39", "32", "15"]) assert.equal(parseQuery(new URLSearchParams({ ...base, kind })).kind, kind);
  for (const kind of ["", "13", "38", "99"]) assert.throws(() => parseQuery(new URLSearchParams({ ...base, kind })), kind);
  assert.deepEqual([TYPES["12"], TYPES["14"], TYPES["39"], TYPES["32"], TYPES["15"]], ["관광지", "문화시설", "음식점", "숙박", "축제·행사"]);
  assert.deepEqual([resourceMaxPages("12"), resourceMaxPages("14"), resourceMaxPages("39"), resourceMaxPages("32"), resourceMaxPages("15")], [20, 20, 20, 20, 6]);
});
test("all pages complete, missing coordinates kept in the list", async () => {
  const result = await collectResources(q, async page => ({ total: 101, rows: page === 1 ? Array.from({ length: 100 }, (_, i) => row(String(i))) : [{ ...row("100"), mapx: "" }] }));
  assert.equal(result.status, "complete"); assert.equal(result.pages, 2); assert.equal(result.items.length, 101); assert.equal(result.items[100].longitude, null);
});
test("festival API accepts continuing events including either boundary and rejects disjoint or reversed schedules", async () => {
  const query:Query={...q,kind:"15",start:"2026-09-05",end:"2026-09-06"};
  const sample={...row("123","15"),eventstartdate:"20260904",eventenddate:"20260906"};
  assert.equal(mapResource(sample,query).start,"2026-09-04");
  assert.equal(mapResource({...sample,eventenddate:"20260905"},query).end,"2026-09-05");
  assert.equal(mapResource({...sample,eventstartdate:"20260906",eventenddate:"20261001"},query).start,"2026-09-06");
  for(const [start,end] of [["20260904","20260904"],["20260907","20260908"],["20260906","20260905"],["20260230","20260906"]])assert.throws(()=>mapResource({...sample,eventstartdate:start,eventenddate:end},query));
  const result=await collectResources(query,async()=>({total:1,rows:[sample]}));assert.equal(result.status,"complete");assert.equal(result.items.length,1);
});
test("partial, duplicate, drifted, wrong-region and capped results never masquerade as totals", async () => {
  for (const load of [
    async () => ({ total: 101, rows: [row()] }),
    async () => ({ total: 2, rows: [row(), row()] }),
    async (page: number) => ({ total: page === 1 ? 101 : 100, rows: Array.from({ length: 100 }, (_, i) => row(String(i))) }),
    async () => ({ total: 1, rows: [{ ...row(), lDongSignguCd: "150" }] }),
    async () => ({ total: 2001, rows: [] }),
    async () => { throw new Error("unavailable"); },
  ]) { const result = await collectResources(q, load); assert.equal(result.status, "unavailable"); assert.deepEqual(result.items, []); assert.equal(result.total, null); }
  assert.equal((await collectResources(q, async () => ({ total: 0, rows: [] }))).status, "empty");
});
// A consistent multi-page listing of `total` rows; `tamper` may replace one page's answer.
function listing(kind: Query["kind"], total: number, tamper: (page: number, rows: Record<string, unknown>[]) => { total?: number; rows?: Record<string, unknown>[] } | null = () => null) {
  const calls: number[] = [];
  const load: PageLoader = async page => {
    calls.push(page);
    const rows = Array.from({ length: Math.max(0, Math.min(100, total - (page - 1) * 100)) }, (_, i) => {
      const r: Record<string, unknown> = row(String((page - 1) * 100 + i + 1), kind);
      return kind === "15" ? { ...r, eventstartdate: "20260905", eventenddate: "20260905" } : r;
    });
    return { total, rows, ...tamper(page, rows) };
  };
  return { load, calls };
}
const range = (n: number) => Array.from({ length: n }, (_, i) => i + 1);
test("tourism kinds collect every page beyond 600 rows up to the 2,000-row boundary", async () => {
  for (const [kind, total, pages] of [["12", 601, 7], ["39", 1234, 13], ["32", 1999, 20], ["14", 2000, 20], ["39", 100, 1], ["32", 0, 1]] as const) {
    const { load, calls } = listing(kind, total), result = await collectResources({ ...q, kind }, load);
    assert.equal(result.status, total ? "complete" : "empty", `${kind}/${total}`);
    assert.deepEqual([result.total, result.items.length, result.pages, new Set(result.items.map(i => i.id)).size], [total, total, pages, total]);
    assert.deepEqual(calls, range(pages), "exact page count, in order");
  }
});
test("more than 2,000 tourism rows or 600 festival rows fail the whole kind without partial rows", async () => {
  for (const [kind, total] of [["12", 2001], ["39", 2500], ["32", 5000]] as const) {
    const { load, calls } = listing(kind, total), result = await collectResources({ ...q, kind }, load);
    assert.deepEqual([result.status, result.items, result.total, calls], ["unavailable", [], null, [1]], `${kind}/${total}`);
  }
  const festival: Query = { ...q, kind: "15", start: "2026-09-05", end: "2026-09-06" };
  const kept = listing("15", 600), ok = await collectResources(festival, kept.load);
  assert.deepEqual([ok.status, ok.items.length, ok.pages], ["complete", 600, 6], "festival cap unchanged");
  const over = await collectResources(festival, listing("15", 601).load);
  assert.deepEqual([over.status, over.items, over.total], ["unavailable", [], null], "festival 601 still exceeds its 600 cap");
});
test("a late page that drifts, shortens, repeats, changes type or region, or fails rejects the whole tourism list", async () => {
  const cases: [string, Query["kind"], number, Parameters<typeof listing>[2]][] = [
    ["total changed on page 12", "39", 1500, p => p === 12 ? { total: 1501 } : null],
    ["total shrank on last page", "32", 2000, p => p === 20 ? { total: 1999 } : null],
    ["short page 9", "39", 1500, (p, rows) => p === 9 ? { rows: rows.slice(1) } : null],
    ["missing final page", "12", 1450, p => p === 15 ? { rows: [] } : null],
    ["extra row on final page", "14", 1450, (p, rows) => p === 15 ? { rows: [...rows, row("9999", "14")] } : null],
    ["duplicate id across pages", "39", 1500, (p, rows) => p === 11 ? { rows: [row("1", "39"), ...rows.slice(1)] } : null],
    ["wrong type on page 10", "39", 1500, (p, rows) => p === 10 ? { rows: [row("901", "32"), ...rows.slice(1)] } : null],
    ["missing type on page 7", "32", 800, (p, rows) => p === 7 ? { rows: [{ ...rows[0], contenttypeid: undefined }, ...rows.slice(1)] } : null],
    ["wrong region on page 14", "12", 1500, (p, rows) => p === 14 ? { rows: [{ ...rows[0], lDongSignguCd: "150" }, ...rows.slice(1)] } : null],
    ["upstream failure on page 20", "14", 2000, p => { if (p === 20) throw new Error("unavailable"); return null; }],
  ];
  for (const [name, kind, total, tamper] of cases) {
    const result = await collectResources({ ...q, kind }, listing(kind, total, tamper).load);
    assert.deepEqual([result.status, result.items, result.total], ["unavailable", [], null], name);
  }
});
test("public resource messages never expose caps, verification rules or raw upstream errors", async () => {
  const failure = "관광정보 목록을 불러오지 못했어요. 잠시 후 다시 조회해 주세요.";
  const raw = "HTTP 500 https://apis.data.go.kr/B551011/KorService2/areaBasedList2?serviceKey=secret-probe-key SERVICE_KEY_IS_NOT_REGISTERED_ERROR";
  const festival: Query = { ...q, kind: "15", start: "2026-09-05", end: "2026-09-06" };
  const cases: [string, Query, PageLoader, number][] = [
    ["tourism over cap", q, listing("12", 2001).load, 1],
    ["festival over cap", festival, listing("15", 601).load, 1],
    ["partial first page", q, async () => ({ total: 101, rows: [row()] }), 1],
    ["missing final page", { ...q, kind: "12" }, listing("12", 1450, p => p === 15 ? { rows: [] } : null).load, 15],
    ["total drift", { ...q, kind: "39" }, listing("39", 1500, p => p === 12 ? { total: 1501 } : null).load, 12],
    ["duplicate id", { ...q, kind: "39" }, listing("39", 1500, (p, rows) => p === 11 ? { rows: [row("1", "39"), ...rows.slice(1)] } : null).load, 11],
    ["type mismatch", { ...q, kind: "39" }, listing("39", 1500, (p, rows) => p === 10 ? { rows: [row("901", "32"), ...rows.slice(1)] } : null).load, 10],
    ["region mismatch", q, async () => ({ total: 1, rows: [{ ...row(), lDongSignguCd: "150" }] }), 1],
    ["raw upstream error", { ...q, kind: "14" }, listing("14", 2000, p => { if (p === 3) throw new Error(raw); return null; }).load, 2],
    ["non-Error throw", q, async () => { throw raw; }, 0],
  ];
  for (const [name, query, load, pages] of cases) {
    const result = await collectResources(query, load, () => "2026-09-26T00:00:00.000Z");
    assert.deepEqual(result, { status: "unavailable", message: failure, items: [], total: null, pages, source: SOURCE, collectedAt: "2026-09-26T00:00:00.000Z" }, name);
    const text = JSON.stringify(result);
    for (const leak of ["2,000", "600", "한도", "전체 페이지", "전체 건수", "중복", "누락", "API", "apis.data.go.kr", "serviceKey", "secret-probe-key", "SERVICE_KEY", "HTTP 500"]) assert.ok(!text.includes(leak), `${name}: ${leak}`);
  }
  const complete = await collectResources({ ...q, kind: "32" }, listing("32", 1999).load);
  assert.deepEqual([complete.status, complete.message, complete.total, complete.items.length, complete.pages], ["complete", "등록된 관광정보", 1999, 1999, 20]);
  const empty = await collectResources(q, async () => ({ total: 0, rows: [] }));
  assert.deepEqual([empty.status, empty.message, empty.total, empty.items, empty.pages], ["empty", "이 조건에 등록된 관광정보가 없어요.", 0, [], 1]);
  assert.deepEqual(RESOURCE_MESSAGES, { complete: complete.message, empty: empty.message, unavailable: failure });
  for (const message of Object.values(RESOURCE_MESSAGES)) assert.ok(!/\d|API|페이지|확인 완료|한도/.test(message), message);
});
test("actual historical value is retained; switching municipality removes Nonsan numbers", () => {
  const history = selectHistory(q, bundled); assert.equal(history.points.find(p => p.date === "2025-03-27")?.value, 52671.5);
  assert.ok(selectHistory({ ...q, district: "150" }, bundled).points.every(p => p.value === null));
  assert.ok(selectHistory({ ...q, start: "2026-09-01", end: "2026-09-06" }, bundled).points.every(p => p.value === null));
});
test("newer missing observations replace older numbers and split the plotted line", () => {
  const base = { snapshotId: "a".repeat(64), collectedAt: "2026-01-01T00:00:00Z", region: { code: "44230", name: "논산시" }, source: SOURCE };
  const history = selectHistory({ ...q, end: "2025-03-03" }, [{ ...base, points: [1, 2, 3].map(n => ({ date: `2025-03-0${n}`, value: n, quality: "complete" })) }, { ...base, collectedAt: "2026-02-01T00:00:00Z", points: [{ date: "2025-03-02", value: null, quality: "missing" }] }]);
  assert.deepEqual(history.points.map(p => p.value), [1, null, 3]); assert.deepEqual(lineSegments(history.points, i => i, n => n), ["M0,1", "M2,3"]);
  const zero = selectHistory({ ...q, end: "2025-03-02" }, [{ ...base, points: [{ date: "2025-03-01", value: 0, quality: "complete" }] }]);
  assert.deepEqual(zero.points.map(p => p.value), [0, null]); assert.equal(zero.status, "available");
});
test("evidence snapshots preserve values, missing dates, source and conditions after live data changes", async () => {
  const result: RegionResult = { query: q, region: regionOf(q), resources: await collectResources(q, async () => ({ total: 1, rows: [row()] })), history: selectHistory(q, bundled) };
  const selection = { dates: result.history.points.map(p => p.date) };
  const evidence = await makeEvidence(result, selection, "개최 시기 참고"), duplicate = await makeEvidence(result, selection, "다른 메모");
  assert.equal(evidence.id, duplicate.id);
  const before = evidence.result.history.points[0].value; result.history.points[0].value = 999;
  assert.equal(parseEvidence(encodeEvidence([evidence]))[0].result.history.points[0].value, before);
  const resource = await makeEvidence(result, { resourceId: "123", mapBounds: [127, 36, 128, 37] }, "장소 조사");
  assert.equal(parseEvidence(encodeEvidence([resource]))[0].result.resources.items.length, 1);
  assert.throws(() => parseEvidence(encodeEvidence([evidence]).replace("https://www.data.go.kr/data/15101972/openapi.do", "javascript:alert(1)")));
  assert.throws(() => parseEvidence('{"version":1,"items":[{}]}'));
});
