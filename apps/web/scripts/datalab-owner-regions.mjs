// The owner's official DataLab region downloads (2026-10-05): yearly tourism spending (domestic, local, outside) and outside
// visitors for regions the first import did not cover, the official ZIPs byte for byte with their CSV entries extracted
// beside them, and the owner's download list and note. `node scripts/datalab-owner-regions.mjs --init <download folder>`
// records it once; builds call verifyOwnerRegions(). The manifest is re-derived from the files and must match exactly.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { blobUrl, describe, gitBlobId, sha256 } from "./datalab-bytes.mjs";
import { parseTable } from "./datalab-csv.mjs";
import { readZip } from "./datalab-zip.mjs";

export const OWNER_REGIONS = {
  id: "datalab-regions-2026-10",
  repository: "https://github.com/gitvssh/fest-compass",
  ref: "main",
  officialUrl: "https://datalab.visitkorea.or.kr/datalab/portal/loc/getAreaDataForm.do",
  downloadedBy: "프로젝트 소유자(로그인 회원, 공식 내려받기 단추)",
  downloadedAt: "2026-10-05(한국시간, 내려받은 사람의 기록)",
};
export const REGIONS_DIR = `docs/research/imported/${OWNER_REGIONS.id}`;
export const REGIONS_ORIGINAL = `${REGIONS_DIR}/original`;
export const REGIONS_MANIFEST = `${REGIONS_DIR}/manifest.json`;
const LIST = "다운로드목록.csv", NOTE = "읽어주세요.txt";
const LIST_HEADER = ["지역", "항목", "조회기간", "CSV파일", "데이터행수", "원본파일", "원본ZIP_SHA256", "CSV_SHA256"];
// What each official ZIP holds. The trend tables feed the region cards; the AI summary is kept for reference only.
export const REGION_KINDS = {
  "관광소비": ["관광소비 추이_내국인", "관광소비 추이_현지인", "관광소비 추이_외지인"],
  "방문자": ["방문자 수(연인원) 추이"],
  "종합분석_참고": ["AI 관광 분석_방문자", "AI 관광 분석_숙박_체류시간", "AI 관광 분석_연관지역", "AI 관광 분석_유사지역"],
};
const CONSUMED_KINDS = ["관광소비", "방문자"];
export const REGIONS_EXPECTED = { zip: 9, csv: 20, doc: 2, consumed: 16 };

const urlOf = path => blobUrl(OWNER_REGIONS.repository, OWNER_REGIONS.ref, `${REGIONS_ORIGINAL}/${path}`);

/** Paths relative to original/: the owner's two documents, zip/<official name>.zip and data/<official stem>/<entry>.csv. */
export function classifyRegionFile(path) {
  if (path === LIST || path === NOTE) return { group: "doc" };
  let m = path.match(/^zip\/((\d{14})_([^_/]+)_(\d{4})-(\d{4})_데이터랩_다운로드)\.zip$/);
  if (m) return { group: "zip", stem: m[1], stamp: m[2], region: m[3], range: { from: Number(m[4]), to: Number(m[5]) } };
  m = path.match(/^data\/((\d{14})_([^_/]+)_(\d{4})-(\d{4})_데이터랩_다운로드)\/(\d{14})_([^/]+)\.csv$/);
  if (m && m[2] === m[6] && Object.values(REGION_KINDS).flat().includes(m[7])) return { group: "table", stem: m[1], stamp: m[2], region: m[3], range: { from: Number(m[4]), to: Number(m[5]) }, table: m[7] };
  throw new Error(`Unknown owner region file: ${path}`);
}

function fileEntry(path, bytes) {
  const d = describe(bytes);
  return { path, bytes: bytes.length, sha256: sha256(bytes), gitBlob: gitBlobId(bytes), encoding: d.encoding, lineEnding: d.lineEnding };
}

