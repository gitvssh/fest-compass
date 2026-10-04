// node --test scripts/datalab-region-profiles.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { appendFileSync, cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { IDS_PATH, IMPORT_DIR, ORIGINAL_DIR, REPO_ROOT } from "./build-datalab-festival-trend.mjs";
import { OWNER_DIR } from "./datalab-owner-import.mjs";
import { CATALOGUE_PATH, REGION_IDS_PATH } from "./build-datalab-region-annual.mjs";
import { buildRegionProfiles, parseAreaShares, parseIndustries, parseOrigins, parseProvince, parseSpendingTrend, REGION_PROFILE_OUTPUT_PATH, serialize, SPENDING_HEADERS, TOTAL, VISITOR_HEADERS, YEARS } from "./build-datalab-region-profiles.mjs";

const csv = (header, rows) => [header, ...rows].map(r => r.join(",")).join("\n") + "\n";
const trendRows = (name = "가군", tweak = () => {}) => YEARS.flatMap(y => {
  const rows = [[String(y), name, TOTAL, "300.0"], [String(y), name, "일반외식업", "100.0"], [String(y), name, "호텔", "200.0"]];
  tweak(rows, y);
  return rows;
});

test("generator is deterministic and matches the checked-in artifact", () => {
  const a = serialize(buildRegionProfiles()), b = serialize(buildRegionProfiles());
  assert.equal(a, b);
  assert.equal(readFileSync(`${REPO_ROOT}${REGION_PROFILE_OUTPUT_PATH}`, "utf8"), a);
  assert.ok(!/20\d\d-\d\d-\d\dT\d\d:/.test(a), "no clock timestamps in output");
});

test("26 reviewed regions: codes, festival links and known source values", () => {
  const d = buildRegionProfiles(), byCode = Object.fromEntries(d.regions.map(r => [r.code, r]));
  assert.equal(d.regions.length, 26);
  assert.deepEqual(d.regions.filter(r => r.visitors === null).map(r => r.name).sort(), ["부평구", "연수구"]);
  assert.deepEqual(d.regions.flatMap(r => r.festivalIds).length, 27, "every first-import festival but Daegu Chimac, and two owner-download festivals in downloaded regions");
  assert.deepEqual(byCode["27110"].festivalIds, ["daegu-yangnyeongsi"], "Daegu Chimac is held in Duryu 3-dong (Dalseo-gu), not Jung-gu; 약령시 is in 성내2동, Jung-gu");
  assert.deepEqual(byCode["51760"].festivalIds, ["pyeongchang-trout", "pyeongchang-hyoseok"]);
  const jangheung = byCode["12770"];
  assert.deepEqual([jangheung.name, jangheung.province, jangheung.festivalIds], ["장흥군", "전남광주통합특별시", ["jangheung-water"]]);
  assert.deepEqual(jangheung.spending.years[0], { year: 2018, total: 40180429 });
  assert.deepEqual(jangheung.spending.industries[0].name, "쇼핑업");
  assert.equal(jangheung.spending.industries[0].share, 37.5);
  assert.deepEqual(jangheung.visitors.origins[0], { province: "전라남도", district: "강진군", share: 9.7 });
  for (const r of d.regions) {
    assert.deepEqual(r.spending.years.map(y => y.year), YEARS);
    for (const t of Object.values(r.spending.sources)) assert.ok(t.originalUrl.startsWith("https://github.com/travel-resolver/pick-d-day/blob/"));
  }
});

test("snapshot tables equal the 2018~2025 totals of the yearly tables (the download range)", () => {
  for (const r of buildRegionProfiles().regions) {
    const sum = r.spending.years.reduce((n, y) => n + y.total, 0);
    assert.ok(Math.abs(r.spending.province.find(x => x.name === r.name).value - sum) <= 2, r.name);
    assert.ok(Math.abs(r.spending.industries.reduce((n, g) => n + g.share, 0) - 100) <= 0.6, r.name);
  }
});

