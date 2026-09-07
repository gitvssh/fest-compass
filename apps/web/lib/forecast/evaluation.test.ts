import assert from "node:assert/strict";
import test from "node:test";
import { commonRows, modelChoice, summarizeEvaluation, type EvaluationRow } from "./evaluation";
function row(date: string, actual: number | null, values: (number | null)[]): EvaluationRow {
  return { phase: "tuning", group: "other-nonfestival", date, windowStart: date, issuedAt: "2024-01-01T09:00:00+09:00", cutoff: "2023-12-01",
    lastObservation: "2023-12-01", actual, modelId: null, predictions: Object.fromEntries(["B1", "B2", "ridge-1", "ridge-10", "ridge-100"].map((name, i) =>
      [name, { value: values[i], reason: values[i] === null ? "unavailable" : null, index: null, lower: null, upper: null, inputIds: [], intervalReason: "not-calibrated" }])) };
}
test("selection compares identical dates and logs failures instead of benefiting from missing hard cases", () => {
  const rows = [row("2024-01-05", 100, [90, 80, 70, 95, 110]), row("2024-01-06", 200, [180, 180, 200, 195, 220]),
    row("2024-01-07", 1000, [1000, null, 1000, 100, 1000]), row("2024-01-08", null, [0, 0, 0, 0, 0])];
  const choice = modelChoice(rows);
  assert.equal(choice.baseline, "B1"); assert.equal(choice.lambda, 10);
  assert.equal(choice.tuning.comparable, 2); assert.equal(choice.tuning.excluded, 2);
  assert.equal(choice.tuning.unavailable.B2.length, 1);
  assert.equal(choice.selectedAfter, "2024-01-06");
  assert.equal(commonRows(rows, ["B1", "B2"]).length, 2);
  assert.equal(summarizeEvaluation(rows, ["B1", "B2"]).metrics.B1.mae, 15);
});
test("ties and missing observations have deterministic selection behavior", () => {
  const choice = modelChoice([row("2024-02-01", 100, [100, 100, 100, 100, 100])]);
  assert.equal(choice.baseline, "B1"); assert.equal(choice.lambda, 1);
  assert.throws(() => modelChoice([row("2024-02-01", null, [100, 100, 100, 100, 100])]), /no-common/);
});
