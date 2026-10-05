// node --test scripts/datalab-region-trends.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { appendFileSync, cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { IDS_PATH, IMPORT_DIR, REPO_ROOT } from "./build-datalab-festival-trend.mjs";
import { CATALOGUE_PATH, REGION_IDS_PATH } from "./build-datalab-region-annual.mjs";
import { buildRegionTrends, parseSpending, parseVisitors, serialize, SPENDING_HEADER, TREND_IDS_PATH, TREND_OUTPUT_PATH, VISITOR_HEADER } from "./build-datalab-region-trends.mjs";
import { OWNER_DIR } from "./datalab-owner-import.mjs";
import { REGIONS_DIR, REGIONS_EXPECTED, REGIONS_MANIFEST, REGIONS_ORIGINAL, verifyOwnerRegions } from "./datalab-owner-regions.mjs";

const RANGE = { from: 2020, to: 2025 };
const csv = (header, rows) => [header, ...rows].map(r => r.join(",")).join("\n") + "\n";
const readJson = path => JSON.parse(readFileSync(`${REPO_ROOT}${path}`, "utf8"));

test("generator is deterministic and matches the checked-in artifact", () => {
  const a = serialize(buildRegionTrends()), b = serialize(buildRegionTrends());
  assert.equal(a, b);
  assert.equal(readFileSync(`${REPO_ROOT}${TREND_OUTPUT_PATH}`, "utf8"), a);
  assert.ok(!/20\d\d-\d\d-\d\dT\d\d:/.test(a), "no clock timestamps in output");
});

test("the owner's region download: 9 official ZIPs and 20 CSVs match the list; the AI summary is kept, not used", () => {
  const { manifest } = verifyOwnerRegions(REPO_ROOT);
  assert.deepEqual(manifest.counts, REGIONS_EXPECTED);
  const preserved = manifest.files.filter(f => f.group === "table" && f.use === "preserved-only").map(f => f.table).sort();
  assert.deepEqual(preserved, ["AI 관광 분석_방문자", "AI 관광 분석_숙박_체류시간", "AI 관광 분석_연관지역", "AI 관광 분석_유사지역"]);
  assert.ok(manifest.files.filter(f => f.group === "table").every(f => f.encoding === "utf-8-bom" && f.lineEnding === "LF"));
});

test("four districts with reviewed codes, festival links by place and known source values", () => {
  const d = buildRegionTrends();
  assert.deepEqual(d.regions.map(r => [r.code, r.name, r.festivalIds]), [
    ["44230", "논산시", ["ganggyeong-jeotgal", "nonsan-strawberry"]], ["44150", "공주시", ["seokjangni-paleolithic"]],
    ["51130", "원주시", ["wonju-dancing-carnival", "wonju-hanji"]], ["27290", "달서구", ["daegu-chimac"]],
  ]);
  const nonsan = d.regions[0];
  assert.deepEqual(nonsan.spending.years[0], { year: 2020, total: 220333977, local: 3678222, outside: 216655756 });
  assert.deepEqual(nonsan.spending.industries.map(g => g.name), ["쇼핑업", "숙박업", "식음료업", "여가서비스업", "여행업", "운송업", "의료웰니스업"]);
  assert.equal(nonsan.spending.industries.reduce((n, g) => n + g.total, 0), nonsan.spending.years.reduce((n, y) => n + y.total, 0));
  assert.equal(nonsan.spending.sources.domestic.originalPath, "20261005095006_논산시_2020-2025_데이터랩_다운로드.zip/20261005095006_관광소비 추이_내국인.csv");
  assert.deepEqual(d.regions.map(r => r.visitors.range), Array(4).fill({ from: 2019, to: 2025 }));
});

test("yearly outside visitors equal the daily outside visitors summed over each year (Nonsan, Gongju, 2023-2025)", () => {
  const d = buildRegionTrends(), sums = points => points.reduce((m, p) => { if (p.value !== null) m[p.date.slice(0, 4)] = (m[p.date.slice(0, 4)] ?? 0) + p.value; return m; }, {});
  const nonsanDaily = sums(readJson("apps/web/data/region-history.json").find(s => s.region.code === "44230" && s.points[0].date === "2023-01-01").points);
  const gongjuDaily = sums(readJson("apps/web/data/regional-history-expanded.json").datasets.find(s => s.region.code === "44150").points);
  for (const [code, daily] of [["44230", nonsanDaily], ["44150", gongjuDaily]]) {
    const years = d.regions.find(r => r.code === code).visitors.years;
    for (const y of [2023, 2024, 2025]) assert.ok(Math.abs(years.find(v => v.year === y).outside - daily[y]) <= 1, `${code} ${y}: ${daily[y]}`);
  }
});

