import test from "node:test";
import assert from "node:assert/strict";
import raw from "../../data/datalab-region-annual.json";
import { createRegionAnnualResolver, defaultRegionAnnual, parseRegionAnnualDataset, RegionAnnualDataError, regionAnnualFrom } from "./region-annual";

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));

test("default resolver gives Imsil 2018-2025 source totals, keeps the one-count total gap, and nothing for other regions", () => {
  const a = defaultRegionAnnual("52750")!;
  assert.equal(a.regionCode, "52750");
  assert.deepEqual(a.years.map(y => y.year), [2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025]);
  assert.deepEqual(a.years.find(y => y.year === 2021), { year: 2021, outside: 7329430, local: 3433454, total: 10762885 });
  assert.deepEqual(a.years.filter(y => y.local! + y.outside! !== y.total).map(y => [y.year, y.total! - y.local! - y.outside!]), [[2021, 1], [2024, 1]]);
  assert.deepEqual(a.years.map(y => y.outside), [4981442, 6440147, 6412108, 7329430, 8092476, 8522745, 8875772, 9183132]);
  assert.deepEqual(a.source, { title: "한국관광 데이터랩 · 지역 방문자 수 추이", url: "https://datalab.visitkorea.or.kr/datalab/portal/loc/getAreaDataForm.do", downloadedOn: "2026-08-30" });
  for (const code of ["44230", "44150", "52790", ""]) assert.equal(defaultRegionAnnual(code), null, code);
  a.years[0].outside = -1;
  assert.equal(defaultRegionAnnual("52750")!.years[0].outside, 4981442, "each call returns a fresh copy");
});

test("projection carries no paths, hashes, commits, raw strings or scope notes", () => {
  const text = JSON.stringify(defaultRegionAnnual("52750"));
  for (const leak of ["sha256", "docs/research", "commit", "\"raw\"", "E7", "github.com", "manifest", "고유", "scope"]) assert.ok(!text.includes(leak), leak);
});

test("missing source values stay null (not 0) and skip the sum check; source zero stays 0", () => {
  const d = clone(raw), y = d.regions[0].years[0] as any;
  y.raw.local = ""; y.local = null; y.raw.outside = "0.0"; y.outside = 0; y.raw.total = "N/A"; y.total = null;
  const first = regionAnnualFrom(parseRegionAnnualDataset(d))("52750")!.years[0];
  assert.deepEqual(first, { year: 2018, outside: 0, local: null, total: null });
});

test("malformed artifacts are rejected rather than coerced", () => {
  const mutations: [string, (d: any) => void][] = [
    ["kind", d => { d.kind = "datalab-festival-period-annual"; }],
    ["schema", d => { d.schemaVersion = 2; }],
    ["header", d => { d.rawHeader[0] = "기준년도"; }],
    ["timezone invented", d => { d.source.downloadTimezone = "Asia/Seoul"; }],
    ["http source", d => { d.source.officialUrl = "http://datalab.visitkorea.or.kr"; }],
    ["region code", d => { d.regions[0].code = "임실군"; }],
    ["relabelled valid region code", d => { d.regions[0].code = "44230"; }],
    ["relabelled name", d => { d.regions[0].name = "논산시"; }],
    ["different source", d => { d.regions[0].source.path = "another.csv"; }],
    ["duplicate region", d => { d.regions.push(clone(d.regions[0])); }],
    ["stamp/date drift", d => { d.regions[0].downloadDate = "2026-08-31"; }],
    ["duplicate year", d => { d.regions[0].years[1] = clone(d.regions[0].years[0]); }],
    ["empty years", d => { d.regions[0].years = []; }],
    ["missing observation year", d => { d.regions[0].years.splice(2, 1); }],
    ["raw/parsed drift", d => { d.regions[0].years[3].raw.total = "1.0762886E7"; }],
    ["missing coerced to 0", d => { d.regions[0].years[0].raw.local = ""; }],
    ["string number", d => { d.regions[0].years[0].outside = "4981442"; }],
    ["spaced raw", d => { d.regions[0].years[0].raw.outside = " 4981442.0"; }],
    ["lowercase exponent", d => { d.regions[0].years[3].raw.total = "1.0762885e7"; }],
    ["negative", d => { d.regions[0].years[0].raw.outside = "-4981442.0"; d.regions[0].years[0].outside = -4981442; }],
    ["sum gap over 1", d => { const y = d.regions[0].years[0]; y.total += 2; y.raw.total = `${y.total}.0`; }],
    ["missing raw", d => { delete d.regions[0].years[0].raw; }],
  ];
  for (const [name, mutate] of mutations) {
    const d = clone(raw); mutate(d);
    assert.throws(() => parseRegionAnnualDataset(d), RegionAnnualDataError, name);
  }
  assert.throws(() => parseRegionAnnualDataset(null), RegionAnnualDataError);
});

test("an invalid artifact disables only the annual block with a fixed log category", () => {
  const logged: string[] = [], d = clone(raw);
  d.regions[0].years[0].raw.local = "garbage";
  const off = createRegionAnnualResolver(d, c => logged.push(c));
  assert.equal(off("52750"), null);
  assert.deepEqual(logged, ["datalab-region-annual: invalid-artifact"]);
});
