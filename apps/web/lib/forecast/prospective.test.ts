import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fixture } from "./test-fixture";
import { makeAssessment, makeIssuance, receiptOf, type Request } from "./prospective";
import { assessForecast, issueForecast, verifyStore } from "./store";

const now = "2026-09-07T01:15:00Z";
const request: Request = { requestId: "regional-check-20260914-d7", horizonDays: 7,
  target: { kind: "regional-check", label: "지역 예측 검증", start: "2026-09-14", end: "2026-09-17", schedule: null } };
// One year is sufficient for training and an independent previous-year baseline in these tests.
const history = fixture("2025-01-01", "2026-08-08", "2026-09-07T00:30:00Z");
test("issuance enforces the Korean due date and actual available inputs, preserving coefficients", () => {
  const receipt = makeIssuance(request, [history], [], now);
  assert.equal(receipt.status, "issued"); assert.equal(receipt.latenessSeconds, 4500);
  assert.equal(receipt.inputCutoff, "2026-08-03"); assert.equal(receipt.lastInputDate, "2026-08-03");
  assert.equal(receipt.model!.lambda, 100);
  assert.ok(receipt.model!.inputIds.every((id) => id.split("/")[1] <= receipt.inputCutoff));
  assert.ok(receipt.predictions.every((p) => p.predictions.ridge.value! > 0));
  assert.equal(receipt.interval.status, "withheld");
  assert.throws(() => makeIssuance(request, [history], [], "2026-09-06T23:59:59Z"), /not-due/);
  assert.throws(() => makeIssuance(request, [history], [], "2026-09-07T15:00:00Z"), /not-due/);
  assert.throws(() => makeIssuance(request, [{ ...history, generatedAt: "2026-09-07T02:00:00Z" }], [], now), /not-yet-observed/);
  assert.throws(() => makeIssuance({ ...request, target: { ...request.target, kind: "festival" } }, [history], [], now), /schedule/);
});
test("old data and insufficient recent history produce explicit withheld forecasts", () => {
  const stale = fixture("2025-01-01", "2026-06-01", history.generatedAt);
  const result = makeIssuance(request, [stale], [], now);
  assert.equal(result.status, "withheld"); assert.equal(result.predictions[0].predictions.ridge.reason, "observations-too-old");
  const oldCollection = fixture("2025-01-01", "2026-08-08", "2026-08-29T00:00:00Z");
  assert.equal(makeIssuance(request, [oldCollection], [], now).predictions[0].predictions.ridge.reason, "collection-too-old");
  const short = fixture("2026-08-01", "2026-08-08", history.generatedAt);
  assert.equal(makeIssuance(request, [short], [], now).predictions[0].predictions.ridge.reason, "insufficient-training-history");
});
test("assessments distinguish unoccurred, absent, zero, and revised results without changing predictions", () => {
  const receipt = receiptOf(makeIssuance(request, [history], [], now)), frozen = JSON.stringify(receipt);
  const pending = makeAssessment(receipt, [history], [], now);
  assert.equal(pending.observedDays, 0); assert.equal(pending.metrics.ridge.mae, null);
  assert.ok(pending.rows.every((r) => r.status === "not-yet-occurred"));
  const outcomes = fixture(request.target.start, request.target.end, "2026-09-19T00:00:00Z", (_, i) => [0, 100, null, 300][i]);
  const first = makeAssessment(receipt, [history, outcomes], [], outcomes.generatedAt);
  assert.equal(first.observedDays, 3); assert.equal(first.comparableDays, 3);
  assert.equal(first.rows[0].actual, 0); assert.equal(first.rows[2].status, "waiting-provider");
  const revised = fixture(request.target.start, request.target.end, "2026-09-20T00:00:00Z", () => 200);
  const second = makeAssessment(receipt, [history, outcomes, revised], [], revised.generatedAt);
  assert.equal(second.comparableDays, 4); assert.equal(second.rows[0].actual, 200);
  assert.notEqual(first.id, second.id); assert.equal(JSON.stringify(receipt), frozen);
});
test("concurrent issuance is idempotent, conflicts cannot overwrite, and archive tampering fails replay", async () => {
  const store = await mkdtemp(join(tmpdir(), "fest-forecast-test-"));
  try {
    const results = await Promise.all([issueForecast(store, request, [history], now), issueForecast(store, request, [history], now)]);
    assert.equal(results.filter((r) => !r.reused).length, 1);
    assert.deepEqual(results[0].receipt, results[1].receipt);
    const receipt = results[0].receipt;
    assert.equal((await issueForecast(store, request, [], "2026-09-08T00:00:00Z")).receipt.id, receipt.id);
    await assert.rejects(issueForecast(store, { ...request, target: { ...request.target, label: "다른 대상" } }, [history], now), /conflict/);
    await assessForecast(store, request.requestId, [history], now);
    const verified = await verifyStore(store);
    assert.equal(verified.receipts.length, 1); assert.equal(verified.assessments.length, 1);
    const archive = join(store, "snapshots", `${receipt.snapshots[0].archiveId}.json`);
    await writeFile(archive, (await readFile(archive, "utf8")).replace("40000", "90000"));
    await assert.rejects(verifyStore(store), /corrupt-snapshot/);
  } finally { await rm(store, { recursive: true, force: true }); }
});
