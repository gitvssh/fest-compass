import { mkdir, open, readFile, readdir, rename, rm, stat, statfs } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { gunzipSync } from "node:zlib";
import { fetchHistoryPage, hash, makeHistoryDataset, monthWindows, shiftDay, validateHistoryWindow, type HistoryDataset, type HistoryPage } from "../kto/history";
import { scrubSecret } from "../kto/security";
import { issueAt } from "./model";
import { koreanDay, validateHistoryDataset } from "./vintages";
import { requestHash, type Request, type SnapshotRef } from "./prospective";
import { archiveSnapshots, assessForecast, createImmutable, issueForecast, loadSnapshots, verifyStore } from "./store";
import { publicSummary } from "./summary";

export const DAILY = { version: "nonsan-daily-v1", lookbackDays: 90, maxCalls: 20, maxStoredBytes: 256 * 1024 * 1024, minFreeBytes: 128 * 1024 * 1024 } as const;
export type DailyResult = { schemaVersion: 1; date: string; startedAt: string; completedAt: string; status: "success" | "partial" | "failed";
  calls: number; error: string | null; snapshot: SnapshotRef | null; nextRunAt: string };
export type Seed = { schemaVersion: 1; files: { path: string; content: string; hash: string }[] };
type PageLoader = typeof fetchHistoryPage;
const encode = (value: unknown) => `${JSON.stringify(value)}\n`;
export const nextRunAt = (now: string) => Date.parse(now) < Date.parse(issueAt(koreanDay(now))) ? issueAt(koreanDay(now)) : issueAt(shiftDay(koreanDay(now), 1));
export const dueDay = (now: string) => Date.parse(now) >= Date.parse(issueAt(koreanDay(now))) ? koreanDay(now) : null;
const safeError = (error: unknown) => error instanceof Error && /^(history-[a-z-]+|daily-[a-z-]+|corrupt-[a-z-]+|invalid-[a-z-]+|snapshot-[a-z-]+|request-id-conflict)$/.test(error.message) ? error.message : "daily-processing-failed";
async function jsonOrNull<T>(path: string): Promise<T | null> {
  try { return JSON.parse(await readFile(path, "utf8")); } catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return null; throw error; }
}
export async function atomicJson(path: string, value: unknown) {
  const temporary = `${path}.${randomUUID()}.tmp`, file = await open(temporary, "wx", 0o600);
  try { await file.writeFile(encode(value)); await file.sync(); } finally { await file.close(); }
  await rename(temporary, path);
}
export function validatePlan(requests: Request[]) {
  if (!Array.isArray(requests) || requests.length > 20 || new Set(requests.map((r) => r.requestId)).size !== requests.length) throw new Error("invalid-daily-plan");
  for (const request of requests) requestHash(request);
}
export async function bootstrap(store: string, compressedSeed: Uint8Array) {
  const seed = JSON.parse(gunzipSync(compressedSeed, { maxOutputLength: 8 * 1024 * 1024 }).toString()) as Seed;
  if (seed.schemaVersion !== 1 || !Array.isArray(seed.files) || seed.files.length > 100) throw new Error("invalid-daily-seed");
  await mkdir(store, { recursive: true, mode: 0o700 });
  for (const file of seed.files) {
    if (!/^(snapshots|assessments)\/[a-f0-9]{64}\.json$|^forecasts\/[a-z0-9][a-z0-9-]{0,79}\.json$/.test(file.path)
      || hash(file.content) !== file.hash) throw new Error("invalid-daily-seed");
    const path = join(store, file.path);
    if (!await createImmutable(path, file.content) && await readFile(path, "utf8") !== file.content) throw new Error("corrupt-daily-seed-target");
  }
  await verifyStore(store);
}
export async function catalogue(store: string): Promise<{ refs: SnapshotRef[]; datasets: HistoryDataset[] }> {
  const files = (await readdir(join(store, "snapshots"))).filter((f) => /^[a-f0-9]{64}\.json$/.test(f)).sort();
  const refs: SnapshotRef[] = [];
  for (const file of files) {
    const content = await readFile(join(store, "snapshots", file), "utf8"), dataset = JSON.parse(content) as HistoryDataset;
    if (hash(content) !== file.slice(0, -5)) throw new Error("corrupt-snapshot-archive");
    validateHistoryDataset(dataset); refs.push({ archiveId: file.slice(0, -5), snapshotId: dataset.snapshotId });
  }
  return { refs, datasets: await loadSnapshots(store, refs) };
}
async function storedBytes(directory: string): Promise<number> {
  let total = 0;
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) throw new Error("daily-store-symlink");
    if (entry.isDirectory()) total += await storedBytes(join(directory, entry.name));
    else total += (await stat(join(directory, entry.name))).size;
  }
  return total;
}
export async function checkStorage(store: string) {
  const usage = await storedBytes(store), fs = await statfs(store);
  if (usage > DAILY.maxStoredBytes || fs.bavail * fs.bsize < DAILY.minFreeBytes) throw new Error("daily-storage-limit");
}

