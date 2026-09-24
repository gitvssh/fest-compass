// node --test scripts/datalab-visitor-profile.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { appendFileSync, cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { REPO_ROOT, sha256 } from "./build-datalab-festival-trend.mjs";
import {
  buildVisitorProfile, CHART_KINDS, CROSS_CHECK_PATHS, editionConfig, parseCliArgs, PROFILE_DIR, PROFILE_MANIFEST_PATH, PROFILE_OUTPUT_PATH,
  RESOURCE_LINKS_PATH, REVIEWED_EDITIONS, REVIEWED_YEARS, runVisitorProfileCli, serialize, verifyProfileImport,
} from "./build-datalab-visitor-profile.mjs";

const [TREND_PATH, LINKS_PATH, EDITIONS_PATH] = CROSS_CHECK_PATHS;
const SCRIPT = fileURLToPath(new URL("./build-datalab-visitor-profile.mjs", import.meta.url));

test("generator is deterministic, matches the checked-in artifact and binds every value to the reviewed 2025 capture", () => {
  const a = serialize(buildVisitorProfile()), b = serialize(buildVisitorProfile());
  assert.equal(a, b);
  assert.equal(readFileSync(`${REPO_ROOT}${PROFILE_OUTPUT_PATH}`, "utf8"), a);
  const d = JSON.parse(a), manifest = JSON.parse(readFileSync(`${REPO_ROOT}${PROFILE_MANIFEST_PATH}`, "utf8"));
  assert.deepEqual([d.kind, d.schemaVersion, d.source.officialUrl, d.source.collectedAt], ["datalab-festival-visitor-profile", 1, "https://datalab.visitkorea.or.kr/datalab/portal/fes/getFesDataForm.do", "2026-09-24T08:15:07.300Z"]);
  assert.deepEqual(d.festival, { archiveFestivalId: "imsil-cheese", editionId: "imsil-cheese-2025", datalabFestivalId: "KCTF0061", name: "임실N치즈축제", regionCode: "52750", areaCode: "52750340", areaName: "임실군 성수면", year: 2025, start: "2025-10-08", end: "2025-10-12", days: 5 });
  assert.equal(d.source.manifestSha256, sha256(readFileSync(`${REPO_ROOT}${PROFILE_MANIFEST_PATH}`)));
  assert.equal(d.source.resourceLinksSha256, sha256(readFileSync(`${REPO_ROOT}${RESOURCE_LINKS_PATH}`)));
  assert.equal(d.evidence.records.length, 5);
  for (const r of d.evidence.records) {
    assert.equal(r.sha256, manifest.records.find(m => m.kind === r.kind).sha256);
    assert.equal(sha256(readFileSync(`${REPO_ROOT}${r.path}`)), r.sha256, r.kind);
    assert.deepEqual(r.baseYears, ["trend", "demographics", "destinations"].includes(r.kind) ? ["2025", "2025"] : null, `${r.kind} period evidence`);
  }
  assert.deepEqual(d.evidence.trend, { local: 16688, outside: 127842, foreign: 126, total: 144656, dailyMean: 28931.2 });
  assert.equal(d.evidence.demographicCountGap, -1, "source counts sum 144529 vs domestic trend 144530: recorded, not normalized");
  assert.deepEqual(d.demographics.map(x => [x.ageBand, x.order, x.malePercent, x.femalePercent, x.display]), [
    ["0~9세", 1, 0.6, 0.7, "N"], ["10~19세", 2, 2.5, 2.4, "N"], ["20~29세", 3, 4.8, 5.0, "N"], ["30~39세", 4, 7.3, 7.6, "N"],
    ["40~49세", 5, 8.3, 7.5, "N"], ["50~59세", 6, 10.4, 11.3, "N"], ["60~69세", 7, 11.4, 11.2, "N"], ["70세 이상", 8, 4.6, 4.4, "N"]]);
  assert.deepEqual(d.destinationGroups.map(g => [g.group, g.sourceLabel, g.items.map(i => i.rank).join()]), [["outside", "외지인", "1,2,3,4,5,6,7"], ["local", "현지인", "1,2,3,4,5,6,7"], ["all", "전체", "1,2,3,4,5,6,7"]]);
  const linked = d.destinationGroups[0].items.filter(i => i.resource).map(i => [i.id, i.name, i.resource.id, i.resource.kind, i.resource.title]);
  assert.deepEqual(linked, [["2773331", "임실치즈테마파크", "2718832", "12", "임실치즈테마파크"], ["3306424", "상이암", "317571", "12", "상이암(임실)"], ["725050", "소충사", "527279", "12", "소충사"]]);
  for (const g of d.destinationGroups) assert.deepEqual(g.items.filter(i => i.resource).map(i => i.id), ["2773331", "3306424", "725050"]);
  for (const leak of ["SRCH_CNT", "M_TOT", "W_TOT", "\"count\"", "27360", "31746", "6691.23", "809.51", "144529"]) assert.ok(!a.includes(leak), `raw count ${leak} must not be generated`);
});

