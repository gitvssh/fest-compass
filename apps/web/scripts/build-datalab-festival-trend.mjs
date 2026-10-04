// Build the checked-in DataLab festival-period annual trend from byte-preserved imports.
// Standalone: `node scripts/build-datalab-festival-trend.mjs [--verify]`. Not part of `npm run build`;
// the app only reads the checked-in apps/web/data/datalab-festival-trend.json.
// `--init-manifest --source-repo <pick-d-day checkout>` records the import manifest from the original commit.
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { blobUrl, describe, gitBlobId, sha256 } from "./datalab-bytes.mjs";
import { parseSourceNumber, parseTable } from "./datalab-csv.mjs";
import { classifyOwner, OWNER_IMPORT, OWNER_MANIFEST, OWNER_ORIGINAL, previousTables, verifyOwnerImport } from "./datalab-owner-import.mjs";

export const REPO_ROOT = fileURLToPath(new URL("../../../", import.meta.url));
export const IMPORT_DIR = "docs/research/imported/hkjin-plan-03";
export const ORIGINAL_DIR = `${IMPORT_DIR}/original`;
export const MANIFEST_PATH = `${IMPORT_DIR}/manifest.json`;
export const IDS_PATH = "apps/web/data/datalab-festival-ids.json";
export const OUTPUT_PATH = "apps/web/data/datalab-festival-trend.json";
export const SOURCE = {
  repository: "https://github.com/travel-resolver/pick-d-day",
  commit: "f362e65ba9e1cac18757951236484cff666c2696",
  basePath: "developer/hkjin/plan-03-datalab",
};
export const OFFICIAL_URL = "https://datalab.visitkorea.or.kr/datalab/portal/fes/getFesDataForm.do";
export const TREND_HEADER = ["축제명", "개최년도", "축체기간(일)", "(현지인)방문자수", "(외지인)방문자수", "(외국인)방문자수", "(전체)방문자수", "일평균 방문자수", "전년도 일평균 방문자수", "일평균 방문자수 증감률", "(이전)전체방문자", "(전체)방문자증감", "(현지인)방문자비율", "(외지인)방문자비율", "(외국인)방문자비율", "전년대비방문자증감비율"];
const DOCS = ["data/README.md", "data/CHECKLIST.md", "data/COLLECT-REGION.md", "01-retraction.md", "02-results.md"];
export const FESTIVAL_TABLES = ["목적지 검색순위", "문화관광축제 주요 지표", "성-연령별 내국인 방문자", "연도별 방문자 추이"];
const REGION_TABLES = ["관광소비 추이", "관광소비 히트맵", "업종별 지출액", "지역별 지출액"];
const VISITOR_TABLES = ["방문자 거주지", "방문자 수 추이", "방문자수 히트맵", "지역별 방문자 수"];
// Reviewed 2026-10-04: every CSV is read — festival tables by this build and build-datalab-festival-profiles.mjs, region and
// region_visitor tables by build-datalab-region-annual.mjs and build-datalab-region-profiles.mjs. Documents stay preserved-only.
export const EXPECTED_COUNTS = { csv: 304, festival: 104, region: 104, region_visitor: 96, doc: 5, consumed: 304 };

export { describe, gitBlobId, sha256 };
export const originalUrl = path => blobUrl(SOURCE.repository, SOURCE.commit, `${SOURCE.basePath}/${path}`);

/** Classify a path relative to plan-03-datalab. Unknown names are rejected rather than guessed. */
export function classify(path) {
  if (DOCS.includes(path)) return { group: "doc", table: path.split("/").at(-1), stamp: null, name: null };
  let m = path.match(/^data\/(\d{14})_문화관광축제_2018-202[45]_데이터랩_다운로드\/(\d{14})_(.+)_([^_]+)\.csv$/);
  if (m && m[1] === m[2] && FESTIVAL_TABLES.includes(m[4])) return { group: "festival", table: m[4], stamp: m[1], name: m[3] };
  m = path.match(/^data\/(region|region_visitor)\/(\d{14})_([^_/]+)_2018-2025_데이터랩_다운로드\/(\d{14})_([^_/]+)\.csv$/);
  if (m && m[2] === m[4] && (m[1] === "region" ? REGION_TABLES : VISITOR_TABLES).includes(m[5])) return { group: m[1], table: m[5], stamp: m[2], name: m[3] };
  throw new Error(`Unknown source file classification: ${path}`);
}

function manifestEntry(path, bytes, gitBlob) {
  const c = classify(path), d = describe(bytes);
  const base = { path, group: c.group, table: c.table, bytes: bytes.length, sha256: sha256(bytes), gitBlob, encoding: d.encoding, lineEnding: d.lineEnding };
  if (c.group === "doc") return { ...base, use: "preserved-only", url: originalUrl(path) };
  const { header, rows } = parseTable(d.text);
  return { ...base, header, rowCount: rows.length, use: "consumed", url: originalUrl(path) };
}

