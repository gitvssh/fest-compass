// node --test scripts/datalab-region-annual.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { appendFileSync, cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { CsvError } from "./datalab-csv.mjs";
import { CONSUMED_REGION_PATHS, IDS_PATH, IMPORT_DIR, MANIFEST_PATH, ORIGINAL_DIR, REPO_ROOT, sha256, verifyImport } from "./build-datalab-festival-trend.mjs";
import { ANNUAL_HEADER, buildRegionDataset, CATALOGUE_PATH, parseAnnualCount, parseRegionAnnual, REGION_IDS_PATH, REGION_OFFICIAL_URL, REGION_OUTPUT_PATH, serialize } from "./build-datalab-region-annual.mjs";

const HEAD = ANNUAL_HEADER.join(",");
const table = (rows, name = "임실군") => `\uFEFF${HEAD}\n${rows.map(([y, seg, v]) => `${y},${name},${seg},${v}`).join("\n")}\n`;
const year = (y, local = "2.0", outside = "3.0", total = "5.0") => [[y, "외지인방문자(b)", outside], [y, "전체방문자(a+b)", total], [y, "현지인방문자(a)", local]];
const years = (from, to) => Array.from({ length: to - from + 1 }, (_, i) => year(String(from + i))).flat();

test("annual counts accept source E notation, keep missing as null and reject malformed text", () => {
  assert.equal(parseAnnualCount("1.0762885E7"), 10762885);
  assert.equal(parseAnnualCount("4981442.0"), 4981442);
  assert.equal(parseAnnualCount("0"), 0);
  assert.equal(parseAnnualCount("5E+2"), 500);
  assert.equal(parseAnnualCount(""), null);
  assert.equal(parseAnnualCount("N/A"), null);
  for (const bad of [" 1", "1 ", "1,000", "-1", "-0.0", "1e7", "E7", "1E", "1.E7", ".5", "1.", "01", "NaN", "Infinity", "n/a", "null", "1E400"]) assert.throws(() => parseAnnualCount(bad), CsvError, bad);
  assert.throws(() => parseAnnualCount(undefined), CsvError);
});

test("table parser: three segments per year, source total kept, missing values stay null", () => {
  const rows = parseRegionAnnual(table([...year("2019", "2.0", "3.0", "6.0"), ...year("2018", "", "1.0E1", "N/A")]), "임실군", [2018, 2019]);
  assert.deepEqual(rows, [
    { year: 2018, local: null, outside: 10, total: null, raw: { local: "", outside: "1.0E1", total: "N/A" } },
    { year: 2019, local: 2, outside: 3, total: 6, raw: { local: "2.0", outside: "3.0", total: "6.0" } },
  ]);
});

test("table parser rejects header, segment, year, name and sum defects", () => {
  const ok = years(2018, 2025);
  assert.doesNotThrow(() => parseRegionAnnual(table(ok), "임실군"));
  const cases = [
    ["header", `\uFEFF기준년도,기초지자체,방문자 구분,방문자 수\n`, /Unexpected header/],
    ["missing segment", table(ok.filter(r => !(r[0] === "2020" && r[1] === "현지인방문자(a)"))), /Missing segment local: 2020/],
    ["duplicate segment", table([...ok, ["2020", "외지인방문자(b)", "3.0"]]), /Duplicate segment/],
    ["unknown segment", table([...ok, ["2020", "외국인방문자(c)", "3.0"]]), /Unknown visitor segment/],
    ["year gap", table(years(2018, 2024).filter(r => r[0] !== "2021").concat(year("2025"))), /Unexpected observation years/],
    ["extra year", table([...ok, ...year("2026")]), /Unexpected observation years/],
    ["yyyymm value", table(ok.map(r => r[0] === "2018" ? ["201801", r[1], r[2]] : r)), /Invalid observation year/],
    ["name", table(ok, "고성군"), /Region name mismatch/],
    ["sum gap 2", table([...years(2018, 2024), ...year("2025", "2.0", "3.0", "7.0")]), /Segment sum mismatch: 2025/],
    ["garbage", table([...years(2018, 2024), ...year("2025", "2.0", "3.0명", "5.0")]), /Malformed annual count/],
    ["short row", `\uFEFF${HEAD}\n2018,임실군,현지인방문자(a)\n`, /expected 4/],
  ];
  for (const [name, text, error] of cases) assert.throws(() => parseRegionAnnual(text, "임실군"), error, name);
  assert.doesNotThrow(() => parseRegionAnnual(table([...years(2018, 2024), ...year("2025", "2.0", "3.0", "6.0")]), "임실군"), "a one-count gap is the source's and allowed");
});