function sandbox() {
  const dir = mkdtempSync(`${tmpdir()}/datalab-visitor-profile-`) + "/";
  mkdirSync(`${dir}apps/web/data`, { recursive: true });
  for (const year of REVIEWED_YEARS) { const { importDir } = REVIEWED_EDITIONS[year]; cpSync(`${REPO_ROOT}${importDir}`, `${dir}${importDir}`, { recursive: true }); }
  for (const p of CROSS_CHECK_PATHS) cpSync(`${REPO_ROOT}${p}`, `${dir}${p}`);
  return dir;
}
const editJson = (root, path, edit) => { const p = `${root}${path}`, m = JSON.parse(readFileSync(p, "utf8")); edit(m); writeFileSync(p, JSON.stringify(m, null, 2) + "\n"); };
const record = (m, kind) => m.records.find(r => r.kind === kind);
// Edit an original response and re-pin its manifest hash, so the content check (not the byte check) must catch it.
const editOriginal = (root, kind, edit, year = 2025) => {
  const { importDir, manifestPath } = REVIEWED_EDITIONS[year], p = `${root}${importDir}/original/${kind}.json`, d = JSON.parse(readFileSync(p, "utf8"));
  edit(d);
  const bytes = Buffer.from(JSON.stringify(d));
  writeFileSync(p, bytes);
  editJson(root, manifestPath, m => { const r = record(m, kind); r.sha256 = sha256(bytes); r.bytes = bytes.length; });
};
// Put another edition's exact response bytes under this edition and re-pin the manifest: only the provenance check can catch it.
const transplant = (root, kind, from, to) => {
  const bytes = readFileSync(`${root}${REVIEWED_EDITIONS[from].importDir}/original/${kind}.json`);
  writeFileSync(`${root}${REVIEWED_EDITIONS[to].importDir}/original/${kind}.json`, bytes);
  editJson(root, REVIEWED_EDITIONS[to].manifestPath, m => { const r = record(m, kind); r.sha256 = sha256(bytes); r.bytes = bytes.length; });
};
const withSandbox = fn => { const root = sandbox(); try { return fn(root); } finally { rmSync(root, { recursive: true, force: true }); } };
const rowOf = (d, group, name) => d.list.find(r => r.DIV_NM === group && r.ITS_BRO_NM === name);
const repoJson = path => JSON.parse(readFileSync(`${REPO_ROOT}${path}`, "utf8"));
const tempFiles = root => readdirSync(`${root}apps/web/data`).filter(n => n.endsWith(".tmp"));

test("sandbox copy builds identically, and re-pinned originals still build (so each mutation below reaches its content check)", () => {
  for (const year of REVIEWED_YEARS) {
    const fresh = serialize(buildVisitorProfile(REPO_ROOT, year));
    withSandbox(root => assert.equal(serialize(buildVisitorProfile(root, year)), fresh, `${year}`));
    withSandbox(root => { for (const k of ["festival-list", "festival-periods", "trend", "demographics", "destinations"]) editOriginal(root, k, () => {}, year); assert.doesNotThrow(() => buildVisitorProfile(root, year), `${year}`); });
  }
});

test("valid variations: rank ties and DISP_YN=Y are kept as published", () => withSandbox(root => {
  editOriginal(root, "destinations", d => { d.list[2].ROWNUM = 2; });
  editOriginal(root, "demographics", d => { d.list[0].DISP_YN = "Y"; });
  const d = buildVisitorProfile(root);
  assert.deepEqual(d.destinationGroups[0].items.map(i => i.rank), [1, 2, 2, 4, 5, 6, 7]);
  assert.equal(d.demographics[7].display, "Y");
  assert.equal(d.demographics[7].malePercent, 4.6);
}));

