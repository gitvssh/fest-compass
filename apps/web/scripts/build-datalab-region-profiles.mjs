// Build the checked-in DataLab region profiles — tourism spending by year, industry and dong, and outside visitors' origin
// and dong shares, with the region's place in its province — for the reviewed regions from byte-preserved imports.
// Standalone: `node scripts/build-datalab-region-profiles.mjs [--verify]`. Not part of `npm run build`;
// the app only reads the checked-in apps/web/data/datalab-region-profiles.json.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseTable } from "./datalab-csv.mjs";
import { parseDestinations } from "./build-datalab-festival-profiles.mjs";
import { classify, describe, festivalSources, MANIFEST_PATH, ORIGINAL_DIR, REPO_ROOT, SOURCE, verifyImport } from "./build-datalab-festival-trend.mjs";
import { CATALOGUE_PATH, parseAnnualCount, parseRegionAnnual, REGION_IDS_PATH, REGION_OFFICIAL_URL } from "./build-datalab-region-annual.mjs";

export const REGION_PROFILE_OUTPUT_PATH = "apps/web/data/datalab-region-profiles.json";
export const YEARS = [2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025];
export const SPENDING_HEADERS = {
  "관광소비 추이": ["기준년월", "기초지자체", "중분류", "소비액(천원)"],
  "관광소비 히트맵": ["기초지자체명", "중분류", "소비액(천원)", "전년동기 소비액"],
  "업종별 지출액": ["대분류", "중분류", "대분류 지출액 비율", "중분류 지출액 비율"],
  "지역별 지출액": ["행정동명", "비율(%)"],
};
export const VISITOR_HEADERS = {
  "방문자 거주지": ["거주지(시도)", "거주지(시군구)", "비율(%)"],
  "방문자수 히트맵": ["기초지자체", "방문자 수"],
  "지역별 방문자 수": ["기초지자체명", "기초지자체 방문자 수", "기초지자체 방문자 비율"],
};
export const TOTAL = "관광총소비";
// Industry groups and their items as the source names them; an unknown name means the file is not what we reviewed.
export const INDUSTRIES = {
  "쇼핑업": ["기타관광쇼핑", "대형쇼핑몰", "레저용품쇼핑", "면세점"],
  "숙박업": ["기타숙박", "캠핑장/펜션", "콘도", "호텔"],
  "식음료업": ["일반외식업", "제과음료업"],
  "여가서비스업": ["골프장", "관광유원시설", "기타레저", "문화서비스", "스키장"],
  "여행업": ["여행업"],
  "운송업": ["렌터카", "수상운송", "육상운송", "항공운송"],
  "의료웰니스업": ["뷰티"],
};
const SHARE = /^(0|[1-9]\d?|100)(\.\d)?$/;

const sourceRef = entry => ({ path: `${ORIGINAL_DIR}/${entry.path}`, originalPath: `${SOURCE.basePath}/${entry.path}`, originalUrl: entry.url, bytes: entry.bytes, sha256: entry.sha256 });
const share = (v, at) => { if (!SHARE.test(v)) throw new Error(`Share must be a percentage with at most one decimal: ${at}`); return Number(v); };
const amount = (v, at) => { const n = parseAnnualCount(v); if (n === null) throw new Error(`Missing amount: ${at}`); return n; };
const near = (a, b, tolerance) => Math.abs(a - b) <= tolerance;

/** Yearly tourism spending (thousand won) by item. Each year needs the total row; the items must add up to it. */
export function parseSpendingTrend(text, name) {
  const { rows } = parseTable(text, SPENDING_HEADERS["관광소비 추이"]), byYear = new Map();
  rows.forEach((r, i) => {
    const at = `row ${i + 2}`;
    if (!/^\d{4}$/.test(r[0]) || !YEARS.includes(Number(r[0]))) throw new Error(`Unexpected observation year: ${at}`);
    if (r[1] !== name) throw new Error(`Region name mismatch: ${at}`);
    if (r[2] !== TOTAL && !Object.values(INDUSTRIES).flat().includes(r[2])) throw new Error(`Unknown spending item: ${at}`);
    const y = byYear.get(r[0]) ?? new Map();
    if (y.has(r[2])) throw new Error(`Duplicate spending item: ${at}`);
    y.set(r[2], amount(r[3], at));
    byYear.set(r[0], y);
  });
  const years = YEARS.map(year => {
    const y = byYear.get(String(year));
    if (!y || !y.has(TOTAL)) throw new Error(`Missing total spending: ${year}`);
    const items = [...y].filter(([k]) => k !== TOTAL), sum = items.reduce((n, [, v]) => n + v, 0), total = y.get(TOTAL);
    if (!near(sum, total, Math.max(2, total * 1e-6))) throw new Error(`Spending items do not add up: ${year}`);
    return { year, total, items: Object.fromEntries(items) };
  });
  return years;
}

