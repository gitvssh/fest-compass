import assert from "node:assert/strict";
import test from "node:test";
import { monitorHistory, selectVintages, validateHistoryDataset, vintageTimeline } from "./vintages";
import { fixture } from "./test-fixture";
test("vintages preserve the value actually observed at each cutoff, including zero and withdrawals", () => {
  const first = fixture("2026-08-01", "2026-08-03", "2026-09-01T00:00:00Z", (_, i) => [10, null, 0][i]);
  const second = fixture("2026-08-01", "2026-08-03", "2026-09-02T00:00:00Z", (_, i) => [12, 5, null][i]);
  const timeline = vintageTimeline([second, first]);
  assert.equal(selectVintages(timeline, "2026-08-31T23:59:59Z").length, 0);
  assert.deepEqual(selectVintages(timeline, "2026-09-01T01:00:00Z").map((v) => v.value), [10, null, 0]);
  assert.deepEqual(selectVintages(timeline, "2026-09-02T01:00:00Z").map((v) => v.value), [12, 5, null]);
  const monitor = monitorHistory([first, second], "2026-09-02T01:00:00Z");
  assert.equal(monitor.comparison.repeatedDays, 3);
  assert.deepEqual(monitor.comparison.changes.map((c) => c.kind), ["revised", "newly-observed", "withdrawn"]);
  assert.deepEqual(monitor.comparison.availabilityTransitions, [{ date: "2026-08-02", lastMissingAt: new Date(first.generatedAt).toISOString(), firstPresentAt: new Date(second.generatedAt).toISOString() }]);
  assert.deepEqual(monitor.coverage.trailingMissing, ["2026-08-03"]);
  assert.equal(monitor.releaseTiming.status, "unknown");
});
test("reassembling the same cached snapshot does not invent a collection or delay", () => {
  const first = fixture("2026-08-01", "2026-08-03", "2026-09-01T00:00:00Z", (_, i) => i === 1 ? null : 10);
  const later = { ...first, generatedAt: "2026-09-03T00:00:00Z" };
  const m = monitorHistory([later, first], "2026-09-04T00:00:00Z");
  assert.equal(m.comparison.repeatedDays, 0);
  assert.equal(m.coverage.latestCollectionAt, new Date(first.generatedAt).toISOString());
  assert.deepEqual(m.coverage.interiorMissing, ["2026-08-02"]);
  assert.equal(selectVintages(vintageTimeline([later, first]), first.generatedAt).length, 3);
});
test("dataset import rejects corruption, quality mismatch and source dates from the future", () => {
  const data = fixture("2026-08-01", "2026-08-03", "2026-09-01T00:00:00Z");
  validateHistoryDataset(data);
  const corrupt = structuredClone(data); corrupt.days[0].values["2"] = 99;
  assert.throws(() => validateHistoryDataset(corrupt), /hash-mismatch/);
  assert.throws(() => validateHistoryDataset({ ...data, quality: { ...data.quality, completeDays: 0 } }), /quality/);
  assert.throws(() => validateHistoryDataset({ ...data, generatedAt: "2026-08-01T00:00:00Z" }), /coverage/);
  const conflict = fixture("2026-08-01", "2026-08-03", data.generatedAt, () => 7);
  assert.throws(() => selectVintages(vintageTimeline([data, conflict]), data.generatedAt), /ambiguous/);
});
