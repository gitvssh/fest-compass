import test from "node:test";
import assert from "node:assert/strict";
import bundled from "../../data/region-history.json";
import { collectResources } from "./service";
import { dates, lineSegments, mapResource, parseQuery, regionOf, REGIONS, selectHistory, SOURCE } from "./model";
import { encodeEvidence, makeEvidence, parseEvidence } from "./evidence";
import type { Query, RegionResult } from "./types";
import { groupResources, hasPosition, NATIONAL_BOUNDS, resourceBounds } from "./map-view";
const q: Query = { province: "44", district: "230", start: "2025-03-01", end: "2025-03-31", kind: "12" };
const row = (id = "123") => ({ contentid: id, title: "자료", lDongRegnCd: "44", lDongSignguCd: "230", mapx: "127.1", mapy: "36.2" });
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
test("all pages complete, missing coordinates kept in the list", async () => {
  const result = await collectResources(q, async page => ({ total: 101, rows: page === 1 ? Array.from({ length: 100 }, (_, i) => row(String(i))) : [{ ...row("100"), mapx: "" }] }));
  assert.equal(result.status, "complete"); assert.equal(result.pages, 2); assert.equal(result.items.length, 101); assert.equal(result.items[100].longitude, null);
});
test("partial, duplicate, drifted, wrong-region and capped results never masquerade as totals", async () => {
  for (const load of [
    async () => ({ total: 101, rows: [row()] }),
    async () => ({ total: 2, rows: [row(), row()] }),
    async (page: number) => ({ total: page === 1 ? 101 : 100, rows: Array.from({ length: 100 }, (_, i) => row(String(i))) }),
    async () => ({ total: 1, rows: [{ ...row(), lDongSignguCd: "150" }] }),
    async () => ({ total: 601, rows: [] }),
    async () => { throw new Error("unavailable"); },
  ]) { const result = await collectResources(q, load); assert.equal(result.status, "unavailable"); assert.deepEqual(result.items, []); assert.equal(result.total, null); }
  assert.equal((await collectResources(q, async () => ({ total: 0, rows: [] }))).status, "empty");
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
