import type { Resource } from "./types";
export type Range = { start: string; end: string };
export type CalendarItem = Pick<Resource, "id" | "title" | "start" | "end">;
export type MonthInput = { range: Range; items: CalendarItem[]; status: "complete" | "empty" | "unavailable"; today: string; urlMonth?: string | null; restoredId?: string | null };
export type MonthView = { month: string; chosen: boolean };
const DAY = 86_400_000;
export const WEEKDAYS = ["월", "화", "수", "목", "금", "토", "일"] as const;
export const monthOf = (date: string) => date.slice(0, 7);
export function validMonth(value: unknown): value is string { return typeof value === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(value); }
export function addMonths(month: string, n: number): string {
  const [y, m] = month.split("-").map(Number), total = y * 12 + m - 1 + n;
  return `${String(Math.floor(total / 12)).padStart(4, "0")}-${String((total % 12) + 1).padStart(2, "0")}`;
}
export function monthInRange(month: string | null | undefined, range: Range): month is string { return validMonth(month) && month >= monthOf(range.start) && month <= monthOf(range.end); }
export function monthsInRange(range: Range): string[] {
  const months: string[] = [];
  for (let m = monthOf(range.start); m <= monthOf(range.end); m = addMonths(m, 1)) months.push(m);
  return months;
}
export function monthLabel(month: string): string { const [y, m] = month.split("-").map(Number); return `${y}년 ${m}월`; }
export function koreaDate(now = new Date()): string { return new Date(now.getTime() + 9 * 3_600_000).toISOString().slice(0, 10); }
// The part of an event inside the applied range; events outside it or without dates never reach the calendar.
export function clip(item: CalendarItem, range: Range): Range | null {
  if (!item.start || !item.end || item.end < item.start) return null;
  const start = item.start > range.start ? item.start : range.start, end = item.end < range.end ? item.end : range.end;
  return start <= end ? { start, end } : null;
}
export function eventMonths(items: CalendarItem[], range: Range): string[] {
  const months = new Set<string>();
  for (const item of items) { const c = clip(item, range); if (c) for (let m = monthOf(c.start); m <= monthOf(c.end); m = addMonths(m, 1)) months.add(m); }
  return [...months].sort();
}
export function firstMonth(item: CalendarItem, range: Range): string | null { const c = clip(item, range); return c ? monthOf(c.start) : null; }
export function touchesMonth(item: CalendarItem, month: string, range: Range): boolean { const c = clip(item, range); return !!c && monthOf(c.start) <= month && monthOf(c.end) >= month; }
export function inQueryRange(date: string, range: Range): boolean { return date >= range.start && date <= range.end; }
export function eventsOn(items: CalendarItem[], date: string, range: Range): CalendarItem[] {
  if (!inQueryRange(date, range)) return [];
  return items.filter(i => i.start && i.end && i.start <= date && i.end >= date);
}
// Monday-first weeks; null pads the days of neighbouring months.
export function monthDays(month: string): (string | null)[][] {
  const [y, m] = month.split("-").map(Number), first = Date.UTC(y, m - 1, 1), count = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const cells: (string | null)[] = [...Array<null>((new Date(first).getUTCDay() + 6) % 7).fill(null), ...Array.from({ length: count }, (_, i) => new Date(first + i * DAY).toISOString().slice(0, 10))];
  while (cells.length % 7) cells.push(null);
  return Array.from({ length: cells.length / 7 }, (_, w) => cells.slice(w * 7, w * 7 + 7));
}
// Address month → restored selection → this month with events → nearest later (else earlier) event month → first event month → this month or query start.
export function initialMonth({ range, items, status, today, urlMonth, restoredId }: MonthInput): string {
  if (monthInRange(urlMonth, range)) return urlMonth;
  const restored = restoredId ? items.find(i => i.id === restoredId) : undefined, restoredMonth = restored ? firstMonth(restored, range) : null;
  if (restoredMonth) return restoredMonth;
  const current = monthOf(today), months = status === "complete" ? eventMonths(items, range) : [];
  if (!months.length) return monthInRange(current, range) ? current : monthOf(range.start);
  if (!monthInRange(current, range)) return months[0];
  if (months.includes(current)) return current;
  return months.find(m => m > current) ?? months.filter(m => m < current).at(-1)!;
}
// A month the user chose stays while it remains inside the applied range; otherwise the initial rule decides again.
export function nextMonthView(prev: MonthView | null, input: MonthInput): MonthView {
  if (prev?.chosen && monthInRange(prev.month, input.range)) return prev;
  return { month: initialMonth(input), chosen: monthInRange(input.urlMonth, input.range) };
}
export function monthForSelection(month: string, item: CalendarItem, range: Range): string {
  return touchesMonth(item, month, range) ? month : firstMonth(item, range) ?? month;
}
