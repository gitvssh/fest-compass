import test from "node:test";
import assert from "node:assert/strict";
import { addMonths, clip, eventMonths, eventsOn, initialMonth, koreaDate, monthDays, monthForSelection, monthInRange, monthLabel, monthsInRange, nextMonthView, type CalendarItem } from "./calendar";

const range = { start: "2026-02-15", end: "2026-04-10" };
const a: CalendarItem = { id: "1", title: "A", start: "2026-01-28", end: "2026-02-20" };
const b: CalendarItem = { id: "2", title: "B", start: "2026-03-30", end: "2026-04-02" };
const base = { range, items: [a, b], status: "complete" as const, today: "2026-09-23" };

test("months and weeks are computed from date strings in UTC", () => {
  assert.equal(addMonths("2025-12", 1), "2026-01"); assert.equal(addMonths("2026-01", -1), "2025-12");
  assert.deepEqual(monthsInRange(range), ["2026-02", "2026-03", "2026-04"]);
  assert.equal(monthLabel("2026-03"), "2026년 3월");
  const feb = monthDays("2026-02");
  assert.equal(feb[0].indexOf("2026-02-01"), 6); // 2026-02-01 is a Sunday; weeks start on Monday.
  assert.equal(feb.flat().filter(Boolean).length, 28);
  assert.ok(feb.every(w => w.length === 7));
  assert.equal(monthDays("2024-02").flat().filter(Boolean).length, 29);
  assert.equal(koreaDate(new Date("2026-09-30T15:30:00Z")), "2026-10-01");
});

test("days outside the applied range never show events", () => {
  assert.deepEqual(eventsOn([a], "2026-02-14", range), []);
  assert.deepEqual(eventsOn([a], "2026-02-15", range).map(i => i.id), ["1"]);
  assert.deepEqual(eventsOn([b], "2026-04-02", range).map(i => i.id), ["2"]);
  assert.deepEqual(eventsOn([{ ...b, end: "2026-04-20" }], "2026-04-11", range), []);
  assert.deepEqual(clip(a, range), { start: "2026-02-15", end: "2026-02-20" });
  assert.equal(clip({ ...a, start: null }, range), null);
  assert.deepEqual(eventMonths([a, b], range), ["2026-02", "2026-03", "2026-04"]);
  assert.equal(monthInRange("2026-01", range), false); assert.equal(monthInRange("2026-13", range), false);
});

test("a valid address month inside the range is kept even without events", () => {
  assert.equal(initialMonth({ ...base, urlMonth: "2026-03", items: [a] }), "2026-03");
  assert.equal(initialMonth({ ...base, urlMonth: "2026-06" }), "2026-02");
  assert.equal(initialMonth({ ...base, urlMonth: "bad" }), "2026-02");
});

test("a restored selection opens its first month inside the range", () => {
  assert.equal(initialMonth({ ...base, restoredId: "2" }), "2026-03");
  assert.equal(initialMonth({ ...base, restoredId: "missing" }), "2026-02");
});

test("the current month opens when it has events, otherwise the nearest later then earlier event month", () => {
  const year = { start: "2026-01-01", end: "2026-12-31" };
  const may: CalendarItem = { id: "m", title: "M", start: "2026-05-01", end: "2026-05-03" }, oct: CalendarItem = { id: "o", title: "O", start: "2026-10-01", end: "2026-10-02" };
  assert.equal(initialMonth({ range: year, items: [may, { ...oct, start: "2026-08-30", end: "2026-09-02" }], status: "complete", today: "2026-09-23" }), "2026-09");
  assert.equal(initialMonth({ range: year, items: [may, oct], status: "complete", today: "2026-09-23" }), "2026-10");
  assert.equal(initialMonth({ range: year, items: [may], status: "complete", today: "2026-09-23" }), "2026-05");
});

test("a past range opens the first month with events, clipped to the range start", () => {
  const past = { start: "2024-01-01", end: "2024-12-31" };
  assert.equal(initialMonth({ range: past, items: [{ id: "x", title: "X", start: "2024-05-10", end: "2024-05-12" }, { id: "y", title: "Y", start: "2024-08-01", end: "2024-08-02" }], status: "complete", today: "2026-09-23" }), "2024-05");
  assert.equal(initialMonth({ range: past, items: [{ id: "z", title: "Z", start: "2023-12-20", end: "2024-01-05" }], status: "complete", today: "2026-09-23" }), "2024-01");
});

test("an empty result opens this month inside the range, otherwise the query start month", () => {
  assert.equal(initialMonth({ range, items: [], status: "empty", today: "2026-09-23" }), "2026-02");
  assert.equal(initialMonth({ range: { start: "2026-01-01", end: "2026-12-31" }, items: [], status: "empty", today: "2026-09-23" }), "2026-09");
});

test("a chosen month survives a reload inside the range and is decided again outside it", () => {
  const chosen = { month: "2026-04", chosen: true };
  assert.equal(nextMonthView(chosen, base), chosen);
  assert.deepEqual(nextMonthView(chosen, { ...base, range: { start: "2026-02-01", end: "2026-03-31" } }), { month: "2026-02", chosen: false });
  assert.deepEqual(nextMonthView({ month: "2026-04", chosen: false }, base), { month: "2026-02", chosen: false });
  assert.deepEqual(nextMonthView(null, { ...base, urlMonth: "2026-03" }), { month: "2026-03", chosen: true });
});

test("selecting an event outside the visible month moves to its first month; otherwise the month stays", () => {
  assert.equal(monthForSelection("2026-04", a, range), "2026-02");
  assert.equal(monthForSelection("2026-04", b, range), "2026-04");
  assert.equal(monthForSelection("2026-03", b, range), "2026-03");
});
