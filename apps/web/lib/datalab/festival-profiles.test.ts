import test from "node:test";
import assert from "node:assert/strict";
import raw from "../../data/datalab-festival-profiles.json";
import trendRaw from "../../data/datalab-festival-trend.json";
import { FESTIVAL_INDICATOR_KEYS } from "./festival-profile-types";
import { defaultFestivalProfiles, FestivalProfileDataError, loadFestivalProfiles, parseFestivalProfiles } from "./festival-profiles";
import { parseFestivalPeriodDataset } from "./model";

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));
type Raw = typeof raw;
const mutate = (edit: (d: Raw) => void) => { const d = clone(raw); edit(d); return d; };

test("checked-in profiles parse and cover exactly the trend festivals", () => {
  const p = parseFestivalProfiles(raw), trend = parseFestivalPeriodDataset(trendRaw);
  assert.equal(p.festivals.length, 26);
  assert.deepEqual(p.festivals.map(f => f.id), trend.festivals.map(f => f.id));
  assert.deepEqual(defaultFestivalProfiles, p);
  assert.equal(p.officialUrl, "https://datalab.visitkorea.or.kr/datalab/portal/fes/getFesDataForm.do");
  for (const f of p.festivals) {
    assert.ok(f.indicators.every(y => y.festival.length === FESTIVAL_INDICATOR_KEYS.length && y.base.length === FESTIVAL_INDICATOR_KEYS.length));
    assert.equal(f.demographics.length, 8);
    assert.deepEqual(f.destinations.map(g => g.group), ["outside", "local", "all"]);
  }
});

test("the public projection carries original links but no internal paths, hashes or byte counts", () => {
  const text = JSON.stringify(parseFestivalProfiles(raw));
  assert.ok(!/"(path|sha256|bytes|originalPath|manifestSha256|repository|commit)"/.test(text));
  const seosan = parseFestivalProfiles(raw).festivals[0];
  assert.deepEqual(Object.keys(seosan.links), ["indicators", "demographics", "destinations"]);
  assert.ok(Object.values(seosan.links).every(u => u.startsWith("https://github.com/travel-resolver/pick-d-day/blob/")));
});

test("withheld years stay out of the held indicator years", () => {
  const p = parseFestivalProfiles(raw), pyeongchang = p.festivals.find(f => f.id === "pyeongchang-trout")!;
  assert.deepEqual(pyeongchang.withheldYears, [2018, 2022]);
  assert.deepEqual(pyeongchang.indicators.map(y => y.year), [2019, 2023, 2024, 2025]);
});

test("malformed artifacts are rejected rather than coerced", () => {
  const cases: [Raw | unknown, RegExp][] = [
    [mutate(d => { (d as { kind: string }).kind = "other"; }), /kind/],
    [mutate(d => { d.source.officialUrl = "https://example.com/"; }), /official festival page/],
    [mutate(d => { d.indicators[0].source = "외지인"; }), /reviewed five/],
    [mutate(d => { d.festivals[1].id = d.festivals[0].id; }), /unique/],
    [mutate(d => { d.festivals[0].indicators.years[0].festival[0] = 0; }), /0\.\.1/],
    [mutate(d => { d.festivals[0].indicators.years[0].festival[0] = 1.5; }), /0\.\.1/],
    [mutate(d => { d.festivals[0].indicators.years[0].base.pop(); }), /hold 5 values/],
    [mutate(d => { d.festivals[0].indicators.years.reverse(); }), /ascending/],
    [mutate(d => { d.festivals[0].indicators.years[0].year = 2017; }), /out of range/],
    [mutate(d => { d.festivals[0].indicators.withheldYears = [d.festivals[0].indicators.years[0].year]; }), /overlap/],
    [mutate(d => { d.festivals[0].demographics[0].malePercent = 50.55; }), /one-decimal/],
    [mutate(d => { d.festivals[0].demographics.reverse(); }), /must be 0~9세/],
    [mutate(d => { d.festivals[0].demographics[0].malePercent = 40; }), /add up to 100/],
    [mutate(d => { d.festivals[0].destinations.pop(); }), /three groups/],
    [mutate(d => { d.festivals[0].destinations[0].items[1].rank = 9; }), /never go down/],
    [mutate(d => { d.festivals[0].destinations[0].items[0].name = " "; }), /non-empty/],
    [mutate(d => { d.festivals[0].sources.indicators.originalUrl = "http://example.com/x.csv"; }), /https/],
    [mutate(d => { d.festivals[0].range.from = 2026; }), /reversed/],
  ];
  for (const [input, error] of cases) assert.throws(() => parseFestivalProfiles(input), (e: unknown) => e instanceof FestivalProfileDataError && error.test((e as Error).message), String(error));
});

test("an invalid artifact yields no profiles and logs one fixed category", () => {
  const logs: string[] = [];
  assert.equal(loadFestivalProfiles({ kind: "datalab-festival-profiles" }, c => logs.push(c)), null);
  assert.deepEqual(logs, ["datalab-festival-profiles: invalid-artifact"]);
});
