import test from "node:test";
import assert from "node:assert/strict";
import { CALENDAR, calendarFeatures } from "./calendar";
import { makeCalendarTrainer } from "./calendar-model";
import { compareHistoryRows, festivalTraining, validateHistoryControl } from "./festival-history";
import type { CalendarReport } from "./calendar-evaluation";
import { observationsFromDataset } from "./model";
import { fixture } from "./test-fixture";
import { shiftDay } from "../kto/history";

test("older context admits the five 2023 festival labels, excludes online-edition labels, and keeps future values out", () => {
  const observations = observationsFromDataset(fixture("2022-01-01", "2024-12-31", "2026-09-07T00:00:00Z", (date) =>
    40_000 + (CALENDAR.festivals.some((f) => f.start <= date && date <= f.end) ? 100_000 : 0)));
  for (const horizon of [28, 7] as const) {
    const cutoff = shiftDay("2024-03-21", -horizon - 35);
    const original = makeCalendarTrainer(observations.filter((r) => r.date >= "2023-01-01"), CALENDAR, "combined", horizon)(cutoff)!;
    const extended = makeCalendarTrainer(observations, CALENDAR, "combined", horizon)(cutoff)!;
    const without = makeCalendarTrainer(observations, CALENDAR, "combined", horizon, 2023)(cutoff)!;
    assert.equal(festivalTraining(original, observations)!.festivalTargets["2023"], 0);
    assert.equal(festivalTraining(extended, observations)!.festivalTargets["2023"], 5);
    assert.equal(festivalTraining(without, observations)!.festivalTargets["2023"], 0);
    assert.equal(extended.trainingSamples - without.trainingSamples, 5);
    assert.ok(extended.inputIds.some((id) => id.startsWith("2022-")));
    assert.ok(extended.trainingTargetIds.every((id) => id >= "2023-01-01" && id.slice(0, 10) <= cutoff));
    assert.ok(without.inputIds.some((id) => id.startsWith("2023-03-08")), "omitting labels must not erase lagged visit inputs");
    const corrupted = observations.map((r) => r.date > cutoff ? { ...r, value: 1e10 } : r);
    assert.deepEqual(makeCalendarTrainer(corrupted, CALENDAR, "combined", horizon)(cutoff), extended);
  }
  assert.equal(calendarFeatures(CALENDAR, "festival", "2022-02-23", "2022-02-22T09:00:00+09:00", "dated-announcement").reason, "festival-calendar-unknown");
});

test("history comparisons use one common set, preserve unavailable days, and reject a substituted control", () => {
  const prediction = (value: number | null) => ({ value, reason: value === null ? "festival-calendar-unknown" : null, inputIds: [] });
  const rows = [
    { actual: 10, predictions: { ridge: prediction(12), original: prediction(8), extended: prediction(9), without2023: prediction(6) } },
    { actual: 100, predictions: { ridge: prediction(99), original: prediction(90), extended: prediction(null), without2023: prediction(80) } },
    { actual: null, predictions: { ridge: prediction(99), original: prediction(90), extended: prediction(90), without2023: prediction(80) } },
  ];
  const result = compareHistoryRows(rows);
  assert.equal(result.expected, 3); assert.equal(result.observed, 2); assert.equal(result.common, 1);
  assert.equal(result.methods.extended.available, 2);
  assert.equal(result.methods.extended.unavailable["festival-calendar-unknown"], 1);
  assert.equal(result.methods.ridge.mae, 2); assert.equal(result.methods.extended.mae, 1);
  assert.equal(result.methods.without2023.bias, -4);
  assert.throws(() => validateHistoryControl({} as CalendarReport), /history-study-control-mismatch/);
});
