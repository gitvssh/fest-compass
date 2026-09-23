// node --test scripts/datalab-festival-trend.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { cpSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, appendFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { CsvError, parseCsv, parseSourceNumber, parseTable } from "./datalab-csv.mjs";
import { buildDataset, classify, EXPECTED_COUNTS, gitBlobId, IDS_PATH, IMPORT_DIR, MANIFEST_PATH, ORIGINAL_DIR, OUTPUT_PATH, originalUrl, REPO_ROOT, serialize, SOURCE, verifyImport } from "./build-datalab-festival-trend.mjs";

test("CSV parser handles BOM, quotes, embedded newlines, CRLF and trailing empty cells", () => {
  assert.deepEqual(parseCsv("\uFEFFa,b,c\n1,,\n"), [["a", "b", "c"], ["1", "", ""]]);
  assert.deepEqual(parseCsv('a,b\r\n"x, y","he said ""hi""\nnext"\r\n'), [["a", "b"], ["x, y", 'he said "hi"\nnext']]);
  assert.deepEqual(parseCsv("a,b\n1,2"), [["a", "b"], ["1", "2"]]);
  assert.deepEqual(parseCsv('a\n""\n'), [["a"], [""]]);
  assert.deepEqual(parseTable("h1,h2\n0.0,N/A\n").rows, [["0.0", "N/A"]]);
});

test("CSV parser rejects malformed input", () => {
  for (const bad of ['a,"b\n', 'a,b"c\n', 'a,"b"c\n', "a\rb\n"]) assert.throws(() => parseCsv(bad), CsvError, bad);
  assert.throws(() => parseTable("a,b\n1\n"), /expected 2/);
  assert.throws(() => parseTable("a,b\n1,2,3\n"), /expected 2/);
  assert.throws(() => parseTable("a,b\n\n1,2\n"), /expected 2/);
  assert.throws(() => parseTable("x,y\n", ["a", "b"]), /Unexpected header/);
});

test("numeric parser never turns empty or N/A into zero and rejects malformed values", () => {
  assert.equal(parseSourceNumber(""), null);
  assert.equal(parseSourceNumber("N/A"), null);
  assert.equal(parseSourceNumber("0.0"), 0);
  assert.equal(parseSourceNumber("32565.3333"), 32565.3333);
  assert.equal(parseSourceNumber("-11.0"), -11);
  for (const bad of [" 1", "1,000", "1e3", "NaN", "Infinity", "01", "1.", ".5", "-", "n/a", "null"]) assert.throws(() => parseSourceNumber(bad), CsvError, bad);
  assert.throws(() => parseSourceNumber(undefined), CsvError);
});

test("all 304 CSVs and 5 source docs are manifest-listed with matching bytes and original commit blobs", () => {
  const { manifest, files } = verifyImport();
  assert.equal(manifest.files.length, 309);
  assert.deepEqual(manifest.counts, EXPECTED_COUNTS);
  assert.equal(manifest.source.commit, SOURCE.commit);
  for (const f of manifest.files) {
    const bytes = files.get(f.path).bytes;
    assert.equal(gitBlobId(bytes), f.gitBlob);
    assert.equal(f.url, originalUrl(f.path));
    assert.ok(f.url.startsWith("https://github.com/travel-resolver/pick-d-day/blob/f362e65ba9e1cac18757951236484cff666c2696/developer/hkjin/plan-03-datalab/"));
    assert.ok(!/[가-힣 ]/.test(f.url), "URL segments are percent-encoded");
    if (f.group !== "doc") { assert.equal(f.encoding, "utf-8-bom"); assert.equal(f.lineEnding, "LF"); }
  }
  assert.equal(decodeURIComponent(originalUrl("data/a b/가.csv").split("/blob/")[1]), `${SOURCE.commit}/${SOURCE.basePath}/data/a b/가.csv`);
  const trend = manifest.files.filter(f => f.table === "연도별 방문자 추이");
  assert.equal(trend.length, 26);
  assert.ok(trend.every(f => f.use === "consumed" && f.header.length === 16 && f.header[2] === "축체기간(일)"));
  assert.equal(trend.reduce((n, f) => n + f.rowCount, 0), 147);
  assert.ok(manifest.files.filter(f => f.use === "consumed").every(f => f.group === "festival"));
});

