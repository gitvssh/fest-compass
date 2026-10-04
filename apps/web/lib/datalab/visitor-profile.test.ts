import test from "node:test";
import assert from "node:assert/strict";
import catalogue from "../../data/festival-editions.json";
import raw2023 from "../../data/datalab-visitor-profile-2023.json";
import raw2024 from "../../data/datalab-visitor-profile-2024.json";
import raw from "../../data/datalab-visitor-profile.json";
import type { Edition } from "../comparison/types";
import { archiveCatalogue } from "../existing/identity";
import type { ArchiveFestival } from "../existing/types";
import { compareDestinations, percentagePointChange } from "./visitor-profile-compare";
import type { VisitorProfileSelection } from "./visitor-profile-types";
import { createVisitorProfileResolver, defaultVisitorProfile, parseVisitorProfileDataset, type ReviewedYear, VisitorProfileDataError, visitorProfileFrom } from "./visitor-profile";

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));
const festivals = archiveCatalogue(catalogue.editions as Edition[], () => true), imsil = festivals.find(f => f.festivalId === "imsil-cheese")!;
const ALL = imsil.editions.map(e => e.editionId);
const [E23, E24, E25] = ["imsil-cheese-2023", "imsil-cheese-2024", "imsil-cheese-2025"];
const withEdition = (f: ArchiveFestival, id: string, patch: Partial<ArchiveFestival["editions"][number]>): ArchiveFestival =>
  ({ ...f, editions: f.editions.map(e => e.editionId === id ? { ...e, ...patch } : e) });
const ids = (s: VisitorProfileSelection | null) => s && s.editions.map(e => e.editionId);
const single = (id: string) => { const s = defaultVisitorProfile(imsil, [id])!; assert.equal(s.editions.length, 1, id); return s.editions[0]; };
const PARK = { id: "2718832", kind: "12", title: "임실치즈테마파크" }, SANGIAM = { id: "317571", kind: "12", title: "상이암(임실)" }, SOCHUNGSA = { id: "527279", kind: "12", title: "소충사" };
const URL = "https://datalab.visitkorea.or.kr/datalab/portal/fes/getFesDataForm.do", TITLE = "한국관광 데이터랩 · 문화관광축제 방문자 특성";

test("reviewed 2025 edition alone gets one profile with the exact published percentages and source-order search ranks", () => {
  const p = single(E25);
  assert.deepEqual([p.editionId, p.year, p.start, p.end, p.areaName], [E25, 2025, "2025-10-08", "2025-10-12", "임실군 성수면"]);
  assert.deepEqual(p.demographics.map(b => b.ageBand), ["0~9세", "10~19세", "20~29세", "30~39세", "40~49세", "50~59세", "60~69세", "70세 이상"]);
  assert.deepEqual(p.demographics.map(b => [b.malePercent, b.femalePercent]), [[0.6, 0.7], [2.5, 2.4], [4.8, 5.0], [7.3, 7.6], [8.3, 7.5], [10.4, 11.3], [11.4, 11.2], [4.6, 4.4]]);
  assert.ok(Math.abs(p.demographics.reduce((n, b) => n + b.malePercent + b.femalePercent, 0) - 100) < 1e-9, "sixteen published shares add to 100.0");
  assert.deepEqual(p.destinationGroups.map(g => [g.group, g.label, g.items.length]), [["outside", "외지인", 7], ["local", "현지인", 7], ["all", "전체", 7]]);
  for (const g of p.destinationGroups) {
    assert.deepEqual(g.items.map(i => i.rank), [1, 2, 3, 4, 5, 6, 7]);
    assert.deepEqual(g.items.map(i => i.id), ["2773331", "7837938", "173403", "10147587", "3306424", "54277", "725050"]);
  }
  const outside = p.destinationGroups[0].items;
  assert.deepEqual(outside[0], { id: "2773331", rank: 1, name: "임실치즈테마파크", address: "전북 임실군 도인2길 50-0", category: "테마공원", resource: PARK });
  assert.deepEqual(outside[4].resource, SANGIAM, "reviewed alias, not a name join");
  assert.deepEqual(outside[6].resource, SOCHUNGSA);
  assert.deepEqual([outside[1].resource, outside[3].resource], [null, null], "same-address festival and museum stay separate unlinked places");
  assert.deepEqual(p.source, { title: TITLE, url: URL, collectedAt: "2026-09-24T08:15:07.300Z" });
  assert.deepEqual(defaultVisitorProfile(imsil, [E24, E25])!.editions[1], p, "the same 2025 profile inside a comparison");
  p.demographics[0].malePercent = 99; p.destinationGroups[0].items[0].resource!.id = "x";
  assert.equal(single(E25).demographics[0].malePercent, 0.6, "each call returns a fresh copy");
  assert.equal(single(E25).destinationGroups[0].items[0].resource!.id, "2718832");
});

