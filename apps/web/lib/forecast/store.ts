import { mkdir, open, readFile, link, unlink, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";
import { hash, type HistoryDataset } from "../kto/history";
import { validateHistoryDataset } from "./vintages";
import { makeAssessment, makeIssuance, receiptOf, requestHash, requestKey, validateReceipt, type Assessment, type Receipt, type Request, type SnapshotRef } from "./prospective";

const isExists = (error: unknown) => (error as NodeJS.ErrnoException).code === "EEXIST";
const isMissing = (error: unknown) => (error as NodeJS.ErrnoException).code === "ENOENT";
const digest = (value: string) => { if (!/^[a-f0-9]{64}$/.test(value)) throw new Error("invalid-archive-id"); return value; };
const encode = (value: unknown) => `${JSON.stringify(value)}\n`;

/** Fully write and fsync before exposing the destination. A competing writer can never replace it. */
export async function createImmutable(path: string, content: string): Promise<boolean> {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.${randomUUID()}.tmp`, file = await open(temporary, "wx", 0o600);
  try {
    await file.writeFile(content); await file.sync(); await file.close();
    try { await link(temporary, path); return true; } catch (error) { if (isExists(error)) return false; throw error; }
  } finally { await file.close(); await unlink(temporary); }
}
export async function archiveSnapshots(store: string, datasets: HistoryDataset[]): Promise<SnapshotRef[]> {
  const refs: SnapshotRef[] = [];
  for (const dataset of datasets) {
    validateHistoryDataset(dataset);
    const content = encode(dataset), archiveId = hash(content), path = join(store, "snapshots", `${archiveId}.json`);
    if (!await createImmutable(path, content) && await readFile(path, "utf8") !== content) throw new Error("corrupt-snapshot-archive");
    if (!refs.some((r) => r.archiveId === archiveId)) refs.push({ archiveId, snapshotId: dataset.snapshotId });
  }
  return refs.sort((a, b) => a.archiveId.localeCompare(b.archiveId));
}
export async function loadSnapshots(store: string, refs: SnapshotRef[]): Promise<HistoryDataset[]> {
  return Promise.all(refs.map(async (ref) => {
    const content = await readFile(join(store, "snapshots", `${digest(ref.archiveId)}.json`), "utf8");
    if (hash(content) !== ref.archiveId) throw new Error("corrupt-snapshot-archive");
    const dataset = JSON.parse(content) as HistoryDataset; validateHistoryDataset(dataset);
    if (dataset.snapshotId !== ref.snapshotId) throw new Error("snapshot-reference-mismatch");
    return dataset;
  }));
}
export async function readReceipt(store: string, requestId: string): Promise<Receipt | null> {
  let content: string;
  try { content = await readFile(join(store, "forecasts", `${requestKey(requestId)}.json`), "utf8"); }
  catch (error) { if (isMissing(error)) return null; throw error; }
  const receipt = JSON.parse(content) as Receipt; validateReceipt(receipt);
  if (receipt.request.requestId !== requestId) throw new Error("request-reference-mismatch");
  await loadSnapshots(store, receipt.snapshots);
  return receipt;
}
export async function issueForecast(store: string, request: Request, datasets: HistoryDataset[], now: string): Promise<{ reused: boolean; receipt: Receipt }> {
  const intentHash = requestHash(request), existing = await readReceipt(store, request.requestId);
  if (existing) {
    if (existing.intentHash !== intentHash) throw new Error("request-id-conflict");
    return { reused: true, receipt: existing };
  }
  // Validate the due date and data before creating an archive. Archive order is deterministic.
  makeIssuance(request, datasets, [], now);
  const snapshots = await archiveSnapshots(store, datasets);
  const receipt = receiptOf(makeIssuance(request, await loadSnapshots(store, snapshots), snapshots, now));
  const created = await createImmutable(join(store, "forecasts", `${request.requestId}.json`), encode(receipt));
  if (created) return { reused: false, receipt };
  const winner = await readReceipt(store, request.requestId);
  if (!winner || winner.intentHash !== intentHash) throw new Error("request-id-conflict");
  return { reused: true, receipt: winner };
}
export async function assessForecast(store: string, requestId: string, datasets: HistoryDataset[], now: string): Promise<Assessment> {
  const receipt = await readReceipt(store, requestId);
  if (!receipt) throw new Error("forecast-not-found");
  makeAssessment(receipt, datasets, [], now);
  const snapshots = await archiveSnapshots(store, datasets);
  const result = makeAssessment(receipt, await loadSnapshots(store, snapshots), snapshots, now);
  const content = encode(result), path = join(store, "assessments", `${result.id}.json`);
  if (!await createImmutable(path, content) && await readFile(path, "utf8") !== content) throw new Error("corrupt-assessment");
  return result;
}
export async function verifyStore(store: string) {
  const receipts: Receipt[] = [], assessments: Assessment[] = [];
  let forecastFiles: string[];
  try { forecastFiles = await readdir(join(store, "forecasts")); } catch (error) { if (!isMissing(error)) throw error; forecastFiles = []; }
  for (const file of forecastFiles.filter((f) => f.endsWith(".json")).sort()) {
    const receipt = (await readReceipt(store, file.slice(0, -5)))!;
    const replay = receiptOf(makeIssuance(receipt.request, await loadSnapshots(store, receipt.snapshots), receipt.snapshots, receipt.issuedAt));
    if (JSON.stringify(replay) !== JSON.stringify(receipt)) throw new Error("forecast-replay-mismatch");
    receipts.push(receipt);
  }
  let files: string[];
  try { files = await readdir(join(store, "assessments")); } catch (error) { if (!isMissing(error)) throw error; files = []; }
  for (const file of files.filter((f) => f.endsWith(".json")).sort()) {
    const result = JSON.parse(await readFile(join(store, "assessments", file), "utf8")) as Assessment;
    const receipt = receipts.find((r) => r.id === result.forecastId);
    if (!receipt || file !== `${result.id}.json`) throw new Error("invalid-assessment-reference");
    const replay = makeAssessment(receipt, await loadSnapshots(store, result.snapshots), result.snapshots, result.assessedAt);
    if (JSON.stringify(replay) !== JSON.stringify(result)) throw new Error("assessment-replay-mismatch");
    assessments.push(result);
  }
  return { receipts, assessments };
}
