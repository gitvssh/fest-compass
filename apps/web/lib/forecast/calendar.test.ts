import test from "node:test";
import assert from "node:assert/strict";
import { CALENDAR, calendarFeatures, validateCalendar } from "./calendar";
import { makeCalendarTrainer, predictCalendar } from "./calendar-model";
import { observationsFromDataset } from "./model";
import { WINTER_WINDOWS, compareCalendarRows, type CalendarEvaluationRow } from "./calendar-evaluation";
import { fixture } from "./test-fixture";
import { daysBetween } from "../kto/history";

test("official calendar has all four annual lists plus later additions and bounded 2027 coverage", () => {
  validateCalendar(CALENDAR);
  assert.deepEqual([2023, 2024, 2025, 2026].map((y) => CALENDAR.holidays.filter((h) => h.date.startsWith(String(y))).length), [18, 19, 19, 22]);
  assert.equal(CALENDAR.holidays.filter((h) => h.date === "2025-05-05").length, 1);
  assert.ok(!CALENDAR.holidays.some((h) => h.date === "2025-05-01" || h.date === "2025-07-17"));
  assert.equal(calendarFeatures(CALENDAR, "holiday", "2027-02-02", "2026-09-08T00:00:00Z", "collected").reason, "holiday-calendar-unknown");
  const broken = structuredClone(CALENDAR); broken.holidays.push(broken.holidays[0]);
  assert.throws(() => validateCalendar(broken), /duplicate-calendar-entry/);
});
test("temporary holidays do not leak backwards through their publication date or collection time", () => {
  const at = (time: string) => calendarFeatures(CALENDAR, "holiday", "2023-05-29", time, "dated-announcement");
  assert.equal(at("2023-05-01T09:00:00+09:00").x?.[0], 0);
  assert.equal(at("2023-05-02T23:59:59+09:00").x?.[0], 0);
  assert.equal(at("2023-05-03T00:00:00+09:00").x?.[0], 1);
  assert.equal(calendarFeatures(CALENDAR, "holiday", "2023-05-29", "2023-05-03T00:00:00+09:00", "collected").reason, "holiday-calendar-unknown");
  assert.equal(calendarFeatures(CALENDAR, "holiday", "2026-05-01", "2026-04-28T09:00:00+09:00", "dated-announcement").x?.[0], 0);
  assert.equal(calendarFeatures(CALENDAR, "holiday", "2026-05-01", "2026-04-30T09:00:00+09:00", "dated-announcement").x?.[0], 1);
});
test("unannounced festival dates and the 2027 expo are unknown, not zero", () => {
  assert.equal(calendarFeatures(CALENDAR, "festival", "2025-03-27", "2025-01-22T09:00:00+09:00", "dated-announcement").reason, "festival-calendar-unknown");
  assert.deepEqual(calendarFeatures(CALENDAR, "festival", "2025-03-27", "2025-01-23T09:00:00+09:00", "dated-announcement").x, [1, 0.25, 0]);
  assert.deepEqual(calendarFeatures(CALENDAR, "festival", "2025-03-30", "2025-01-23T09:00:00+09:00", "dated-announcement").x, [1, 1, 1]);
  assert.equal(calendarFeatures(CALENDAR, "combined", "2027-01-01", "2026-09-08T09:00:00+09:00", "collected").reason, "festival-calendar-unknown");
});
test("learned holiday effect comes from historical values; future targets cannot change a fitted model", () => {
  const holidays = new Set(CALENDAR.holidays.map((h) => h.date));
  const rows = observationsFromDataset(fixture("2023-01-01", "2025-12-31", "2026-09-07T00:00:00Z",
    (date) => 40_000 + (holidays.has(date) ? 80_000 : 0)));
  const model = makeCalendarTrainer(rows, CALENDAR, "holiday", 7)("2025-11-01")!;
  assert.ok(model.trainingSamples > 800);
  const coefficient = model.coefficients[model.featureNames.indexOf("public-holiday")];
  assert.ok(coefficient > 0.05, "holiday effect must actually be fitted from the fixture");
  const corruptedFuture = rows.map((r) => r.date > "2025-11-01" ? { ...r, value: 1e10 } : r);
  assert.deepEqual(makeCalendarTrainer(corruptedFuture, CALENDAR, "holiday", 7)("2025-11-01"), model);
  const holiday = predictCalendar(model, rows, CALENDAR, "2025-12-25", "2025-11-01", "2025-12-18T09:00:00+09:00", "dated-announcement");
  const ordinary = predictCalendar(model, rows, CALENDAR, "2025-12-18", "2025-11-01", "2025-12-11T09:00:00+09:00", "dated-announcement");
  assert.ok(holiday.value! > ordinary.value! + 40_000);
  assert.ok(model.inputIds.every((id) => id.slice(0, 10) <= "2025-11-01"));
  assert.equal(predictCalendar(model, rows, CALENDAR, "2027-02-02", "2025-11-01", "2026-09-08T00:00:00Z", "collected").value, null);
});
test("winter trial contains 13 disjoint windows and shared comparisons retain missing forecasts", () => {
  assert.equal(WINTER_WINDOWS.length, 13);
  const dates = WINTER_WINDOWS.flatMap((w) => daysBetween(w.start, w.end));
  assert.equal(new Set(dates).size, 52);
  assert.ok(dates.includes("2026-12-25") && dates.includes("2027-01-01"));
  const rows = [{ actual: 10, predictions: { B1: { value: 9, reason: null }, holiday: { value: 12, reason: null } } },
    { actual: 100, predictions: { B1: { value: 99, reason: null }, holiday: { value: null, reason: "holiday-calendar-unknown" } } }] as CalendarEvaluationRow[];
  const comparison = compareCalendarRows(rows, ["B1", "holiday"]);
  assert.equal(comparison.expected, 2); assert.equal(comparison.common, 1);
  assert.equal(comparison.methods.holiday.mae, 2); assert.equal(comparison.methods.holiday.available, 1);
  assert.equal(comparison.methods.B1.n, 1);
});
