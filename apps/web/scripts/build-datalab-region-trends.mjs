// Build the checked-in DataLab region trends — yearly tourism spending (domestic = local + outside, by industry group) and
// yearly outside visitors — for the regions the owner downloaded on 2026-10-05, from the byte-preserved import.
// Standalone: `node scripts/build-datalab-region-trends.mjs [--verify]`. Not part of `npm run build`;
// the app only reads the checked-in apps/web/data/datalab-region-trends.json.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe } from "./datalab-bytes.mjs";
import { parseTable } from "./datalab-csv.mjs";
import { festivalSources, placeOf, REPO_ROOT, stampDate } from "./build-datalab-festival-trend.mjs";
import { CATALOGUE_PATH, REGION_IDS_PATH, REGION_OFFICIAL_URL } from "./build-datalab-region-annual.mjs";
import { INDUSTRIES } from "./build-datalab-region-profiles.mjs";
import { classifyRegionFile, OWNER_REGIONS, REGIONS_MANIFEST, REGIONS_ORIGINAL, verifyOwnerRegions } from "./datalab-owner-regions.mjs";

export const TREND_IDS_PATH = "apps/web/data/datalab-region-trend-ids.json";
export const TREND_OUTPUT_PATH = "apps/web/data/datalab-region-trends.json";
export const SPENDING_HEADER = ["기준연월", "업종대분류명", "소비액(천원)"];
export const VISITOR_HEADER = ["기준년월", "방문자수", "전년동월방문자수", "방문자수증감률"];
export const SPENDING_TABLES = { domestic: "관광소비 추이_내국인", local: "관광소비 추이_현지인", outside: "관광소비 추이_외지인" };
export const VISITOR_TABLE = "방문자 수(연인원) 추이";
const TOTAL = "전체";
const AMOUNT = /^(0|[1-9]\d*)(\.\d+)?(E[+-]?\d+)?$/;
// Source amounts are whole thousand won written with a decimal or E notation; sums stay within one unit per part.
const near = (a, b, tolerance) => Math.abs(a - b) <= tolerance;

/** One spending table: every year of the range has a total, known industry groups only, and the groups add up to it. */
export function parseSpending(text, range) {
  const { rows } = parseTable(text, SPENDING_HEADER), byYear = new Map();
  rows.forEach((r, i) => {
    const at = `row ${i + 2}`;
    if (!/^\d{4}$/.test(r[0]) || Number(r[0]) < range.from || Number(r[0]) > range.to) throw new Error(`Year outside the download range: ${at}`);
    if (r[1] !== TOTAL && !Object.hasOwn(INDUSTRIES, r[1])) throw new Error(`Unknown industry group: ${at}`);
    if (!AMOUNT.test(r[2]) || !Number.isFinite(Number(r[2]))) throw new Error(`Amount must be a non-negative number: ${at}`);
    const year = Number(r[0]), y = byYear.get(year) ?? new Map();
    if (y.has(r[1])) throw new Error(`Repeated year and industry: ${at}`);
    y.set(r[1], Number(r[2]));
    byYear.set(year, y);
  });
  const years = [];
  for (let year = range.from; year <= range.to; year++) {
    const y = byYear.get(year);
    if (!y?.has(TOTAL)) throw new Error(`Missing total for ${year}`);
    const groups = [...y].filter(([k]) => k !== TOTAL);
    if (!near(groups.reduce((n, [, v]) => n + v, 0), y.get(TOTAL), groups.length)) throw new Error(`Industry groups do not add up to the total in ${year}`);
    years.push({ year, total: y.get(TOTAL), industries: Object.fromEntries(groups) });
  }
  return years;
}

/**
 * Yearly outside visitors (연인원). The download range comes with the site's one comparison year before it; years run
 * without gaps. Where the source gives the previous year, it must be the row before and its rate must follow from both.
 */