/** Industry shares over the download range; they must equal the shares of the summed yearly items (same period). */
export function parseIndustries(text, trend) {
  const { rows } = parseTable(text, SPENDING_HEADERS["업종별 지출액"]), groups = new Map();
  rows.forEach((r, i) => {
    const at = `row ${i + 2}`;
    if (!INDUSTRIES[r[0]]?.includes(r[1])) throw new Error(`Unknown industry: ${at}`);
    const g = groups.get(r[0]) ?? { name: r[0], share: share(r[2], at), items: [] };
    if (g.share !== share(r[2], at)) throw new Error(`Group share differs within a group: ${at}`);
    if (g.items.some(x => x.name === r[1])) throw new Error(`Duplicate industry item: ${at}`);
    g.items.push({ name: r[1], share: share(r[3], at) });
    groups.set(r[0], g);
  });
  const sums = {};
  for (const y of trend) for (const [k, v] of Object.entries(y.items)) sums[k] = (sums[k] ?? 0) + v;
  const all = Object.values(sums).reduce((n, v) => n + v, 0);
  for (const g of groups.values()) {
    const groupSum = g.items.reduce((n, x) => n + (sums[x.name] ?? 0), 0);
    if (!near(Math.round((groupSum / all) * 1000) / 10, g.share, 0.11)) throw new Error(`Industry share is not the download-range share: ${g.name}`);
    for (const x of g.items) if (groupSum && !near(Math.round(((sums[x.name] ?? 0) / groupSum) * 1000) / 10, x.share, 0.11)) throw new Error(`Item share is not the download-range share: ${x.name}`);
  }
  const out = [...groups.values()].map(g => ({ ...g, items: [...g.items].sort((a, b) => b.share - a.share || a.name.localeCompare(b.name, "ko")) }));
  if (!near(out.reduce((n, g) => n + g.share, 0), 100, 0.6)) throw new Error("Industry shares must add up to 100");
  return out.sort((a, b) => b.share - a.share || a.name.localeCompare(b.name, "ko"));
}

/** Dong shares (%) in source order sorted by share; they must add up to 100 within rounding. */
export function parseAreaShares(text, header, shareColumn) {
  const { rows } = parseTable(text, header), seen = new Set();
  const out = rows.map((r, i) => {
    const at = `row ${i + 2}`;
    if (!r[0].trim() || seen.has(r[0])) throw new Error(`Empty or repeated dong: ${at}`);
    seen.add(r[0]);
    return { name: r[0], share: share(r[shareColumn], at) };
  });
  if (!out.length || !near(out.reduce((n, x) => n + x.share, 0), 100, 1.0)) throw new Error("Dong shares must add up to 100");
  return out.sort((a, b) => b.share - a.share || a.name.localeCompare(b.name, "ko"));
}

/** Province comparison: every listed district with its download-range value; the region itself must appear once. */
export function parseProvince(text, header, name, valueColumn, categoryColumn = null) {
  const { rows } = parseTable(text, header), seen = new Set();
  const out = rows.map((r, i) => {
    const at = `row ${i + 2}`;
    if (categoryColumn !== null && r[categoryColumn] !== TOTAL) throw new Error(`Province comparison must be total spending: ${at}`);
    if (!r[0].trim() || seen.has(r[0])) throw new Error(`Empty or repeated district: ${at}`);
    seen.add(r[0]);
    return { name: r[0], value: amount(r[valueColumn], at) };
  });
  if (out.filter(x => x.name === name).length !== 1) throw new Error("Province comparison must list the region once");
  return out.sort((a, b) => b.value - a.value || a.name.localeCompare(b.name, "ko"));
}

