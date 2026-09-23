import { validPoint } from "../comparison/distance";
import { datesBetween, weekday } from "./history";
import type { Resource } from "../region/types";
import type { EventsBlock, HolidaySummary, Range, ScheduleDay, ScheduleEvent, ScheduleSummary, SourceRef } from "./types";

// Shape of the reviewed holiday calendar (data/nonsan-calendar.json); coverage ranges are national holiday years.
export type HolidayCalendar = {
  version: string;
  holidayCoverage: { sourceId: string; start: string; end: string }[];
  holidays: { date: string; label: string; category: string; sourceId: string }[];
  sources: { id: string; url: string; publishedDate: string; collectedAt: string }[];
};

const covered = (date: string, cal: HolidayCalendar) => cal.holidayCoverage.some(c => c.start <= date && date <= c.end);

export function scheduleDays(range: Range, cal: HolidayCalendar): ScheduleDay[] {
  return datesBetween(range.start, range.end).map(date => {
    const w = weekday(date), known = covered(date, cal);
    return { date, weekday: w, weekend: w === 0 || w === 6, holidayKnown: known, holidays: known ? cal.holidays.filter(h => h.date === date).map(h => h.label) : [] };
  });
}

/** "No holiday" is only stated when the whole range lies inside a confirmed holiday calendar. */
export function holidaySummary(range: Range, cal: HolidayCalendar): HolidaySummary {
  const days = scheduleDays(range, cal), uncovered: Range[] = [];
  for (const d of days) if (!d.holidayKnown) {
    const last = uncovered.at(-1);
    if (last && datesBetween(last.end, d.date).length === 2) last.end = d.date; else uncovered.push({ start: d.date, end: d.date });
  }
  const coveredDays = days.filter(d => d.holidayKnown).length, dates = days.filter(d => d.holidays.length).map(d => ({ date: d.date, labels: d.holidays }));
  const status = coveredDays === days.length ? "complete" : coveredDays ? "partial" : "unknown";
  return { status, coveredDays, uncovered, dates, holidayDays: status === "complete" ? dates.length : null };
}

export function holidaySources(range: Range, cal: HolidayCalendar): SourceRef[] {
  const ids = new Set([...cal.holidayCoverage.filter(c => c.start <= range.end && c.end >= range.start).map(c => c.sourceId),
    ...cal.holidays.filter(h => h.date >= range.start && h.date <= range.end).map(h => h.sourceId)]);
  return cal.sources.filter(s => ids.has(s.id)).map(s => ({ title: s.id.startsWith("annual-") ? "공휴일 월력요항" : "공휴일 지정 공고", url: s.url, checkedAt: s.collectedAt, publishedAt: s.publishedDate }));
}

export function overlapDays(item: { start: string | null; end: string | null }, range: Range): number | null {
  if (!item.start || !item.end || item.end < item.start) return null;
  const start = item.start > range.start ? item.start : range.start, end = item.end < range.end ? item.end : range.end;
  return end < start ? 0 : datesBetween(start, end).length;
}

/** Registered rows keep "registered" (cancellation unknown); only an explicit cancellation marks "cancelled". */
export function scheduleEvents(items: (Resource & { cancelled?: boolean })[], range: Range): ScheduleEvent[] {
  return items.map(r => {
    const point = { latitude: r.latitude, longitude: r.longitude }, overlap = overlapDays(r, range);
    return { id: r.id, title: r.title, address: r.address, start: r.start, end: r.end, datesKnown: overlap !== null, scheduleStatus: r.cancelled === true ? "cancelled" as const : "registered" as const,
      point: validPoint(point) ? point : null, modifiedAt: r.modifiedAt, overlapDays: overlap };
  }).sort((a, b) => (a.start ?? "9999-12-31").localeCompare(b.start ?? "9999-12-31") || a.title.localeCompare(b.title, "ko-KR") || a.id.localeCompare(b.id));
}

/** Confirmed overlap: dated, not cancelled, at least one shared day. */
export const confirmedOverlap = (e: Pick<ScheduleEvent, "start" | "end" | "scheduleStatus">, range: Range) => e.scheduleStatus !== "cancelled" && (overlapDays(e, range) ?? 0) > 0;

/**
 * Candidate/calendar facts only — no forecast or score. Event counts and overlaps appear only when the
 * events block was confirmed for exactly this full range; a month-only query never stands in for a longer candidate.
 */
export function summarizeSchedule(range: Range, cal: HolidayCalendar, events: Pick<EventsBlock, "status" | "range"> & { items: Pick<ScheduleEvent, "start" | "end" | "scheduleStatus">[] }): ScheduleSummary {
  const days = scheduleDays(range, cal), full = (events.status === "complete" || events.status === "empty") && events.range.start === range.start && events.range.end === range.end;
  return { totalDays: days.length, weekendDays: days.filter(d => d.weekend).length, holidays: holidaySummary(range, cal),
    events: { status: full ? events.status : events.status === "unavailable" || events.status === "not-requested" ? events.status : "not-requested",
      count: full ? events.items.length : null, overlapping: full ? events.items.filter(e => confirmedOverlap(e, range)).length : null,
      cancelled: full ? events.items.filter(e => e.scheduleStatus === "cancelled").length : null, undated: full ? events.items.filter(e => overlapDays(e, range) === null).length : null } };
}