test("provenance, byte, period, identity, shape, rank, trend and resource-link defects are rejected", () => {
  const cases = [
    // bytes and listing
    ["tampered bytes", root => appendFileSync(`${root}${PROFILE_DIR}/original/demographics.json`, " "), /hash mismatch/],
    ["unlisted original", root => writeFileSync(`${root}${PROFILE_DIR}/original/residence.json`, "{}"), /unlisted original file/],
    ["missing record", root => editJson(root, PROFILE_MANIFEST_PATH, m => { m.records = m.records.filter(r => r.kind !== "festival-list"); }), /exactly the five/],
    ["other page", root => editJson(root, PROFILE_MANIFEST_PATH, m => { m.page = "https://datalab.visitkorea.or.kr/datalab/portal/loc/getAreaDataForm.do"; }), /official festival page/],
    ["endpoint", root => editJson(root, PROFILE_MANIFEST_PATH, m => { record(m, "destinations").url = "https://datalab.visitkorea.or.kr/visualize/downloadData.do"; }), /request identity/],
    ["record path", root => editJson(root, PROFILE_MANIFEST_PATH, m => { record(m, "trend").path = "original/demographics.json"; }), /trend path/],
    ["local time", root => editJson(root, PROFILE_MANIFEST_PATH, m => { record(m, "trend").retrievedAt = "2026-09-24 17:15:07"; }), /UTC instant/],
    ["no definition checks", root => editJson(root, PROFILE_MANIFEST_PATH, m => { m.definitionChecks = []; }), /definition checks/],
    // period evidence
    ["parameters absent", root => editJson(root, PROFILE_MANIFEST_PATH, m => { delete record(m, "demographics").parameters; }), /period not bound/],
    ["range request", root => editJson(root, PROFILE_MANIFEST_PATH, m => { record(m, "demographics").parameters.BASE_YY1 = "2018"; }), /request parameters differ/],
    ["other year", root => editJson(root, PROFILE_MANIFEST_PATH, m => { const p = record(m, "destinations").parameters; p.BASE_YY1 = p.BASE_YY2 = "2024"; }), /request parameters differ/],
    ["BASE_YY2 missing", root => editJson(root, PROFILE_MANIFEST_PATH, m => { delete record(m, "trend").parameters.BASE_YY2; }), /request parameters differ/],
    ["qid swap", root => editJson(root, PROFILE_MANIFEST_PATH, m => { record(m, "trend").parameters.qid = "FE_01_01_006"; }), /request parameters differ/],
    ["other festival request", root => editJson(root, PROFILE_MANIFEST_PATH, m => { record(m, "festival-periods").parameters.fstvId = "KCTF0062"; }), /request parameters differ/],
    ["scope year", root => editJson(root, PROFILE_MANIFEST_PATH, m => { m.scope.destinationYear = "2024"; }), /scope destinationYear/],
    ["scope festival", root => editJson(root, PROFILE_MANIFEST_PATH, m => { m.scope.festivalId = "KCTF0062"; }), /manifest festival identity/],
    ["observation", root => editJson(root, PROFILE_MANIFEST_PATH, m => { m.observation.end = "2025-10-11"; m.observation.days = 4; }), /manifest observation/],
    ["residence", root => editJson(root, PROFILE_MANIFEST_PATH, m => { m.residenceVisible = true; }), /residence/],
    // festival list and periods
    ["list identity", root => editOriginal(root, "festival-list", d => { d.list[0].FSTV_ID = "KCTF0062"; }), /exactly once/],
    ["list year", root => editOriginal(root, "festival-list", d => { d.list[0].BASE_YEAR_STR = "2018,2019,2022,2023,2024"; d.list[0].MAX_BASE_YEAR = "2024"; }), /does not offer 2025/],
    ["4-day 2025", root => editOriginal(root, "festival-periods", d => { d.info_list.find(r => r.BASE_YEAR === "2025").FSTV_END_YMD = "2025-10-11"; }), /dates differ/],
    ["tot list dates", root => editOriginal(root, "festival-periods", d => { d.info_listTot.find(r => r.BASE_YEAR === "2025").FSTV_BGNG_YMD = "2025-10-09"; }), /dates differ/],
    ["2025 period missing", root => editOriginal(root, "festival-periods", d => { d.info_list = d.info_list.filter(r => r.BASE_YEAR !== "2025"); }), /2025 exactly once/],
    ["period area", root => editOriginal(root, "festival-periods", d => { d.info_list.find(r => r.BASE_YEAR === "2025").ADONG_NM1 = "임실군 임실읍"; }), /host area differs/],
    // trend
    ["trend year", root => editOriginal(root, "trend", d => { d.list[0].BASE_YEAR = "2024"; }), /trend row is not/],
    ["trend days", root => editOriginal(root, "trend", d => { d.list[0].FSTV_PERD_CNT = 4; }), /trend days/],
    ["trend null", root => editOriginal(root, "trend", d => { d.list[0].TOT_LOCAL = null; }), /finite number/],
    ["trend revised", root => editOriginal(root, "trend", d => { const r = d.list[0]; r.TOT_OUT += 10; r.TOTAL_COL += 10; r.TOTAL_AVG = r.TOTAL_COL / 5; }), /source revised/],
    ["verified trend revised", root => editJson(root, TREND_PATH, t => { t.festivals.find(f => f.id === "imsil-n-cheese").years.find(y => y.year === 2025).outside += 1; }), /source revised/],
    // archive cross-check
    ["archive period", root => editJson(root, EDITIONS_PATH, e => { e.editions.find(x => x.id === "imsil-cheese-2025").end = "2025-10-11"; }), /archive edition differs/],
    ["link days", root => editJson(root, LINKS_PATH, l => { l.links[0].editions.find(x => x.editionId === "imsil-cheese-2025").days = 4; }), /reviewed link edition/],
    // demographics
    ["other festival", root => editOriginal(root, "demographics", d => { for (const r of d.list) r.FSTV_ID = "KCTF0062"; }), /another festival/],
    ["seven bands", root => editOriginal(root, "demographics", d => { d.list.pop(); }), /exactly 8 age bands/],
    ["nine bands", root => editOriginal(root, "demographics", d => { d.list.push({ ...d.list[0], AGEG_DIV_NM: "80세 이상", SORT_STR: 9 }); }), /exactly 8 age bands/],
    ["duplicate band", root => editOriginal(root, "demographics", d => { d.list[1].AGEG_DIV_NM = d.list[0].AGEG_DIV_NM; }), /repeats an age band/],
    ["sort drift", root => editOriginal(root, "demographics", d => { d.list[0].SORT_STR = 1; }), /sort order/],
    ["null share", root => editOriginal(root, "demographics", d => { d.list[0].M_TOU_NUM_RAT = null; }), /finite number/],
    ["string share", root => editOriginal(root, "demographics", d => { d.list[0].W_TOU_NUM_RAT = "4.4"; }), /finite number/],
    ["null count", root => editOriginal(root, "demographics", d => { d.list[0].M_TOT = null; }), /finite number/],
    ["share over 100", root => editOriginal(root, "demographics", d => { d.list[0].M_TOU_NUM_RAT = 104.6; }), /0\.\.100 percentage/],
    ["shares add to 99", root => editOriginal(root, "demographics", d => { d.list[0].M_TOU_NUM_RAT = 3.6; }), /add up to 100/],
    ["share vs count", root => editOriginal(root, "demographics", d => { d.list[0].M_TOT *= 1.5; }), /does not match its source count/],
    ["multi-year counts", root => editOriginal(root, "demographics", d => { for (const r of d.list) { r.M_TOT *= 8; r.W_TOT *= 8; } }), /another period/],
    ["display flag", root => editOriginal(root, "demographics", d => { d.list[0].DISP_YN = ""; }), /Y or N/],
    ["extra field", root => editOriginal(root, "demographics", d => { d.list[0].AGEG_CD = "08"; }), /reviewed shape/],
    // destinations
    ["rank 0", root => editOriginal(root, "destinations", d => { d.list[0].ROWNUM = 0; }), /positive integer/],
    ["rank string", root => editOriginal(root, "destinations", d => { d.list[0].ROWNUM = "1"; }), /positive integer/],
    ["rank goes down", root => editOriginal(root, "destinations", d => { d.list[3].ROWNUM = 2; }), /never go down/],
    ["rank skips ahead", root => editOriginal(root, "destinations", d => { d.list[1].ROWNUM = 3; }), /never go down/],
    ["unknown group", root => editOriginal(root, "destinations", d => { d.list[20].DIV_NM = "외국인"; }), /unknown rank group/],
    ["other dong", root => editOriginal(root, "destinations", d => { d.list[4].EMD_CD = "52750250"; }), /host area/],
    ["food", root => editOriginal(root, "destinations", d => { rowOf(d, "외지인", "오봉저수지").KTO_CATE_SCLS_NM = "한식"; }), /food or lodging/],
    ["lodging", root => editOriginal(root, "destinations", d => { rowOf(d, "현지인", "오봉저수지").KTO_CATE_SCLS_NM = "펜션"; }), /food or lodging/],
    ["duplicate place", root => editOriginal(root, "destinations", d => { d.list[2] = { ...d.list[1], ROWNUM: 3 }; }), /repeats a place/],
    ["identity drift", root => editOriginal(root, "destinations", d => { rowOf(d, "전체", "소충사").ITS_BRO_NM = "소충사(임실)"; }), /changes identity/],
    ["search count null", root => editOriginal(root, "destinations", d => { d.list[6].SRCH_CNT = null; }), /search count/],
    ["search count order", root => editOriginal(root, "destinations", d => { d.list[6].SRCH_CNT = 99999; }), /contradict the rank order/],
    ["hidden extra field", root => editOriginal(root, "destinations", d => { d.list[0].VISIT_CNT = 1; }), /reviewed shape/],
    ["empty group", root => editOriginal(root, "destinations", d => { d.list = d.list.filter(r => r.DIV_NM !== "현지인"); }), /현지인 must hold/],
    // resource links
    ["fourth link", root => editJson(root, RESOURCE_LINKS_PATH, l => { l.links.push({ ...l.links[0], destinationId: "7837938" }); }), /exactly the 3 reviewed/],
    ["two links", root => editJson(root, RESOURCE_LINKS_PATH, l => { l.links.pop(); }), /exactly the 3 reviewed/],
    ["same-address merge", root => editJson(root, RESOURCE_LINKS_PATH, l => { l.links[0].destinationId = "7837938"; }), /unreviewed destination/],
    ["duplicate mapping", root => editJson(root, RESOURCE_LINKS_PATH, l => { l.links[2] = JSON.parse(JSON.stringify(l.links[0])); }), /repeats a destination/],
    ["fuzzy title", root => editJson(root, RESOURCE_LINKS_PATH, l => { l.links[1].resource.title = "상이암"; }), /target differs/],
    ["other resource id", root => editJson(root, RESOURCE_LINKS_PATH, l => { l.links[1].resource.id = "317572"; }), /target differs/],
    ["kind 14", root => editJson(root, RESOURCE_LINKS_PATH, l => { l.links[0].resource.kind = "14"; }), /target differs/],
    ["kind 15", root => editJson(root, RESOURCE_LINKS_PATH, l => { l.links[0].resource.kind = "15"; }), /12 or 14/],
    ["other area address", root => editJson(root, RESOURCE_LINKS_PATH, l => { l.links[2].resource.address = "전북특별자치도 임실군 임실읍 산성로 725-23"; }), /not the same place/],
    ["other building", root => editJson(root, RESOURCE_LINKS_PATH, l => { l.links[0].resource.address = "전북특별자치도 임실군 성수면 도인2길 52"; }), /not the same place/],
    ["source name", root => editJson(root, RESOURCE_LINKS_PATH, l => { l.links[1].sourceName = "상이암(임실)"; }), /source identity/],
    ["source address", root => editJson(root, RESOURCE_LINKS_PATH, l => { l.links[1].sourceAddress = "전북 임실군 성수산길 658"; }), /source identity/],
    ["links year", root => editJson(root, RESOURCE_LINKS_PATH, l => { l.year = 2024; }), /scope differs/],
    ["links region", root => editJson(root, RESOURCE_LINKS_PATH, l => { l.regionCode = "52790"; }), /scope differs/],
    ["point null", root => editJson(root, RESOURCE_LINKS_PATH, l => { l.links[0].resource.point.latitude = null; }), /finite number/],
    ["no evidence", root => editJson(root, RESOURCE_LINKS_PATH, l => { delete l.links[0].evidence; }), /evidence/],
  ];
  for (const [name, mutate, error] of cases) withSandbox(root => { mutate(root); assert.throws(() => buildVisitorProfile(root), error, name); });
});

