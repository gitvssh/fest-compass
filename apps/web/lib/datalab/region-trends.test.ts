import test from "node:test";
import assert from "node:assert/strict";
import raw from "../../data/datalab-region-trends.json";
import { festivalBundle } from "./festival-bundles";
import { defaultRegionProfiles } from "./region-profiles";
import { defaultRegionTrends, loadRegionTrends, parseRegionTrends, regionAnnualFromTrend, RegionTrendDataError, regionTrendFor } from "./region-trends";

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));
type Raw = typeof raw;
const mutate = (edit: (d: Raw) => void) => { const d = clone(raw); edit(d); return d; };

test("checked-in trends parse: four districts, six festivals, none shared with the first import", () => {
  const t = parseRegionTrends(raw);
  assert.deepEqual(defaultRegionTrends, t);
  assert.deepEqual(t.regions.map(r => [r.code, r.name, r.province]), [["44230", "논산시", "충청남도"], ["44150", "공주시", "충청남도"], ["51130", "원주시", "강원특별자치도"], ["27290", "달서구", "대구광역시"]]);
  assert.deepEqual(t.festivalRegions, { "ganggyeong-jeotgal": "44230", "nonsan-strawberry": "44230", "seokjangni-paleolithic": "44150", "wonju-dancing-carnival": "51130", "wonju-hanji": "51130", "daegu-chimac": "27290" });
  assert.ok(Object.keys(t.festivalRegions).every(id => !Object.hasOwn(defaultRegionProfiles!.festivalRegions, id)));
  assert.ok(t.regions.every(r => !defaultRegionProfiles!.regions.some(p => p.code === r.code)));
});

test("Nonsan values come through as the source wrote them: domestic = local + outside, shares of the range total", () => {
  const nonsan = regionTrendFor(parseRegionTrends(raw), "44230")!;
  assert.deepEqual(nonsan.spending.range, { from: 2020, to: 2025 });
  assert.deepEqual(nonsan.spending.years.at(-1), { year: 2025, total: 269996522, local: 3430311, outside: 266566211 });
  assert.equal(Math.round(nonsan.spending.industries.reduce((n, g) => n + g.share, 0) * 10) / 10, 100);
  assert.deepEqual(nonsan.spending.industries.map(g => g.name), ["쇼핑업", "숙박업", "식음료업", "여가서비스업", "여행업", "운송업", "의료웰니스업"]);
  assert.deepEqual(nonsan.visitors.range, { from: 2019, to: 2025 });
  assert.deepEqual(nonsan.visitors.years.map(y => y.outside), [15101695, 14007360, 14692181, 16260534, 16571947, 16952096, 17451010]);
  assert.ok(Object.values(nonsan.spending.links).every(u => u.startsWith("https://github.com/gitvssh/fest-compass/blob/main/docs/research/imported/datalab-regions-2026-10/original/data/")));
  assert.ok(!/"(path|sha256|bytes|originalPath|manifestSha256)"/.test(JSON.stringify(parseRegionTrends(raw))));
});

test("the annual block gets outside visitors only; unknown districts get nothing", () => {
  const a = regionAnnualFromTrend(defaultRegionTrends, "27290")!;
  assert.deepEqual([a.regionCode, a.years.length, a.years.every(y => y.local === null && y.total === null), a.source.downloadedOn], ["27290", 7, true, "2026-10-05"]);
  assert.equal(a.years.at(-1)!.outside, 57097467);
  assert.equal(regionAnnualFromTrend(defaultRegionTrends, "52750"), null);
  assert.equal(regionAnnualFromTrend(null, "44230"), null);
});

test("festival bundles carry exactly one host block: a full profile or a yearly trend", () => {
  const nonsan = festivalBundle("nonsan-strawberry")!, imsil = festivalBundle("imsil-n-cheese")!, chimac = festivalBundle("daegu-chimac")!, sejong = festivalBundle("sejong")!;
  assert.deepEqual([nonsan.host, nonsan.hostTrend?.code], [null, "44230"]);
  assert.deepEqual([imsil.host?.code, imsil.hostTrend], ["52750", null]);
  assert.deepEqual([chimac.host, chimac.hostTrend?.name], [null, "달서구"], "두류3동 is in 달서구, not the first import's 중구");
  assert.deepEqual([sejong.host, sejong.hostTrend], [null, null]);
});

test("malformed artifacts are rejected rather than coerced", () => {
  const cases: [unknown, RegExp][] = [
    [mutate(d => { (d as { kind: string }).kind = "other"; }), /kind/],
    [mutate(d => { d.source.officialUrl = "https://example.com/"; }), /official region page/],
    [mutate(d => { d.regions[0].code = "4423"; }), /5-digit/],
    [mutate(d => { d.regions[1].code = d.regions[0].code; }), /unique/],
    [mutate(d => { d.regions[1].festivalIds.push(d.regions[0].festivalIds[0]); }), /linked twice/],
    [mutate(d => { d.regions[0].spending.years[0].local += 10; }), /add up to the total/],
    [mutate(d => { d.regions[0].spending.years.pop(); }), /must cover/],
    [mutate(d => { d.regions[0].spending.years.reverse(); }), /must cover/],
    [mutate(d => { d.regions[0].spending.industries[0].name = "기타"; }), /known industry group/],
    [mutate(d => { d.regions[0].spending.industries[0].total *= 2; }), /split the range total/],
    [mutate(d => { d.regions[0].spending.industries.push(clone(d.regions[0].spending.industries[0])); }), /split the range total/],
    [mutate(d => { d.regions[0].visitors.years.splice(2, 1); }), /must cover/],
    [mutate(d => { d.regions[0].visitors.years[0].outside = 1.5; }), /out of range/],
    [mutate(d => { d.regions[0].spending.sources.domestic.originalUrl = "http://example.com/x.csv"; }), /https/],
    [mutate(d => { d.regions[0].visitors.sources.trend.sha256 = "abc"; }), /hash/],
    [mutate(d => { (d as { schemaVersion: number }).schemaVersion = 2; }), /schema version/],
  ];
  for (const [input, error] of cases) assert.throws(() => parseRegionTrends(input), (e: unknown) => e instanceof RegionTrendDataError && error.test((e as Error).message), String(error));
});

test("an invalid artifact yields no trends and logs one fixed category", () => {
  const logs: string[] = [];
  assert.equal(loadRegionTrends({ kind: "datalab-region-trends" }, c => logs.push(c)), null);
  assert.deepEqual(logs, ["datalab-region-trends: invalid-artifact"]);
});
