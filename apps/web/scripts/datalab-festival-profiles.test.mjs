// node --test scripts/datalab-festival-profiles.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { appendFileSync, cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { AGE_BANDS, buildProfiles, DESTINATION_HEADER, DEMOGRAPHIC_HEADER, INDICATOR_HEADER, parseDemographics, parseDestinations, parseIndicators, PROFILE_OUTPUT_PATH, serialize } from "./build-datalab-festival-profiles.mjs";
import { IDS_PATH, IMPORT_DIR, MANIFEST_PATH, ORIGINAL_DIR, REPO_ROOT } from "./build-datalab-festival-trend.mjs";

const RANGE = { from: 2018, to: 2025 };
const csv = (header, rows) => [header, ...rows].map(r => r.join(",")).join("\n") + "\n";
const indicatorRows = (year, festival, base, name = "가축제") => [["축제기간", festival], ["비축제기간", base]].flatMap(([g, vs]) =>
  ["외부방문자 유입", "현지인방문자 유입", "내비게이션 검색량", "관광소비", "축제지 집중률"].map((k, i) => [name, g, String(year), k, vs[i]]));

test("generator is deterministic and matches the checked-in artifact", () => {
  const a = serialize(buildProfiles()), b = serialize(buildProfiles());
  assert.equal(a, b);
  assert.equal(readFileSync(`${REPO_ROOT}${PROFILE_OUTPUT_PATH}`, "utf8"), a);
  assert.ok(!/20\d\d-\d\d-\d\dT\d\d:/.test(a), "no clock timestamps in output");
});

test("26 reviewed festivals with every profile table and known source values", () => {
  const d = buildProfiles(), ids = JSON.parse(readFileSync(`${REPO_ROOT}${IDS_PATH}`, "utf8"));
  assert.deepEqual(d.festivals.map(f => f.id), ids.festivals.map(f => f.id));
  const seosan = d.festivals.find(f => f.id === "seosan-haemieupseong");
  assert.deepEqual(seosan.range, RANGE);
  assert.deepEqual(seosan.indicators.years.at(-1), { year: 2025, festival: [0.663, 0.782, 0.588, 0.544, 0.855], base: [0.419, 0.457, 0.369, 0.564, 0.556] });
  assert.deepEqual(seosan.demographics.map(b => b.ageBand), AGE_BANDS);
  assert.deepEqual(seosan.demographics.at(-1), { ageBand: "70세 이상", malePercent: 4.5, femalePercent: 3.7 });
  assert.deepEqual(seosan.destinations.map(g => [g.group, g.label, g.items.length]), [["outside", "외지인", 16], ["local", "현지인", 16], ["all", "전체", 16]]);
  assert.deepEqual(seosan.destinations[0].items[0], { rank: 1, area: "해미면", name: "해미읍성", address: "충남 서산시 남문2로 143-0", category: "역사유적지" });
  for (const f of d.festivals) {
    for (const t of ["indicators", "demographics", "destinations"]) assert.ok(f.sources[t].originalUrl.startsWith("https://github.com/travel-resolver/pick-d-day/blob/"));
    assert.ok(f.indicators.years.every(y => y.year !== 2020 && y.year !== 2021));
  }
  const goryeong = d.festivals.find(f => f.id === "goryeong-daegaya");
  assert.deepEqual(goryeong.range, { from: 2018, to: 2024 });
});

test("all-zero indicator years are withheld — exactly the festival-years missing from the visit trend", () => {
  const withheld = buildProfiles().festivals.flatMap(f => f.indicators.withheldYears.map(y => `${f.name}/${y}`)).sort();
  assert.deepEqual(withheld, ["보성다향대축제/2022", "부평풍물대축제/2019", "안성맞춤남사당바우덕이축제/2019", "영암왕인문화축제/2022", "평창송어축제/2018", "평창송어축제/2022", "포항국제불빛축제/2022"]);
  assert.ok(buildProfiles().festivals.every(f => f.indicators.years.every(y => [...y.festival, ...y.base].every(v => v > 0 && v <= 1))));
});