// Reviewed 2023/2024 captures: values read from the byte-pinned originals, never derived from the 2025 edition.
const SAME_RANKING_2023 = ["2773331", "7837938", "10147587", "173403", "3306424", "54277"];
const EDITION_EXPECTATIONS = {
  2023: {
    output: "apps/web/data/datalab-visitor-profile-2023.json", period: ["2023-10-06", "2023-10-09", 4], collectedAt: "2026-09-24T11:41:56.074Z",
    trend: { local: 13923, outside: 79355, foreign: 40, total: 93318, dailyMean: 23329.5 }, gap: 1, // source counts 93278.5 vs domestic trend 93278
    shares: [[0.6, 0.7], [1.9, 2.1], [4.5, 5.2], [6.9, 7], [8.3, 7.7], [10.8, 12.3], [12.3, 11.6], [4.3, 3.9]],
    ids: { outside: SAME_RANKING_2023, local: SAME_RANKING_2023, all: SAME_RANKING_2023 }, leaks: ["11526", "12792", "93278.5"],
  },
  2024: {
    output: "apps/web/data/datalab-visitor-profile-2024.json", period: ["2024-10-03", "2024-10-06", 4], collectedAt: "2026-09-24T11:41:43.889Z",
    trend: { local: 14949, outside: 93573, foreign: 187, total: 108709, dailyMean: 27177.25 }, gap: -1, // 108521 vs 108522
    shares: [[0.5, 0.8], [2.1, 1.9], [4.3, 4.7], [6.7, 6.9], [8.4, 7.5], [11.1, 13], [12.1, 11.4], [4.4, 4.2]],
    ids: {
      outside: ["2773331", "7837938", "10147587", "3306424", "173403", "54277", "8343126"],
      local: ["2773331", "7837938", "10147587", "3306424", "173403", "8343126", "54277"],
      all: ["2773331", "7837938", "10147587", "3306424", "173403", "8343126", "54277"],
    },
    leaks: ["13988", "16232", "108521"],
  },
};

