import test from "node:test";
import assert from "node:assert/strict";
import catalogue from "../../data/festival-editions.json";
import raw from "../../data/datalab-visitor-profile.json";
import type { Edition } from "../comparison/types";
import { archiveCatalogue } from "../existing/identity";
import type { ArchiveFestival } from "../existing/types";
import { createVisitorProfileResolver, defaultVisitorProfile, parseVisitorProfileDataset, VisitorProfileDataError, visitorProfileFrom } from "./visitor-profile";

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));
const festivals = archiveCatalogue(catalogue.editions as Edition[], () => true), imsil = festivals.find(f => f.festivalId === "imsil-cheese")!;
const ALL = imsil.editions.map(e => e.editionId);
const withEdition = (f: ArchiveFestival, id: string, patch: Partial<ArchiveFestival["editions"][number]>): ArchiveFestival =>
  ({ ...f, editions: f.editions.map(e => e.editionId === id ? { ...e, ...patch } : e) });

test("reviewed 2025 edition gets the exact published percentages and source-order search ranks", () => {
  const p = defaultVisitorProfile(imsil, ["imsil-cheese-2025"])!;
  assert.deepEqual([p.editionId, p.year, p.start, p.end, p.areaName], ["imsil-cheese-2025", 2025, "2025-10-08", "2025-10-12", "임실군 성수면"]);
  assert.deepEqual(p.demographics.map(b => b.ageBand), ["0~9세", "10~19세", "20~29세", "30~39세", "40~49세", "50~59세", "60~69세", "70세 이상"]);
  assert.deepEqual(p.demographics.map(b => [b.malePercent, b.femalePercent]), [[0.6, 0.7], [2.5, 2.4], [4.8, 5.0], [7.3, 7.6], [8.3, 7.5], [10.4, 11.3], [11.4, 11.2], [4.6, 4.4]]);
  assert.ok(Math.abs(p.demographics.reduce((n, b) => n + b.malePercent + b.femalePercent, 0) - 100) < 1e-9, "sixteen published shares add to 100.0");
  assert.deepEqual(p.destinationGroups.map(g => [g.group, g.label, g.items.length]), [["outside", "외지인", 7], ["local", "현지인", 7], ["all", "전체", 7]]);
  for (const g of p.destinationGroups) {
    assert.deepEqual(g.items.map(i => i.rank), [1, 2, 3, 4, 5, 6, 7]);
    assert.deepEqual(g.items.map(i => i.id), ["2773331", "7837938", "173403", "10147587", "3306424", "54277", "725050"]);
  }
  const outside = p.destinationGroups[0].items;
  assert.deepEqual(outside[0], { id: "2773331", rank: 1, name: "임실치즈테마파크", address: "전북 임실군 도인2길 50-0", category: "테마공원", resource: { id: "2718832", kind: "12", title: "임실치즈테마파크" } });
  assert.deepEqual(outside[4].resource, { id: "317571", kind: "12", title: "상이암(임실)" }, "reviewed alias, not a name join");
  assert.deepEqual(outside[6].resource, { id: "527279", kind: "12", title: "소충사" });
  assert.deepEqual([outside[1].resource, outside[3].resource], [null, null], "same-address festival and museum stay separate unlinked places");
  assert.deepEqual(p.source, { title: "한국관광 데이터랩 · 문화관광축제 방문자 특성", url: "https://datalab.visitkorea.or.kr/datalab/portal/fes/getFesDataForm.do", collectedAt: "2026-09-24T08:15:07.300Z" });
  assert.deepEqual(defaultVisitorProfile(imsil, ALL), p, "other selected editions do not change it");
  p.demographics[0].malePercent = 99; p.destinationGroups[0].items[0].resource!.id = "x";
  assert.equal(defaultVisitorProfile(imsil, ["imsil-cheese-2025"])!.demographics[0].malePercent, 0.6, "each call returns a fresh copy");
  assert.equal(defaultVisitorProfile(imsil, ["imsil-cheese-2025"])!.destinationGroups[0].items[0].resource!.id, "2718832");
});