test("Imsil sex·age shares differ from each single year's capture: the table covers the whole download range", () => {
  const imsil = buildProfiles().festivals.find(f => f.id === "imsil-n-cheese");
  for (const year of [2023, 2024, 2025]) {
    const capture = JSON.parse(readFileSync(`${REPO_ROOT}docs/research/imported/datalab-imsil-${year}/original/demographics.json`, "utf8")).list;
    const same = imsil.demographics.every(b => { const c = capture.find(x => x.AGEG_DIV_NM === b.ageBand); return c.M_TOU_NUM_RAT === b.malePercent && c.W_TOU_NUM_RAT === b.femalePercent; });
    assert.equal(same, false, `${year} capture`);
  }
});

test("indicator parser: groups, years, precision, duplicates and partly zero years", () => {
  const ok = csv(INDICATOR_HEADER, indicatorRows(2024, ["0.5", "0.6", "0.7", "0.8", "1.0"], ["0.1", "0.2", "0.3", "0.4", "0.05"]));
  assert.deepEqual(parseIndicators(ok, "가축제", RANGE), { years: [{ year: 2024, festival: [0.5, 0.6, 0.7, 0.8, 1], base: [0.1, 0.2, 0.3, 0.4, 0.05] }], withheldYears: [] });
  const zero = csv(INDICATOR_HEADER, [...indicatorRows(2019, Array(5).fill("0.0"), Array(5).fill("0.0")), ...indicatorRows(2024, ["0.5", "0.6", "0.7", "0.8", "0.9"], ["0.1", "0.2", "0.3", "0.4", "0.5"])]);
  assert.deepEqual(parseIndicators(zero, "가축제", RANGE).withheldYears, [2019]);
  const bad = [
    [csv(INDICATOR_HEADER, indicatorRows(2024, ["0.5", "0.6", "0.7", "0.8", "0.0"], ["0.1", "0.2", "0.3", "0.4", "0.5"])), /Partly zero/],
    [csv(INDICATOR_HEADER, indicatorRows(2017, ["0.5", "0.6", "0.7", "0.8", "0.9"], ["0.1", "0.2", "0.3", "0.4", "0.5"])), /outside the download range/],
    [csv(INDICATOR_HEADER, indicatorRows(2024, ["0.5", "0.6", "0.7", "0.8", "1.2"], ["0.1", "0.2", "0.3", "0.4", "0.5"])), /0\.\.1/],
    [csv(INDICATOR_HEADER, indicatorRows(2024, ["0.5", "0.6", "0.7", "0.8", "0.1234"], ["0.1", "0.2", "0.3", "0.4", "0.5"])), /three decimals/],
    [csv(INDICATOR_HEADER, indicatorRows(2024, ["0.5", "0.6", "0.7", "0.8", "0.9"], ["0.1", "0.2", "0.3", "0.4", "0.5"], "나축제")), /name mismatch/],
    [csv(INDICATOR_HEADER, indicatorRows(2024, ["0.5", "0.6", "0.7", "0.8", "0.9"], ["0.1", "0.2", "0.3", "0.4", "0.5"]).slice(1)), /Incomplete/],
    [csv(INDICATOR_HEADER, [...indicatorRows(2024, ["0.5", "0.6", "0.7", "0.8", "0.9"], ["0.1", "0.2", "0.3", "0.4", "0.5"]), ["가축제", "축제기간", "2024", "관광소비", "0.3"]]), /Duplicate/],
    [csv(INDICATOR_HEADER, [["가축제", "행사기간", "2024", "관광소비", "0.3"]]), /Unknown period group/],
    [csv(INDICATOR_HEADER, [["가축제", "축제기간", "2024", "체류시간", "0.3"]]), /Unknown indicator/],
    [csv(INDICATOR_HEADER, indicatorRows(2019, Array(5).fill("0.0"), Array(5).fill("0.0"))), /No indicator year/],
  ];
  for (const [text, error] of bad) assert.throws(() => parseIndicators(text, "가축제", RANGE), error);
});

test("sex·age parser: eight bands youngest first, one-decimal shares adding up to 100", () => {
  const rows = [...AGE_BANDS].reverse().map((b, i) => ["가축제", b, i === 0 ? "50.0" : "3.6", i === 0 ? "24.8" : "0.0"]);
  const out = parseDemographics(csv(DEMOGRAPHIC_HEADER, rows), "가축제");
  assert.deepEqual(out.map(b => b.ageBand), AGE_BANDS);
  assert.deepEqual(out.at(-1), { ageBand: "70세 이상", malePercent: 50, femalePercent: 24.8 });
  const bad = [
    [rows.slice(1), /eight age bands/],
    [[...rows.slice(1), ["가축제", "60~69세", "1.0", "1.0"]], /repeated/],
    [rows.map((r, i) => (i ? r : ["가축제", r[1], "50", r[3]])), /one-decimal/],
    [rows.map((r, i) => (i ? r : ["가축제", r[1], "60.0", r[3]])), /add up to 100/],
    [rows.map((r, i) => (i ? r : ["가축제", "80세 이상", r[2], r[3]])), /Unknown or repeated age band/],
  ];
  for (const [r, error] of bad) assert.throws(() => parseDemographics(csv(DEMOGRAPHIC_HEADER, r), "가축제"), error);
});