test("2023 and 2024 build deterministically, match their checked-in artifacts and keep their own period, trend, shares and ranking", () => {
  for (const [year, x] of Object.entries(EDITION_EXPECTATIONS).map(([y, v]) => [Number(y), v])) {
    const a = serialize(buildVisitorProfile(REPO_ROOT, year)), [start, end, days] = x.period;
    assert.equal(serialize(buildVisitorProfile(REPO_ROOT, year)), a);
    assert.equal(editionConfig(year).outputPath, x.output);
    assert.equal(readFileSync(`${REPO_ROOT}${x.output}`, "utf8"), a, `${year} checked-in artifact`);
    const d = JSON.parse(a);
    assert.deepEqual(d.festival, { archiveFestivalId: "imsil-cheese", editionId: `imsil-cheese-${year}`, datalabFestivalId: "KCTF0061", name: "임실N치즈축제", regionCode: "52750", areaCode: "52750340", areaName: "임실군 성수면", year, start, end, days });
    assert.deepEqual([d.source.importDir, d.source.collectedAt], [`docs/research/imported/datalab-imsil-${year}`, x.collectedAt]);
    assert.equal(d.source.manifestSha256, sha256(readFileSync(`${REPO_ROOT}${editionConfig(year).manifestPath}`)));
    assert.equal(d.source.resourceLinksSha256, sha256(readFileSync(`${REPO_ROOT}${editionConfig(year).resourceLinksPath}`)));
    assert.equal(d.evidence.records.length, 5);
    for (const r of d.evidence.records) {
      assert.ok(r.path.startsWith(`${d.source.importDir}/original/`), r.path);
      assert.equal(sha256(readFileSync(`${REPO_ROOT}${r.path}`)), r.sha256, `${year} ${r.kind}`);
      assert.deepEqual(r.baseYears, CHART_KINDS.includes(r.kind) ? [String(year), String(year)] : null, `${year} ${r.kind} period evidence`);
    }
    assert.deepEqual(d.evidence.definitionChecks.map(c => c.file), ["fes.html", "festival.js", "festival_chart.js"]);
    assert.deepEqual(d.evidence.trend, x.trend);
    assert.equal(d.evidence.demographicCountGap, x.gap);
    assert.deepEqual(d.demographics.map(b => b.ageBand), ["0~9세", "10~19세", "20~29세", "30~39세", "40~49세", "50~59세", "60~69세", "70세 이상"]);
    assert.deepEqual(d.demographics.map(b => [b.malePercent, b.femalePercent]), x.shares);
    assert.ok(d.demographics.every(b => b.display === "N"), "DISP_YN=N is a valid percentage mode");
    assert.deepEqual(Object.fromEntries(d.destinationGroups.map(g => [g.group, g.items.map(i => i.id)])), x.ids);
    for (const g of d.destinationGroups) {
      assert.deepEqual(g.items.map(i => i.rank), g.items.map((_, i) => i + 1));
      assert.ok(g.items.every(i => i.address.startsWith("전북 임실군")), "host county");
      assert.deepEqual(g.items.filter(i => i.resource).map(i => [i.id, i.resource.id, i.resource.title]), [["2773331", "2718832", "임실치즈테마파크"], ["3306424", "317571", "상이암(임실)"]], `${year} ${g.group}: 소충사 is not ranked`);
    }
    for (const leak of ["SRCH_CNT", "M_TOT", "W_TOT", "\"count\"", "527279", ...x.leaks]) assert.ok(!a.includes(leak), `${year} must not carry ${leak}`);
  }
});