test("unknown source classifications are rejected", () => {
  assert.throws(() => classify("data/extra.csv"), /Unknown source file classification/);
  assert.throws(() => classify("data/20260829165421_문화관광축제_2018-2025_데이터랩_다운로드/20260829165420_서산해미읍성축제_연도별 방문자 추이.csv"), /Unknown/);
  assert.throws(() => classify("data/20260829165421_문화관광축제_2018-2025_데이터랩_다운로드/20260829165421_서산해미읍성축제_새 지표.csv"), /Unknown/);
  assert.throws(() => classify("data/PROMPT-desktop.txt"), /Unknown/);
});

test("generator is deterministic and matches the checked-in artifact", () => {
  const a = serialize(buildDataset()), b = serialize(buildDataset());
  assert.equal(a, b);
  assert.equal(readFileSync(`${REPO_ROOT}${OUTPUT_PATH}`, "utf8"), a);
  assert.ok(!/20\d\d-\d\d-\d\dT\d\d:/.test(a), "no clock timestamps in output");
});

test("26 stable IDs, 147 rows, expected years, gaps and internal consistency", () => {
  const d = buildDataset(), ids = JSON.parse(readFileSync(`${REPO_ROOT}${IDS_PATH}`, "utf8"));
  assert.deepEqual(d.festivals.map(f => f.id), ids.festivals.map(f => f.id));
  assert.equal(new Set(d.festivals.map(f => f.id)).size, 26);
  const rows = d.festivals.flatMap(f => f.years.map(y => ({ ...y, id: f.id })));
  assert.equal(rows.length, 147);
  const byYear = {};
  for (const r of rows) byYear[r.year] = (byYear[r.year] ?? 0) + 1;
  assert.deepEqual(byYear, { 2018: 25, 2019: 24, 2022: 22, 2023: 26, 2024: 26, 2025: 24 });
  assert.ok(rows.every(r => r.year !== 2020 && r.year !== 2021));
  for (const r of rows) {
    assert.ok(Math.abs(r.local + r.outside + r.foreign - r.periodTotal) <= 0.5);
    assert.ok(Math.abs(r.periodTotal / r.days - r.dailyMean) <= 0.01);
    assert.ok(r.days >= 1 && r.periodTotal > 0 && r.dailyMean > 0);
    assert.equal(r.raw.length, 16);
  }
  const years = id => d.festivals.find(f => f.id === id).years.map(y => y.year);
  assert.deepEqual(years("yeongam-wangin"), [2018, 2019, 2023, 2024]);
  assert.deepEqual(years("pyeongchang-trout"), [2019, 2023, 2024, 2025]);
  assert.ok(!years("goryeong-daegaya").includes(2025));
  const seosan = d.festivals.find(f => f.id === "seosan-haemieupseong");
  assert.deepEqual(seosan.years[0].raw, ["서산해미읍성축제", "2018", "3", "39400.0", "58296.0", "0.0", "97696.0", "32565.3333", "", "", "N/A", "97696.0", "40.33", "59.67", "0.0", "0.0"]);
  assert.equal(seosan.downloadDate, "2026-08-29");
  assert.equal(d.source.downloadTimezone, null);
  assert.ok(seosan.source.originalUrl.includes(encodeURIComponent("20260829165421_서산해미읍성축제_연도별 방문자 추이.csv")));
});

test("raw foreign zero is retained as source 0 and first-row derivative blanks stay raw strings", () => {
  const rows = buildDataset().festivals.flatMap(f => f.years);
  const zeros = rows.filter(r => r.foreign === 0);
  assert.equal(zeros.length, 49);
  assert.ok(zeros.every(r => r.raw[5] === "0.0" || r.raw[5] === "0"));
  const firsts = buildDataset().festivals.map(f => f.years[0]);
  assert.ok(firsts.every(r => r.raw[8] === "" && r.raw[10] === "N/A"));
  assert.ok(rows.every(r => !("previousDailyMean" in r) && !("growth" in r)));
});

