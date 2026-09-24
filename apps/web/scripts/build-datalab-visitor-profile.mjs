// Build the checked-in Imsil 2025 festival visitor profile (성·연령 비율 + 목적지 검색순위) from the byte-preserved
// DataLab chart responses in docs/research/imported/datalab-imsil-2025 and the reviewed TourAPI resource links.
// Standalone: `node scripts/build-datalab-visitor-profile.mjs [--verify]`. Not part of `npm run build`;
// the app only reads the checked-in apps/web/data/datalab-visitor-profile.json.
// Year and period come only from the recorded request parameters and in-data year/date fields, never from file names.
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { OFFICIAL_URL, REPO_ROOT, sha256 } from "./build-datalab-festival-trend.mjs";

export const PROFILE_DIR = "docs/research/imported/datalab-imsil-2025";
export const PROFILE_MANIFEST_PATH = `${PROFILE_DIR}/manifest.json`;
export const RESOURCE_LINKS_PATH = `${PROFILE_DIR}/resource-links.json`;
export const PROFILE_OUTPUT_PATH = "apps/web/data/datalab-visitor-profile.json";
// Cross-check inputs: the verified festival trend, the reviewed archive link and the archive edition itself.
export const CROSS_CHECK_PATHS = ["apps/web/data/datalab-festival-trend.json", "apps/web/data/datalab-festival-links.json", "apps/web/data/festival-editions.json"];
const [TREND_PATH, LINKS_PATH, EDITIONS_PATH] = CROSS_CHECK_PATHS;

// Reviewed 2026-09-24: the only festival, edition, period and host area this import may describe.
export const REVIEWED = Object.freeze({
  archiveFestivalId: "imsil-cheese", editionId: "imsil-cheese-2025", trendFestivalId: "imsil-n-cheese", datalabFestivalId: "KCTF0061", name: "임실N치즈축제",
  year: 2025, start: "2025-10-08", end: "2025-10-12", days: 5, sidoCode: "52", regionCode: "52750", areaCode: "52750340", areaName: "임실군 성수면", emdName: "성수면",
});
const HOST = "https://datalab.visitkorea.or.kr";
const TEMPLATE_URL = `${HOST}/visualize/getTempleteData.do`;
const YEAR = String(REVIEWED.year);
const template = qid => ({ FSTV_ID: REVIEWED.datalabFestivalId, BASE_YY1: YEAR, BASE_YY2: YEAR, querySpace: "FesDao", fileWriteYn: "N", qid });
/** Exact request records the official page sent. Chart parameters are the period evidence: absent or different fails. */
export const RECORDS = {
  "festival-list": { url: `${HOST}/datalab/portal/fes/getFesList.do`, parameters: { sidoAreaSel: "ALL", sggAreaSel: "ALL", fesNm: "임실", currentIndex: 1, recordCountPerPage: 10, pageSize: 10 } },
  "festival-periods": { url: `${HOST}/datalab/portal/fes/getFesInfoList.do`, parameters: { fstvId: REVIEWED.datalabFestivalId, currentIndex: 1, recordCountPerPage: 10, pageSize: 10 } },
  trend: { url: TEMPLATE_URL, parameters: template("FE_01_01_005") },
  demographics: { url: TEMPLATE_URL, parameters: template("FE_01_01_006") },
  destinations: { url: TEMPLATE_URL, parameters: template("FE_01_01_004_00") },
};
export const AGE_BANDS = ["0~9세", "10~19세", "20~29세", "30~39세", "40~49세", "50~59세", "60~69세", "70세 이상"];
/** Output order follows the page's default: outside visitors first. */
export const GROUPS = [
  { group: "outside", sourceLabel: "외지인", label: "외지인" },
  { group: "local", sourceLabel: "현지인", label: "현지인" },
  { group: "all", sourceLabel: "전체", label: "전체" },
];
/** Reviewed destination -> current TourAPI resource identities. Exact IDs only; never joined by name at runtime. */
export const REVIEWED_RESOURCES = [
  { destinationId: "2773331", sourceName: "임실치즈테마파크", resource: { id: "2718832", kind: "12", title: "임실치즈테마파크" } },
  { destinationId: "3306424", sourceName: "상이암", resource: { id: "317571", kind: "12", title: "상이암(임실)" } },
  { destinationId: "725050", sourceName: "소충사", resource: { id: "527279", kind: "12", title: "소충사" } },
];
const SOURCE_ADDRESS_PREFIX = "전북 임실군 ", RESOURCE_ADDRESS_PREFIX = "전북특별자치도 임실군 성수면 ";
// The page definition excludes restaurants and lodging; seeing one means the definition changed.
export const EXCLUDED_CATEGORY = /음식|식당|한식|중식|일식|양식|카페|주점|제과|분식|뷔페|숙박|호텔|모텔|펜션|콘도|민박|게스트하우스|여관/;
const DEMOGRAPHIC_KEYS = ["AGEG_DIV_NM", "DISP_YN", "FSTV_ID", "FSTV_REPS_NM", "M_TOT", "M_TOU_NUM_RAT", "SORT_STR", "W_TOT", "W_TOU_NUM_RAT"];
const DESTINATION_KEYS = ["ADDR_ROAD_NM", "DIV_NM", "EMD_CD", "EMD_NM", "ITS_BRO_ID", "ITS_BRO_NM", "KTO_CATE_SCLS_NM", "ROWNUM", "SRCH_CNT"];
const MAX_RANK_ROWS = 10;