export function parseVisitors(text, range) {
  const { rows } = parseTable(text, VISITOR_HEADER), first = range.from - 1;
  if (rows.length !== range.to - first + 1) throw new Error("Visitor rows must be the comparison year and the download range");
  return rows.map((r, i) => {
    const at = `row ${i + 2}`, year = first + i;
    if (r[0] !== String(year)) throw new Error(`Years must run from ${first} without gaps: ${at}`);
    const outside = AMOUNT.test(r[1]) ? Number(r[1]) : NaN;
    if (!Number.isInteger(outside)) throw new Error(`Visitors must be a whole count: ${at}`);
    if (r[2] !== "" || r[3] !== "") {
      const previous = Number(r[2]), rate = Math.round((outside - previous) / previous * 1000) / 10;
      if (i === 0 || !AMOUNT.test(r[2]) || previous !== Number(rows[i - 1][1])) throw new Error(`Previous-year value must equal the row before: ${at}`);
      if (!/^-?\d+(\.\d)?$/.test(r[3]) || !near(rate, Number(r[3]), 0.1 + 1e-9)) throw new Error(`Change rate differs from the counts: ${at}`);
    }
    return { year, outside };
  });
}

const sourceRef = entry => ({ path: `${REGIONS_ORIGINAL}/${entry.path}`, originalPath: `${entry.zip.path.slice("zip/".length)}/${entry.zip.entry}`, originalUrl: entry.url, bytes: entry.bytes, sha256: entry.sha256 });