export function initManifest(sourceRepo, root = REPO_ROOT) {
  const git = args => execFileSync("git", ["-C", sourceRepo, ...args], { maxBuffer: 1 << 26 });
  if (git(["rev-parse", `${SOURCE.commit}^{commit}`]).toString().trim() !== SOURCE.commit) throw new Error("Source commit not found");
  const tree = git(["ls-tree", "-r", "-z", SOURCE.commit, "--", `${SOURCE.basePath}/`]).toString().split("\0").filter(Boolean)
    .map(l => { const [meta, p] = l.split("\t"); return { blob: meta.split(" ")[2], path: p.slice(SOURCE.basePath.length + 1) }; });
  const selected = tree.filter(t => (t.path.startsWith("data/") && t.path.endsWith(".csv")) || DOCS.includes(t.path));
  const files = selected.map(({ path, blob }) => {
    const bytes = readFileSync(`${root}${ORIGINAL_DIR}/${path}`);
    if (gitBlobId(bytes) !== blob) throw new Error(`Imported bytes differ from source commit: ${path}`);
    return manifestEntry(path, bytes, blob);
  }).sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  const manifest = { schemaVersion: 1, source: { ...SOURCE, officialUrl: OFFICIAL_URL, importedTo: ORIGINAL_DIR, downloadTimeNote: "파일·폴더명 앞 14자리는 다운로드 시각 표기로 보이나 시간대가 기록되지 않았다. 관측 기간이 아니다." }, counts: countOf(files), files };
  checkCounts(manifest);
  writeFileSync(`${root}${MANIFEST_PATH}`, JSON.stringify(manifest, null, 2) + "\n");
  return manifest;
}

function countOf(files) {
  const n = g => files.filter(f => f.group === g).length;
  return { csv: files.filter(f => f.group !== "doc").length, festival: n("festival"), region: n("region"), region_visitor: n("region_visitor"), doc: n("doc"), consumed: files.filter(f => f.use === "consumed").length };
}
function checkCounts(manifest) {
  const actual = countOf(manifest.files);
  for (const [k, v] of Object.entries(EXPECTED_COUNTS)) if (actual[k] !== v || manifest.counts[k] !== v) throw new Error(`Unexpected ${k} count: ${actual[k]}`);
  if (new Set(manifest.files.map(f => f.path)).size !== manifest.files.length) throw new Error("Duplicate manifest path");
}

/** Re-hash every imported file against the manifest and re-derive each entry's classification. */
export function verifyImport(root = REPO_ROOT) {
  const raw = readFileSync(`${root}${MANIFEST_PATH}`), manifest = JSON.parse(raw.toString("utf8"));
  if (manifest.schemaVersion !== 1 || JSON.stringify({ repository: manifest.source?.repository, commit: manifest.source?.commit, basePath: manifest.source?.basePath }) !== JSON.stringify(SOURCE)) throw new Error("Manifest source mismatch");
  checkCounts(manifest);
  const files = new Map();
  for (const entry of manifest.files) {
    const path = `${root}${ORIGINAL_DIR}/${entry.path}`;
    if (!existsSync(path)) throw new Error(`Missing imported file: ${entry.path}`);
    const bytes = readFileSync(path);
    if (bytes.length !== entry.bytes || sha256(bytes) !== entry.sha256 || gitBlobId(bytes) !== entry.gitBlob) throw new Error(`Imported file hash mismatch: ${entry.path}`);
    if (JSON.stringify(manifestEntry(entry.path, bytes, entry.gitBlob)) !== JSON.stringify(entry)) throw new Error(`Manifest entry mismatch: ${entry.path}`);
    files.set(entry.path, { entry, bytes });
  }
  const present = readdirSync(`${root}${ORIGINAL_DIR}`, { recursive: true, withFileTypes: true }).filter(d => d.isFile()).map(d => `${d.parentPath ?? d.path}/${d.name}`.slice(`${root}${ORIGINAL_DIR}/`.length));
  const extra = present.filter(p => !files.has(p));
  if (extra.length) throw new Error(`Unlisted imported file: ${extra[0]}`);
  return { manifest, manifestSha256: sha256(raw), files };
}

const req = (v, what) => { if (v === null) throw new Error(`Missing required value: ${what}`); return v; };

export const FESTIVAL_IMPORTS = ["hkjin-plan-03", OWNER_IMPORT.id];
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
export const stampDate = stamp => `${stamp.slice(0, 4)}-${stamp.slice(4, 6)}-${stamp.slice(6, 8)}`;

