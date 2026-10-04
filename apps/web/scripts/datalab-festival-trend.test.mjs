// node --test scripts/datalab-festival-trend.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { cpSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, appendFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { CsvError, parseCsv, parseSourceNumber, parseTable } from "./datalab-csv.mjs";
import { buildDataset, classify, EXPECTED_COUNTS, festivalSources, gitBlobId, IDS_PATH, IMPORT_DIR, MANIFEST_PATH, ORIGINAL_DIR, OUTPUT_PATH, originalUrl, placeOf, REPO_ROOT, serialize, SOURCE, verifyImport } from "./build-datalab-festival-trend.mjs";
import { OWNER_DIR } from "./datalab-owner-import.mjs";

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
  // Every CSV is consumed (festival tables by the trend and profile builds, region tables by the region builds); documents
  // stay preserved-only. The festival build reads only the trend table.
  assert.ok(manifest.files.every(f => f.use === (f.group === "doc" ? "preserved-only" : "consumed")));
  assert.equal(manifest.files.filter(f => f.use === "consumed").length, 304);
  assert.equal(manifest.files.filter(f => f.table === "연도별 방문자 추이").length, 26);
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

test("92 stable IDs, 447 rows, expected years, gaps and internal consistency", () => {
  const d = buildDataset(), ids = JSON.parse(readFileSync(`${REPO_ROOT}${IDS_PATH}`, "utf8"));
  assert.deepEqual(d.festivals.map(f => f.id), ids.festivals.map(f => f.id));
  assert.equal(new Set(d.festivals.map(f => f.id)).size, 92);
  assert.deepEqual([ids.festivals.filter(f => f.import === "hkjin-plan-03").length, ids.festivals.filter(f => f.import === "datalab-festivals-2026-10").length], [26, 66]);
  const rows = d.festivals.flatMap(f => f.years.map(y => ({ ...y, id: f.id })));
  assert.equal(rows.length, 447);
  const byYear = {};
  for (const r of rows) byYear[r.year] = (byYear[r.year] ?? 0) + 1;
  assert.deepEqual(byYear, { 2018: 82, 2019: 80, 2022: 73, 2023: 85, 2024: 65, 2025: 62 });
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
  const nonsan = d.festivals.find(f => f.id === "nonsan-strawberry");
  assert.deepEqual([nonsan.place, nonsan.downloadDate, nonsan.years.map(y => [y.year, y.days])], ["충남 논산시", "2026-10-04", [[2024, 4], [2025, 4]]]);
  assert.equal(nonsan.source.originalPath, "20261004234455_문화관광축제_2024-2025_데이터랩_다운로드.zip/20261004234455_논산딸기축제_연도별 방문자 추이.csv");
  assert.equal(decodeURIComponent(nonsan.source.originalUrl), `https://github.com/gitvssh/fest-compass/blob/main/${nonsan.source.path}`);
  assert.deepEqual(d.source.imports.map(m => m.id), ["hkjin-plan-03", "datalab-festivals-2026-10"]);
});

test("place labels come from the destination ranking's addresses; only a festival without one has a reviewed place", () => {
  const d = buildDataset(), ids = JSON.parse(readFileSync(`${REPO_ROOT}${IDS_PATH}`, "utf8"));
  assert.deepEqual(ids.festivals.filter(f => "place" in f).map(f => [f.id, f.place]), [["sejong", "세종"]]);
  const place = id => d.festivals.find(f => f.id === id).place;
  assert.deepEqual(["seosan-haemieupseong", "ganggyeong-jeotgal", "gwangju-kimchi", "hwaseong-boat", "pyeongchang-hyoseok"].map(place), ["충남 서산시", "충남 논산시", "광주 서구·남구", "경기 화성시", "강원 평창군"]);
  const table = (rows) => ["구분,순위,읍면동명,목적지명,도로명주소,카테고리", ...rows.map((a, i) => `전체,${i + 1},가동,곳${i},${a},공원`)].join("\n") + "\n";
  assert.equal(placeOf(table([...Array(9).fill("충남 가시 가로 1"), "충남 나군"])), "충남 가시·나군", "a tenth counts");
  assert.equal(placeOf(table([...Array(11).fill("충남 가시 가로 1"), "충북 나군 나로 2"])), "충남 가시", "less than a tenth does not");
  assert.equal(placeOf(table(["충남 가시", "충북 나군 나로 2"])), "충남 가시 · 충북 나군");
  assert.throws(() => placeOf(table(["세종특별자치시"])), /without province and district/);
});