/** Derive the whole manifest from the files; `read(path)` returns the bytes of a path under original/ (or throws). */
export function deriveRegionsManifest(read) {
  const { rows: list } = parseTable(describe(read(LIST)).text, LIST_HEADER);
  const files = [LIST, NOTE].map(p => ({ ...fileEntry(p, read(p)), group: "doc", use: "preserved-only", url: urlOf(p) }));
  const byZip = new Map();
  list.forEach((row, i) => { const z = row[5]; if (!byZip.has(z)) byZip.set(z, []); byZip.get(z).push({ row, at: `${LIST} row ${i + 2}` }); });
  for (const [officialName, rows] of byZip) {
    const [region, kind, rangeLabel, , , , zipSha] = rows[0].row;
    if (rows.some(r => r.row[0] !== region || r.row[1] !== kind || r.row[2] !== rangeLabel || r.row[6] !== zipSha)) throw new Error(`One official ZIP must list one region, kind, range and hash: ${officialName}`);
    if (!REGION_KINDS[kind]) throw new Error(`Unknown download kind ${kind}: ${rows[0].at}`);
    const zipPath = `zip/${officialName}`, z = classifyRegionFile(zipPath), zipBytes = read(zipPath);
    if (z.region !== region || `${z.range.from}-${z.range.to}` !== rangeLabel) throw new Error(`Official ZIP name differs from the list: ${officialName}`);
    if (!/^[0-9A-F]{64}$/.test(zipSha) || sha256(zipBytes) !== zipSha.toLowerCase()) throw new Error(`Official ZIP hash differs from the download list: ${officialName}`);
    const entries = readZip(zipBytes);
    if (entries.length !== rows.length) throw new Error(`CSV count differs from the download list: ${officialName}`);
    const tablePaths = entries.map(e => {
      const m = e.name.match(/^(\d{14})_(.+)\.csv$/);
      if (!m || m[1] !== z.stamp || !REGION_KINDS[kind].includes(m[2])) throw new Error(`Unexpected ZIP entry ${e.name}: ${officialName}`);
      const listed = rows.filter(r => r.row[3].split("/").at(-1) === `${m[2]}.csv`);
      if (listed.length !== 1) throw new Error(`ZIP entry is not listed once: ${e.name}`);
      const [, , , , rowCount, , , csvSha] = listed[0].row;
      const path = `data/${z.stem}/${e.name}`, bytes = read(path);
      if (!bytes.equals(e.bytes)) throw new Error(`Extracted CSV differs from its ZIP entry: ${path}`);
      if (sha256(bytes) !== csvSha.toLowerCase()) throw new Error(`CSV hash differs from the download list: ${path}`);
      const { header, rows: body } = parseTable(describe(bytes).text);
      if (String(body.length) !== rowCount) throw new Error(`Row count differs from the download list: ${path}`);
      files.push({ ...fileEntry(path, bytes), group: "table", region, kind, table: m[2], range: z.range, header, rowCount: body.length,
        zip: { path: zipPath, entry: e.name, crc32: e.crc32 }, use: CONSUMED_KINDS.includes(kind) ? "consumed" : "preserved-only", url: urlOf(path) });
      return path;
    });
    files.push({ path: zipPath, bytes: zipBytes.length, sha256: sha256(zipBytes), gitBlob: gitBlobId(zipBytes), group: "zip", region, kind, range: z.range,
      entries: tablePaths, use: "preserved-only", url: urlOf(zipPath) });
  }
  files.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  const n = test => files.filter(test).length;
  return {
    schemaVersion: 1,
    source: { ...OWNER_REGIONS, importedTo: REGIONS_ORIGINAL, list: LIST, note: NOTE,
      downloadTimeNote: "파일·폴더명 앞 14자리는 내려받은 시각 표기로 보이나 시간대가 기록되지 않았다. 관측 기간이 아니다." },
    counts: { zip: n(f => f.group === "zip"), csv: n(f => f.group === "table"), doc: n(f => f.group === "doc"), consumed: n(f => f.use === "consumed") },
    files,
  };
}