/** Caller owns the process-wide flock. Attempts survive a crash; an uncertain request is never repeated that day. */
export async function collectDaily(store: string, date: string, key: string, clock: () => string, loader: PageLoader = fetchHistoryPage) {
  const directory = join(store, "runs", date), cache = join(directory, "pages");
  await mkdir(cache, { recursive: true, mode: 0o700 });
  const attemptsPath = join(directory, "attempts.jsonl");
  let attempts: { id: string; at: string }[];
  try { attempts = (await readFile(attemptsPath, "utf8")).trim().split("\n").filter(Boolean).map((line) => JSON.parse(line)); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; attempts = []; }
  const start = shiftDay(date, -DAILY.lookbackDays), end = shiftDay(date, -1), pages: HistoryPage[] = [];
  for (const window of monthWindows(start, end)) {
    let count = 1, size = 10_000;
    for (let pageNo = 1; pageNo <= count; pageNo++) {
      const id = `${window.start}-${window.end}-${pageNo}`, path = join(cache, `${id}.json`);
      const saved = await jsonOrNull<{ page: HistoryPage; checksum: string }>(path);
      let page: HistoryPage;
      if (saved) {
        if (hash(JSON.stringify(saved.page)) !== saved.checksum) throw new Error("history-cache-corrupt");
        page = saved.page;
      } else {
        if (attempts.some((a) => a.id === id)) throw new Error("history-interrupted-request");
        if (attempts.length >= DAILY.maxCalls) throw new Error("history-call-budget-stop");
        const attempt = { id, at: clock() };
        const log = await open(attemptsPath, "a", 0o600);
        try { await log.writeFile(encode(attempt)); await log.sync(); } finally { await log.close(); }
        attempts.push(attempt);
        page = JSON.parse(scrubSecret(JSON.stringify(await loader({ ...window, pageNo, pageSize: size }, key)), key));
        await atomicJson(path, { page, checksum: hash(JSON.stringify(page)) });
        await new Promise((done) => setTimeout(done, 250));
      }
      if (page.start !== window.start || page.end !== window.end || page.pageNo !== pageNo) throw new Error("history-cache-request-mismatch");
      pages.push(page);
      if (pageNo === 1) { size = page.pageSize; count = Math.max(1, Math.ceil(page.totalCount / size)); }
      if (count > 100) throw new Error("history-page-limit");
    }
    validateHistoryWindow(pages.filter((p) => p.start === window.start), window.start, window.end);
  }
  const dataset = makeHistoryDataset(pages, start, end); dataset.generatedAt = clock(); validateHistoryDataset(dataset);
  return { dataset, calls: attempts.length };
}

export async function publishDailySummary(store: string, requests: Request[], result: DailyResult, now: string) {
  const { datasets } = await catalogue(store), verified = await verifyStore(store);
  const schedule = requests.map((r) => ({ requestId: r.requestId, start: r.target.start, horizonDays: r.horizonDays,
    dueDate: shiftDay(r.target.start, -r.horizonDays), status: verified.receipts.some((f) => f.request.requestId === r.requestId) ? "recorded"
      : shiftDay(r.target.start, -r.horizonDays) < koreanDay(now) ? "missed" : "upcoming" }));
  const payload = { ...publicSummary(verified, datasets, now), automation: { ...result, mode: "daily" as const, schedule } };
  await atomicJson(join(store, "public-summary.json"), { schemaVersion: 1, checksum: hash(JSON.stringify(payload)), payload });
  return payload;
}

export async function runDaily(store: string, requests: Request[], key: string, clock: () => string = () => new Date().toISOString(), loader?: PageLoader) {
  validatePlan(requests);
  const startedAt = clock(), date = dueDay(startedAt);
  if (!date) return null;
  const directory = join(store, "runs", date), resultPath = join(directory, "result.json");
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const existing = await jsonOrNull<DailyResult>(resultPath);
  if (existing) { await publishDailySummary(store, requests, existing, clock()); return existing; }
  let error: string | null = null, snapshot: SnapshotRef | null = null, calls = 0, partial = false;
  try {
    await checkStorage(store);
    if (!key.trim()) throw new Error("daily-key-missing");
    const checkpoint = await jsonOrNull<SnapshotRef>(join(directory, "collected.json"));
    let dataset: HistoryDataset;
    if (checkpoint) { [dataset] = await loadSnapshots(store, [checkpoint]); snapshot = checkpoint; }
    else {
      const collected = await collectDaily(store, date, key, clock, loader); dataset = collected.dataset; calls = collected.calls;
      [snapshot] = await archiveSnapshots(store, [dataset]);
      await atomicJson(join(directory, "collected.json"), snapshot);
    }
    partial = dataset.quality.completeDays !== dataset.quality.expectedDays;
    const { datasets } = await catalogue(store);
    for (const request of requests) {
      // A missed date stays missed. A restart must not invent an earlier issuance.
      if (shiftDay(request.target.start, -request.horizonDays) === koreanDay(clock())) await issueForecast(store, request, datasets, clock());
    }
    const { receipts } = await verifyStore(store);
    for (const receipt of receipts) {
      const marker = join(directory, `assessed-${receipt.request.requestId}.json`);
      if (!await jsonOrNull(marker)) await atomicJson(marker, { id: (await assessForecast(store, receipt.request.requestId, datasets, clock())).id });
    }
  } catch (cause) { error = safeError(cause); }
  try { calls = (await readFile(join(directory, "attempts.jsonl"), "utf8")).trim().split("\n").filter(Boolean).length; }
  catch (cause) { if ((cause as NodeJS.ErrnoException).code !== "ENOENT") throw cause; }
  const completedAt = clock(), result: DailyResult = { schemaVersion: 1, date, startedAt, completedAt,
    status: error ? "failed" : partial ? "partial" : "success", calls, error, snapshot, nextRunAt: nextRunAt(completedAt) };
  await atomicJson(resultPath, result);
  // Only this completed run's temporary national identifiers are removed. Regional evidence and attempts remain.
  await rm(join(directory, "pages"), { recursive: true, force: true });
  await publishDailySummary(store, requests, result, clock());
  return result;
}