export function buildRegionTrends(root = REPO_ROOT) {
  const { manifest, manifestSha256, files } = verifyOwnerRegions(root);
  const ids = JSON.parse(readFileSync(`${root}${TREND_IDS_PATH}`, "utf8"));
  if (ids.version !== 1 || !Array.isArray(ids.regions)) throw new Error("Unexpected region trend table version");
  const catalogue = JSON.parse(readFileSync(`${root}${CATALOGUE_PATH}`, "utf8")).rows;
  const firstImport = JSON.parse(readFileSync(`${root}${REGION_IDS_PATH}`, "utf8")).regions;
  const sources = festivalSources(root);
  const consumedZips = manifest.files.filter(f => f.group === "zip" && f.entries.some(p => files.get(p).entry.use === "consumed")).map(f => f.path.slice("zip/".length));
  const mapped = ids.regions.flatMap(r => [r.spendingZip, r.visitorZip]);
  if (new Set(mapped).size !== mapped.length || mapped.length !== consumedZips.length || consumedZips.some(z => !mapped.includes(z))) throw new Error("Region table does not cover the consumed downloads exactly");
  if (new Set(ids.regions.map(r => r.code)).size !== ids.regions.length || ids.regions.some(r => firstImport.some(x => x.code === r.code))) throw new Error("A region is listed twice or already comes from the first import");
  const linked = ids.regions.flatMap(r => r.festivalIds);
  if (new Set(linked).size !== linked.length || linked.some(id => firstImport.some(x => x.festivalIds.includes(id)))) throw new Error("A festival is linked to more than one region");
  const regions = ids.regions.map(r => {
    const place = catalogue.find(k => `${k.provinceCode}${k.districtCode}` === r.code);
    if (!place || place.districtName !== r.name || place.provinceName !== r.province) throw new Error(`Region code not in catalogue under that name: ${r.code}`);
    const zip = (name, kind) => {
      const z = manifest.files.find(f => f.group === "zip" && f.path === `zip/${name}`);
      if (!z || z.region !== r.name || z.kind !== kind) throw new Error(`Download is not the region's ${kind}: ${name}`);
      return { ...z, stamp: classifyRegionFile(z.path).stamp };
    };
    const table = (z, name) => {
      const hit = z.entries.map(p => files.get(p)).find(h => h.entry.table === name);
      if (!hit || hit.entry.use !== "consumed") throw new Error(`Missing ${name}: ${r.code}`);
      return { text: describe(hit.bytes).text, source: sourceRef(hit.entry) };
    };
    const sz = zip(r.spendingZip, "관광소비"), vz = zip(r.visitorZip, "방문자");
    const spending = Object.fromEntries(Object.entries(SPENDING_TABLES).map(([k, name]) => { const t = table(sz, name); return [k, { ...t, years: parseSpending(t.text, sz.range) }]; }));
    // Domestic spending is local plus outside for every year and industry group (a group a table leaves out had none).
    spending.domestic.years.forEach((d, i) => {
      for (const key of new Set([TOTAL, ...Object.keys(d.industries), ...Object.keys(spending.local.years[i].industries), ...Object.keys(spending.outside.years[i].industries)])) {
        const pick = who => (key === TOTAL ? spending[who].years[i].total : spending[who].years[i].industries[key] ?? 0);
        if (!near(pick("domestic"), pick("local") + pick("outside"), 2)) throw new Error(`Domestic spending is not local plus outside: ${r.code} ${d.year} ${key}`);
      }
    });
    const visits = table(vz, VISITOR_TABLE);
    for (const id of r.festivalIds) {
      const f = sources.ids.festivals.find(x => x.id === id), destinations = f && sources.table(f, "목적지 검색순위");
      if (!f) throw new Error(`Unknown festival: ${id}`);
      if (!destinations || placeOf(destinations.text) !== r.addressPrefix) throw new Error(`Festival place is not the region: ${id}`);
    }
    return {
      code: r.code, name: r.name, province: r.province, festivalIds: r.festivalIds,
      spending: {
        downloadDate: stampDate(sz.stamp), range: sz.range,
        years: spending.domestic.years.map((d, i) => ({ year: d.year, total: d.total, local: spending.local.years[i].total, outside: spending.outside.years[i].total })),
        industries: Object.keys(INDUSTRIES).filter(name => spending.domestic.years.some(y => name in y.industries))
          .map(name => ({ name, total: Math.round(spending.domestic.years.reduce((n, y) => n + (y.industries[name] ?? 0), 0)) })),
        sources: Object.fromEntries(Object.keys(SPENDING_TABLES).map(k => [k, spending[k].source])),
      },
      visitors: { downloadDate: stampDate(vz.stamp), range: { from: vz.range.from - 1, to: vz.range.to }, years: parseVisitors(visits.text, vz.range), sources: { trend: visits.source } },
    };
  });
  return {
    kind: "datalab-region-trends", schemaVersion: 1,
    scope: {
      spending: "시군구 전체 관광소비(천원), 데이터랩 지역 화면의 관광소비 추이. 내국인 = 현지인 + 외지인(연도·업종마다 대조). 업종은 대분류만 있고 비율은 범위 합계 기준. 축제 소비가 아니다.",
      visitors: "시군구를 찾은 외지인 방문자 수(연인원, 이동통신 기반 추정). 내려받기 범위 앞의 한 해(2019)는 사이트가 함께 준 비교 연도. 한국관광공사 일별 외지인 방문자 수의 연간 합계와 같은 지표.",
      notIncluded: "읍면동 비율·같은 시도 순위·거주지·업종 세부는 이 내려받기에 없다.",
    },
    source: { title: "한국관광 데이터랩 · 지역 관광소비·외지인 방문자 추이", officialUrl: REGION_OFFICIAL_URL, definitionReviewedAt: "2026-10-05",
      import: { id: OWNER_REGIONS.id, manifestPath: REGIONS_MANIFEST, manifestSha256 }, downloadTimezone: null },
    regions,
  };
}

export const serialize = dataset => JSON.stringify(dataset, null, 2) + "\n";

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const text = serialize(buildRegionTrends()), out = `${REPO_ROOT}${TREND_OUTPUT_PATH}`, n = JSON.parse(text).regions.length;
  if (process.argv.includes("--verify")) {
    if (!existsSync(out) || readFileSync(out, "utf8") !== text) { console.error(`${TREND_OUTPUT_PATH} differs from a fresh build`); process.exit(1); }
    console.log(`Verified manifest, imports, and ${TREND_OUTPUT_PATH} (${n} regions)`);
  } else {
    writeFileSync(out, text);
    console.log(`Built ${TREND_OUTPUT_PATH} (${n} regions)`);
  }
}