test("public projection is the exact whitelist: no counts, hashes, paths, DataLab IDs or flags", () => {
  const p = defaultVisitorProfile(imsil, ["imsil-cheese-2025"])!;
  assert.deepEqual(Object.keys(p).sort(), ["areaName", "demographics", "destinationGroups", "editionId", "end", "source", "start", "year"]);
  assert.deepEqual(Object.keys(p.demographics[0]).sort(), ["ageBand", "femalePercent", "malePercent"]);
  assert.deepEqual(Object.keys(p.destinationGroups[0]).sort(), ["group", "items", "label"]);
  assert.deepEqual(Object.keys(p.destinationGroups[0].items[0]).sort(), ["address", "category", "id", "name", "rank", "resource"]);
  assert.deepEqual(Object.keys(p.destinationGroups[0].items[0].resource!).sort(), ["id", "kind", "title"]);
  assert.deepEqual(Object.keys(p.source).sort(), ["collectedAt", "title", "url"]);
  const text = JSON.stringify(p);
  for (const leak of ["sha256", "docs/research", "KCTF0061", "52750340", "evidence", "manifest", "display", "sourceLabel", "SRCH", "_TOT", "baseYears", "resource-links", "\"order\"", "residence"]) assert.ok(!text.includes(leak), leak);
  for (const count of ["27360", "31746", "4386", "144529", "144530", "144656", "127842", "6691", "16405"]) assert.ok(!text.includes(count), `count ${count}`);
});

test("gating: only the reviewed, selected, uncancelled 2025 edition with its original period; chart windows are not an input", () => {
  assert.equal(defaultVisitorProfile(imsil, ["imsil-cheese-2024", "imsil-cheese-2023"]), null, "2025 not selected");
  assert.equal(defaultVisitorProfile(imsil, []), null);
  for (const f of festivals.filter(f => f.festivalId !== "imsil-cheese")) assert.equal(defaultVisitorProfile(f, f.editions.map(e => e.editionId)), null, f.festivalId);
  assert.equal(defaultVisitorProfile({ ...imsil, region: { ...imsil.region, code: "52790" } }, ALL), null, "other region");
  const cases: [string, ArchiveFestival][] = [
    ["cancelled", withEdition(imsil, "imsil-cheese-2025", { cancelled: true, status: "취소" })],
    ["undated", withEdition(imsil, "imsil-cheese-2025", { start: null, end: null, days: null })],
    ["4-day period", withEdition(imsil, "imsil-cheese-2025", { end: "2025-10-11", days: 4 })],
    ["shifted period, same days", withEdition(imsil, "imsil-cheese-2025", { start: "2025-10-09", end: "2025-10-13" })],
    ["other year", withEdition(imsil, "imsil-cheese-2025", { year: 2024 })],
    ["missing edition", { ...imsil, editions: imsil.editions.filter(e => e.editionId !== "imsil-cheese-2025") }],
  ];
  for (const [name, f] of cases) assert.equal(defaultVisitorProfile(f, ALL), null, name);
});

test("valid variations: tied ranks and a Y display flag are accepted as published", () => {
  const d = clone(raw) as any;
  d.destinationGroups[0].items[2].rank = 2; d.demographics[0].display = "Y";
  const p = visitorProfileFrom(parseVisitorProfileDataset(d))(imsil, ["imsil-cheese-2025"])!;
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

test("an invalid artifact disables only this block with a fixed log category", () => {
  const logged: string[] = [], d = clone(raw) as any;
  d.festival.year = 2024;
  const off = createVisitorProfileResolver(d, c => logged.push(c));
  assert.equal(off(imsil, ALL), null);
  assert.deepEqual(logged, ["datalab-visitor-profile: invalid-artifact"]);
});