const fail = why => { throw new Error(`Visitor profile source rejected: ${why}`); };
const isObj = v => v !== null && typeof v === "object" && !Array.isArray(v);
const obj = (v, at) => (isObj(v) ? v : fail(`${at} must be an object`));
const arr = (v, at) => (Array.isArray(v) ? v : fail(`${at} must be an array`));
const text = (v, at) => (typeof v === "string" && v.length > 0 ? v : fail(`${at} must be a non-empty string`));
/** Strict source number: null, strings and non-finite values are rejected, never coerced to 0. */
const num = (v, at) => (typeof v === "number" && Number.isFinite(v) ? v : fail(`${at} must be a finite number`));
const exactKeys = (o, keys, at) => { if (Object.keys(o).sort().join() !== [...keys].sort().join()) fail(`${at} fields differ from the reviewed shape`); };
const byKey = ([a], [b]) => (a < b ? -1 : a > b ? 1 : 0);
const canonical = v => JSON.stringify(v, (_, x) => (isObj(x) ? Object.fromEntries(Object.entries(x).sort(byKey)) : x));
const HEX = /^[0-9a-f]{64}$/;
const instant = (v, at) => { const s = text(v, at); if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(s) || new Date(s).toISOString() !== s) fail(`${at} must be a UTC instant`); return s; };
const oneDecimal = v => Math.abs(v * 10 - Math.round(v * 10)) < 1e-9;
const spanDays = (start, end) => Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000) + 1;
function readJson(bytes, at) {
  let s;
  try { s = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes); } catch { fail(`${at} is not UTF-8`); }
  if (s.charCodeAt(0) === 0xfeff) fail(`${at} starts with a BOM`);
  try { return JSON.parse(s); } catch { return fail(`${at} is not JSON`); }
}