test("reviewed 2023 and 2024 editions carry their own pinned period, shares, ranks and year-reviewed resource links", () => {
  const p23 = single(E23), p24 = single(E24);
  assert.deepEqual([p23.editionId, p23.year, p23.start, p23.end, p23.areaName], [E23, 2023, "2023-10-06", "2023-10-09", "임실군 성수면"]);
  assert.deepEqual([p24.editionId, p24.year, p24.start, p24.end, p24.areaName], [E24, 2024, "2024-10-03", "2024-10-06", "임실군 성수면"]);
  assert.deepEqual(p23.demographics.map(b => [b.malePercent, b.femalePercent]), [[0.6, 0.7], [1.9, 2.1], [4.5, 5.2], [6.9, 7.0], [8.3, 7.7], [10.8, 12.3], [12.3, 11.6], [4.3, 3.9]]);
  assert.deepEqual(p24.demographics.map(b => [b.malePercent, b.femalePercent]), [[0.5, 0.8], [2.1, 1.9], [4.3, 4.7], [6.7, 6.9], [8.4, 7.5], [11.1, 13.0], [12.1, 11.4], [4.4, 4.2]]);
  for (const p of [p23, p24]) assert.ok(Math.abs(p.demographics.reduce((n, b) => n + b.malePercent + b.femalePercent, 0) - 100) <= 0.8 + 1e-9, `${p.year} shares within rounding`);
  assert.deepEqual(p23.destinationGroups.map(g => [g.group, g.items.map(i => i.id)]), ["outside", "local", "all"].map(g => [g, ["2773331", "7837938", "10147587", "173403", "3306424", "54277"]]));
  assert.deepEqual(p24.destinationGroups.map(g => [g.group, g.items.map(i => i.id)]), [
    ["outside", ["2773331", "7837938", "10147587", "3306424", "173403", "54277", "8343126"]],
    ["local", ["2773331", "7837938", "10147587", "3306424", "173403", "8343126", "54277"]],
    ["all", ["2773331", "7837938", "10147587", "3306424", "173403", "8343126", "54277"]],
  ]);
  assert.equal(p23.destinationGroups[0].items[3].name, "성수산자연휴양림", "each year keeps its own published name");
  for (const p of [p23, p24]) {
    const linked = Object.fromEntries(p.destinationGroups[0].items.filter(i => i.resource).map(i => [i.id, i.resource]));
    assert.deepEqual(linked, { "2773331": PARK, "3306424": SANGIAM }, `${p.year} links exactly its two reviewed places`);
  }
  assert.deepEqual([p23.source, p24.source], [{ title: TITLE, url: URL, collectedAt: "2026-09-24T11:41:56.074Z" }, { title: TITLE, url: URL, collectedAt: "2026-09-24T11:41:43.889Z" }]);
});

test("selection: every selected pair compares in ascending date order; singles stay single; unselected editions never fill in", () => {
  for (const [a, b] of [[E23, E24], [E23, E25], [E24, E25]]) {
    assert.deepEqual(ids(defaultVisitorProfile(imsil, [a, b])), [a, b], `${a}+${b}`);
    assert.deepEqual(ids(defaultVisitorProfile(imsil, [b, a])), [a, b], `${b}+${a} request order does not matter`);
    const [before, after] = defaultVisitorProfile(imsil, [b, a])!.editions;
    assert.ok(before.end < after.start, "both original periods, older first");
    assert.equal(before.areaName, after.areaName, "same reviewed host area");
  }
  for (const id of ALL) assert.deepEqual(ids(defaultVisitorProfile(imsil, [id])), [id]);
  assert.equal(defaultVisitorProfile(imsil, []), null);
  assert.deepEqual(ids(defaultVisitorProfile(imsil, [E25, "imsil-cheese-2022", "nonsan-strawberry-2025"])), [E25], "unknown or foreign ids add nothing");
  assert.deepEqual(ids(defaultVisitorProfile(imsil, ALL)), [E24, E25], "never more than two: the latest two, like the default selection");
});