test("each edition carries only its own year and every edition differs in period, trend, shares, ranking and provenance", () => {
  const built = REVIEWED_YEARS.map(year => [year, serialize(buildVisitorProfile(REPO_ROOT, year))]);
  for (const [year, a] of built) for (const other of REVIEWED_YEARS.filter(y => y !== year)) {
    for (const mark of [`"${other}"`, `${other}-`, `datalab-imsil-${other}`, `imsil-cheese-${other}`]) assert.ok(!a.includes(mark), `${year} artifact must not carry ${mark}`);
  }
  const profiles = built.map(([, a]) => JSON.parse(a));
  for (const key of [d => `${d.festival.start}/${d.festival.end}`, d => JSON.stringify(d.evidence.trend), d => JSON.stringify(d.demographics),
    d => JSON.stringify(d.destinationGroups), d => d.source.manifestSha256, d => d.evidence.records.find(r => r.kind === "destinations").sha256]) {
    assert.equal(new Set(profiles.map(key)).size, REVIEWED_YEARS.length);
  }
  assert.equal(new Set(REVIEWED_YEARS.map(y => editionConfig(y).outputPath)).size, REVIEWED_YEARS.length);
});

test("unknown years are rejected and the reviewed allowlist cannot be mutated at runtime", () => {
  for (const year of [2022, 2026, "2024", 2024.5, null]) {
    assert.throws(() => editionConfig(year), /not a reviewed edition/, String(year));
    assert.throws(() => buildVisitorProfile(REPO_ROOT, year), /not a reviewed edition/, String(year));
  }
  assert.throws(() => verifyProfileImport(REPO_ROOT, 2019), /not a reviewed edition/);
  assert.deepEqual([...REVIEWED_YEARS], [2023, 2024, 2025]);
  assert.ok(Object.isFrozen(REVIEWED_EDITIONS) && Object.isFrozen(REVIEWED_EDITIONS[2024].reviewed) && Object.isFrozen(REVIEWED_EDITIONS[2024].records.trend.parameters));
  assert.throws(() => { REVIEWED_EDITIONS[2022] = REVIEWED_EDITIONS[2025]; }, TypeError);
  assert.throws(() => { REVIEWED_EDITIONS[2024].records.trend.parameters.BASE_YY1 = "2023"; }, TypeError);
  assert.deepEqual(parseCliArgs([]), { year: 2025, verify: false });
  assert.deepEqual(parseCliArgs(["--year", "2023", "--verify"]), { year: 2023, verify: true });
  assert.deepEqual(parseCliArgs(["--verify", "--year", "2024"]), { year: 2024, verify: true });
  for (const bad of [["--year"], ["--year", "23"], ["--year", "--verify"], ["--year", "2024", "--year", "2023"], ["--verify", "--verify"], ["--write"], ["2024"]]) {
    assert.throws(() => parseCliArgs(bad), /Usage/, bad.join(" "));
  }
  assert.throws(() => parseCliArgs(["--year", "2026"]), /not a reviewed edition/);
});