test("trend parser: eight years, a total each year, items adding up to it", () => {
  const out = parseSpendingTrend(csv(SPENDING_HEADERS["관광소비 추이"], trendRows()), "가군");
  assert.deepEqual(out[0], { year: 2018, total: 300, items: { 일반외식업: 100, 호텔: 200 } });
  const bad = [
    [trendRows("가군", (rows, y) => { if (y === 2020) rows.splice(0, 1); }), /Missing total spending: 2020/],
    [trendRows("가군", (rows, y) => { if (y === 2021) rows[1][3] = "150.0"; }), /do not add up: 2021/],
    [trendRows("가군", (rows, y) => { if (y === 2018) rows.push(["2018", "가군", "카지노", "1.0"]); }), /Unknown spending item/],
    [trendRows("가군", (rows, y) => { if (y === 2018) rows.push(["2018", "가군", "호텔", "1.0"]); }), /Duplicate spending item/],
    [trendRows("나군"), /Region name mismatch/],
    [[...trendRows(), ["2017", "가군", TOTAL, "1.0"]], /Unexpected observation year/],
    [trendRows("가군", (rows, y) => { if (y === 2019) rows[0][3] = ""; }), /Missing amount/],
  ];
  for (const [rows, error] of bad) assert.throws(() => parseSpendingTrend(csv(SPENDING_HEADERS["관광소비 추이"], rows), "가군"), error);
});

test("industry parser: shares must be the summed-range shares of the yearly items", () => {
  const trend = parseSpendingTrend(csv(SPENDING_HEADERS["관광소비 추이"], trendRows()), "가군");
  const ok = [["식음료업", "일반외식업", "33.3", "100.0"], ["숙박업", "호텔", "66.7", "100.0"]];
  assert.deepEqual(parseIndustries(csv(SPENDING_HEADERS["업종별 지출액"], ok), trend).map(g => [g.name, g.share]), [["숙박업", 66.7], ["식음료업", 33.3]]);
  assert.throws(() => parseIndustries(csv(SPENDING_HEADERS["업종별 지출액"], [["식음료업", "일반외식업", "50.0", "100.0"], ["숙박업", "호텔", "50.0", "100.0"]]), trend), /not the download-range share/);
  assert.throws(() => parseIndustries(csv(SPENDING_HEADERS["업종별 지출액"], [["숙박업", "일반외식업", "33.3", "100.0"]]), trend), /Unknown industry/);
});

test("dong, province and origin parsers keep shares, list the region once and stay within 100", () => {
  assert.deepEqual(parseAreaShares(csv(SPENDING_HEADERS["지역별 지출액"], [["가읍", "40.0"], ["나면", "60.0"]]), SPENDING_HEADERS["지역별 지출액"], 1).map(x => x.name), ["나면", "가읍"]);
  assert.throws(() => parseAreaShares(csv(SPENDING_HEADERS["지역별 지출액"], [["가읍", "40.0"], ["나면", "40.0"]]), SPENDING_HEADERS["지역별 지출액"], 1), /add up to 100/);
  assert.throws(() => parseAreaShares(csv(SPENDING_HEADERS["지역별 지출액"], [["가읍", "50.0"], ["가읍", "50.0"]]), SPENDING_HEADERS["지역별 지출액"], 1), /repeated dong/);
  const heat = [["가군", TOTAL, "3.0E2", "1.0E2"], ["나시", TOTAL, "9.0E2", "8.0E2"]];
  assert.deepEqual(parseProvince(csv(SPENDING_HEADERS["관광소비 히트맵"], heat), SPENDING_HEADERS["관광소비 히트맵"], "가군", 2, 1), [{ name: "나시", value: 900 }, { name: "가군", value: 300 }]);
  assert.throws(() => parseProvince(csv(SPENDING_HEADERS["관광소비 히트맵"], heat.slice(1)), SPENDING_HEADERS["관광소비 히트맵"], "가군", 2, 1), /list the region once/);
  assert.throws(() => parseProvince(csv(SPENDING_HEADERS["관광소비 히트맵"], [["가군", "호텔", "1.0", "1.0"]]), SPENDING_HEADERS["관광소비 히트맵"], "가군", 2, 1), /total spending/);
  assert.deepEqual(parseOrigins(csv(VISITOR_HEADERS["방문자 거주지"], [["가도", "다시", "1.5"], ["가도", "라군", "9.7"]]), "가군")[0], { province: "가도", district: "라군", share: 9.7 });
  assert.throws(() => parseOrigins(csv(VISITOR_HEADERS["방문자 거주지"], [["가도", "다시", "60.0"], ["가도", "라군", "60.0"]]), "가군"), /exceed 100/);
});

