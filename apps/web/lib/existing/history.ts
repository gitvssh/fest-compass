import type { DailyValue, DayPoint, EditionHistory, EditionState, MonthMean, PeriodSummary, PublicSource, Range, SourceRef, YearCoverage } from "./types";

// Daily region observations: a real 0 stays 0; a missing or invalid day is null and is never filled.
// collectedAt is the source time of the row that decided the day (also for an explicit latest "missing" row).
export type Observed = { date: string; value: number | null; collectedAt: string | null };
/** Canonical definition of the regional daily source the journey reads (region-history + expanded + runtime). */
export const VISIT_DEFINITION = { metric: "시군구 일별 외지인 방문", unit: "명 (통신 기반 추정)", method: "KTO-locgoRegnVisitrDDList-touDivCd2" } as const;
export type LinkedVisits = { metric: string; unit: string; method: string; regionCode: string; points: { date: string; value: number | null }[] };
export type EditionInput = { editionId: string; year: number; start: string | null; end: string | null; status: string; source: SourceRef; regionCode: string; linked: LinkedVisits | null };
export type WindowOptions = { before?: number; after?: number; window?: Range | null; visits?: SourceRef | null };

const DAY = 86_400_000;
export const PAD_DEFAULT = 7, PAD_MAX = 30, CUSTOM_WINDOW_MAX = 120;
export const WITHHELD_MESSAGES: Record<Exclude<EditionState, "available">, string> = {
  "no-dates": "개최일이 확인되지 않은 회차예요",
  "no-history": "이 기간의 방문 자료가 없어요",
  cancelled: "취소된 회차라 개최기간 평균을 만들지 않아요",
  incompatible: "지역·지표 정의가 달라 같은 기준으로 비교하지 않아요",
};
export const shiftDate = (date: string, n: number) => new Date(Date.parse(`${date}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);
export const weekday = (date: string) => new Date(`${date}T00:00:00Z`).getUTCDay();
export const daysInMonth = (month: string) => { const [y, m] = month.split("-").map(Number); return new Date(Date.UTC(y, m, 0)).getUTCDate(); };
export function datesBetween(start: string, end: string): string[] {
  if (end < start) return [];
  return Array.from({ length: Math.round((Date.parse(end) - Date.parse(start)) / DAY) + 1 }, (_, i) => shiftDate(start, i));
}
const valid = (v: number | null | undefined): v is number => typeof v === "number" && Number.isFinite(v) && v >= 0;
const dated = (e: Pick<EditionInput, "start" | "end">) => !!e.start && !!e.end && e.end >= e.start;

/** Default chart window: `before` days before the start through `after` days after the END (inclusive). */
export function editionWindow(start: string, end: string, before = PAD_DEFAULT, after = PAD_DEFAULT): Range {
  return { start: shiftDate(start, -before), end: shiftDate(end, after) };
}
/** Dates the server must read: chart window ∪ original festival period (the summary never depends on the window). */
export function loadRange(e: Pick<EditionInput, "start" | "end">, o: WindowOptions = {}): Range | null {
  if (!dated(e)) return null;
  const w = o.window ?? editionWindow(e.start!, e.end!, o.before, o.after);
  return { start: w.start < e.start! ? w.start : e.start!, end: w.end > e.end! ? w.end : e.end! };
}

/** Festival-period daily mean over the ORIGINAL festival days; withheld unless every day has a value. */
export function periodSummary(values: ReadonlyMap<string, number | null>, start: string | null, end: string | null): PeriodSummary {
  if (!start || !end || end < start) return { status: "no-dates" };
  const days = datesBetween(start, end), observed = days.filter(d => valid(values.get(d)));
  if (!observed.length) return { status: "no-history" };
  if (observed.length !== days.length) return { status: "incomplete", denominator: days.length, observedDays: observed.length, missingDates: days.filter(d => !valid(values.get(d))) };
  const list = days.map(d => values.get(d)!), numerator = list.reduce((s, v) => s + v, 0), mean = numerator / days.length, max = Math.max(...list);
  return { status: "available", numerator, denominator: days.length, mean, rounded: Math.round(mean), peak: { value: max, dates: days.filter(d => values.get(d) === max) } };
}

/**
 * The edition's own visit link must share the canonical regional DEFINITION (comparison.visitReason pattern).
 * Values are not compared: a newer collection of the same definition may correct a number or report a day missing,
 * and the latest collected row is the one shown.
 */
export function linkedVisitsCompatible(e: Pick<EditionInput, "regionCode" | "linked">): boolean {
  const l = e.linked;
  return !l || (l.metric === VISIT_DEFINITION.metric && l.unit === VISIT_DEFINITION.unit && l.method === VISIT_DEFINITION.method && l.regionCode === e.regionCode);
}

export function editionHistory(e: EditionInput, observations: Observed[], o: WindowOptions = {}): EditionHistory {
  const hasDates = dated(e), days = hasDates ? datesBetween(e.start!, e.end!).length : null;
  const base = { editionId: e.editionId, year: e.year, start: hasDates ? e.start : null, end: hasDates ? e.end : null, days, status: e.status };
  const withheld = (state: Exclude<EditionState, "available">, extra: Partial<EditionHistory> = {}): EditionHistory => ({
    ...base, state, withheld: { reason: state, message: WITHHELD_MESSAGES[state] }, window: null, windowSource: null, points: [],
    summary: { status: state }, comparable: false, source: { edition: e.source, visits: null }, ...extra });
  if (!linkedVisitsCompatible(e)) return withheld("incompatible");
  const cancelled = e.status.trim() === "취소";
  if (!hasDates) return withheld(cancelled ? "cancelled" : "no-dates");
  const window = o.window ?? editionWindow(e.start!, e.end!, o.before, o.after), byDate = new Map(observations.map(x => [x.date, x]));
  const points: DayPoint[] = datesBetween(window.start, window.end).map(date => {
    const x = byDate.get(date);
    return { date, weekday: weekday(date), inFestival: !cancelled && date >= e.start! && date <= e.end!, value: valid(x?.value) ? x!.value : null, collectedAt: x?.collectedAt ?? null };
  });
  // Source time over everything the answer rests on: chart window ∪ original festival period.
  const collectedAt = observations.filter(x => (x.date >= window.start && x.date <= window.end) || (x.date >= e.start! && x.date <= e.end!))
    .map(x => x.collectedAt).filter((v): v is string => !!v).sort().at(-1) ?? null;
  const visits: PublicSource | null = o.visits && collectedAt ? { ...o.visits, collectedAt } : null;
  const windowSource = o.window ? "custom" as const : "padding" as const;
  if (cancelled) return withheld("cancelled", { window, windowSource, points, source: { edition: e.source, visits } });
  const summary = periodSummary(new Map(observations.map(x => [x.date, valid(x.value) ? x.value : null])), e.start, e.end);
  if (summary.status === "no-history" && !points.some(p => p.value !== null)) return withheld("no-history", { window, windowSource, points, source: { edition: e.source, visits } });
  return { ...base, state: "available", withheld: null, window, windowSource, points, summary, comparable: true, source: { edition: e.source, visits } };
}

/** Common Y maximum across the separate charts; only editions shown on the shared axis count. */
export function sharedYMax(editions: Pick<EditionHistory, "points" | "state">[]): number | null {
  const values = editions.filter(e => e.state === "available").flatMap(e => e.points.map(p => p.value)).filter(valid);
  return values.length ? Math.max(...values) : null;
}

/** Monthly daily mean = month sum ÷ calendar days, only when every day of the month is observed. */
export function monthlyMeans(daily: Pick<Observed, "date" | "value">[], year: number): MonthMean[] {
  const byDate = new Map(daily.map(d => [d.date, d.value]));
  return Array.from({ length: 12 }, (_, i) => {
    const month = `${year}-${String(i + 1).padStart(2, "0")}`, days = daysInMonth(month);
    const values = Array.from({ length: days }, (_, d) => byDate.get(`${month}-${String(d + 1).padStart(2, "0")}`)).filter(valid);
    const observedDays = values.length, complete = observedDays === days, sum = complete ? values.reduce((s, v) => s + v, 0) : null, mean = sum === null ? null : sum / days;
    return { month, days, observedDays, missingDays: days - observedDays, zeroDays: values.filter(v => v === 0).length, sum, mean, rounded: mean === null ? null : Math.round(mean),
      status: complete ? "complete" : observedDays ? "partial" : "none" };
  });
}

export function yearCoverage(daily: Pick<Observed, "date" | "value">[]): YearCoverage[] {
  const counts = new Map<number, number>();
  for (const d of daily) if (valid(d.value)) counts.set(Number(d.date.slice(0, 4)), (counts.get(Number(d.date.slice(0, 4))) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => a[0] - b[0]).map(([year, observedDays]) => {
    const days = datesBetween(`${year}-01-01`, `${year}-12-31`).length;
    return { year, days, observedDays, complete: observedDays === days };
  });
}
/** Latest complete year; a partial latest year is never chosen as the default. */
export const defaultYear = (years: YearCoverage[]) => years.filter(y => y.complete).at(-1)?.year ?? null;

export function dailyValues(daily: Pick<Observed, "date" | "value">[], start: string, end: string): DailyValue[] {
  const byDate = new Map(daily.map(d => [d.date, d.value]));
  return datesBetween(start, end).map(date => { const v = byDate.get(date); return { date, weekday: weekday(date), value: valid(v) ? v : null }; });
}