/** Manifest scope/observation pins, exact request records, byte hashes of all five responses and no unlisted originals. */
export function verifyProfileImport(root = REPO_ROOT) {
  const manifestBytes = readFileSync(`${root}${PROFILE_MANIFEST_PATH}`), manifest = obj(readJson(manifestBytes, "manifest"), "manifest");
  if (manifest.schemaVersion !== 1) fail("manifest schema version");
  if (manifest.page !== OFFICIAL_URL) fail("manifest page is not the official festival page");
  const scope = obj(manifest.scope, "manifest.scope");
  if (scope.name !== REVIEWED.name || scope.festivalId !== REVIEWED.datalabFestivalId) fail("manifest festival identity");
  for (const k of ["startYear", "endYear", "demographicYear", "destinationYear"]) if (scope[k] !== YEAR) fail(`manifest scope ${k} is not ${YEAR}`);
  if (manifest.residenceVisible !== false) fail("residence must stay out of this import while the official chart is hidden");
  const observation = { year: REVIEWED.year, start: REVIEWED.start, end: REVIEWED.end, days: REVIEWED.days, areaCode: REVIEWED.areaCode, areaName: REVIEWED.areaName, regionCode: REVIEWED.regionCode };
  if (canonical(obj(manifest.observation, "manifest.observation")) !== canonical(observation)) fail("manifest observation differs from the reviewed period and area");
  const definitionChecks = arr(manifest.definitionChecks, "manifest.definitionChecks").map((v, i) => {
    const c = obj(v, `definitionChecks[${i}]`);
    if (!HEX.test(c.sha256) || !/^\d{4}-\d{2}-\d{2}$/.test(c.checkedAt)) fail(`definitionChecks[${i}] must carry a hash and date`);
    return { file: text(c.file, `definitionChecks[${i}].file`), sha256: c.sha256, checkedAt: c.checkedAt };
  });
  if (!definitionChecks.length) fail("manifest must record the page definition checks");
  const records = arr(manifest.records, "manifest.records").map((v, i) => obj(v, `records[${i}]`)), kinds = Object.keys(RECORDS);
  if (records.length !== kinds.length || kinds.some(k => records.filter(r => r.kind === k).length !== 1)) fail("manifest must list exactly the five reviewed responses");
  const sources = {}, evidence = [];
  for (const kind of kinds) {
    const r = records.find(x => x.kind === kind), spec = RECORDS[kind], at = `record ${kind}`;
    if (r.url !== spec.url || r.method !== "POST" || r.status !== 200) fail(`${at} request identity`);
    if (!isObj(r.parameters)) fail(`${at} has no request parameters (period not bound)`);
    if (canonical(r.parameters) !== canonical(spec.parameters)) fail(`${at} request parameters differ from the reviewed ${YEAR} selection`);
    if (r.path !== `original/${kind}.json`) fail(`${at} path`);
    const retrievedAt = instant(r.retrievedAt, `${at}.retrievedAt`), file = `${root}${PROFILE_DIR}/${r.path}`;
    if (!existsSync(file)) fail(`${at} file is missing`);
    const bytes = readFileSync(file);
    if (typeof r.sha256 !== "string" || !HEX.test(r.sha256) || bytes.length !== r.bytes || sha256(bytes) !== r.sha256) fail(`${at} hash mismatch`);
    sources[kind] = readJson(bytes, at);
    evidence.push({ kind, path: `${PROFILE_DIR}/${r.path}`, bytes: r.bytes, sha256: r.sha256, qid: spec.parameters.qid ?? null,
      baseYears: "BASE_YY1" in spec.parameters ? [r.parameters.BASE_YY1, r.parameters.BASE_YY2] : null, retrievedAt });
  }
  const base = `${root}${PROFILE_DIR}/original/`;
  const present = readdirSync(base, { recursive: true, withFileTypes: true }).filter(d => d.isFile()).map(d => `${d.parentPath ?? d.path}/${d.name}`.replace(/\/+/g, "/").slice(base.length));
  const extra = present.filter(p => !kinds.some(k => `${k}.json` === p));
  if (extra.length) fail(`unlisted original file: ${extra[0]}`);
  const linksBytes = readFileSync(`${root}${RESOURCE_LINKS_PATH}`);
  return { manifestSha256: sha256(manifestBytes), definitionChecks, records: evidence, sources, resourceLinks: readJson(linksBytes, "resource-links"), resourceLinksSha256: sha256(linksBytes) };
}

/** The reviewed archive link and archive edition must describe the same edition, region and original period. */
export function checkArchive(links, editions) {
  const link = arr(obj(links, "festival links").links, "festival links").find(l => isObj(l) && l.archiveFestivalId === REVIEWED.archiveFestivalId);
  if (!link || link.datalabFestivalId !== REVIEWED.trendFestivalId || link.regionCode !== REVIEWED.regionCode) fail("reviewed archive link is missing or changed");
  const e = arr(link.editions, "link editions").find(x => isObj(x) && x.editionId === REVIEWED.editionId);
  if (!e || e.year !== REVIEWED.year || e.start !== REVIEWED.start || e.end !== REVIEWED.end || e.days !== REVIEWED.days) fail("reviewed link edition differs from the reviewed period");
  const ed = arr(obj(editions, "festival editions").editions, "festival editions").find(x => isObj(x) && x.id === REVIEWED.editionId);
  if (!ed || ed.festivalId !== REVIEWED.archiveFestivalId || ed.year !== REVIEWED.year || ed.start !== REVIEWED.start || ed.end !== REVIEWED.end
    || `${ed.region?.province}${ed.region?.district}` !== REVIEWED.regionCode) fail("archive edition differs from the reviewed period or region");
}