test("raw foreign zero is retained as source 0 and first-row derivative blanks stay raw strings", () => {
  const rows = buildDataset().festivals.flatMap(f => f.years);
  const zeros = rows.filter(r => r.foreign === 0);
  assert.equal(zeros.length, 165);
  assert.ok(zeros.every(r => r.raw[5] === "0.0" || r.raw[5] === "0"));
  const firsts = buildDataset().festivals.map(f => f.years[0]);
  assert.ok(firsts.every(r => r.raw[8] === "" && r.raw[10] === "N/A"));
  assert.ok(rows.every(r => !("previousDailyMean" in r) && !("growth" in r)));
});

test("main-index-only festival-years never leak into the trend", () => {
  const d = buildDataset(), { ids, table } = festivalSources();
  const trendPairs = new Set(d.festivals.flatMap(f => f.years.map(y => `${f.name}/${y.year}`)));
  const mainPairs = new Set(ids.festivals.flatMap(f => parseTable(table(f, "문화관광축제 주요 지표").text).rows.map(r => `${r[0]}/${r[2]}`)));
  assert.equal(mainPairs.size, 471);
  const onlyMain = [...mainPairs].filter(p => !trendPairs.has(p)).sort();
  assert.deepEqual(onlyMain, ["강경젓갈축제/2019", "강진청자축제/2022", "관악강감찬축제/2018", "금호강바람소리길축제/2018", "담양대나무축제/2022", "보성다향대축제/2022", "봉화은어축제/2023", "부천국제만화축제/2018", "부평풍물대축제/2019", "소래포구축제/2019", "안성맞춤남사당바우덕이축제/2019", "여주오곡나루축제/2019", "영덕대게축제/2022", "영암왕인문화축제/2022", "이천쌀문화축제/2019", "제주들불축제/2022", "진도신비의바닷길축제/2022", "탐라입춘굿축제/2022", "태백산눈축제/2022", "평창송어축제/2018", "평창송어축제/2022", "평창효석문화제/2022", "포항국제불빛축제/2022", "화천산천어축제/2022"]);
  assert.ok([...trendPairs].every(p => mainPairs.has(p)));
});

function sandbox() {
  const dir = mkdtempSync(`${tmpdir()}/datalab-`) + "/";
  mkdirSync(`${dir}apps/web/data`, { recursive: true });
  cpSync(`${REPO_ROOT}${IMPORT_DIR}`, `${dir}${IMPORT_DIR}`, { recursive: true });
  cpSync(`${REPO_ROOT}${OWNER_DIR}`, `${dir}${OWNER_DIR}`, { recursive: true });
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
    [root => { const p = `${root}${IDS_PATH}`, m = JSON.parse(readFileSync(p, "utf8")); m.festivals[0].name = "논산딸기축제"; writeFileSync(p, JSON.stringify(m)); }, /mapped twice/],
    [root => { const p = `${root}${IDS_PATH}`, m = JSON.parse(readFileSync(p, "utf8")); m.festivals[0].name = "가상축제"; writeFileSync(p, JSON.stringify(m)); }, /name mismatch/],
    [root => { const p = `${root}${IDS_PATH}`, m = JSON.parse(readFileSync(p, "utf8")); m.version = 1; writeFileSync(p, JSON.stringify(m)); }, /ID table version/],
    [root => { const p = `${root}${IDS_PATH}`, m = JSON.parse(readFileSync(p, "utf8")); m.festivals[0].place = "충남 서산시"; writeFileSync(p, JSON.stringify(m)); }, /reviewed place is only/],
    [root => { const p = `${root}${IDS_PATH}`, m = JSON.parse(readFileSync(p, "utf8")); delete m.festivals.find(f => f.id === "sejong").place; writeFileSync(p, JSON.stringify(m)); }, /reviewed place is only/],
  ];
  for (const [mutate, error] of cases) {
    const root = sandbox();
    try { assert.doesNotThrow(() => buildDataset(root)); mutate(root); assert.throws(() => buildDataset(root), error); }
    finally { rmSync(root, { recursive: true, force: true }); }
  }
});