/**
 * Both festival imports verified, with one lookup over the reviewed ID table. `table(festival, name)` returns the text and
 * public source reference of one of the festival's four tables, or null only when that festival's official download had
 * no such table (the owner's list records which). Every consumed trend table of each import maps to exactly one ID.
 */
export function festivalSources(root = REPO_ROOT) {
  const hkjin = verifyImport(root), owner = verifyOwnerImport(root, previousTables(hkjin.files));
  const ids = JSON.parse(readFileSync(`${root}${IDS_PATH}`, "utf8"));
  if (ids.version !== 2 || !Array.isArray(ids.festivals)) throw new Error("Unexpected festival ID table version");
  const imports = new Map([
    [FESTIVAL_IMPORTS[0], { files: hkjin.files, original: ORIGINAL_DIR, classify, originalPath: e => `${SOURCE.basePath}/${e.path}`, manifestPath: MANIFEST_PATH, manifestSha256: hkjin.manifestSha256, manifest: hkjin.manifest }],
    [FESTIVAL_IMPORTS[1], { files: owner.files, original: OWNER_ORIGINAL, classify: classifyOwner, originalPath: e => `${e.zip.path.slice("zip/".length)}/${e.zip.entry}`, manifestPath: OWNER_MANIFEST, manifestSha256: owner.manifestSha256, manifest: owner.manifest }],
  ]);
  if (new Set(ids.festivals.map(f => f.id)).size !== ids.festivals.length || ids.festivals.some(f => !SLUG.test(f.id))) throw new Error("Festival IDs must be unique slugs");
  if (new Set(ids.festivals.map(f => f.name)).size !== ids.festivals.length) throw new Error("A festival is mapped twice");
  for (const [id, imp] of imports) {
    const consumed = imp.manifest.files.filter(f => f.use === "consumed" && f.group === "festival" && f.table === "연도별 방문자 추이").map(f => f.path);
    const mapped = ids.festivals.filter(f => f.import === id).map(f => f.sourceFile);
    if (new Set(mapped).size !== mapped.length || mapped.length !== consumed.length || consumed.some(p => !mapped.includes(p))) throw new Error(`ID mapping does not cover consumed files exactly: ${id}`);
  }
  for (const f of ids.festivals) {
    if (!imports.has(f.import)) throw new Error(`Unknown import: ${f.id}`);
    const c = imports.get(f.import).classify(f.sourceFile);
    if (c.group !== "festival" || c.table !== "연도별 방문자 추이" || c.name !== f.name || f.aliases?.[0] !== f.name) throw new Error(`Mapping name mismatch: ${f.id}`);
  }
  function table(f, name) {
    const imp = imports.get(f.import), path = f.sourceFile.replace(/_연도별 방문자 추이\.csv$/, `_${name}.csv`), hit = imp.files.get(path);
    const trend = imp.classify(f.sourceFile);
    if (!hit) {
      // Only the owner's list can say an official download lacked a table: its ZIP entry list is verified against the list.
      const zip = f.import === OWNER_IMPORT.id && imp.manifest.files.find(z => z.group === "zip" && z.festival === f.name);
      if (zip && zip.entries.includes(f.sourceFile) && !zip.entries.includes(path)) return null;
      throw new Error(`Missing reviewed ${name} file: ${f.id}`);
    }
    const c = imp.classify(path);
    if (c.group !== "festival" || c.table !== name || c.name !== f.name || c.stamp !== trend.stamp || hit.entry.use !== "consumed") throw new Error(`Missing reviewed ${name} file: ${f.id}`);
    return { text: describe(hit.bytes).text, stamp: c.stamp, source: { path: `${imp.original}/${path}`, originalPath: imp.originalPath(hit.entry), originalUrl: hit.entry.url, bytes: hit.entry.bytes, sha256: hit.entry.sha256 } };
  }
  return { ids, table, imports: [...imports].map(([id, imp]) => ({ id, manifestPath: imp.manifestPath, manifestSha256: imp.manifestSha256 })) };
}

// The festival's host dong(s) are where its destination ranking sits; their road addresses name the province and district.
// Districts holding at least a tenth of the ranked places make the label; a stray border address does not.
const PLACE_SHARE = 0.1;
export function placeOf(destinationText) {
  const { rows } = parseTable(destinationText), counts = new Map();
  rows.forEach((r, i) => {
    const m = r[4].match(/^(\S+) (\S+)(?: |$)/);
    if (!m) throw new Error(`Address without province and district: row ${i + 2}`);
    counts.set(`${m[1]} ${m[2]}`, (counts.get(`${m[1]} ${m[2]}`) ?? 0) + 1);
  });
  const kept = [...counts].filter(([, n]) => n >= rows.length * PLACE_SHARE).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).map(([k]) => k.split(" "));
  if (!kept.length) throw new Error("No district holds a tenth of the ranked places");
  const byProvince = new Map();
  for (const [province, district] of kept) byProvince.set(province, [...(byProvince.get(province) ?? []), district]);
  return [...byProvince].map(([province, districts]) => `${province} ${districts.join("·")}`).join(" · ");
}