/** Festival search list: the reviewed ID resolves to the reviewed name, province, host area and offers the reviewed year. */
export function checkFestivalList(src) {
  const rows = arr(obj(src, "festival-list").list, "festival-list.list").map((r, i) => obj(r, `festival-list[${i}]`)).filter(r => r.FSTV_ID === REVIEWED.datalabFestivalId);
  if (rows.length !== 1) fail("festival list must hold the reviewed festival exactly once");
  const [r] = rows;
  if (r.FSTV_REPS_NM !== REVIEWED.name || r.SIDO_CD !== REVIEWED.sidoCode) fail("festival list identity differs");
  const years = text(r.BASE_YEAR_STR, "festival-list.BASE_YEAR_STR").split(",");
  if (!/^\d{4}$/.test(r.MIN_BASE_YEAR) || !/^\d{4}$/.test(r.MAX_BASE_YEAR) || !years.includes(YEAR) || r.MIN_BASE_YEAR > YEAR || r.MAX_BASE_YEAR < YEAR) fail(`festival list does not offer ${YEAR}`);
  if (!Object.keys(r).some(k => /^ADONG_NM\d$/.test(k) && r[k] === REVIEWED.areaName)) fail("festival list host area differs");
}

/** Per-year periods: exactly one reviewed-year row in both lists, with the reviewed dates and host area. */
export function checkPeriods(src) {
  const p = obj(src, "festival-periods");
  const pick = (list, at) => {
    const rows = arr(list, at).map((r, i) => obj(r, `${at}[${i}]`)).filter(r => r.BASE_YEAR === YEAR);
    if (rows.length !== 1) fail(`${at} must hold ${YEAR} exactly once`);
    const [r] = rows;
    if (r.FSTV_ID !== REVIEWED.datalabFestivalId || r.FSTV_REPS_NM !== REVIEWED.name) fail(`${at} ${YEAR} row belongs to another festival`);
    if (r.FSTV_BGNG_YMD !== REVIEWED.start || r.FSTV_END_YMD !== REVIEWED.end) fail(`${at} ${YEAR} dates differ from the reviewed period`);
    return r;
  };
  const info = pick(p.info_list, "info_list");
  pick(p.info_listTot, "info_listTot");
  if (info.SIDO_CD !== REVIEWED.sidoCode || info.ADONG_NM1 !== REVIEWED.areaName) fail("festival period host area differs");
  if (spanDays(REVIEWED.start, REVIEWED.end) !== REVIEWED.days) fail("reviewed period day count");
}

/** Fresh trend row must equal the verified festival trend for the year; a difference means the source was revised. */
export function checkTrend(src, trendDataset) {
  const rows = arr(obj(src, "trend").list, "trend.list");
  if (rows.length !== 1) fail("trend must hold exactly one row");
  const r = obj(rows[0], "trend[0]");
  if (r.FSTV_ID !== REVIEWED.datalabFestivalId || r.FSTV_REPS_NM !== REVIEWED.name || r.BASE_YEAR !== YEAR) fail(`trend row is not ${REVIEWED.name} ${YEAR}`);
  if (r.FSTV_PERD_CNT !== REVIEWED.days) fail("trend days differ from the reviewed period");
  const [local, outside, foreign, total, dailyMean] = ["TOT_LOCAL", "TOT_OUT", "TOT_FORE", "TOTAL_COL", "TOTAL_AVG"].map(k => num(r[k], `trend.${k}`));
  if ([local, outside, total, dailyMean].some(v => v <= 0) || foreign < 0) fail("trend values must be positive");
  if (Math.abs(local + outside + foreign - total) > 0.5) fail("trend category sum mismatch");
  if (Math.abs(total / REVIEWED.days - dailyMean) > 0.01) fail("trend daily mean mismatch");
  const known = arr(obj(trendDataset, "festival trend").festivals, "festival trend").find(f => isObj(f) && f.id === REVIEWED.trendFestivalId);
  const y = known && known.name === REVIEWED.name ? arr(known.years, "trend years").find(x => x.year === REVIEWED.year) : null;
  if (!y || y.days !== REVIEWED.days || canonical([y.local, y.outside, y.foreign, y.periodTotal, y.dailyMean]) !== canonical([local, outside, foreign, total, dailyMean])) {
    fail("fresh trend differs from the verified festival trend (source revised?)");
  }
  return { local, outside, foreign, total, dailyMean };
}