test("destination parser: three groups, competition ranks, no food or lodging", () => {
  const place = (g, rank, name, category = "역사유적지") => [g, String(rank), "가동", name, "충남 가시 가로 1-0", category];
  const rows = ["외지인", "현지인", "전체"].flatMap(g => [place(g, 1, "가성"), place(g, 2, "나숲"), place(g, 2, "다못"), place(g, 4, "라탑")]);
  const out = parseDestinations(csv(DESTINATION_HEADER, rows));
  assert.deepEqual(out.map(g => [g.group, g.items.map(i => i.rank)]), [["outside", [1, 2, 2, 4]], ["local", [1, 2, 2, 4]], ["all", [1, 2, 2, 4]]]);
  const bad = [
    [rows.filter(r => r[0] !== "현지인"), /Missing destination group: 현지인/],
    [[...rows, place("관광객", 1, "마을")], /Unknown destination group/],
    [rows.map((r, i) => (i === 1 ? place("외지인", 3, "나숲") : r)), /never go down/],
    [rows.map((r, i) => (i === 0 ? place("외지인", 2, "가성") : r)), /start at 1/],
    [rows.map((r, i) => (i === 3 ? place("외지인", 4, "라식당", "한식") : r)), /Food or lodging/],
    [rows.map((r, i) => (i === 3 ? place("외지인", 4, " ") : r)), /Empty destination field/],
  ];
  for (const [r, error] of bad) assert.throws(() => parseDestinations(csv(DESTINATION_HEADER, r)), error);
});

function sandbox() {
  const dir = mkdtempSync(`${tmpdir()}/datalab-profiles-`) + "/";
  mkdirSync(`${dir}apps/web/data`, { recursive: true });
  cpSync(`${REPO_ROOT}${IMPORT_DIR}`, `${dir}${IMPORT_DIR}`, { recursive: true });
  cpSync(`${REPO_ROOT}${IDS_PATH}`, `${dir}${IDS_PATH}`);
  return dir;
}
const editJson = (root, path, edit) => { const p = `${root}${path}`, m = JSON.parse(readFileSync(p, "utf8")); edit(m); writeFileSync(p, JSON.stringify(m)); };
const profileFile = (root, name, table) => {
  const m = JSON.parse(readFileSync(`${root}${MANIFEST_PATH}`, "utf8"));
  return { manifest: m, path: m.files.find(f => f.table === table && f.path.includes(name)).path };
};

test("tampered profile bytes and unconsumed profile tables are rejected", () => {
  const cases = [
    [root => appendFileSync(`${root}${ORIGINAL_DIR}/${profileFile(root, "강릉커피축제", "성-연령별 내국인 방문자").path}`, "x"), /hash mismatch/],
    [root => editJson(root, MANIFEST_PATH, m => { m.files.find(f => f.table === "목적지 검색순위").use = "preserved-only"; }), /Unexpected consumed count/],
    // Same count, swapped use: the per-file check still sees that a reviewed profile table is no longer consumed.
    [root => editJson(root, MANIFEST_PATH, m => { m.files.find(f => f.table === "목적지 검색순위").use = "preserved-only"; m.files.find(f => f.group === "region").use = "consumed"; }), /Manifest entry mismatch/],
    [root => editJson(root, IDS_PATH, m => { m.festivals[0].sourceFile = m.festivals[0].sourceFile.replace("서산해미읍성축제_연도별", "서산해미읍성_연도별"); }), /Missing reviewed/],
  ];
  for (const [mutate, error] of cases) {
    const root = sandbox();
    try { assert.doesNotThrow(() => buildProfiles(root)); mutate(root); assert.throws(() => buildProfiles(root), error); }
    finally { rmSync(root, { recursive: true, force: true }); }
  }
});
