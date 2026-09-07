import manifest from "../../data/nonsan-calendar.json";
import { daysBetween, hash, shiftDay } from "../kto/history";

export type Calendar = typeof manifest;
export const CALENDAR: Calendar = manifest;
export type CalendarMode = "dated-announcement" | "collected";
export type CalendarCandidate = "holiday" | "festival" | "combined";
export const calendarHash = (calendar: Calendar) => hash(JSON.stringify(calendar));
export const knownAfter = (source: Calendar["sources"][number]) => `${shiftDay(source.publishedDate, 1)}T00:00:00+09:00`;
const day = (date: string) => /^\d{4}-\d{2}-\d{2}$/.test(date) && shiftDay(date, 0) === date;
export function validateCalendar(calendar: Calendar) {
  if (calendar.schemaVersion !== 1 || !calendar.version || !Array.isArray(calendar.sources)
    || new Set(calendar.sources.map((s) => s.id)).size !== calendar.sources.length) throw new Error("invalid-calendar");
  const sources = new Set(calendar.sources.map((s) => s.id));
  for (const source of calendar.sources) {
    if (source.precision !== "day" || !day(source.publishedDate) || !Number.isFinite(Date.parse(source.collectedAt))
      || Date.parse(knownAfter(source)) > Date.parse(source.collectedAt) || !/^[a-f0-9]{64}$/.test(source.contentHash)
      || !Number.isInteger(source.bytes) || source.bytes < 1) throw new Error("invalid-calendar-source");
    for (const raw of [source.url, source.contentUrl]) {
      const url = new URL(raw);
      if (url.protocol !== "https:" || url.username || url.password) throw new Error("invalid-calendar-source");
    }
  }
  for (const range of [...calendar.holidayCoverage, ...calendar.festivals]) {
    if (!sources.has(range.sourceId) || !day(range.start) || !day(range.end) || range.start > range.end) throw new Error("invalid-calendar-range");
  }
  if (new Set(calendar.holidays.map((h) => h.date)).size !== calendar.holidays.length
    || new Set(calendar.festivals.map((f) => f.year)).size !== calendar.festivals.length) throw new Error("duplicate-calendar-entry");
  for (const holiday of calendar.holidays) {
    if (!sources.has(holiday.sourceId) || !day(holiday.date) || !["public", "lunar"].includes(holiday.category)
      || !calendar.holidayCoverage.some((c) => c.start <= holiday.date && holiday.date <= c.end)) throw new Error("invalid-calendar-holiday");
  }
  for (const festival of calendar.festivals) {
    if (festival.start.slice(0, 4) !== String(festival.year) || festival.end.slice(0, 4) !== String(festival.year)
      || daysBetween(festival.start, festival.end).length > 5) throw new Error("invalid-calendar-festival");
  }
}

export function calendarFeatures(calendar: Calendar, candidate: CalendarCandidate, target: string, issuedAt: string, mode: CalendarMode) {
  if (!day(target) || !Number.isFinite(Date.parse(issuedAt))) throw new Error("invalid-calendar-query");
  const available = new Set(calendar.sources.filter((s) => Date.parse(knownAfter(s)) <= Date.parse(issuedAt)
    && (mode === "dated-announcement" || Date.parse(s.collectedAt) <= Date.parse(issuedAt))).map((s) => s.id));
  const x: number[] = [], sourceIds = new Set<string>();
  if (candidate !== "festival") {
    const dates = [target, shiftDay(target, -1), shiftDay(target, 1)];
    for (const date of dates) {
      const coverage = calendar.holidayCoverage.find((c) => c.start <= date && date <= c.end && available.has(c.sourceId));
      if (!coverage) return { x: null, sourceIds: [], reason: "holiday-calendar-unknown" };
      sourceIds.add(coverage.sourceId);
    }
    const holidays = calendar.holidays.filter((h) => dates.includes(h.date) && available.has(h.sourceId));
    holidays.forEach((h) => sourceIds.add(h.sourceId));
    x.push(Number(holidays.some((h) => h.date === target)), Number(holidays.some((h) => h.date === target && h.category === "lunar")),
      Number(holidays.some((h) => h.date === dates[1])), Number(holidays.some((h) => h.date === dates[2])));
  }
  if (candidate !== "holiday") {
    const festival = calendar.festivals.find((f) => f.year === Number(target.slice(0, 4)) && available.has(f.sourceId));
    if (!festival) return { x: null, sourceIds: [], reason: "festival-calendar-unknown" };
    sourceIds.add(festival.sourceId);
    const eventDays = daysBetween(festival.start, festival.end), order = eventDays.indexOf(target) + 1;
    const weekday = new Date(`${target}T00:00:00Z`).getUTCDay();
    x.push(Number(order > 0), order / eventDays.length, Number(order > 0 && [0, 6].includes(weekday)));
  }
  return { x, sourceIds: [...sourceIds].sort(), reason: null };
}

export const HOLIDAY_FEATURES = ["public-holiday", "lunar-holiday", "after-public-holiday", "before-public-holiday"];
export const FESTIVAL_FEATURES = ["strawberry-festival", "festival-progress", "festival-weekend"];
export const extraFeatureNames = (candidate: CalendarCandidate) => [
  ...(candidate !== "festival" ? HOLIDAY_FEATURES : []), ...(candidate !== "holiday" ? FESTIVAL_FEATURES : []),
];
validateCalendar(CALENDAR);