export function parseOrigins(text, name) {
  const { rows } = parseTable(text, VISITOR_HEADERS["방문자 거주지"]), seen = new Set();
  const out = rows.map((r, i) => {
    const at = `row ${i + 2}`, key = `${r[0]}|${r[1]}`;
    if (!r[0].trim() || !r[1].trim() || seen.has(key)) throw new Error(`Empty or repeated origin: ${at}`);
    seen.add(key);
    return { province: r[0], district: r[1], share: share(r[2], at) };
  });
  const total = out.reduce((n, x) => n + x.share, 0);
  if (!out.length || total > 100.6) throw new Error("Origin shares exceed 100");
  return out.sort((a, b) => b.share - a.share || `${a.province}${a.district}`.localeCompare(`${b.province}${b.district}`, "ko"));
}

/** The table set of one download folder, each file reviewed (classified, consumed, same stamp and region name). */
function folderTables(files, folder, group, name, tables) {
  const stamp = folder.split("/").at(-1).split("_")[0];
  return Object.fromEntries(tables.map(t => {
    const path = `${folder}/${stamp}_${t}.csv`, hit = files.get(path), c = hit && classify(path);
    if (!hit || c.group !== group || c.table !== t || c.name !== name || c.stamp !== stamp || hit.entry.use !== "consumed") throw new Error(`Missing reviewed ${t} file: ${name}`);
    return [t, { text: describe(hit.bytes).text, source: sourceRef(hit.entry), stamp }];
  }));
}
const dateOf = stamp => `${stamp.slice(0, 4)}-${stamp.slice(4, 6)}-${stamp.slice(6, 8)}`;