test("gating is per edition: cancelled, shifted or unselected editions drop out without affecting the other", () => {
  for (const f of festivals.filter(f => f.festivalId !== "imsil-cheese")) assert.equal(defaultVisitorProfile(f, f.editions.map(e => e.editionId)), null, f.festivalId);
  assert.equal(defaultVisitorProfile({ ...imsil, region: { ...imsil.region, code: "52790" } }, ALL), null, "other region");
  const cases: [string, ArchiveFestival][] = [
    ["cancelled", withEdition(imsil, E25, { cancelled: true, status: "취소" })],
    ["undated", withEdition(imsil, E25, { start: null, end: null, days: null })],
    ["4-day period", withEdition(imsil, E25, { end: "2025-10-11", days: 4 })],
    ["shifted period, same days", withEdition(imsil, E25, { start: "2025-10-09", end: "2025-10-13" })],
    ["other year", withEdition(imsil, E25, { year: 2024 })],
    ["missing edition", { ...imsil, editions: imsil.editions.filter(e => e.editionId !== E25) }],
  ];
  for (const [name, f] of cases) {
    assert.equal(defaultVisitorProfile(f, [E25]), null, name);
    assert.deepEqual(ids(defaultVisitorProfile(f, [E24, E25])), [E24], `${name}: 2024 stays as a single profile`);
    assert.deepEqual(ids(defaultVisitorProfile(f, ALL)), [E23, E24], `${name}: remaining selected editions compare`);
  }
  assert.deepEqual(ids(defaultVisitorProfile(withEdition(imsil, E24, { cancelled: true, status: "취소" }), [E24, E25])), [E25], "cancelled 2024");
  assert.deepEqual(ids(defaultVisitorProfile(withEdition(imsil, E23, { start: "2023-10-07", end: "2023-10-10" }), [E23, E24])), [E24], "shifted 2023");
  assert.equal(defaultVisitorProfile(withEdition(withEdition(imsil, E23, { cancelled: true }), E24, { cancelled: true }), [E23, E24]), null, "no verified edition -> no block");
});

test("public projection is the exact whitelist for every edition: no counts, hashes, paths, DataLab IDs or flags", () => {
  for (const pair of [[E23, E24], [E23, E25], [E24, E25]]) {
    const s = defaultVisitorProfile(imsil, pair)!;
    assert.deepEqual(Object.keys(s), ["editions"]);
    for (const p of s.editions) {
      assert.deepEqual(Object.keys(p).sort(), ["areaName", "demographics", "destinationGroups", "editionId", "end", "source", "start", "year"]);
      assert.deepEqual(Object.keys(p.demographics[0]).sort(), ["ageBand", "femalePercent", "malePercent"]);
      assert.deepEqual(Object.keys(p.destinationGroups[0]).sort(), ["group", "items", "label"]);
      for (const i of p.destinationGroups.flatMap(g => g.items)) {
        assert.deepEqual(Object.keys(i).sort(), ["address", "category", "id", "name", "rank", "resource"]);
        if (i.resource) assert.deepEqual(Object.keys(i.resource).sort(), ["id", "kind", "title"]);
      }
      assert.deepEqual(Object.keys(p.source).sort(), ["collectedAt", "title", "url"]);
    }
    const text = JSON.stringify(s);
    for (const leak of ["sha256", "docs/research", "datalab-imsil", "KCTF0061", "52750340", "evidence", "manifest", "display", "sourceLabel", "SRCH", "_TOT", "baseYears", "resource-links", "\"order\"", "residence", "demographicCountGap"]) assert.ok(!text.includes(leak), leak);
    for (const count of ["27360", "31746", "4386", "144529", "144656", "11526", "3620", "13988", "4910", "79355", "93318", "93573", "108709", "23329.5", "27177.25", "4003.12", "4818.75"]) assert.ok(!text.includes(count), `count ${count}`);
  }
});

