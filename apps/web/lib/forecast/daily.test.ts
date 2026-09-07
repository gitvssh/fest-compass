import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, rm, mkdir, writeFile, access } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { gzipSync } from "node:zlib";
import { execFile, spawn } from "node:child_process";
import { once } from "node:events";
import { promisify } from "node:util";
import { hash, daysBetween, type HistoryDataset, type fetchHistoryPage } from "../kto/history";
import { fixture } from "./test-fixture";
import { atomicJson, bootstrap, collectDaily, dueDay, nextRunAt, runDaily } from "./daily";
import { loadRuntimeSummary } from "./runtime";
import { issueForecast } from "./store";
import type { Request } from "./prospective";

const now = "2026-09-07T01:00:00.000Z", clock = () => now;
const history = fixture("2025-01-01", "2026-08-08", "2026-09-01T00:00:00.000Z");
function seedOf(data: HistoryDataset) {
  const content = `${JSON.stringify(data)}\n`, archiveId = hash(content);
  return gzipSync(JSON.stringify({ schemaVersion: 1, files: [{ path: `snapshots/${archiveId}.json`, hash: archiveId, content }] }));
}
const loader = (missing = false): typeof fetchHistoryPage => async (request) => {
  const selected = daysBetween(request.start, request.end).filter((date) => !missing || date < "2026-08-09").flatMap((date) => ["1", "2", "3"].map((type) => ({
    baseYmd: date.replaceAll("-", ""), signguCode: "44230", signguNm: "논산시", touDivCd: type,
    touDivNm: { "1": "현지인(a)", "2": "외지인(b)", "3": "외국인(c)" }[type], touNum: "0",
  })));
  return { schemaVersion: 1, ...request, totalCount: selected.length, rowCount: selected.length, fetchedAt: now,
    bodyHash: hash(JSON.stringify(selected)), selected, keys: selected.map((r) => `${r.baseYmd}/44230/${r.touDivCd}`) };
};
async function withStore(fn: (store: string) => Promise<void>) {
  const store = await mkdtemp(join(tmpdir(), "fest-daily-test-"));
  try { await bootstrap(store, seedOf(history)); await fn(store); } finally { await rm(store, { recursive: true, force: true }); }
}
test("daily schedule respects 09:00 Korea, leap dates and missed-day behavior", () => {
  assert.equal(dueDay("2026-09-06T23:59:59Z"), null);
  assert.equal(dueDay("2026-09-07T00:00:00Z"), "2026-09-07");
  assert.equal(nextRunAt("2024-02-28T01:00:00Z"), "2024-02-29T09:00:00+09:00");
  assert.equal(nextRunAt("2026-09-07T15:00:00Z"), "2026-09-08T09:00:00+09:00");
});
test("completed daily runs preserve zero, publish runtime data and spend no more calls on restart", async () => withStore(async (store) => {
  let calls = 0;
  const page: typeof fetchHistoryPage = async (...args) => { calls++; return loader()(...args); };
  const result = await runDaily(store, [], "private-test-key", clock, page);
  assert.equal(result!.status, "success"); assert.equal(result!.calls, 4);
  const before = await readFile(join(store, "runs/2026-09-07/result.json"), "utf8");
  await runDaily(store, [], "private-test-key", clock, page);
  assert.equal(calls, 4); assert.equal(await readFile(join(store, "runs/2026-09-07/result.json"), "utf8"), before);
  await atomicJson(join(store, "heartbeat.json"), { at: now });
  const current = await loadRuntimeSummary(store, Date.parse(now));
  assert.equal(current.source, "live"); assert.equal(current.workerAlive, true);
  assert.equal(current.summary.monitor.coverage.latestObservation, "2026-09-06");
  assert.equal(current.summary.monitor.coverage.missingDates.length, 0);
  await assert.rejects(access(join(store, "runs/2026-09-07/pages")), /ENOENT/);
}));
test("normal empty dates are partial; failures stay distinct and are not retried that day", async () => withStore(async (store) => {
  const partial = await runDaily(store, [], "test-key", clock, loader(true));
  assert.equal(partial!.status, "partial"); assert.equal(partial!.error, null);
  const current = await loadRuntimeSummary(store, Date.parse(now));
  assert.equal(current.summary.monitor.coverage.missingDates.length, 29);
  let calls = 0;
  const failed = await runDaily(store, [], "private-test-key", () => "2026-09-08T01:00:00Z", async () => { calls++; throw new Error("private-test-key"); });
  assert.equal(failed!.status, "failed"); assert.equal(failed!.calls, 1);
  assert.equal(failed!.error, "daily-processing-failed");
  await runDaily(store, [], "private-test-key", () => "2026-09-08T02:00:00Z", async () => { calls++; throw new Error("unexpected-retry"); });
  assert.equal(calls, 1);
  assert.ok(!(await readFile(join(store, "public-summary.json"), "utf8")).includes("private-test-key"));
}));
test("uncertain in-flight calls cannot be repeated after a process crash", async () => withStore(async (store) => {
  const directory = join(store, "runs/2026-09-07"); await mkdir(directory, { recursive: true });
  await writeFile(join(directory, "attempts.jsonl"), JSON.stringify({ id: "2026-06-09-2026-06-30-1", at: now }) + "\n");
  let calls = 0;
  await assert.rejects(collectDaily(store, "2026-09-07", "test-key", clock, async () => { calls++; throw new Error("unexpected-retry"); }), /interrupted-request/);
  assert.equal(calls, 0);
}));
test("missed issuance is visible and bootstrap cannot overwrite an existing receipt", async () => withStore(async (store) => {
  const request: Request = { requestId: "missed-check", horizonDays: 7,
    target: { kind: "regional-check", label: "일반 날짜", start: "2026-09-10", end: "2026-09-13", schedule: null } };
  await runDaily(store, [request], "test-key", clock, loader());
  const current = await loadRuntimeSummary(store, Date.parse(now));
  assert.equal(current.summary.records.length, 0);
  assert.equal(current.summary.automation!.schedule[0].status, "missed");
  const issuedRequest = { ...request, requestId: "due-check", target: { ...request.target, start: "2026-09-14", end: "2026-09-17" } };
  const { receipt } = await issueForecast(store, issuedRequest, [history], now);
  await bootstrap(store, seedOf(history));
  assert.equal(JSON.parse(await readFile(join(store, "forecasts/due-check.json"), "utf8")).id, receipt.id);
}));
test("runtime errors show bundled evidence honestly, and stale worker health stays visible", async () => withStore(async (store) => {
  await runDaily(store, [], "test-key", clock, loader());
  await atomicJson(join(store, "heartbeat.json"), { at: "2026-09-06T01:00:00Z" });
  const intact = await loadRuntimeSummary(store, Date.parse(now));
  assert.equal(intact.source, "live"); assert.equal(intact.workerAlive, false);
  const file = join(store, "public-summary.json"), content = JSON.parse(await readFile(file, "utf8"));
  content.payload.monitor.coverage.latestObservation = "2099-01-01"; await writeFile(file, JSON.stringify(content));
  assert.equal((await loadRuntimeSummary(store, Date.parse(now))).source, "unavailable");
}));
test("kernel lock rejects a second writer and releases after a killed process", { skip: process.platform !== "linux" && "production flock runs on Linux" }, async () => {
  const directory = await mkdtemp(join(tmpdir(), "fest-flock-test-")), lock = join(directory, "worker.lock");
  const child = spawn("flock", ["--no-fork", "-n", "-E", "75", lock, "sh", "-c", "printf ready; read answer"], { stdio: ["pipe", "pipe", "pipe"] });
  try {
    await once(child.stdout, "data");
    await assert.rejects(promisify(execFile)("flock", ["-n", "-E", "75", lock, "true"]), (error: unknown) => (error as { code: number }).code === 75);
    child.kill("SIGTERM"); await once(child, "exit");
    await promisify(execFile)("flock", ["-n", "-E", "75", lock, "true"]);
  } finally { if (child.exitCode === null) child.kill(); await rm(directory, { recursive: true, force: true }); }
});
