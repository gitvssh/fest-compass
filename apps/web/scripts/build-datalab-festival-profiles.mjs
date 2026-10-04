// Build the checked-in DataLab festival profiles — festival-period vs base-period indicators, sex·age shares and
// destination search ranks — for the 26 reviewed festivals from byte-preserved imports.
// Standalone: `node scripts/build-datalab-festival-profiles.mjs [--verify]`. Not part of `npm run build`;
// the app only reads the checked-in apps/web/data/datalab-festival-profiles.json.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseTable } from "./datalab-csv.mjs";
import { classify, describe, IDS_PATH, MANIFEST_PATH, OFFICIAL_URL, ORIGINAL_DIR, REPO_ROOT, SOURCE, TREND_HEADER, verifyImport } from "./build-datalab-festival-trend.mjs";

export const PROFILE_OUTPUT_PATH = "apps/web/data/datalab-festival-profiles.json";
export const INDICATOR_HEADER = ["축제명", "그룹명", "개최년도", "구분명", "지표값"];
export const DEMOGRAPHIC_HEADER = ["축제명", "연령대", "남성비율", "여성비율"];
export const DESTINATION_HEADER = ["구분", "순위", "읍면동명", "목적지명", "도로명주소", "카테고리"];
// Source indicator names in display order. Value = the period's mean ÷ that year's maximum (DataLab 데이터 해석 유의사항,
// quoted in the imported 02-results.md). Visits and search are the festival's dong, spending its municipality.
export const INDICATORS = [
  { key: "outside", source: "외부방문자 유입" },
  { key: "local", source: "현지인방문자 유입" },
  { key: "search", source: "내비게이션 검색량" },
  { key: "spending", source: "관광소비" },
  { key: "concentration", source: "축제지 집중률" },
];
/** 비축제기간 is the four weeks before and after the festival (DataLab definition). */
export const PERIOD_GROUPS = { "축제기간": "festival", "비축제기간": "base" };
export const AGE_BANDS = ["0~9세", "10~19세", "20~29세", "30~39세", "40~49세", "50~59세", "60~69세", "70세 이상"];
export const DESTINATION_GROUPS = [{ group: "outside", source: "외지인" }, { group: "local", source: "현지인" }, { group: "all", source: "전체" }];
// The ranking excludes food and lodging by definition; a category like these means the file is not what we reviewed.
const EXCLUDED_CATEGORY = /음식|식당|한식|중식|일식|양식|카페|주점|제과|분식|뷔페|숙박|호텔|모텔|펜션|콘도|민박|게스트하우스|여관/;
const INDEX = /^(0|1)(\.\d{1,3})?$/;
const SHARE = /^(0|[1-9]\d?|100)\.\d$/;

const sourceRef = entry => ({ path: `${ORIGINAL_DIR}/${entry.path}`, originalPath: `${SOURCE.basePath}/${entry.path}`, originalUrl: entry.url, bytes: entry.bytes, sha256: entry.sha256 });

/**
 * Indicators per held year. A year whose ten values are all exactly 0 is withheld (the source has no measurement for it;
 * these are the festival-years absent from the visit trend) and never shown as zeros. A partly zero year fails the build.
 */
