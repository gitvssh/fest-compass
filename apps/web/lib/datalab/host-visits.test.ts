import test from "node:test";
import assert from "node:assert/strict";
import catalogue from "../../data/festival-editions.json";
import linksRaw from "../../data/datalab-festival-links.json";
import trendRaw from "../../data/datalab-festival-trend.json";
import type { Edition } from "../comparison/types";
import { archiveCatalogue, editionDays } from "../existing/identity";
import type { ArchiveFestival } from "../existing/types";
import { createHostVisitsResolver, defaultHostVisits, HostVisitsDataError, hostVisitsFrom, parseFestivalLinks } from "./host-visits";
import { parseFestivalPeriodDataset } from "./model";

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));
const editions = catalogue.editions as Edition[], trend = parseFestivalPeriodDataset(trendRaw);
const festivals = archiveCatalogue(editions, () => true), imsil = festivals.find(f => f.festivalId === "imsil-cheese")!;
const IDS = ["imsil-cheese-2025", "imsil-cheese-2024", "imsil-cheese-2023"];
const withEdition = (f: ArchiveFestival, id: string, patch: Partial<ArchiveFestival["editions"][number]>): ArchiveFestival =>
  ({ ...f, editions: f.editions.map(e => e.editionId === id ? { ...e, ...patch } : e) });

test("reviewed link: imsil-cheese -> imsil-n-cheese in 52750, reviewed periods equal the archive editions and DataLab day counts", () => {
  const [link] = parseFestivalLinks(linksRaw, trend);
  assert.deepEqual([link.archiveFestivalId, link.datalabFestivalId, link.regionCode, imsil.region.code], ["imsil-cheese", "imsil-n-cheese", "52750", "52750"]);
  const source = trend.festivals.find(f => f.id === "imsil-n-cheese")!;
  assert.equal(source.name, "임실N치즈축제");
  for (const r of link.editions) {
    const e = editions.find(x => x.id === r.editionId)!;
    assert.deepEqual([e.year, e.start, e.end, editionDays(e.start, e.end)], [r.year, r.start, r.end, r.days]);
    assert.equal(source.years.find(y => y.year === r.year)!.days, r.days);
  }
  assert.deepEqual(link.editions.map(e => e.days), [4, 4, 5]);
});

test("selected editions map in the requested order with counts from the DataLab row and share computed from counts", () => {
  const v = defaultHostVisits(imsil, IDS)!;
  assert.deepEqual(v.editions.map(e => [e.editionId, e.start, e.end, e.days]), [["imsil-cheese-2025", "2025-10-08", "2025-10-12", 5], ["imsil-cheese-2024", "2024-10-03", "2024-10-06", 4], ["imsil-cheese-2023", "2023-10-06", "2023-10-09", 4]]);
  assert.deepEqual([v.festivalName, v.allYearsHref], ["임실N치즈축제", "/compare/annual?festival=imsil-n-cheese"]);
  assert.deepEqual(v.source, { title: trend.source.title, url: "https://datalab.visitkorea.or.kr/datalab/portal/fes/getFesDataForm.do", downloadedOn: "2026-08-29" });
  const y2025 = v.editions[0];
  assert.deepEqual([y2025.local, y2025.outside, y2025.foreign, y2025.total, y2025.dailyMean], [16688, 127842, 126, 144656, 28931.2]);
  const rows = trend.festivals.find(f => f.id === "imsil-n-cheese")!.years;
  for (const e of v.editions) {
    const row = rows.find(r => r.year === e.year)!;
    assert.equal(e.outsideShare, e.outside / e.total);
    assert.ok(e.outsideShare > 0 && e.outsideShare < 1);
    assert.ok(Math.abs(e.outsideShare * 100 - Number(row.raw[13])) <= 0.01, `${e.year} share vs source percent`);
    assert.equal(e.local + e.outside + e.foreign, e.total);
    assert.ok(Math.abs(e.total / e.days - e.dailyMean) <= 0.01);
  }
  assert.deepEqual(defaultHostVisits(imsil, ["imsil-cheese-2023"])!.editions.map(e => e.editionId), ["imsil-cheese-2023"]);
});