test("Nonsan is absent and main-index-only festival-years never leak into the trend", () => {
  const d = buildDataset(), { manifest, files } = verifyImport();
  assert.ok(!d.festivals.some(f => f.aliases.some(a => a.includes("논산"))));
  const trendPairs = new Set(d.festivals.flatMap(f => f.years.map(y => `${f.name}/${y.year}`)));
  const mainPairs = new Set();
  for (const f of manifest.files.filter(f => f.table === "문화관광축제 주요 지표")) {
    for (const r of parseTable(files.get(f.path).bytes.toString("utf8").replace(/^\uFEFF/, "")).rows) mainPairs.add(`${r[0]}/${r[2]}`);
  }
  assert.equal(mainPairs.size, 154);
  const onlyMain = [...mainPairs].filter(p => !trendPairs.has(p)).sort();
  assert.deepEqual(onlyMain, ["보성다향대축제/2022", "부평풍물대축제/2019", "안성맞춤남사당바우덕이축제/2019", "영암왕인문화축제/2022", "평창송어축제/2018", "평창송어축제/2022", "포항국제불빛축제/2022"]);
  assert.ok([...trendPairs].every(p => mainPairs.has(p)));
});

function sandbox() {
  const dir = mkdtempSync(`${tmpdir()}/datalab-`) + "/";
  mkdirSync(`${dir}apps/web/data`, { recursive: true });
  cpSync(`${REPO_ROOT}${IMPORT_DIR}`, `${dir}${IMPORT_DIR}`, { recursive: true });
  cpSync(`${REPO_ROOT}${IDS_PATH}`, `${dir}${IDS_PATH}`);
  return dir;
}
const trendFile = (root, name) => {
  const m = JSON.parse(readFileSync(`${root}${MANIFEST_PATH}`, "utf8"));
  return `${root}${ORIGINAL_DIR}/${m.files.find(f => f.table === "연도별 방문자 추이" && f.path.includes(name)).path}`;
};

test("tampered imports, manifests, extra files and ID mappings are rejected", () => {
  const cases = [
    [root => appendFileSync(trendFile(root, "강릉커피축제"), "x"), /hash mismatch/],
    [root => writeFileSync(`${root}${ORIGINAL_DIR}/data/extra.csv`, "a\n"), /Unlisted imported file/],
    [root => { const p = `${root}${MANIFEST_PATH}`, m = JSON.parse(readFileSync(p, "utf8")); m.files[0].rowCount++; writeFileSync(p, JSON.stringify(m)); }, /Manifest entry mismatch/],
    [root => { const p = `${root}${MANIFEST_PATH}`, m = JSON.parse(readFileSync(p, "utf8")); m.source.commit = "0".repeat(40); writeFileSync(p, JSON.stringify(m)); }, /source mismatch/],
    [root => { const p = `${root}${IDS_PATH}`, m = JSON.parse(readFileSync(p, "utf8")); m.festivals[1].id = m.festivals[0].id; writeFileSync(p, JSON.stringify(m)); }, /unique/],
    [root => { const p = `${root}${IDS_PATH}`, m = JSON.parse(readFileSync(p, "utf8")); m.festivals.pop(); writeFileSync(p, JSON.stringify(m)); }, /cover consumed/],
    [root => { const p = `${root}${IDS_PATH}`, m = JSON.parse(readFileSync(p, "utf8")); m.festivals[0].name = "논산딸기축제"; writeFileSync(p, JSON.stringify(m)); }, /name mismatch/],
  ];
  for (const [mutate, error] of cases) {
    const root = sandbox();
    try { assert.doesNotThrow(() => buildDataset(root)); mutate(root); assert.throws(() => buildDataset(root), error); }
    finally { rmSync(root, { recursive: true, force: true }); }
  }
});