test("spending parser: every year has a total, known groups only, groups add up", () => {
  const rows = year => [[year, "전체", "300.0"], [year, "운송업", "1.0E2"], [year, "식음료업", "200"]];
  const ok = csv(SPENDING_HEADER, [2020, 2021, 2022, 2023, 2024, 2025].flatMap(rows));
  assert.deepEqual(parseSpending(ok, RANGE)[0], { year: 2020, total: 300, industries: { 운송업: 100, 식음료업: 200 } });
  const bad = [
    [csv(SPENDING_HEADER, [2020, 2021, 2022, 2023, 2024].flatMap(rows)), /Missing total for 2025/],
    [csv(SPENDING_HEADER, [...[2020, 2021, 2022, 2023, 2024, 2025].flatMap(rows), [2019, "전체", "1"]]), /outside the download range/],
    [csv(SPENDING_HEADER, [...[2020, 2021, 2022, 2023, 2024, 2025].flatMap(rows), [2020, "운송업", "1"]]), /Repeated/],
    [csv(SPENDING_HEADER, [...[2020, 2021, 2022, 2023, 2024, 2025].flatMap(rows), [2021, "기타", "1"]]), /Unknown industry group/],
    [csv(SPENDING_HEADER, [...[2021, 2022, 2023, 2024, 2025].flatMap(rows), [2020, "전체", "300"], [2020, "운송업", "100"], [2020, "식음료업", "150"]]), /do not add up/],
    [csv(SPENDING_HEADER, [...[2021, 2022, 2023, 2024, 2025].flatMap(rows), [2020, "전체", "-300"]]), /non-negative/],
  ];
  for (const [text, error] of bad) assert.throws(() => parseSpending(text, RANGE), error);
});

test("visitor parser: comparison year plus the range without gaps; previous values and rates follow from the counts", () => {
  const good = [["2019", "100", "", ""], ["2020", "90", "", ""], ["2021", "99", "90", "10.0"], ["2022", "99", "99", "0.0"], ["2023", "110", "99", "11.1"], ["2024", "1.2E2", "110", "9.1"], ["2025", "60", "120", "-50.0"]];
  assert.deepEqual(parseVisitors(csv(VISITOR_HEADER, good), RANGE).map(v => v.outside), [100, 90, 99, 99, 110, 120, 60]);
  const swap = (i, row) => good.map((r, j) => (j === i ? row : r));
  const bad = [
    [good.slice(1), /comparison year and the download range/],
    [swap(3, ["2023", "99", "99", "0.0"]), /without gaps/],
    [swap(2, ["2021", "99", "91", "8.8"]), /Previous-year value/],
    [swap(2, ["2021", "99", "90", "9.5"]), /Change rate/],
    [swap(1, ["2020", "90.5", "", ""]), /whole count/],
  ];
  for (const [rows, error] of bad) assert.throws(() => parseVisitors(csv(VISITOR_HEADER, rows), RANGE), error);
});

function sandbox() {
  const dir = mkdtempSync(`${tmpdir()}/datalab-trends-`) + "/";
  mkdirSync(`${dir}apps/web/data`, { recursive: true });
  for (const p of [IMPORT_DIR, OWNER_DIR, REGIONS_DIR]) cpSync(`${REPO_ROOT}${p}`, `${dir}${p}`, { recursive: true });
  for (const p of [IDS_PATH, REGION_IDS_PATH, CATALOGUE_PATH, TREND_IDS_PATH]) cpSync(`${REPO_ROOT}${p}`, `${dir}${p}`);
  return dir;
}
const editJson = (root, path, edit) => { const p = `${root}${path}`, m = JSON.parse(readFileSync(p, "utf8")); edit(m); writeFileSync(p, JSON.stringify(m, null, 2) + "\n"); };
const region = (m, code) => m.regions.find(r => r.code === code);
const regionFile = (root, test) => `${root}${REGIONS_ORIGINAL}/${JSON.parse(readFileSync(`${root}${REGIONS_MANIFEST}`, "utf8")).files.find(test).path}`;

test("tampered downloads, unreviewed codes and festival links are rejected", () => {
  const cases = [
    [root => appendFileSync(regionFile(root, f => f.table === "관광소비 추이_현지인" && f.region === "원주시"), "x"), /differs from its ZIP entry/],
    [root => appendFileSync(regionFile(root, f => f.group === "zip" && f.region === "달서구" && f.kind === "방문자"), "x"), /hash differs from the download list/],
    [root => writeFileSync(`${root}${REGIONS_ORIGINAL}/data/extra.csv`, "a\n"), /Unlisted owner region file/],
    [root => editJson(root, REGIONS_MANIFEST, m => { m.files.find(f => f.table === "AI 관광 분석_연관지역").use = "consumed"; }), /manifest differs/],
    [root => editJson(root, TREND_IDS_PATH, m => { region(m, "44150").festivalIds.push("wonju-hanji"); region(m, "51130").festivalIds = ["wonju-dancing-carnival"]; }), /Festival place is not the region: wonju-hanji/],
    [root => editJson(root, TREND_IDS_PATH, m => { region(m, "27290").festivalIds.push("daegu-yangnyeongsi"); }), /linked to more than one region/],
    [root => editJson(root, TREND_IDS_PATH, m => { region(m, "51130").province = "강원도"; }), /not in catalogue/],
    [root => editJson(root, TREND_IDS_PATH, m => { const n = region(m, "44230"); [n.spendingZip, n.visitorZip] = [n.visitorZip, n.spendingZip]; }), /is not the region's 관광소비/],
    [root => editJson(root, TREND_IDS_PATH, m => { m.regions.pop(); }), /cover the consumed downloads/],
  ];
  for (const [mutate, error] of cases) {
    const root = sandbox();
    try { assert.doesNotThrow(() => buildRegionTrends(root)); mutate(root); assert.throws(() => buildRegionTrends(root), error); }
    finally { rmSync(root, { recursive: true, force: true }); }
  }
});
