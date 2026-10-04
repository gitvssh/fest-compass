// The owner's official DataLab culture-tourism festival downloads (2026-10-04~05, every festival the official picker lists):
// the official ZIPs byte for byte, their CSV entries extracted beside them, and the owner's download list and note.
// `node scripts/datalab-owner-import.mjs --init <download folder>` records it once; the festival builds call verifyOwnerImport().
// The manifest is never edited by hand: verification re-derives it from the files and must get the same JSON.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { blobUrl, describe, gitBlobId, sha256 } from "./datalab-bytes.mjs";
import { parseCsv, parseTable } from "./datalab-csv.mjs";
import { readZip } from "./datalab-zip.mjs";

export const OWNER_IMPORT = {
  id: "datalab-festivals-2026-10",
  repository: "https://github.com/gitvssh/fest-compass",
  ref: "main",
  officialUrl: "https://datalab.visitkorea.or.kr/datalab/portal/fes/getFesDataForm.do",
  downloadedBy: "프로젝트 소유자(로그인 회원, 공식 내려받기 단추)",
  downloadedAt: "2026-10-04 밤 ~ 2026-10-05 새벽(한국시간, 내려받은 사람의 기록)",
};
export const OWNER_DIR = `docs/research/imported/${OWNER_IMPORT.id}`;
export const OWNER_ORIGINAL = `${OWNER_DIR}/original`;
export const OWNER_MANIFEST = `${OWNER_DIR}/manifest.json`;
export const OWNER_LIST = "다운로드목록.csv";
const NOTE = "읽어주세요.txt";
const LIST_HEADER = ["축제명", "조회기간", "CSV수", "행수_파일순서", "원본다운로드파일", "원본SHA256"];
// The ZIP names the sex·age table with a colon, which Windows cannot store; the extracted copy uses the earlier import's "-".
const ENTRY_TABLES = new Map([["문화관광축제 주요 지표", "문화관광축제 주요 지표"], ["목적지 검색순위", "목적지 검색순위"], ["연도별 방문자 추이", "연도별 방문자 추이"], ["성:연령별 내국인 방문자", "성-연령별 내국인 방문자"]]);
export const OWNER_EXPECTED = { zip: 92, csv: 367, doc: 2, consumed: 263, overlap: 104 };
const DESTINATION_KEY = ["구분", "순위"];

const urlOf = path => blobUrl(OWNER_IMPORT.repository, OWNER_IMPORT.ref, `${OWNER_ORIGINAL}/${path}`);
const rangeText = r => `${r.from}-${r.to}`;

/** Paths relative to original/: the two owner documents, zip/<official name>.zip and data/<official stem>/<entry>.csv. */
export function classifyOwner(path) {
  if (path === OWNER_LIST || path === NOTE) return { group: "doc" };
  let m = path.match(/^zip\/((\d{14})_문화관광축제_(\d{4})-(\d{4})_데이터랩_다운로드)\.zip$/);
  if (m) return { group: "zip", stem: m[1], stamp: m[2], range: range(m[3], m[4]) };
  m = path.match(/^data\/((\d{14})_문화관광축제_(\d{4})-(\d{4})_데이터랩_다운로드)\/(\d{14})_(.+)_([^_]+)\.csv$/);
  if (m && m[2] === m[5] && [...ENTRY_TABLES.values()].includes(m[7])) return { group: "festival", stem: m[1], stamp: m[2], range: range(m[3], m[4]), name: m[6], table: m[7] };
  throw new Error(`Unknown owner import file: ${path}`);
}
function range(from, to) {
  const r = { from: Number(from), to: Number(to) };
  if (r.from < 2018 || r.to > 2100 || r.from > r.to) throw new Error(`Invalid download range: ${from}-${to}`);
  return r;
}

/** Rows equal as a multiset and, per group, the same ranks in the same order: only the order inside a tied rank differs. */
export function sameUpToTieOrder(a, b) {
  const ta = parseTable(a), tb = parseTable(b);
  if (JSON.stringify(ta.header) !== JSON.stringify(tb.header) || ta.rows.length !== tb.rows.length) return false;
  const [g, r] = DESTINATION_KEY.map(k => ta.header.indexOf(k));
  if (g < 0 || r < 0) return false;
  const rankSeq = rows => rows.map(x => `${x[g]}\u0000${x[r]}`).join("\u0001");
  const bag = rows => rows.map(x => JSON.stringify(x)).sort().join("\n");
  return rankSeq(ta.rows) === rankSeq(tb.rows) && bag(ta.rows) === bag(tb.rows);
}

function fileEntry(path, bytes) {
  const d = describe(bytes);
  return { path, bytes: bytes.length, sha256: sha256(bytes), gitBlob: gitBlobId(bytes), encoding: d.encoding, lineEnding: d.lineEnding };
}

