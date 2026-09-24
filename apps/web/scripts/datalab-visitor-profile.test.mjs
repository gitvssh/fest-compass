// node --test scripts/datalab-visitor-profile.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { appendFileSync, cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { REPO_ROOT, sha256 } from "./build-datalab-festival-trend.mjs";
import { buildVisitorProfile, CROSS_CHECK_PATHS, PROFILE_DIR, PROFILE_MANIFEST_PATH, PROFILE_OUTPUT_PATH, RESOURCE_LINKS_PATH, serialize } from "./build-datalab-visitor-profile.mjs";

const [TREND_PATH, LINKS_PATH, EDITIONS_PATH] = CROSS_CHECK_PATHS;

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
  cpSync(`${REPO_ROOT}${PROFILE_DIR}`, `${dir}${PROFILE_DIR}`, { recursive: true });
  for (const p of CROSS_CHECK_PATHS) cpSync(`${REPO_ROOT}${p}`, `${dir}${p}`);
  return dir;
}
const editJson = (root, path, edit) => { const p = `${root}${path}`, m = JSON.parse(readFileSync(p, "utf8")); edit(m); writeFileSync(p, JSON.stringify(m, null, 2) + "\n"); };
const record = (m, kind) => m.records.find(r => r.kind === kind);
// Edit an original response and re-pin its manifest hash, so the content check (not the byte check) must catch it.
const editOriginal = (root, kind, edit) => {
  const p = `${root}${PROFILE_DIR}/original/${kind}.json`, d = JSON.parse(readFileSync(p, "utf8"));
  edit(d);
  const bytes = Buffer.from(JSON.stringify(d));
  writeFileSync(p, bytes);
  editJson(root, PROFILE_MANIFEST_PATH, m => { const r = record(m, kind); r.sha256 = sha256(bytes); r.bytes = bytes.length; });
};
const withSandbox = fn => { const root = sandbox(); try { return fn(root); } finally { rmSync(root, { recursive: true, force: true }); } };
const rowOf = (d, group, name) => d.list.find(r => r.DIV_NM === group && r.ITS_BRO_NM === name);

test("sandbox copy builds identically, and re-pinned originals still build (so each mutation below reaches its content check)", () => {
  const fresh = serialize(buildVisitorProfile());
  withSandbox(root => assert.equal(serialize(buildVisitorProfile(root)), fresh));
  withSandbox(root => { for (const k of ["festival-list", "festival-periods", "trend", "demographics", "destinations"]) editOriginal(root, k, () => {}); assert.doesNotThrow(() => buildVisitorProfile(root)); });
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