/**
 * Exactly the eight chronological bands of the reviewed festival. Source percentages are kept as published (DISP_YN=N is
 * valid: the page shows percentages for it). Counts only cross-check percentages and the domestic trend; they never leave.
 */
export function checkDemographics(src, trend) {
  const rows = arr(obj(src, "demographics").list, "demographics.list");
  if (rows.length !== AGE_BANDS.length) fail(`demographics must hold exactly ${AGE_BANDS.length} age bands`);
  const seen = new Set();
  const bands = rows.map((v, i) => {
    const at = `demographics[${i}]`, r = obj(v, at);
    exactKeys(r, DEMOGRAPHIC_KEYS, at);
    if (r.FSTV_ID !== REVIEWED.datalabFestivalId || r.FSTV_REPS_NM !== REVIEWED.name) fail(`${at} belongs to another festival`);
    const order = AGE_BANDS.indexOf(r.AGEG_DIV_NM) + 1;
    if (!order) fail(`${at} has an unknown age band`);
    if (seen.has(r.AGEG_DIV_NM)) fail(`${at} repeats an age band`);
    seen.add(r.AGEG_DIV_NM);
    if (r.SORT_STR !== order) fail(`${at} sort order differs from the age band`);
    if (r.DISP_YN !== "Y" && r.DISP_YN !== "N") fail(`${at} display flag must be Y or N`);
    const [malePercent, femalePercent] = [["M_TOU_NUM_RAT", r.M_TOU_NUM_RAT], ["W_TOU_NUM_RAT", r.W_TOU_NUM_RAT]].map(([k, x]) => {
      const p = num(x, `${at}.${k}`);
      if (p < 0 || p > 100 || !oneDecimal(p)) fail(`${at}.${k} must be a 0..100 percentage with one decimal`);
      return p;
    });
    const [male, female] = [["M_TOT", r.M_TOT], ["W_TOT", r.W_TOT]].map(([k, x]) => { const c = num(x, `${at}.${k}`); if (c < 0) fail(`${at}.${k} must not be negative`); return c; });
    return { ageBand: r.AGEG_DIV_NM, order, malePercent, femalePercent, display: r.DISP_YN, male, female };
  }).sort((a, b) => a.order - b.order);
  const shares = bands.reduce((n, b) => n + b.malePercent + b.femalePercent, 0);
  // Sixteen one-decimal cells: rounding can move the sum by at most 16 × 0.05.
  if (Math.abs(shares - 100) > 0.8 + 1e-9) fail("percentages do not add up to 100 within rounding");
  const counted = bands.reduce((n, b) => n + b.male + b.female, 0);
  if (!(counted > 0)) fail("demographic counts are empty");
  for (const b of bands) for (const [p, c] of [[b.malePercent, b.male], [b.femalePercent, b.female]]) {
    if (Math.abs((c / counted) * 100 - p) > 0.05 + 1e-6) fail(`${b.ageBand} percentage does not match its source count`);
  }
  // Source counts are fractional estimates; the domestic trend may differ by a rounding count. A multi-year or other period never fits.
  const gap = counted - (trend.local + trend.outside);
  if (Math.abs(gap) > 2) fail(`demographic counts do not match the ${YEAR} domestic trend (another period?)`);
  return { bands: bands.map(({ ageBand, order, malePercent, femalePercent, display }) => ({ ageBand, order, malePercent, femalePercent, display })), gap: Math.round(gap) + 0 };
}

