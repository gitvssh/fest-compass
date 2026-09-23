// Display helpers for the existing-festival journey. Dates are calendar dates (YYYY-MM-DD), never instants.
export const WEEKDAY_SHORT = ["일", "월", "화", "수", "목", "금", "토"] as const;

export function weekdayOf(date: string): number { return new Date(`${date}T00:00:00Z`).getUTCDay(); }
export function shortDate(date: string): string { return `${Number(date.slice(5, 7))}.${Number(date.slice(8, 10))}`; }
export function dayWithWeekday(date: string): string { return `${shortDate(date)}(${WEEKDAY_SHORT[weekdayOf(date)]})`; }
export function fullDate(date: string): string { return `${date.slice(0, 4)}.${shortDate(date)}(${WEEKDAY_SHORT[weekdayOf(date)]})`; }
export function monthTitle(month: string): string { return `${month.slice(0, 4)}년 ${Number(month.slice(5, 7))}월`; }
export function daysBetween(start: string, end: string): number { return Math.round((Date.parse(end) - Date.parse(start)) / 86_400_000) + 1; }

/** `2025년 · 3.27–3.30 · 목–일 4일`, or the year with an unknown period. */
export function editionLabel(e: { year: number; start: string | null; end: string | null; days: number | null }): string {
  if (!e.start || !e.end) return `${e.year}년 · 개최일 미확인`;
  const days = e.days ?? daysBetween(e.start, e.end);
  return `${e.year}년 · ${shortDate(e.start)}–${shortDate(e.end)} · ${WEEKDAY_SHORT[weekdayOf(e.start)]}–${WEEKDAY_SHORT[weekdayOf(e.end)]} ${days}일`;
}
export function periodLabel(start: string | null, end: string | null): string {
  if (!start || !end) return "일정 미확인";
  return start === end ? fullDate(start) : `${fullDate(start)} ~ ${fullDate(end)}`;
}

export const number = (value: number, digits = 0) => value.toLocaleString("ko-KR", { maximumFractionDigits: digits });
/** Raw source values keep their decimals in tables; summaries are rounded by the server. */
export const rawNumber = (value: number) => value.toLocaleString("ko-KR", { maximumFractionDigits: 3 });

export function timeLabel(iso: string | null): string {
  if (!iso) return "확인 안 됨";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "확인 안 됨" : d.toLocaleString("ko-KR", { timeZone: "Asia/Seoul", year: "numeric", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
}
export function dateOnly(iso: string | null): string {
  if (!iso) return "확인 안 됨";
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso : timeLabel(iso);
}

/** Korean calendar date today (YYYY-MM-DD). */
export function koreaToday(now = new Date()): string { return new Date(now.getTime() + 9 * 3_600_000).toISOString().slice(0, 10); }
export function addMonth(month: string, n: number): string {
  const [y, m] = month.split("-").map(Number), total = y * 12 + (m - 1) + n;
  return `${String(Math.floor(total / 12)).padStart(4, "0")}-${String((total % 12) + 1).padStart(2, "0")}`;
}
export function monthRange(month: string): { start: string; end: string } {
  const [y, m] = month.split("-").map(Number);
  return { start: `${month}-01`, end: new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10) };
}
export const validMonth = (value: string | null | undefined): value is string => !!value && /^\d{4}-(0[1-9]|1[0-2])$/.test(value) && value >= "2000-01" && value <= "2035-12";
export const validDay = (value: string | null | undefined): value is string =>
  !!value && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