export function parseIndicators(text, name, range) {
  const { rows } = parseTable(text, INDICATOR_HEADER), byYear = new Map();
  rows.forEach((r, i) => {
    const at = `row ${i + 2}`, group = PERIOD_GROUPS[r[1]], index = INDICATORS.findIndex(x => x.source === r[3]);
    if (r[0] !== name) throw new Error(`Festival name mismatch: ${at}`);
    if (!group) throw new Error(`Unknown period group: ${at}`);
    if (!/^\d{4}$/.test(r[2]) || Number(r[2]) < range.from || Number(r[2]) > range.to) throw new Error(`Year outside the download range: ${at}`);
    if (index < 0) throw new Error(`Unknown indicator: ${at}`);
    if (!INDEX.test(r[4]) || Number(r[4]) > 1) throw new Error(`Indicator must be 0..1 with up to three decimals: ${at}`);
    const year = Number(r[2]), y = byYear.get(year) ?? { festival: INDICATORS.map(() => null), base: INDICATORS.map(() => null) };
    if (y[group][index] !== null) throw new Error(`Duplicate indicator: ${at}`);
    y[group][index] = Number(r[4]);
    byYear.set(year, y);
  });
  const years = [], withheldYears = [];
  for (const year of [...byYear.keys()].sort((a, b) => a - b)) {
    const y = byYear.get(year), all = [...y.festival, ...y.base];
    if (all.some(v => v === null)) throw new Error(`Incomplete indicator year: ${year}`);
    if (all.every(v => v === 0)) { withheldYears.push(year); continue; }
    if (all.some(v => v === 0)) throw new Error(`Partly zero indicator year needs review: ${year}`);
    years.push({ year, festival: y.festival, base: y.base });
  }
  if (!years.length) throw new Error("No indicator year with values");
  return { years, withheldYears };
}

/** Eight bands, source order is oldest first; returned youngest first like the reviewed visitor profile. */
export function parseDemographics(text, name) {
  const { rows } = parseTable(text, DEMOGRAPHIC_HEADER), byBand = new Map();
  rows.forEach((r, i) => {
    const at = `row ${i + 2}`;
    if (r[0] !== name) throw new Error(`Festival name mismatch: ${at}`);
    if (!AGE_BANDS.includes(r[1]) || byBand.has(r[1])) throw new Error(`Unknown or repeated age band: ${at}`);
    if (!SHARE.test(r[2]) || !SHARE.test(r[3])) throw new Error(`Share must be a one-decimal percentage: ${at}`);
    byBand.set(r[1], { ageBand: r[1], malePercent: Number(r[2]), femalePercent: Number(r[3]) });
  });
  if (byBand.size !== AGE_BANDS.length) throw new Error("Demographics must hold the eight age bands");
  const bands = AGE_BANDS.map(b => byBand.get(b));
  const sum = bands.reduce((n, b) => n + b.malePercent + b.femalePercent, 0);
  if (Math.abs(sum - 100) > 0.8 + 1e-9) throw new Error("Shares must add up to 100 within rounding");
  return bands;
}

/** Three groups in the reviewed order, each a competition ranking (ties share a rank) in source order. */
export function parseDestinations(text) {
  const { rows } = parseTable(text, DESTINATION_HEADER);
  rows.forEach((r, i) => { if (!DESTINATION_GROUPS.some(g => g.source === r[0])) throw new Error(`Unknown destination group: row ${i + 2}`); });
  return DESTINATION_GROUPS.map(({ group, source }) => {
    const items = [];
    rows.filter(r => r[0] === source).forEach((r, i) => {
      const at = `${source} row ${i + 1}`, rank = Number(r[1]);
      if (!/^[1-9]\d*$/.test(r[1]) || rank > i + 1 || (i === 0 ? rank !== 1 : rank < items[i - 1].rank)) throw new Error(`Rank must start at 1 and never go down: ${at}`);
      if (r.slice(2).some(v => !v.trim())) throw new Error(`Empty destination field: ${at}`);
      if (EXCLUDED_CATEGORY.test(r[5])) throw new Error(`Food or lodging is outside the ranking definition: ${at}`);
      items.push({ rank, area: r[2], name: r[3], address: r[4], category: r[5] });
    });
    if (!items.length) throw new Error(`Missing destination group: ${source}`);
    return { group, label: source, items };
  });
}