/** Three rank groups in source display order. Ties are allowed; duplicate places, bad ranks, other areas and food/lodging fail. */
export function checkDestinations(src) {
  const rows = arr(obj(src, "destinations").list, "destinations.list"), byGroup = new Map(GROUPS.map(g => [g.sourceLabel, []])), identity = new Map();
  rows.forEach((v, i) => {
    const at = `destinations[${i}]`, r = obj(v, at);
    exactKeys(r, DESTINATION_KEYS, at);
    const list = byGroup.get(r.DIV_NM) ?? fail(`${at} has an unknown rank group`);
    if (r.EMD_CD !== REVIEWED.areaCode || r.EMD_NM !== REVIEWED.emdName) fail(`${at} is outside the reviewed host area`);
    if (!Number.isInteger(r.ROWNUM) || r.ROWNUM < 1) fail(`${at} rank must be a positive integer`);
    const id = text(r.ITS_BRO_ID, `${at}.ITS_BRO_ID`);
    if (!/^\d+$/.test(id)) fail(`${at} place ID must be numeric`);
    const name = text(r.ITS_BRO_NM, `${at}.ITS_BRO_NM`), address = text(r.ADDR_ROAD_NM, `${at}.ADDR_ROAD_NM`), category = text(r.KTO_CATE_SCLS_NM, `${at}.KTO_CATE_SCLS_NM`);
    if (EXCLUDED_CATEGORY.test(category)) fail(`${at} food or lodging category means the page definition changed`);
    if (!Number.isInteger(r.SRCH_CNT) || r.SRCH_CNT < 0) fail(`${at} search count must be a non-negative integer`);
    const key = canonical({ name, address, category });
    if (identity.has(id) && identity.get(id) !== key) fail(`${at} place ${id} changes identity between groups`);
    identity.set(id, key);
    list.push({ id, rank: r.ROWNUM, name, address, category, count: r.SRCH_CNT });
  });
  return GROUPS.map(g => {
    const items = byGroup.get(g.sourceLabel);
    if (!items.length || items.length > MAX_RANK_ROWS) fail(`${g.sourceLabel} must hold 1..${MAX_RANK_ROWS} destinations`);
    if (new Set(items.map(x => x.id)).size !== items.length) fail(`${g.sourceLabel} repeats a place`);
    items.forEach((x, i) => {
      const prev = items[i - 1];
      if (i === 0 ? x.rank !== 1 : x.rank < prev.rank || x.rank > i + 1) fail(`${g.sourceLabel} ranks must start at 1 and never go down`);
      if (prev && x.count > prev.count) fail(`${g.sourceLabel} search counts contradict the rank order`);
    });
    return { ...g, items: items.map(({ id, rank, name, address, category }) => ({ id, rank, name, address, category })) };
  });
}

/** Exactly the reviewed destination -> resource identities, each tied to its ranking row and to the same host-area address. */
export function checkResourceLinks(input, groups) {
  const d = obj(input, "resource-links");
  if (d.schemaVersion !== 1 || d.festivalId !== REVIEWED.datalabFestivalId || d.regionCode !== REVIEWED.regionCode || d.areaCode !== REVIEWED.areaCode || d.year !== REVIEWED.year) {
    fail("resource links scope differs from the reviewed festival, area or year");
  }
  const checkedAt = instant(d.checkedAt, "resource-links.checkedAt");
  text(d.source, "resource-links.source");
  const links = arr(d.links, "resource-links.links");
  if (links.length !== REVIEWED_RESOURCES.length) fail(`resource links must hold exactly the ${REVIEWED_RESOURCES.length} reviewed mappings`);
  const places = new Map(groups.flatMap(g => g.items).map(x => [x.id, x])), mapped = new Map();
  links.forEach((v, i) => {
    const at = `resource-links[${i}]`, l = obj(v, at), res = obj(l.resource, `${at}.resource`);
    const reviewed = REVIEWED_RESOURCES.find(r => r.destinationId === l.destinationId) ?? fail(`${at} maps an unreviewed destination`);
    if (mapped.has(l.destinationId)) fail(`${at} repeats a destination`);
    if (res.kind !== "12" && res.kind !== "14") fail(`${at} resource kind must be 12 or 14`);
    if (canonical({ id: res.id, kind: res.kind, title: res.title }) !== canonical(reviewed.resource)) fail(`${at} target differs from the reviewed resource`);
    const place = places.get(l.destinationId) ?? fail(`${at} destination is not in the ranking`);
    if (l.sourceName !== reviewed.sourceName || l.sourceName !== place.name || l.sourceAddress !== place.address) fail(`${at} source identity differs from the ranking row`);
    if (!place.address.startsWith(SOURCE_ADDRESS_PREFIX)) fail(`${at} source address is outside the reviewed county`);
    const road = place.address.slice(SOURCE_ADDRESS_PREFIX.length).replace(/-0$/, "");
    if (res.address !== `${RESOURCE_ADDRESS_PREFIX}${road}`) fail(`${at} resource address is not the same place in ${REVIEWED.areaName}`);
    const point = obj(res.point, `${at}.resource.point`), lat = num(point.latitude, `${at}.latitude`), lng = num(point.longitude, `${at}.longitude`);
    if (lat < 33 || lat > 39 || lng < 124 || lng > 132) fail(`${at} point is outside Korea`);
    if (typeof res.modifiedAt !== "string" || !/^\d{14}$/.test(res.modifiedAt)) fail(`${at} modifiedAt must be a 14-digit stamp`);
    text(l.evidence, `${at}.evidence`);
    mapped.set(l.destinationId, { ...reviewed.resource });
  });
  return { checkedAt, mapped };
}