test("provenance, period and geography of 2023/2024 are checked against their own reviewed edition", () => {
  const demographics2023 = repoJson(`${REVIEWED_EDITIONS[2023].importDir}/original/demographics.json`);
  const links2025 = repoJson(REVIEWED_EDITIONS[2025].resourceLinksPath);
  const cases = [
    // year mix in provenance
    [2024, "chart request of another year", root => editJson(root, REVIEWED_EDITIONS[2024].manifestPath, m => { const p = record(m, "destinations").parameters; p.BASE_YY1 = p.BASE_YY2 = "2023"; }), /request parameters differ from the reviewed 2024 selection/],
    [2024, "one-sided range", root => editJson(root, REVIEWED_EDITIONS[2024].manifestPath, m => { record(m, "trend").parameters.BASE_YY2 = "2025"; }), /request parameters differ/],
    [2023, "scope of another year", root => editJson(root, REVIEWED_EDITIONS[2023].manifestPath, m => { m.scope.demographicYear = "2024"; }), /scope demographicYear is not 2023/],
    [2024, "observation of another year", root => editJson(root, REVIEWED_EDITIONS[2024].manifestPath, m => { m.observation = repoJson(REVIEWED_EDITIONS[2023].manifestPath).observation; }), /manifest observation/],
    [2024, "record path into another edition", root => editJson(root, REVIEWED_EDITIONS[2024].manifestPath, m => { record(m, "trend").path = "../../datalab-imsil-2023/original/trend.json"; }), /trend path/],
    [2024, "2023 destinations bytes", root => transplant(root, "destinations", 2023, 2024), /reviewed 2023 response \(mixed provenance\)/],
    [2023, "2025 trend bytes", root => transplant(root, "trend", 2025, 2023), /reviewed 2025 response \(mixed provenance\)/],
    [2025, "2024 demographics bytes", root => transplant(root, "demographics", 2024, 2025), /reviewed 2024 response \(mixed provenance\)/],
    [2024, "2023 demographics re-serialized", root => editOriginal(root, "demographics", d => { d.list = [...demographics2023.list].reverse(); }, 2024), /2024 domestic trend \(another period\?\)/],
    [2024, "trend row of another year", root => editOriginal(root, "trend", d => { d.list[0].BASE_YEAR = "2023"; }, 2024), /trend row is not 임실N치즈축제 2024/],
    [2023, "resource links of another year", root => editJson(root, REVIEWED_EDITIONS[2023].resourceLinksPath, l => { l.year = 2025; }), /scope differs/],
    [2024, "definition script drift", root => editJson(root, REVIEWED_EDITIONS[2024].manifestPath, m => { m.definitionChecks.find(c => c.file === "festival.js").sha256 = "0".repeat(64); }), /festival\.js differs from the reviewed page definition/],
    [2023, "definition check missing", root => editJson(root, REVIEWED_EDITIONS[2023].manifestPath, m => { m.definitionChecks = m.definitionChecks.filter(c => c.file !== "festival_chart.js"); }), /exactly the reviewed page definition checks/],
    [2023, "definition check repeated", root => editJson(root, REVIEWED_EDITIONS[2023].manifestPath, m => { m.definitionChecks[0] = { ...m.definitionChecks[1] }; }), /exactly the reviewed page definition checks/],
    [2023, "unlisted original", root => writeFileSync(`${root}${REVIEWED_EDITIONS[2023].importDir}/original/residence.json`, "{}"), /unlisted original file/],
    [2024, "tampered bytes", root => appendFileSync(`${root}${REVIEWED_EDITIONS[2024].importDir}/original/destinations.json`, " "), /hash mismatch/],
    // period
    [2024, "2025 dates under 2024", root => editOriginal(root, "festival-periods", d => { Object.assign(d.info_list.find(r => r.BASE_YEAR === "2024"), { FSTV_BGNG_YMD: "2025-10-08", FSTV_END_YMD: "2025-10-12" }); }, 2024), /info_list 2024 dates differ/],
    [2023, "five-day 2023", root => editOriginal(root, "festival-periods", d => { d.info_list.find(r => r.BASE_YEAR === "2023").FSTV_END_YMD = "2023-10-10"; }, 2023), /info_list 2023 dates differ/],
    [2023, "2023 total list missing", root => editOriginal(root, "festival-periods", d => { d.info_listTot = d.info_listTot.filter(r => r.BASE_YEAR !== "2023"); }, 2023), /info_listTot must hold 2023 exactly once/],
    [2024, "trend days", root => editOriginal(root, "trend", d => { d.list[0].FSTV_PERD_CNT = 5; }, 2024), /trend days/],
    [2023, "verified trend revised", root => editJson(root, TREND_PATH, t => { t.festivals.find(f => f.id === "imsil-n-cheese").years.find(y => y.year === 2023).local += 1; }), /source revised/],
    [2023, "archive period", root => editJson(root, EDITIONS_PATH, e => { e.editions.find(x => x.id === "imsil-cheese-2023").start = "2023-10-05"; }), /archive edition differs/],
    [2024, "link days", root => editJson(root, LINKS_PATH, l => { l.links.find(x => x.archiveFestivalId === "imsil-cheese").editions.find(x => x.editionId === "imsil-cheese-2024").days = 5; }), /reviewed link edition/],
    [2024, "list without 2024", root => editOriginal(root, "festival-list", d => { d.list[0].BASE_YEAR_STR = "2018,2019,2022,2023,2025"; }, 2024), /does not offer 2024/],
    // geography
    [2024, "period host area", root => editOriginal(root, "festival-periods", d => { d.info_list.find(r => r.BASE_YEAR === "2024").ADONG_NM1 = "임실군 임실읍"; }, 2024), /host area differs/],
    [2023, "list host area", root => editOriginal(root, "festival-list", d => { for (const k of Object.keys(d.list[0])) if (/^ADONG_NM\d$/.test(k)) d.list[0][k] = "임실군 임실읍"; }, 2023), /festival list host area differs/],
    [2023, "destination in another dong", root => editOriginal(root, "destinations", d => { d.list[3].EMD_CD = "52750250"; }, 2023), /outside the reviewed host area/],
    [2024, "destination dong name", root => editOriginal(root, "destinations", d => { rowOf(d, "현지인", "수월제").EMD_NM = "임실읍"; }, 2024), /outside the reviewed host area/],
    [2024, "other building", root => editJson(root, REVIEWED_EDITIONS[2024].resourceLinksPath, l => { l.links[1].resource.address = "전북특별자치도 임실군 성수면 성수산길 373"; }), /not the same place/],
    // resource mappings are the reviewed set this edition ranks
    [2023, "소충사 link without its ranking", root => editJson(root, REVIEWED_EDITIONS[2023].resourceLinksPath, l => { l.links.push({ ...links2025.links.find(x => x.destinationId === "725050") }); }), /exactly the 2 reviewed mappings ranked in 2023/],
    [2024, "소충사 instead of 상이암", root => editJson(root, REVIEWED_EDITIONS[2024].resourceLinksPath, l => { l.links[1] = { ...links2025.links.find(x => x.destinationId === "725050") }; }), /unreviewed destination/],
    [2023, "ranked 상이암 left unlinked", root => editJson(root, REVIEWED_EDITIONS[2023].resourceLinksPath, l => { l.links = l.links.filter(x => x.destinationId !== "3306424"); }), /exactly the 2 reviewed mappings/],
    [2024, "수월제 is not reviewed", root => editJson(root, REVIEWED_EDITIONS[2024].resourceLinksPath, l => { l.links[1].destinationId = "8343126"; }), /unreviewed destination/],
    [2025, "소충사 dropped from the ranking, link kept", root => editOriginal(root, "destinations", d => { d.list = d.list.filter(r => r.ITS_BRO_ID !== "725050"); }), /reviewed resource is missing/],
  ];
  for (const [year, name, mutate, error] of cases) withSandbox(root => { mutate(root); assert.throws(() => buildVisitorProfile(root, year), error, `${year} ${name}`); });
});