test("generator is deterministic, matches the checked-in artifact and pins the reviewed source bytes", () => {
  const a = serialize(buildRegionDataset()), b = serialize(buildRegionDataset());
  assert.equal(a, b);
  assert.equal(readFileSync(`${REPO_ROOT}${REGION_OUTPUT_PATH}`, "utf8"), a);
  assert.ok(!/20\d\d-\d\d-\d\dT\d\d:/.test(a), "no clock timestamps in output");
  const d = JSON.parse(a), [r] = d.regions, { manifest, manifestSha256 } = verifyImport();
  assert.equal(d.regions.length, 1);
  assert.deepEqual([d.kind, d.schemaVersion, d.source.officialUrl, d.source.downloadTimezone, d.source.manifestSha256], ["datalab-region-visitor-annual", 1, REGION_OFFICIAL_URL, null, manifestSha256]);
  const entry = manifest.files.find(f => f.path === CONSUMED_REGION_PATHS[0]);
  assert.deepEqual([r.code, r.name, r.downloadDate, r.source.sha256, r.source.bytes], ["52750", "임실군", "2026-08-30", "e36cc998f14454db0f9349356076d60815c83f245a13c808c8f29f5f69457e6d", 1193]);
  assert.equal(sha256(readFileSync(`${REPO_ROOT}${r.source.path}`)), entry.sha256);
  assert.equal(r.source.path, `${ORIGINAL_DIR}/${CONSUMED_REGION_PATHS[0]}`);
  assert.deepEqual(r.years.map(y => y.year), [2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025], "value years, not the 2026 download stamp");
  assert.deepEqual(r.years.find(y => y.year === 2021), { year: 2021, local: 3433454, outside: 7329430, total: 10762885, raw: { local: "3433454.0", outside: "7329430.0", total: "1.0762885E7" } });
  assert.deepEqual(r.years.map(y => [y.year, y.total - y.local - y.outside]).filter(([, gap]) => gap), [[2021, 1], [2024, 1]], "source total preserved, not re-summed");
  for (const y of r.years) for (const k of ["local", "outside", "total"]) assert.equal(Number(y.raw[k]), y[k]);
});

test("annual outside equals the sum of the district's daily outside visits for every fully observed year", () => {
  const expanded = JSON.parse(readFileSync(`${REPO_ROOT}apps/web/data/regional-history-expanded.json`, "utf8"));
  const daily = expanded.datasets.filter(d => d.region.code === "52750");
  assert.equal(daily.length, 1);
  const annual = buildRegionDataset().regions[0].years, checked = [];
  for (const y of [...new Set(daily[0].points.map(p => Number(p.date.slice(0, 4))))]) {
    const points = daily[0].points.filter(p => p.date.startsWith(`${y}-`)), days = (Date.UTC(y + 1, 0, 1) - Date.UTC(y, 0, 1)) / 86_400_000;
    if (points.length !== days || points.some(p => p.quality !== "complete" || typeof p.value !== "number")) continue;
    const sum = points.reduce((n, p) => n + p.value, 0);
    assert.ok(Math.abs(sum - annual.find(a => a.year === y).outside) <= 0.5, `${y}: ${sum}`);
    checked.push(y);
  }
  assert.deepEqual(checked, [2023, 2024, 2025]);
});

test("manifest consumes exactly 26 festival trends plus the one reviewed region file; region IDs cover it exactly", () => {
  const { manifest } = verifyImport(), ids = JSON.parse(readFileSync(`${REPO_ROOT}${REGION_IDS_PATH}`, "utf8"));
  const consumed = manifest.files.filter(f => f.use === "consumed");
  assert.equal(consumed.filter(f => f.group === "festival").length, 26);
  assert.deepEqual(consumed.filter(f => f.group !== "festival").map(f => f.path), CONSUMED_REGION_PATHS);
  assert.deepEqual(ids.regions.map(r => r.sourceFile), CONSUMED_REGION_PATHS);
  assert.equal(manifest.files.filter(f => f.group === "region_visitor" && f.use === "preserved-only").length, 95);
  assert.equal(manifest.files.filter(f => f.use === "preserved-only").length, 309 - 27);
});

function sandbox() {
  const dir = mkdtempSync(`${tmpdir()}/datalab-region-`) + "/";
  mkdirSync(`${dir}apps/web/data`, { recursive: true });
  cpSync(`${REPO_ROOT}${IMPORT_DIR}`, `${dir}${IMPORT_DIR}`, { recursive: true });
  for (const p of [IDS_PATH, REGION_IDS_PATH, CATALOGUE_PATH]) cpSync(`${REPO_ROOT}${p}`, `${dir}${p}`);
  return dir;
}
const editJson = (root, path, edit) => { const p = `${root}${path}`, m = JSON.parse(readFileSync(p, "utf8")); edit(m); writeFileSync(p, JSON.stringify(m, null, 2) + "\n"); };

test("tampered bytes, widened consumption and unreviewed region codes are rejected", () => {
  const residence = CONSUMED_REGION_PATHS[0].replace("방문자 수 추이", "방문자 거주지");
  const cases = [
    [root => appendFileSync(`${root}${ORIGINAL_DIR}/${CONSUMED_REGION_PATHS[0]}`, "x"), /hash mismatch/],
    [root => editJson(root, MANIFEST_PATH, m => { m.files.find(f => f.path === residence).use = "consumed"; m.files.find(f => f.path === CONSUMED_REGION_PATHS[0]).use = "preserved-only"; }), /Manifest entry mismatch/],
    [root => editJson(root, MANIFEST_PATH, m => { m.files.find(f => f.path === CONSUMED_REGION_PATHS[0]).use = "preserved-only"; m.counts.consumed = 26; }), /Unexpected consumed count/],
    [root => editJson(root, REGION_IDS_PATH, m => { m.regions[0].sourceFile = residence; }), /cover consumed/],
    [root => editJson(root, REGION_IDS_PATH, m => { m.regions.push({ ...m.regions[0], code: "46770" }); }), /cover consumed/],
    [root => editJson(root, REGION_IDS_PATH, m => { m.regions[0].code = "44230"; }), /not in catalogue/],
    [root => editJson(root, REGION_IDS_PATH, m => { m.regions[0].code = "5275"; }), /5-digit/],
    [root => editJson(root, REGION_IDS_PATH, m => { m.regions[0].name = "진안군"; }), /name mismatch/],
  ];
  for (const [mutate, error] of cases) {
    const root = sandbox();
    try { assert.doesNotThrow(() => buildRegionDataset(root)); mutate(root); assert.throws(() => buildRegionDataset(root), error); }
    finally { rmSync(root, { recursive: true, force: true }); }
  }
});