export function buildRegionProfiles(root = REPO_ROOT) {
  const { manifestSha256, files } = verifyImport(root);
  const ids = JSON.parse(readFileSync(`${root}${REGION_IDS_PATH}`, "utf8"));
  const catalogue = JSON.parse(readFileSync(`${root}${CATALOGUE_PATH}`, "utf8")).rows;
  const sources = festivalSources(root), festivals = sources.ids.festivals;
  const spendingFolders = [...new Set([...files.keys()].filter(p => p.startsWith("data/region/")).map(p => p.split("/").slice(0, 3).join("/")))];
  const visitorFolders = [...new Set([...files.keys()].filter(p => p.startsWith("data/region_visitor/")).map(p => p.split("/").slice(0, 3).join("/")))];
  const mappedSpending = ids.regions.map(r => r.spendingFolder), mappedVisitor = ids.regions.map(r => r.visitorFolder).filter(Boolean);
  if (mappedSpending.length !== spendingFolders.length || spendingFolders.some(f => !mappedSpending.includes(f))) throw new Error("Region mapping does not cover the spending downloads exactly");
  if (new Set(mappedVisitor).size !== mappedVisitor.length || mappedVisitor.length !== visitorFolders.length || visitorFolders.some(f => !mappedVisitor.includes(f))) throw new Error("Region mapping does not cover the visitor downloads exactly");
  const linked = ids.regions.flatMap(r => r.festivalIds);
  if (new Set(linked).size !== linked.length) throw new Error("A festival is linked to more than one region");
  const regions = ids.regions.map(r => {
    const place = catalogue.find(k => `${k.provinceCode}${k.districtCode}` === r.code);
    if (!place || place.districtName !== r.name || place.provinceName !== r.province) throw new Error(`Region code not in catalogue under that name: ${r.code}`);
    const s = folderTables(files, r.spendingFolder, "region", r.name, Object.keys(SPENDING_HEADERS));
    const trend = parseSpendingTrend(s["관광소비 추이"].text, r.name);
    const province = parseProvince(s["관광소비 히트맵"].text, SPENDING_HEADERS["관광소비 히트맵"], r.name, 2, 1);
    const sum = trend.reduce((n, y) => n + y.total, 0);
    if (!near(province.find(x => x.name === r.name).value, sum, 2)) throw new Error(`Province spending is not the download-range total: ${r.code}`);
    // The comparison lists districts of one province (old district names allowed): it must be the region's province.
    const siblings = new Set(catalogue.filter(k => k.provinceCode === place.provinceCode).flatMap(k => [k.districtName, k.districtName.split(" ").at(-1)]));
    if (province.filter(x => !siblings.has(x.name)).length > 3) throw new Error(`Province comparison is not the region's province: ${r.code}`);
    const areas = parseAreaShares(s["지역별 지출액"].text, SPENDING_HEADERS["지역별 지출액"], 1);
    const spending = {
      downloadDate: dateOf(s["관광소비 추이"].stamp),
      years: trend.map(y => ({ year: y.year, total: y.total })),
      industries: parseIndustries(s["업종별 지출액"].text, trend), areas,
      province: province.map(x => ({ name: x.name, value: x.value })),
      sources: Object.fromEntries(Object.entries(s).map(([t, v]) => [t, v.source])),
    };
    let visitors = null, visitorAreas = [];
    if (r.visitorFolder) {
      const v = folderTables(files, r.visitorFolder, "region_visitor", r.name, [...Object.keys(VISITOR_HEADERS), "방문자 수 추이"]);
      const outside = parseRegionAnnual(v["방문자 수 추이"].text, r.name).reduce((n, y) => n + y.outside, 0);
      const vprovince = parseProvince(v["방문자수 히트맵"].text, VISITOR_HEADERS["방문자수 히트맵"], r.name, 1);
      if (!near(vprovince.find(x => x.name === r.name).value, outside, 2)) throw new Error(`Province visitors are not the download-range outside total: ${r.code}`);
      visitorAreas = parseAreaShares(v["지역별 방문자 수"].text, VISITOR_HEADERS["지역별 방문자 수"], 2);
      const { ["방문자 수 추이"]: _annual, ...visitorSources } = v;
      visitors = {
        downloadDate: dateOf(v["방문자 거주지"].stamp),
        origins: parseOrigins(v["방문자 거주지"].text, r.name), areas: visitorAreas,
        province: vprovince.map(x => ({ name: x.name, value: x.value })),
        sources: Object.fromEntries(Object.entries(visitorSources).map(([t, x]) => [t, x.source])),
      };
    }
    // A festival is linked only when its host dong (destination ranking) is one of the region's dongs.
    const dongs = new Set([...areas, ...visitorAreas].map(x => x.name));
    for (const id of r.festivalIds) {
      const f = festivals.find(x => x.id === id);
      if (!f) throw new Error(`Unknown festival: ${id}`);
      const destinations = sources.table(f, "목적지 검색순위");
      if (!destinations) throw new Error(`Missing destination file: ${id}`);
      const hosts = new Set(parseDestinations(destinations.text).flatMap(g => g.items.map(i => i.area)));
      if (![...hosts].some(h => dongs.has(h))) throw new Error(`Festival host dong is not in the region: ${id}`);
    }
    return { code: r.code, name: r.name, province: r.province, festivalIds: r.festivalIds, range: { from: YEARS[0], to: YEARS.at(-1) }, spending, visitors };
  });
  return {
    kind: "datalab-region-profiles", schemaVersion: 1,
    scope: {
      spending: "시군구 전체의 관광소비(천원). 연도별 합계와 업종(대분류·중분류)·읍면동 비율. 업종·읍면동 비율과 같은 시도 비교는 2018~2025 합계 기준이다(연도별 합계와 대조). 축제 소비가 아니다.",
      visitors: "시군구를 찾은 외지인(이동통신 기반 추정)의 거주지·읍면동 비율과 같은 시도 비교, 2018~2025 합계 기준. 읍면동 방문 수는 여러 읍면동을 들르면 각각 세므로 비율만 쓴다.",
      notUsed: "히트맵의 전년동기 소비액은 2017년 자료가 없어 2018~2024 합계일 뿐이라 쓰지 않는다.",
    },
    source: { title: "한국관광 데이터랩 · 지역 관광소비·방문자", officialUrl: REGION_OFFICIAL_URL, definitionReviewedAt: "2026-10-04", repository: SOURCE.repository, commit: SOURCE.commit, basePath: SOURCE.basePath, manifestPath: MANIFEST_PATH, manifestSha256, downloadTimezone: null },
    regions,
  };
}

export const serialize = dataset => JSON.stringify(dataset, null, 2) + "\n";

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const text = serialize(buildRegionProfiles()), out = `${REPO_ROOT}${REGION_PROFILE_OUTPUT_PATH}`;
  const n = JSON.parse(text).regions.length;
  if (process.argv.includes("--verify")) {
    if (!existsSync(out) || readFileSync(out, "utf8") !== text) { console.error(`${REGION_PROFILE_OUTPUT_PATH} differs from a fresh build`); process.exit(1); }
    console.log(`Verified manifest, imports, and ${REGION_PROFILE_OUTPUT_PATH} (${n} regions)`);
  } else {
    writeFileSync(out, text);
    console.log(`Built ${REGION_PROFILE_OUTPUT_PATH} (${n} regions)`);
  }
}