/**
 * Derive the whole manifest from the files. `read(path)` returns the bytes of a path under original/ (or throws);
 * `previous(name, table)` returns the earlier import's bytes for the same festival table, or null when that festival is new.
 */
export function deriveOwnerManifest(read, previous) {
  const { rows: list } = parseTable(describe(read(OWNER_LIST)).text, LIST_HEADER);
  const files = [OWNER_LIST, NOTE].map(p => ({ ...fileEntry(p, read(p)), group: "doc", use: "preserved-only", url: urlOf(p) }));
  const names = new Set();
  list.forEach((row, i) => {
    const [name, rangeLabel, csvCount, rowCounts, officialName, officialSha] = row, at = `${OWNER_LIST} row ${i + 2}`;
    if (names.has(name) || !name) throw new Error(`Empty or repeated festival: ${at}`);
    names.add(name);
    const zipPath = `zip/${officialName}`, z = classifyOwner(zipPath), zipBytes = read(zipPath);
    if (rangeText(z.range) !== rangeLabel) throw new Error(`Download range differs from the official file name: ${at}`);
    if (sha256(zipBytes) !== officialSha.toLowerCase() || !/^[0-9A-F]{64}$/.test(officialSha)) throw new Error(`Official ZIP hash differs from the download list: ${at}`);
    const entries = readZip(zipBytes), counts = rowCounts.split("/");
    if (!/^[1-9]\d*$/.test(csvCount) || entries.length !== Number(csvCount) || counts.length !== entries.length) throw new Error(`CSV count differs from the download list: ${at}`);
    const csvPaths = entries.map((e, j) => {
      const m = e.name.match(/^(\d{14})_(.+)_([^_]+)\.csv$/), table = m && ENTRY_TABLES.get(m[3]);
      if (!m || m[1] !== z.stamp || m[2] !== name || !table) throw new Error(`Unexpected ZIP entry ${e.name}: ${at}`);
      const path = `data/${z.stem}/${z.stamp}_${name}_${table}.csv`, bytes = read(path);
      if (!bytes.equals(e.bytes)) throw new Error(`Extracted CSV differs from its ZIP entry: ${path}`);
      const c = classifyOwner(path), d = describe(bytes), { header, rows } = parseTable(d.text);
      if (rows.length !== Number(counts[j])) throw new Error(`Row count differs from the download list: ${path}`);
      const before = previous(name, table);
      const sameAs = before === null ? undefined : bytes.equals(before) ? { import: "hkjin-plan-03", identical: true }
        : table === "목적지 검색순위" && sameUpToTieOrder(describe(before).text, d.text) ? { import: "hkjin-plan-03", identical: false, difference: "같은 순위 안의 행 순서만 다르다" }
        : (() => { throw new Error(`Same festival differs from the earlier import: ${path}`); })();
      files.push({ ...fileEntry(path, bytes), group: "festival", table: c.table, festival: name, range: c.range, header, rowCount: rows.length,
        zip: { path: zipPath, entry: e.name, crc32: e.crc32 }, use: sameAs ? "preserved-only" : "consumed", ...(sameAs ? { sameAs } : {}), url: urlOf(path) });
      return path;
    });
    files.push({ path: zipPath, bytes: zipBytes.length, sha256: sha256(zipBytes), gitBlob: gitBlobId(zipBytes), group: "zip", festival: name, range: z.range,
      entries: csvPaths, use: "preserved-only", url: urlOf(zipPath) });
  });
  files.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  const n = (f) => files.filter(f).length;
  const counts = { zip: n(f => f.group === "zip"), csv: n(f => f.group === "festival"), doc: n(f => f.group === "doc"), consumed: n(f => f.use === "consumed"), overlap: n(f => f.sameAs) };
  return {
    schemaVersion: 1,
    source: { ...OWNER_IMPORT, importedTo: OWNER_ORIGINAL, list: OWNER_LIST, note: NOTE,
      entryNameNote: "ZIP 안 이름의 '성:연령별'은 Windows에서 쓸 수 없어 풀어 둔 CSV 이름만 '성-연령별'로 바꿨다. 내용은 ZIP 항목과 바이트까지 같다.",
      downloadTimeNote: "파일·폴더명 앞 14자리는 내려받은 시각 표기로 보이나 시간대가 기록되지 않았다. 관측 기간이 아니다." },
    counts, files,
  };
}

const listed = dir => readdirSync(dir, { recursive: true, withFileTypes: true }).filter(d => d.isFile()).map(d => `${d.parentPath ?? d.path}/${d.name}`.slice(dir.length + 1)).sort();

function checkCounts(manifest) {
  for (const [k, v] of Object.entries(OWNER_EXPECTED)) if (manifest.counts[k] !== v) throw new Error(`Unexpected owner import ${k} count: ${manifest.counts[k]}`);
}