const listed = dir => readdirSync(dir, { recursive: true, withFileTypes: true }).filter(d => d.isFile()).map(d => `${d.parentPath ?? d.path}/${d.name}`.slice(dir.length + 1)).sort();
function checkCounts(manifest) {
  for (const [k, v] of Object.entries(REGIONS_EXPECTED)) if (manifest.counts[k] !== v) throw new Error(`Unexpected owner region import ${k} count: ${manifest.counts[k]}`);
}

/** Re-derive the manifest from the imported files; any byte, list, ZIP or classification change fails. */
export function verifyOwnerRegions(root) {
  const raw = readFileSync(`${root}${REGIONS_MANIFEST}`), stored = JSON.parse(raw.toString("utf8")), base = `${root}${REGIONS_ORIGINAL}`;
  if (stored.schemaVersion !== 1 || stored.source?.id !== OWNER_REGIONS.id) throw new Error("Owner region manifest source mismatch");
  const present = listed(base), seen = new Set();
  const read = path => { seen.add(path); try { return readFileSync(`${base}/${path}`); } catch { throw new Error(`Missing owner region file: ${path}`); } };
  if (JSON.stringify(deriveRegionsManifest(read)) !== JSON.stringify(stored)) throw new Error("Owner region manifest differs from the imported files");
  checkCounts(stored);
  const extra = present.filter(p => !seen.has(p));
  if (extra.length) throw new Error(`Unlisted owner region file: ${extra[0]}`);
  const files = new Map(stored.files.map(entry => [entry.path, { entry, bytes: readFileSync(`${base}/${entry.path}`) }]));
  return { manifest: stored, manifestSha256: sha256(raw), files };
}

/** Copy the owner's folder (<지역>/공식ZIP/<항목>_<기간>.zip, 다운로드목록.csv, 읽어주세요.txt) into original/ and record the manifest. */
export function initOwnerRegions(sourceDir, root) {
  const { rows: list } = parseTable(describe(readFileSync(`${sourceDir}/${LIST}`)).text, LIST_HEADER), base = `${root}${REGIONS_ORIGINAL}`;
  const put = (path, bytes) => { mkdirSync(`${base}/${path}`.replace(/\/[^/]+$/, ""), { recursive: true }); writeFileSync(`${base}/${path}`, bytes); };
  for (const doc of [LIST, NOTE]) put(doc, readFileSync(`${sourceDir}/${doc}`));
  for (const [region, kind, rangeLabel, , , officialName] of new Map(list.map(r => [r[5], r])).values()) {
    const zipBytes = readFileSync(`${sourceDir}/${region}/공식ZIP/${kind}_${rangeLabel}.zip`), z = classifyRegionFile(`zip/${officialName}`);
    put(`zip/${officialName}`, zipBytes);
    for (const e of readZip(zipBytes)) put(`data/${z.stem}/${e.name}`, e.bytes);
  }
  const manifest = deriveRegionsManifest(path => readFileSync(`${base}/${path}`));
  checkCounts(manifest);
  const extra = listed(base).filter(p => !manifest.files.some(f => f.path === p));
  if (extra.length) throw new Error(`Unexpected file after import: ${extra[0]}`);
  writeFileSync(`${root}${REGIONS_MANIFEST}`, JSON.stringify(manifest, null, 2) + "\n");
  return manifest;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const root = fileURLToPath(new URL("../../../", import.meta.url)), args = process.argv.slice(2);
  if (args[0] === "--init" && args[1]) {
    const m = initOwnerRegions(args[1].replace(/\/$/, ""), root);
    console.log(`Recorded ${m.counts.zip} official ZIPs and ${m.counts.csv} CSVs (${m.counts.consumed} consumed)`);
  } else {
    const { manifest } = verifyOwnerRegions(root);
    console.log(`Verified ${manifest.counts.zip} official ZIPs and ${manifest.counts.csv} CSVs against the owner's download list`);
  }
}
