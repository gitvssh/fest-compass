// Build the checked-in DataLab region annual visitor totals from byte-preserved imports (reviewed regions only).
// Standalone: `node scripts/build-datalab-region-annual.mjs [--verify]`. Not part of `npm run build`;
// the app only reads the checked-in apps/web/data/datalab-region-annual.json.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { CsvError, parseTable } from "./datalab-csv.mjs";
import { classify, describe, MANIFEST_PATH, ORIGINAL_DIR, REPO_ROOT, SOURCE, verifyImport } from "./build-datalab-festival-trend.mjs";

export const REGION_IDS_PATH = "apps/web/data/datalab-region-ids.json";
export const CATALOGUE_PATH = "apps/web/data/region-catalogue.json";
export const REGION_OUTPUT_PATH = "apps/web/data/datalab-region-annual.json";
export const REGION_OFFICIAL_URL = "https://datalab.visitkorea.or.kr/datalab/portal/loc/getAreaDataForm.do";
export const ANNUAL_HEADER = ["기준년월", "기초지자체", "방문자 구분", "방문자 수"];
// Source segment label -> field. Exactly one row of each per year.
export const SEGMENTS = { "현지인방문자(a)": "local", "외지인방문자(b)": "outside", "전체방문자(a+b)": "total" };
// Pilot scope: the reviewed file must hold exactly these observation years (the value column, not the download stamp).
export const EXPECTED_YEARS = [2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025];

const COUNT = /^(0|[1-9]\d*)(\.\d+)?(E[+-]?\d+)?$/;
/** Annual counts may use source E notation (1.0762885E7). Empty and "N/A" are missing (null), never zero. */
export function parseAnnualCount(raw) {
  if (typeof raw !== "string") throw new CsvError("Annual count must be a string");
  if (raw === "" || raw === "N/A") return null;
  if (!COUNT.test(raw)) throw new CsvError(`Malformed annual count: ${JSON.stringify(raw)}`);
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) throw new CsvError(`Non-finite annual count: ${JSON.stringify(raw)}`);
  return value;
}

/** Parse one `방문자 수 추이` table for a reviewed region name. Total stays the source value (may differ from a+b by 1). */
export function parseRegionAnnual(text, name, expectedYears = EXPECTED_YEARS) {
  const { rows } = parseTable(text, ANNUAL_HEADER), byYear = new Map();
  rows.forEach((r, i) => {
    const at = `row ${i + 2}`, field = SEGMENTS[r[2]];
    if (!/^\d{4}$/.test(r[0])) throw new Error(`Invalid observation year: ${at}`);
    if (r[1] !== name) throw new Error(`Region name mismatch: ${at}`);
    if (!field) throw new Error(`Unknown visitor segment: ${at}`);
    const y = byYear.get(r[0]) ?? {};
    if (field in y) throw new Error(`Duplicate segment: ${at}`);
    parseAnnualCount(r[3]);
    byYear.set(r[0], { ...y, [field]: r[3] });
  });
  const years = [...byYear.keys()].map(Number).sort((a, b) => a - b);
  if (years.join() !== expectedYears.join()) throw new Error(`Unexpected observation years: ${years.join(",")}`);
  return years.map(year => {
    const raw = byYear.get(String(year));
    for (const f of Object.values(SEGMENTS)) if (!(f in raw)) throw new Error(`Missing segment ${f}: ${year}`);
    const [local, outside, total] = [raw.local, raw.outside, raw.total].map(parseAnnualCount);
    if (local !== null && outside !== null && total !== null && Math.abs(local + outside - total) > 1) throw new Error(`Segment sum mismatch: ${year}`);
    return { year, local, outside, total, raw: { local: raw.local, outside: raw.outside, total: raw.total } };
  });
}

export function buildRegionDataset(root = REPO_ROOT) {
  const { manifest, manifestSha256, files } = verifyImport(root);
  const ids = JSON.parse(readFileSync(`${root}${REGION_IDS_PATH}`, "utf8"));
  const catalogue = JSON.parse(readFileSync(`${root}${CATALOGUE_PATH}`, "utf8")).rows;
  const consumed = manifest.files.filter(f => f.use === "consumed" && f.group === "region_visitor").map(f => f.path);
  const mapped = ids.regions.map(r => r.sourceFile);
  if (new Set(ids.regions.map(r => r.code)).size !== ids.regions.length || ids.regions.some(r => !/^\d{5}$/.test(r.code))) throw new Error("Region codes must be unique 5-digit codes");
  if (new Set(mapped).size !== mapped.length || mapped.length !== consumed.length || consumed.some(p => !mapped.includes(p))) throw new Error("Region mapping does not cover consumed files exactly");
  const regions = ids.regions.map(r => {
    const { entry, bytes } = files.get(r.sourceFile), c = classify(r.sourceFile);
    if (c.group !== "region_visitor" || c.table !== "방문자 수 추이" || c.name !== r.name) throw new Error(`Region mapping name mismatch: ${r.code}`);
    const known = catalogue.find(k => `${k.provinceCode}${k.districtCode}` === r.code);
    if (!known || known.districtName !== r.name) throw new Error(`Region code not in catalogue under that name: ${r.code}`);
    return {
      code: r.code, name: r.name, downloadStamp: c.stamp, downloadDate: `${c.stamp.slice(0, 4)}-${c.stamp.slice(4, 6)}-${c.stamp.slice(6, 8)}`,
      source: { path: `${ORIGINAL_DIR}/${entry.path}`, originalPath: `${SOURCE.basePath}/${entry.path}`, originalUrl: entry.url, bytes: entry.bytes, sha256: entry.sha256 },
      years: parseRegionAnnual(describe(bytes).text, r.name),
    };
  });
  return {
    kind: "datalab-region-visitor-annual", schemaVersion: 1,
    scope: { area: "기초지자체 전체", period: "달력 연도", method: "이동통신 기반 방문자 추정", unit: "명(연간 방문 합계)", total: "원문 전체방문자(a+b) 값을 그대로 둔다. 현지인+외지인과 1명까지 다를 수 있다.", note: "기간 중 반복 방문이 합산된 값이며 고유 방문자 수가 아니다." },
    source: { title: "한국관광 데이터랩 · 지역 방문자 수 추이", officialUrl: REGION_OFFICIAL_URL, officialUrlOpenedOn: "2026-09-24", repository: SOURCE.repository, commit: SOURCE.commit, basePath: SOURCE.basePath, manifestPath: MANIFEST_PATH, manifestSha256, downloadTimezone: null },
    rawHeader: ANNUAL_HEADER, regions,
  };
}

export const serialize = dataset => JSON.stringify(dataset, null, 2) + "\n";

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const text = serialize(buildRegionDataset()), out = `${REPO_ROOT}${REGION_OUTPUT_PATH}`;
  const rows = JSON.parse(text).regions.reduce((n, r) => n + r.years.length, 0);
  if (process.argv.includes("--verify")) {
    if (!existsSync(out) || readFileSync(out, "utf8") !== text) { console.error(`${REGION_OUTPUT_PATH} differs from a fresh build`); process.exit(1); }
    console.log(`Verified manifest, imports, and ${REGION_OUTPUT_PATH} (${rows} region-year rows)`);
  } else {
    writeFileSync(out, text);
    console.log(`Built ${REGION_OUTPUT_PATH} (${rows} region-year rows)`);
  }
}
