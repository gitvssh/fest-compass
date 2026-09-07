import assert from "node:assert/strict";
import test from "node:test";
import { availableAt, baseline, evaluationWindows, fitRidge, issueAt, predictRidge, relativeIndex, residualRadius, scores, solve, type Observation } from "./model";
import { daysBetween, shiftDay } from "../kto/history";

function series(): Observation[] {
  return daysBetween("2023-01-01", "2025-12-31").map((date, i) => ({ id: `${date}/2`, date,
    value: 40_000 + (new Date(`${date}T00:00:00Z`).getUTCDay() === 6 ? 20_000 : 0) + i * 3,
    fetchedAt: "2026-09-07T00:00:00Z", sourcePublishedAt: null }));
}
test("strict replay rejects today's historical revision; experimental cutoff is explicit", () => {
  const rows = series();
  assert.equal(availableAt(rows, issueAt("2025-03-20"), { mode: "strict-replay" }).length, 0);
  const available = availableAt(rows, issueAt("2025-03-20"), { mode: "revised-series-experiment", assumedLagDays: 35 });
  assert.equal(available.at(-1)!.date, "2025-02-13");
  assert.equal(availableAt([{ ...rows[0], fetchedAt: "2023-01-06T00:00:00Z" }], issueAt("2023-01-07"), { mode: "strict-replay" }).length, 1);
  assert.throws(() => availableAt(rows, issueAt("2025-03-20"), { mode: "revised-series-experiment", assumedLagDays: 0 }));
});
test("weekday and annual baselines preserve zero and distinguish unavailable values", () => {
  const rows = series().filter((r) => r.date <= "2023-02-28");
  assert.equal(baseline(rows, "2023-03-04", "B1").inputIds.length, 4);
  assert.equal(baseline(rows.slice(0, 3), "2023-03-04", "B1").value, null);
  assert.equal(baseline(rows, "2023-03-04", "B2").value, null);
  assert.equal(baseline(rows.map((r) => ({ ...r, value: 0 })), "2023-03-04", "B1").value, 0);
  assert.equal(relativeIndex(1, 0), null);
  assert.equal(relativeIndex(150, 100), 150);
});
test("a learned model predicts a known weekly pattern and ignores future targets", () => {
  const rows = series(), cutoff = "2024-12-01", target = "2025-01-04";
  const model = fitRidge(rows, cutoff, 7, 7, 1)!;
  assert.ok(model.trainingSamples > 500);
  assert.ok(model.inputIds.every((id) => id.slice(0, 10) <= cutoff));
  const forecast = predictRidge(model, rows, target, cutoff);
  const actual = rows.find((r) => r.date === target)!.value;
  assert.ok(Math.abs(forecast.value! - actual) < 2000, `${forecast.value} vs ${actual}`);
  const changedFuture = rows.map((r) => r.date > cutoff ? { ...r, value: 999_999_999 } : r);
  assert.deepEqual(fitRidge(changedFuture, cutoff, 7, 7, 1), model);
  assert.deepEqual(predictRidge(model, changedFuture, target, cutoff), forecast);
  assert.throws(() => predictRidge(model, rows, target, shiftDay(cutoff, -1)), /future/);
  assert.equal(fitRidge(rows.slice(0, 30), cutoff, 7, 7, 1), null);
});
test("linear solve, metrics and interval edge cases have independent known answers", () => {
  assert.deepEqual(solve([[2, 1], [1, 3]], [5, 10]).map((n) => Math.round(n * 1000) / 1000), [1, 3]);
  const result = scores([{ actual: 100, predicted: 80, lower: 70, upper: 110 }, { actual: 300, predicted: 340, lower: 320, upper: 360 }]);
  assert.equal(result.mae, 30); assert.equal(result.wape, 0.15); assert.equal(result.bias, 10);
  assert.equal(result.coverage, 0.5); assert.equal(result.meanWidth, 40);
  assert.equal(scores([{ actual: 0, predicted: 3 }]).wape, null);
  assert.equal(scores([]).mae, null);
  assert.equal(residualRadius([1, 2, 3]), null);
  assert.equal(residualRadius(Array.from({ length: 30 }, (_, i) => i + 1)), 25);
});
test("evaluation windows never duplicate dates and preserve fixed festival issuance", () => {
  const windows = evaluationWindows("2025-01-01", "2025-12-31"), days = windows.flatMap((w) => daysBetween(w.start, w.end));
  assert.equal(new Set(days).size, days.length);
  assert.deepEqual(windows.filter((w) => w.group === "festival"), [{ start: "2025-03-27", end: "2025-03-30", group: "festival" }]);
  assert.equal(shiftDay(windows.find((w) => w.group === "festival")!.start, -28), "2025-02-27");
});