/** Re-derive the manifest from the imported files; any byte, list, ZIP or classification change fails. */
export function verifyOwnerImport(root, previous) {
  const raw = readFileSync(`${root}${OWNER_MANIFEST}`), stored = JSON.parse(raw.toString("utf8")), base = `${root}${OWNER_ORIGINAL}`;
  if (stored.schemaVersion !== 1 || stored.source?.id !== OWNER_IMPORT.id) throw new Error("Owner manifest source mismatch");
  const present = listed(base), seen = new Set();
  const read = path => { seen.add(path); try { return readFileSync(`${base}/${path}`); } catch { throw new Error(`Missing owner import file: ${path}`); } };
  const derived = deriveOwnerManifest(read, previous);
  if (JSON.stringify(derived) !== JSON.stringify(stored)) throw new Error("Owner manifest differs from the imported files");
  checkCounts(stored);
  const extra = present.filter(p => !seen.has(p));
  if (extra.length) throw new Error(`Unlisted owner import file: ${extra[0]}`);
  const files = new Map(stored.files.map(entry => [entry.path, { entry, bytes: readFileSync(`${base}/${entry.path}`) }]));
  return { manifest: stored, manifestSha256: sha256(raw), files };
}

/** Copy the owner's folder (공식ZIP/<축제명>_<기간>.zip, 다운로드목록.csv, 읽어주세요.txt) into original/ and record the manifest. */
export function initOwnerImport(sourceDir, root, previous) {
  const { rows: list } = parseTable(describe(readFileSync(`${sourceDir}/${OWNER_LIST}`)).text, LIST_HEADER), base = `${root}${OWNER_ORIGINAL}`;
  const put = (path, bytes) => { mkdirSync(`${base}/${path}`.replace(/\/[^/]+$/, ""), { recursive: true }); writeFileSync(`${base}/${path}`, bytes); };
  for (const doc of [OWNER_LIST, NOTE]) put(doc, readFileSync(`${sourceDir}/${doc}`));
  for (const [name, rangeLabel, , , officialName] of list) {
    const zipBytes = readFileSync(`${sourceDir}/공식ZIP/${name}_${rangeLabel}.zip`), z = classifyOwner(`zip/${officialName}`);
    put(`zip/${officialName}`, zipBytes);
    for (const e of readZip(zipBytes)) {
      const m = e.name.match(/^(\d{14})_(.+)_([^_]+)\.csv$/);
      if (!m || !ENTRY_TABLES.has(m[3])) throw new Error(`Unexpected ZIP entry: ${e.name}`);
      put(`data/${z.stem}/${m[1]}_${m[2]}_${ENTRY_TABLES.get(m[3])}.csv`, e.bytes);
    }
  }
  const manifest = deriveOwnerManifest(path => readFileSync(`${base}/${path}`), previous);
  checkCounts(manifest);
  const extra = listed(base).filter(p => !manifest.files.some(f => f.path === p));
  if (extra.length) throw new Error(`Unexpected file after import: ${extra[0]}`);
  writeFileSync(`${root}${OWNER_MANIFEST}`, JSON.stringify(manifest, null, 2) + "\n");
  return manifest;
}

/** Bytes of the earlier import's festival tables by festival name and table, for the overlap check. */
export function previousTables(hkjinFiles) {
  const byKey = new Map();
  for (const { entry, bytes } of hkjinFiles.values()) if (entry.group === "festival") {
    const name = entry.path.match(/\/\d{14}_([^/]+)_[^_/]+\.csv$/)[1];
    byKey.set(`${name}\u0000${entry.table}`, bytes);
  }
  const names = new Set([...byKey.keys()].map(k => k.split("\u0000")[0]));
  return (name, table) => {
    if (!names.has(name)) return null;
    const bytes = byKey.get(`${name}\u0000${table}`);
    if (!bytes) throw new Error(`Earlier import lacks ${table} for ${name}`);
    return bytes;
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const { REPO_ROOT, verifyImport } = await import("./build-datalab-festival-trend.mjs");
  const args = process.argv.slice(2), previous = previousTables(verifyImport().files);
  if (args[0] === "--init" && args[1]) {
    const m = initOwnerImport(args[1].replace(/\/$/, ""), REPO_ROOT, previous);
    console.log(`Recorded ${m.counts.zip} official ZIPs, ${m.counts.csv} CSVs (${m.counts.consumed} consumed, ${m.counts.overlap} overlap the earlier import)`);
  } else {
    const { manifest } = verifyOwnerImport(REPO_ROOT, previous);
    console.log(`Verified ${manifest.counts.zip} official ZIPs and ${manifest.counts.csv} CSVs against the owner's download list`);
  }
}
