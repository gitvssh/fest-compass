import test from "node:test";
import assert from "node:assert/strict";
import raw from "../../data/datalab-festival-trend.json";
import { axisYears, consecutiveRuns, DatalabDataError, metricValue, niceMax, parseFestivalPeriodDataset, parseMetric, searchFestivals } from "./model";
import type { FestivalPeriodDataset } from "./types";

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));
const dataset = parseFestivalPeriodDataset(raw);

test("checked-in DataLab trend passes the strict adapter", () => {
  assert.equal(dataset.kind, "datalab-festival-period-annual");
  assert.equal(dataset.festivals.length, 26);
  assert.equal(dataset.festivals.reduce((n, f) => n + f.years.length, 0), 147);
  assert.equal(dataset.rawHeader[2], "축체기간(일)");
  assert.equal(dataset.source.downloadTimezone, null);
  assert.deepEqual(axisYears(dataset.festivals), [2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025]);
});

test("malformed payloads are rejected rather than coerced", () => {
  const mutations: [string, (d: any) => void][] = [
    ["kind", d => { d.kind = "region-daily-visits"; }],
    ["header typo fixed", d => { d.rawHeader[2] = "축제기간(일)"; }],
    ["duplicate id", d => { d.festivals[1].id = d.festivals[0].id; }],
    ["duplicate year", d => { d.festivals[0].years[1] = clone(d.festivals[0].years[0]); }],
    ["string number", d => { d.festivals[0].years[0].periodTotal = "97696"; }],
    ["null mean", d => { d.festivals[0].years[0].dailyMean = null; }],
    ["zero days", d => { d.festivals[0].years[0].days = 0; }],
    ["fractional year", d => { d.festivals[0].years[0].year = 2018.5; }],
    ["sum mismatch", d => { d.festivals[0].years[0].local += 10; d.festivals[0].years[0].raw[3] = String(d.festivals[0].years[0].local); }],
    ["mean mismatch", d => { d.festivals[0].years[0].dailyMean += 1; d.festivals[0].years[0].raw[7] = String(d.festivals[0].years[0].dailyMean); }],
    ["empty raw foreign coerced to 0", d => { d.festivals[0].years[0].raw[5] = ""; }],
    ["raw/parsed drift", d => { d.festivals[0].years[0].raw[6] = "1.0"; }],
    ["short raw row", d => { d.festivals[0].years[0].raw.pop(); }],
    ["timezone invented", d => { d.source.downloadTimezone = "Asia/Seoul"; }],
    ["non-https source", d => { d.festivals[0].source.originalUrl = "http://example.com"; }],
    ["alias order", d => { d.festivals[0].aliases.reverse(); }],
    ["empty years", d => { d.festivals[0].years = []; }],
  ];
  for (const [name, mutate] of mutations) {
    const d = clone(raw);
    mutate(d);
    assert.throws(() => parseFestivalPeriodDataset(d), DatalabDataError, name);
  }
  assert.throws(() => parseFestivalPeriodDataset(null), DatalabDataError);
});

test("raw foreign zero stays 0 and missing years are gaps, never zero points", () => {
  const seosan = dataset.festivals.find(f => f.id === "seosan-haemieupseong")!;
  assert.equal(seosan.years[0].foreign, 0);
  assert.equal(seosan.years[0].raw[5], "0.0");
  const yeongam = dataset.festivals.find(f => f.id === "yeongam-wangin")!;
  assert.deepEqual(consecutiveRuns(yeongam.years).map(r => r.map(y => y.year)), [[2018, 2019], [2023, 2024]]);
  assert.ok(yeongam.years.every(y => metricValue(y, "total") > 0));
  const runs = consecutiveRuns(dataset.festivals.find(f => f.id === "gangneung-coffee")!.years);
  assert.ok(runs.every(r => r.every((y, i) => !i || y.year === r[i - 1].year + 1)));
});

test("metric values come from the source columns without cross-period derivation", () => {
  const y = dataset.festivals[0].years[0];
  assert.equal(metricValue(y, "mean"), 32565.3333);
  assert.equal(metricValue(y, "total"), 97696);
  assert.equal(parseMetric("total"), "total");
  for (const v of [undefined, "", "mean", "growth", ["total"]]) assert.equal(parseMetric(v), "mean");
  assert.equal(niceMax(37312), 50000);
  assert.equal(niceMax(97696), 100000);
  assert.equal(niceMax(0), 1);
});

test("search matches source names and reviewed aliases only", () => {
  assert.deepEqual(searchFestivals(dataset.festivals, "논산"), []);
  assert.deepEqual(searchFestivals(dataset.festivals, "강릉 커피").map(f => f.id), ["gangneung-coffee"]);
  assert.deepEqual(searchFestivals(dataset.festivals, "치맥").map(f => f.id), ["daegu-chimac"]);
  assert.equal(searchFestivals(dataset.festivals, "  ").length, 26);
  const typed: FestivalPeriodDataset = dataset;
  assert.ok(!("visits" in typed.festivals[0]) && !("points" in typed.festivals[0]));
});