export function buildDataset(root = REPO_ROOT) {
  const { ids, table, imports } = festivalSources(root);
  const festivals = ids.festivals.map(f => {
    const trend = table(f, "연도별 방문자 추이"), destinations = table(f, "목적지 검색순위");
    if ((destinations === null) !== (typeof f.place === "string")) throw new Error(`A reviewed place is only for a festival without a destination ranking: ${f.id}`);
    const { rows } = parseTable(trend.text, TREND_HEADER);
    const seen = new Set();
    const years = rows.map((raw, i) => {
      const at = `${f.id} row ${i + 2}`;
      if (raw[0] !== f.name) throw new Error(`Festival name mismatch: ${at}`);
      if (!/^\d{4}$/.test(raw[1]) || !/^[1-9]\d*$/.test(raw[2])) throw new Error(`Invalid year or days: ${at}`);
      const year = Number(raw[1]), days = Number(raw[2]);
      if (year < 2000 || year > 2100 || days > 366) throw new Error(`Invalid year or days: ${at}`);
      if (seen.has(year)) throw new Error(`Duplicate festival-year: ${at}`);
      seen.add(year);
      const [local, outside, foreign, periodTotal, dailyMean] = [3, 4, 5, 6, 7].map(c => req(parseSourceNumber(raw[c]), `${at} ${TREND_HEADER[c]}`));
      if ([local, outside, periodTotal, dailyMean].some(v => v <= 0) || foreign < 0) throw new Error(`Non-positive required value: ${at}`);
      if (Math.abs(local + outside + foreign - periodTotal) > 0.5) throw new Error(`Category sum mismatch: ${at}`);
      if (Math.abs(periodTotal / days - dailyMean) > 0.01) throw new Error(`Daily mean mismatch: ${at}`);
      raw.slice(8).forEach((v, j) => parseSourceNumber(v)); // derivative columns must still be well-formed; kept as raw strings only
      return { year, days, periodTotal, dailyMean, local, outside, foreign, raw };
    }).sort((a, b) => a.year - b.year);
    return {
      id: f.id, name: f.name, aliases: f.aliases, place: destinations ? placeOf(destinations.text) : f.place,
      downloadStamp: trend.stamp, downloadDate: stampDate(trend.stamp), source: trend.source, years,
    };
  });
  return {
    kind: "datalab-festival-period-annual", schemaVersion: 2,
    scope: { area: "축제 개최 행정동", period: "축제 개최기간", method: "이동통신 기반 방문자 추정", unit: "명", periodTotal: "개최기간 방문자 합계", dailyMean: "개최기간 일평균 방문자", note: "개최기간이 짧으면 합계가 줄 수 있습니다. 행사장 입장객이나 연간 방문객이 아닙니다.",
      place: "지역은 목적지 검색순위 도로명주소의 시도·시군구(순위 장소의 10% 이상). 목적지 검색순위가 없는 축제만 검토한 값." },
    source: { title: "한국관광 데이터랩 · 문화관광축제 연도별 방문자 추이", officialUrl: OFFICIAL_URL, definitionReviewedAt: "2026-09-23", imports, downloadTimezone: null },
    rawHeader: TREND_HEADER, festivals,
  };
}

export const serialize = dataset => JSON.stringify(dataset, null, 2) + "\n";

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const args = process.argv.slice(2);
  if (args.includes("--init-manifest")) {
    const repo = args[args.indexOf("--source-repo") + 1];
    if (!args.includes("--source-repo") || !repo) throw new Error("--source-repo <path> required");
    const m = initManifest(repo);
    console.log(`Recorded ${m.files.length} files (${m.counts.csv} CSV) from ${SOURCE.commit}`);
  } else {
    const text = serialize(buildDataset()), out = `${REPO_ROOT}${OUTPUT_PATH}`;
    const rows = JSON.parse(text).festivals.reduce((n, f) => n + f.years.length, 0);
    if (args.includes("--verify")) {
      if (!existsSync(out) || readFileSync(out, "utf8") !== text) { console.error(`${OUTPUT_PATH} differs from a fresh build`); process.exit(1); }
      console.log(`Verified manifest, imports, and ${OUTPUT_PATH} (${rows} festival-year rows)`);
    } else {
      writeFileSync(out, text);
      console.log(`Built ${OUTPUT_PATH} (${rows} festival-year rows)`);
    }
  }
}