test("unreviewed festivals, other regions, cancelled/undated/changed-period editions are dropped; valid subset survives", () => {
  for (const f of festivals.filter(f => f.festivalId !== "imsil-cheese")) assert.equal(defaultHostVisits(f, f.editions.map(e => e.editionId)), null, f.festivalId);
  assert.equal(defaultHostVisits({ ...imsil, region: { ...imsil.region, code: "52790" } }, IDS), null, "region must match the link");
  const cases: [string, ArchiveFestival][] = [
    ["cancelled", withEdition(imsil, "imsil-cheese-2024", { cancelled: true, status: "취소" })],
    ["no dates", withEdition(imsil, "imsil-cheese-2024", { start: null, end: null, days: null })],
    ["changed period, same days", withEdition(imsil, "imsil-cheese-2024", { start: "2024-10-04", end: "2024-10-07" })],
    ["different day count", withEdition(imsil, "imsil-cheese-2024", { end: "2024-10-07", days: 5 })],
    ["unknown mapping id", withEdition(imsil, "imsil-cheese-2024", { editionId: "imsil-cheese-2024b" })],
  ];
  for (const [name, f] of cases) assert.deepEqual(defaultHostVisits(f, IDS)!.editions.map(e => e.year), [2025, 2023], name);
  const allBad = withEdition(withEdition(withEdition(imsil, "imsil-cheese-2025", { cancelled: true }), "imsil-cheese-2024", { cancelled: true }), "imsil-cheese-2023", { cancelled: true });
  assert.equal(defaultHostVisits(allBad, IDS), null);
  assert.equal(defaultHostVisits(imsil, []), null);
});

test("a DataLab year whose day count differs from the edition is dropped, and source foreign 0 stays 0", () => {
  const links = parseFestivalLinks(linksRaw, trend), t = clone(trend), rows = t.festivals.find(f => f.id === "imsil-n-cheese")!.years;
  const y24 = rows.find(y => y.year === 2024)!; y24.days = 5;
  const y25 = rows.find(y => y.year === 2025)!; y25.local += y25.foreign; y25.foreign = 0;
  const v = hostVisitsFrom(links, t)(imsil, IDS)!;
  assert.deepEqual(v.editions.map(e => e.year), [2025, 2023]);
  assert.equal(v.editions[0].foreign, 0);
});

test("malformed links are rejected strictly and disable only this block with a fixed log category", () => {
  const mutations: [string, (d: any) => void][] = [
    ["version", d => { d.version = 2; }],
    ["empty links", d => { d.links = []; }],
    ["duplicate archive id", d => { d.links.push(clone(d.links[0])); }],
    ["unknown DataLab id", d => { d.links[0].datalabFestivalId = "imsil-cheese-fest"; }],
    ["region code", d => { d.links[0].regionCode = "5275"; }],
    ["missing evidence", d => { delete d.links[0].evidence; }],
    ["days vs period", d => { d.links[0].editions[2].days = 4; }],
    ["days vs DataLab", d => { d.links[0].editions[2].end = "2025-10-11"; d.links[0].editions[2].days = 4; }],
    ["year vs start", d => { d.links[0].editions[0].year = 2022; }],
    ["invalid date", d => { d.links[0].editions[0].start = "2023-02-30"; }],
    ["duplicate edition", d => { d.links[0].editions[1] = clone(d.links[0].editions[0]); }],
  ];
  for (const [name, mutate] of mutations) {
    const d = clone(linksRaw); mutate(d);
    assert.throws(() => parseFestivalLinks(d, trend), HostVisitsDataError, name);
  }
  const logged: string[] = [];
  const off = createHostVisitsResolver({ version: 1, links: [] }, trendRaw, c => logged.push(c));
  assert.equal(off(imsil, IDS), null);
  const badTrend = clone(trendRaw); badTrend.festivals[0].years[0].raw[6] = "1.0";
  assert.equal(createHostVisitsResolver(linksRaw, badTrend, c => logged.push(c))(imsil, IDS), null);
  assert.deepEqual(logged, ["datalab-host-visits: invalid-artifact", "datalab-host-visits: invalid-artifact"]);
});

test("projection carries no evidence, paths, hashes, commits or raw rows", () => {
  const text = JSON.stringify(defaultHostVisits(imsil, IDS));
  for (const leak of ["evidence", "sha256", "docs/research", "commit", "\"raw\"", "github.com", "manifest", "원문 축제명"]) assert.ok(!text.includes(leak), leak);
  assert.deepEqual(Object.keys(defaultHostVisits(imsil, IDS)!.editions[0]).sort(), ["dailyMean", "days", "editionId", "end", "foreign", "local", "outside", "outsideShare", "start", "total", "year"]);
});