test("two-edition comparison joins places by exact ID, keeps latest names and shows missing ranks as missing", () => {
  const [before, after] = defaultVisitorProfile(imsil, [E25, E24])!.editions;
  assert.deepEqual(before.destinationGroups.map(g => g.group), after.destinationGroups.map(g => g.group));
  const rows = compareDestinations(before.destinationGroups[0].items, after.destinationGroups[0].items);
  assert.deepEqual(rows.map(r => [r.id, r.beforeRank, r.afterRank, r.rankChange]), [
    ["2773331", 1, 1, 0], ["7837938", 2, 2, 0], ["173403", 5, 3, 2], ["10147587", 3, 4, -1], ["3306424", 4, 5, -1], ["54277", 6, 6, 0], ["725050", null, 7, null], ["8343126", 7, null, null],
  ]);
  assert.equal(rows[2].name, "성수산왕의숲자연휴양림", "renamed place matched by ID, shown with the latest name");
  assert.deepEqual([rows[0].resource, rows[4].resource, rows[6].resource, rows[7].resource], [PARK, SANGIAM, SOCHUNGSA, null]);
  assert.deepEqual([rows[7].name, rows[7].category], ["수월제", "자연경관(하천/해양)"], "older-only place keeps its own published metadata");
  const all = compareDestinations(single(E23).destinationGroups[2].items, single(E25).destinationGroups[2].items);
  assert.deepEqual(all.map(r => r.rankChange), [0, 0, 1, -1, 0, 0, null]);
  assert.equal(all[3].address, "전북 임실군 도인2길 50-0", "latest address, not the older 2023 one");
  const band = (p: typeof before, age: string) => p.demographics.find(b => b.ageBand === age)!;
  assert.equal(percentagePointChange(band(before, "30~39세").malePercent, band(after, "30~39세").malePercent), 0.6);
  assert.equal(percentagePointChange(band(before, "50~59세").femalePercent, band(after, "50~59세").femalePercent), -1.7);
});

test("each artifact is pinned to its own reviewed year: a moved, shifted or re-scoped artifact is rejected", () => {
  assert.equal(parseVisitorProfileDataset(raw2023, 2023).festival.editionId, E23);
  assert.equal(parseVisitorProfileDataset(raw2024, 2024).festival.editionId, E24);
  assert.equal(parseVisitorProfileDataset(raw).festival.editionId, E25, "a standalone parse defaults to the original 2025 pin");
  const misplaced: [unknown, number][] = [[raw2023, 2024], [raw2024, 2023], [raw2024, 2025], [raw, 2023], [raw, 2024], [raw2023, 2022]];
  for (const [input, year] of misplaced) assert.throws(() => parseVisitorProfileDataset(input, year as ReviewedYear), VisitorProfileDataError, `${year}`);
  const mutations: [string, unknown, ReviewedYear, (d: any) => void][] = [
    ["2023 capture folder of 2025", raw2023, 2023, d => { d.source.importDir = "docs/research/imported/datalab-imsil-2025"; }],
    ["2024 period shifted", raw2024, 2024, d => { d.festival.end = "2024-10-07"; d.festival.days = 5; }],
    ["2023 other area", raw2023, 2023, d => { d.festival.areaName = "임실군 임실읍"; }],
    ["2023 other area code", raw2023, 2023, d => { d.festival.areaCode = "52750310"; }],
    ["2024 request bound to 2025", raw2024, 2024, d => { d.evidence.records.find((r: any) => r.kind === "demographics").baseYears = ["2025", "2025"]; }],
    ["2024 evidence from 2023 folder", raw2024, 2024, d => { d.evidence.records[0].path = d.evidence.records[0].path.replace("2024", "2023"); }],
    ["2023 link on a place not reviewed for 2023", raw2023, 2023, d => { d.destinationGroups[0].items[5].resource = { id: "527279", kind: "12", title: "소충사" }; }],
    ["2024 reviewed link dropped", raw2024, 2024, d => { for (const g of d.destinationGroups) for (const i of g.items) if (i.id === "3306424") i.resource = null; }],
  ];
  for (const [name, input, year, mutate] of mutations) {
    const d = clone(input); mutate(d);
    assert.throws(() => parseVisitorProfileDataset(d, year), VisitorProfileDataError, name);
  }
});