export function buildVisitorProfile(root = REPO_ROOT) {
  const imp = verifyProfileImport(root), s = imp.sources, read = p => JSON.parse(readFileSync(`${root}${p}`, "utf8"));
  checkArchive(read(LINKS_PATH), read(EDITIONS_PATH));
  checkFestivalList(s["festival-list"]);
  checkPeriods(s["festival-periods"]);
  const trend = checkTrend(s.trend, read(TREND_PATH));
  const demographics = checkDemographics(s.demographics, trend);
  const groups = checkDestinations(s.destinations);
  const links = checkResourceLinks(imp.resourceLinks, groups);
  const { archiveFestivalId, editionId, datalabFestivalId, name, regionCode, areaCode, areaName, year, start, end, days } = REVIEWED;
  return {
    kind: "datalab-festival-visitor-profile", schemaVersion: 1,
    scope: {
      population: "내국인 방문자", method: "이동통신 기반 추정", area: "축제 개최 행정동", period: "축제 개최기간",
      demographics: "성·연령별 비율(%)은 원문 백분율을 그대로 둔다. 16칸 합계가 100이다. 방문자 수는 싣지 않는다.",
      destinations: "축제 기간 내비게이션 목적지 검색순위(음식점·숙박 제외). 방문 수나 동선이 아니다.",
      residence: "공식 화면에서 축제 거주지 차트가 숨겨져 있어 포함하지 않는다.",
    },
    source: { title: "한국관광 데이터랩 · 문화관광축제 방문자 특성", officialUrl: OFFICIAL_URL, collectedAt: imp.records.map(r => r.retrievedAt).sort().at(-1),
      importDir: PROFILE_DIR, manifestSha256: imp.manifestSha256, resourceLinksSha256: imp.resourceLinksSha256, resourceCheckedAt: links.checkedAt },
    festival: { archiveFestivalId, editionId, datalabFestivalId, name, regionCode, areaCode, areaName, year, start, end, days },
    evidence: { records: imp.records, definitionChecks: imp.definitionChecks, trend, demographicCountGap: demographics.gap, residence: "hidden-on-official-page" },
    demographics: demographics.bands,
    destinationGroups: groups.map(g => ({ group: g.group, sourceLabel: g.sourceLabel, label: g.label,
      items: g.items.map(x => ({ ...x, resource: links.mapped.has(x.id) ? { ...links.mapped.get(x.id) } : null })) })),
  };
}

export const serialize = dataset => JSON.stringify(dataset, null, 2) + "\n";

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const output = serialize(buildVisitorProfile()), out = `${REPO_ROOT}${PROFILE_OUTPUT_PATH}`;
  const d = JSON.parse(output), summary = `${d.demographics.length} age bands, ${d.destinationGroups.map(g => g.items.length).join("/")} ranked places`;
  if (process.argv.includes("--verify")) {
    if (!existsSync(out) || readFileSync(out, "utf8") !== output) { console.error(`${PROFILE_OUTPUT_PATH} differs from a fresh build`); process.exit(1); }
    console.log(`Verified manifest, originals, resource links and ${PROFILE_OUTPUT_PATH} (${summary})`);
  } else {
    writeFileSync(out, output);
    console.log(`Built ${PROFILE_OUTPUT_PATH} (${summary})`);
  }
}