test("a removed reviewed place cannot replace an artifact that the runtime expects to keep", () => withSandbox(root => {
  runVisitorProfileCli([], root);
  const out = `${root}${PROFILE_OUTPUT_PATH}`, previous = readFileSync(out);
  editOriginal(root, "destinations", d => { d.list = d.list.filter(r => r.ITS_BRO_ID !== "725050"); });
  editJson(root, RESOURCE_LINKS_PATH, l => { l.links = l.links.filter(x => x.destinationId !== "725050"); });
  assert.throws(() => runVisitorProfileCli([], root), /reviewed resource is missing/);
  assert.deepEqual(readFileSync(out), previous);
}));

test("CLI refresh writes only a fully validated artifact; a stale, revised or mixed candidate keeps the previous snapshot", () => withSandbox(root => {
  const out = `${root}${REVIEWED_EDITIONS[2024].outputPath}`, fresh = serialize(buildVisitorProfile(REPO_ROOT, 2024));
  assert.equal(runVisitorProfileCli(["--year", "2024"], root), "Built apps/web/data/datalab-visitor-profile-2024.json (2024: 8 age bands, 7/7/7 ranked places)");
  assert.equal(readFileSync(out, "utf8"), fresh);
  assert.match(runVisitorProfileCli(["--verify", "--year", "2024"], root), /^Verified .*datalab-visitor-profile-2024\.json/);
  // --verify reports a stale artifact and never rewrites it.
  writeFileSync(out, "{}\n");
  assert.throws(() => runVisitorProfileCli(["--year", "2024", "--verify"], root), /datalab-visitor-profile-2024\.json differs from a fresh build/);
  assert.equal(readFileSync(out, "utf8"), "{}\n");
  runVisitorProfileCli(["--year", "2024"], root);
  const snapshot = readFileSync(out);
  assert.equal(snapshot.toString(), fresh);
  // A refreshed 2024 candidate whose trend was revised must not replace the verified snapshot.
  editOriginal(root, "trend", d => { const r = d.list[0]; r.TOT_OUT += 10; r.TOTAL_COL += 10; r.TOTAL_AVG = r.TOTAL_COL / 4; }, 2024);
  assert.throws(() => runVisitorProfileCli(["--year", "2024"], root), /source revised/);
  assert.deepEqual(readFileSync(out), snapshot);
  // The default edition keeps its checked-in bytes when its candidate mixes in another year's response.
  const defaultOut = `${root}${PROFILE_OUTPUT_PATH}`, defaultSnapshot = readFileSync(`${REPO_ROOT}${PROFILE_OUTPUT_PATH}`);
  writeFileSync(defaultOut, defaultSnapshot);
  transplant(root, "destinations", 2023, 2025);
  assert.throws(() => runVisitorProfileCli([], root), /mixed provenance/);
  assert.deepEqual(readFileSync(defaultOut), defaultSnapshot);
  // Failed or rejected refreshes create no other artifact and leave no temp file.
  assert.equal(existsSync(`${root}${REVIEWED_EDITIONS[2023].outputPath}`), false);
  assert.throws(() => runVisitorProfileCli(["--year", "2022"], root), /not a reviewed edition/);
  assert.equal(existsSync(`${root}apps/web/data/datalab-visitor-profile-2022.json`), false);
  assert.deepEqual(tempFiles(root), []);
}));

test("a failed atomic replace removes its temp file and leaves the target untouched", () => withSandbox(root => {
  const out = `${root}${REVIEWED_EDITIONS[2023].outputPath}`;
  mkdirSync(out);
  writeFileSync(`${out}/keep`, "x");
  assert.throws(() => runVisitorProfileCli(["--year", "2023"], root));
  assert.equal(readFileSync(`${out}/keep`, "utf8"), "x");
  assert.deepEqual(tempFiles(root), []);
}));

test("CLI entry exits non-zero for an unknown year or stray argument before reading or writing anything", () => {
  for (const [args, error] of [[["--year", "2022"], /not a reviewed edition/], [["--year", "2025", "--force"], /Usage/]]) {
    const r = spawnSync(process.execPath, [SCRIPT, ...args], { encoding: "utf8" });
    assert.equal(r.status, 1, args.join(" "));
    assert.match(r.stderr, error);
    assert.equal(r.stdout, "");
  }
});