test("valid variations: tied ranks and a Y display flag are accepted as published", () => {
  const d = clone(raw) as any;
  d.destinationGroups[0].items[2].rank = 2; d.demographics[0].display = "Y";
  const p = visitorProfileFrom(parseVisitorProfileDataset(d))(imsil, [E25])!.editions[0];
  assert.deepEqual(p.destinationGroups[0].items.map(i => i.rank), [1, 2, 2, 4, 5, 6, 7]);
  assert.equal(p.demographics[0].malePercent, 0.6);
});

test("malformed or unreviewed artifacts are rejected rather than coerced", () => {
  const item = (d: any, g = 0, i = 0) => d.destinationGroups[g].items[i];
  const mutations: [string, (d: any) => void][] = [
    ["kind", d => { d.kind = "datalab-festival-profile"; }],
    ["schema", d => { d.schemaVersion = 2; }],
    ["http source", d => { d.source.officialUrl = "http://datalab.visitkorea.or.kr/datalab/portal/fes/getFesDataForm.do"; }],
    ["other import", d => { d.source.importDir = "docs/research/imported/hkjin-plan-03"; }],
    ["hash", d => { d.source.manifestSha256 = "abc"; }],
    ["collected time drift", d => { d.source.collectedAt = "2026-09-24T08:15:07.301Z"; }],
    ["local time", d => { d.source.collectedAt = "2026-09-24 17:15:07"; }],
    ["year", d => { d.festival.year = 2024; }],
    ["edition", d => { d.festival.editionId = "imsil-cheese-2024"; }],
    ["start", d => { d.festival.start = "2025-10-09"; }],
    ["days", d => { d.festival.days = 4; }],
    ["area", d => { d.festival.areaName = "임실군 임실읍"; }],
    ["region", d => { d.festival.regionCode = "52790"; }],
    ["datalab id", d => { d.festival.datalabFestivalId = "KCTF0062"; }],
    ["extra festival field", d => { d.festival.note = "x"; }],
    ["multi-year request", d => { d.evidence.records.find((r: any) => r.kind === "demographics").baseYears = ["2018", "2025"]; }],
    ["unbound request", d => { d.evidence.records.find((r: any) => r.kind === "destinations").baseYears = null; }],
    ["missing record", d => { d.evidence.records = d.evidence.records.filter((r: any) => r.kind !== "trend"); }],
    ["duplicate record", d => { d.evidence.records[0] = clone(d.evidence.records[1]); }],
    ["record path", d => { d.evidence.records[0].path = "tmp/list.json"; }],
    ["residence", d => { d.evidence.residence = "included"; }],
    ["seven bands", d => { d.demographics.pop(); }],
    ["duplicate band", d => { d.demographics[1] = { ...clone(d.demographics[0]), order: 2 }; }],
    ["band order", d => { [d.demographics[0], d.demographics[1]] = [d.demographics[1], d.demographics[0]]; }],
    ["null percent", d => { d.demographics[0].malePercent = null; }],
    ["string percent", d => { d.demographics[0].malePercent = "0.6"; }],
    ["percent over 100", d => { d.demographics[0].malePercent = 101; }],
    ["two decimals", d => { d.demographics[0].malePercent = 0.65; }],
    ["sum 99", d => { d.demographics[6].malePercent = 10.4; }],
    ["hidden count on band", d => { d.demographics[0].M_TOT = 809.5; }],
    ["display flag", d => { d.demographics[0].display = "X"; }],
    ["group order", d => { [d.destinationGroups[0], d.destinationGroups[1]] = [d.destinationGroups[1], d.destinationGroups[0]]; }],
    ["unknown group", d => { d.destinationGroups[2].group = "foreign"; }],
    ["two groups", d => { d.destinationGroups.pop(); }],
    ["empty group", d => { d.destinationGroups[1].items = []; }],
    ["rank 0", d => { item(d).rank = 0; }],
    ["rank goes down", d => { item(d, 0, 3).rank = 2; }],
    ["rank skips ahead", d => { item(d, 0, 1).rank = 3; }],
    ["fractional rank", d => { item(d, 0, 1).rank = 1.5; }],
    ["duplicate place", d => { item(d, 1, 3).id = item(d, 1, 2).id; }],
    ["non-numeric place", d => { item(d, 0, 2).id = "성수산"; }],
    ["food category", d => { item(d, 0, 5).category = "한식"; }],
    ["lodging category", d => { item(d, 0, 5).category = "펜션"; }],
    ["hidden search count", d => { item(d).SRCH_CNT = 27360; }],
    ["resource on unreviewed place", d => { item(d, 0, 1).resource = { id: "2718832", kind: "12", title: "임실치즈테마파크" }; }],
    ["reviewed resource dropped", d => { for (const g of d.destinationGroups) g.items[0].resource = null; }],
    ["fuzzy title", d => { item(d, 0, 4).resource.title = "상이암"; }],
    ["wrong kind", d => { item(d, 0, 4).resource.kind = "14"; }],
    ["extra resource field", d => { item(d).resource.point = { latitude: 35.6, longitude: 127.3 }; }],
    ["reviewed place missing from ranking", d => { for (const g of d.destinationGroups) g.items = g.items.filter((i: any) => i.id !== "725050"); }],
  ];
  for (const [name, mutate] of mutations) {
    const d = clone(raw); mutate(d);
    assert.throws(() => parseVisitorProfileDataset(d), VisitorProfileDataError, name);
  }
  assert.throws(() => parseVisitorProfileDataset(null), VisitorProfileDataError);
});