function sandbox() {
  const dir = mkdtempSync(`${tmpdir()}/datalab-region-profiles-`) + "/";
  mkdirSync(`${dir}apps/web/data`, { recursive: true });
  cpSync(`${REPO_ROOT}${IMPORT_DIR}`, `${dir}${IMPORT_DIR}`, { recursive: true });
  cpSync(`${REPO_ROOT}${OWNER_DIR}`, `${dir}${OWNER_DIR}`, { recursive: true });
  for (const p of [IDS_PATH, REGION_IDS_PATH, CATALOGUE_PATH]) cpSync(`${REPO_ROOT}${p}`, `${dir}${p}`);
  return dir;
}
const editJson = (root, path, edit) => { const p = `${root}${path}`, m = JSON.parse(readFileSync(p, "utf8")); edit(m); writeFileSync(p, JSON.stringify(m, null, 2) + "\n"); };
const region = (m, code) => m.regions.find(r => r.code === code);

test("tampered bytes, unreviewed codes, provinces and festival links are rejected", () => {
  const cases = [
    [root => { const r = region(JSON.parse(readFileSync(`${root}${REGION_IDS_PATH}`, "utf8")), "12770"); appendFileSync(`${root}${ORIGINAL_DIR}/${r.spendingFolder}/${r.spendingFolder.split("/").at(-1).split("_")[0]}_업종별 지출액.csv`, "x"); }, /hash mismatch/],
    [root => editJson(root, REGION_IDS_PATH, m => { region(m, "27110").festivalIds = ["daegu-chimac"]; }), /host dong is not in the region: daegu-chimac/],
    [root => editJson(root, REGION_IDS_PATH, m => { region(m, "12770").festivalIds.push("boseong-dahyang"); }), /linked to more than one region/],
    [root => editJson(root, REGION_IDS_PATH, m => { region(m, "51760").festivalIds.push("hoengseong-hanwoo"); }), /host dong is not in the region: hoengseong-hanwoo/],
    // A festival without a destination ranking cannot show that its host dong is in the region.
    [root => editJson(root, REGION_IDS_PATH, m => { region(m, "12770").festivalIds.push("sejong"); }), /Missing destination file: sejong/],
    [root => editJson(root, REGION_IDS_PATH, m => { region(m, "27110").code = "26110"; region(m, "26110").province = "부산광역시"; }), /not the region's province/],
    [root => editJson(root, REGION_IDS_PATH, m => { region(m, "12770").province = "전라남도"; }), /not in catalogue/],
    [root => editJson(root, REGION_IDS_PATH, m => { region(m, "12770").visitorFolder = null; }), /cover the visitor downloads/],
    [root => editJson(root, REGION_IDS_PATH, m => { m.regions.pop(); }), /cover the spending downloads/],
  ];
  for (const [mutate, error] of cases) {
    const root = sandbox();
    try { assert.doesNotThrow(() => buildRegionProfiles(root)); mutate(root); assert.throws(() => buildRegionProfiles(root), error); }
    finally { rmSync(root, { recursive: true, force: true }); }
  }
});