/** The selected download range is in the folder name; every dated row must sit inside it and the indicators must reach its end. */
function rangeOf(path) {
  const m = path.match(/_문화관광축제_(\d{4})-(\d{4})_데이터랩_다운로드\//);
  if (!m) throw new Error(`No download range in path: ${path}`);
  return { from: Number(m[1]), to: Number(m[2]) };
}

export function buildProfiles(root = REPO_ROOT) {
  const { manifestSha256, files } = verifyImport(root);
  const ids = JSON.parse(readFileSync(`${root}${IDS_PATH}`, "utf8"));
  const festivals = ids.festivals.map(f => {
    const trend = classify(f.sourceFile), range = rangeOf(f.sourceFile);
    const table = name => {
      const path = f.sourceFile.replace(/_연도별 방문자 추이\.csv$/, `_${name}.csv`), hit = files.get(path), c = hit && classify(path);
      if (!hit || c.group !== "festival" || c.table !== name || c.name !== f.name || c.stamp !== trend.stamp || hit.entry.use !== "consumed") throw new Error(`Missing reviewed ${name} file: ${f.id}`);
      return { text: describe(hit.bytes).text, source: sourceRef(hit.entry) };
    };
    const ind = table("문화관광축제 주요 지표"), demo = table("성-연령별 내국인 방문자"), dest = table("목적지 검색순위");
    const indicators = parseIndicators(ind.text, f.name, range);
    if (Math.max(...indicators.years.map(y => y.year), ...indicators.withheldYears) !== range.to) throw new Error(`Indicators do not reach the download range end: ${f.id}`);
    const trendYears = parseTable(describe(files.get(f.sourceFile).bytes).text, TREND_HEADER).rows.map(r => Number(r[1]));
    if (trendYears.some(y => y < range.from || y > range.to)) throw new Error(`Trend year outside the download range: ${f.id}`);
    return {
      id: f.id, name: f.name, range, downloadDate: `${trend.stamp.slice(0, 4)}-${trend.stamp.slice(4, 6)}-${trend.stamp.slice(6, 8)}`,
      indicators, demographics: parseDemographics(demo.text, f.name), destinations: parseDestinations(dest.text),
      sources: { indicators: ind.source, demographics: demo.source, destinations: dest.source },
    };
  });
  return {
    kind: "datalab-festival-profiles", schemaVersion: 1,
    scope: {
      indicators: "축제기간과 비축제기간(축제 전후 4주)의 지표값. 지표값 = 해당 기간 평균 ÷ 그해 최대값(0~1). 외부·현지인 방문과 내비게이션 검색은 축제 개최 행정동, 관광소비는 시군구, 집중률은 행정동 ÷ 시군구.",
      withheld: "열 개 값이 모두 0인 해는 측정값이 없는 해로 보고 표시하지 않는다(방문 추이에도 없는 축제·연도).",
      demographics: "내려받기 기간(폴더 이름의 연도 범위) 전체의 축제기간 내국인 방문자 성·연령 비율(%). 연도별 값이 아니다.",
      destinations: "내려받기 기간 전체의 축제기간에 축제 개최 행정동 안에서 내비게이션 목적지 검색이 많았던 곳의 순위. 음식점·숙박 제외. 방문 수나 동선이 아니다.",
      comparison: "지표값은 지역 규모에 따라 달라지므로 다른 축제와 크기를 비교하지 않는다. 같은 축제의 연도별 변화에 쓴다.",
    },
    source: { title: "한국관광 데이터랩 · 문화관광축제 주요 지표·성연령·목적지 검색순위", officialUrl: OFFICIAL_URL, definitionReviewedAt: "2026-10-04", repository: SOURCE.repository, commit: SOURCE.commit, basePath: SOURCE.basePath, manifestPath: MANIFEST_PATH, manifestSha256, downloadTimezone: null },
    indicators: INDICATORS, festivals,
  };
}

export const serialize = dataset => JSON.stringify(dataset, null, 2) + "\n";

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const text = serialize(buildProfiles()), out = `${REPO_ROOT}${PROFILE_OUTPUT_PATH}`;
  const n = JSON.parse(text).festivals.length;
  if (process.argv.includes("--verify")) {
    if (!existsSync(out) || readFileSync(out, "utf8") !== text) { console.error(`${PROFILE_OUTPUT_PATH} differs from a fresh build`); process.exit(1); }
    console.log(`Verified manifest, imports, and ${PROFILE_OUTPUT_PATH} (${n} festivals)`);
  } else {
    writeFileSync(out, text);
    console.log(`Built ${PROFILE_OUTPUT_PATH} (${n} festivals)`);
  }
}