test("an invalid artifact drops only its own edition with a fixed log category", () => {
  const logged: string[] = [], bad = clone(raw2023) as any;
  bad.demographics[0].malePercent = null;
  const r = createVisitorProfileResolver([{ year: 2023, input: bad }, { year: 2024, input: raw2024 }, { year: 2025, input: raw }], c => logged.push(c));
  assert.equal(r(imsil, [E23]), null);
  assert.deepEqual(ids(r(imsil, [E23, E25])), [E25], "the valid selected edition stays as a single profile");
  assert.deepEqual(ids(r(imsil, [E24, E25])), [E24, E25], "other editions still compare");
  assert.deepEqual(logged, ["datalab-visitor-profile: invalid-artifact"]);

  const moved: string[] = [], m = createVisitorProfileResolver([{ year: 2023, input: raw2024 }, { year: 2025, input: raw }], c => moved.push(c));
  assert.deepEqual(ids(m(imsil, [E23, E24, E25])), [E25], "an artifact loaded under the wrong year is not reinterpreted");
  assert.deepEqual(moved, ["datalab-visitor-profile: invalid-artifact"]);

  const dup: string[] = [], d = createVisitorProfileResolver([{ year: 2025, input: raw }, { year: 2025, input: raw }], c => dup.push(c));
  assert.equal(d(imsil, [E25]), null, "an ambiguous duplicate edition disables the block");
  assert.deepEqual(dup, ["datalab-visitor-profile: invalid-artifact"]);
  assert.equal(createVisitorProfileResolver([], () => assert.fail("no log"))(imsil, ALL), null);
});

test("pure resolver: order-independent datasets, no datasets -> no block", () => {
  const d23 = parseVisitorProfileDataset(raw2023, 2023), d25 = parseVisitorProfileDataset(raw);
  assert.deepEqual(ids(visitorProfileFrom(d25, d23)(imsil, [E25, E23])), [E23, E25]);
  assert.deepEqual(visitorProfileFrom(d25, d23)(imsil, [E23, E25]), visitorProfileFrom(d23, d25)(imsil, [E23, E25]));
  assert.deepEqual(ids(visitorProfileFrom(d25)(imsil, ALL)), [E25], "a single loaded edition gives a single profile");
  assert.equal(visitorProfileFrom()(imsil, ALL), null);
  assert.throws(() => visitorProfileFrom(d25, d25), VisitorProfileDataError);
});
