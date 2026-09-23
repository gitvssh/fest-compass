import { datesBetween, weekday } from "../existing/history";
import type { DailyValue } from "../existing/types";
import type { WeekdayBlock, WeekdayMean } from "./types";

// Calendar order Monday→Sunday (getUTCDay numbering). Order is presentation only, never a ranking.
export const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;
export const WEEKDAY_LABELS: Record<number, string> = { 0: "일", 1: "월", 2: "화", 3: "수", 4: "목", 5: "금", 6: "토" };
const valid = (v: number | null | undefined): v is number => typeof v === "number" && Number.isFinite(v) && v >= 0;

/**
 * Weekday daily means over the selected calendar year from the SAME daily values as the monthly view.
 * A true 0 is observed; a missing/invalid day stays missing and is never filled. The yearly weekday means exist only
 * when every day of the year is observed; with any missing day all seven are withheld (counts and months stay).
 */
export function weekdayMeans(daily: Pick<DailyValue, "date" | "value">[], year: number): WeekdayBlock {
  const byDate = new Map(daily.map(d => [d.date, d.value])), dates = datesBetween(`${year}-01-01`, `${year}-12-31`);
  const yearComplete = dates.every(d => valid(byDate.get(d)));
  const items: WeekdayMean[] = WEEKDAY_ORDER.map(w => {
    const own = dates.filter(d => weekday(d) === w), observed = own.filter(d => valid(byDate.get(d))), values = observed.map(d => byDate.get(d)!);
    const sum = yearComplete ? values.reduce((s, v) => s + v, 0) : null, mean = sum === null ? null : sum / own.length;
    const max = yearComplete ? Math.max(...values) : null;
    return { weekday: w, label: WEEKDAY_LABELS[w], days: own.length, observedDays: observed.length, missingDays: own.length - observed.length,
      zeroDays: values.filter(v => v === 0).length, missingDates: own.filter(d => !valid(byDate.get(d))),
      sum, mean, rounded: mean === null ? null : Math.round(mean), peak: max === null ? null : { value: max, dates: own.filter(d => byDate.get(d) === max) },
      coverage: observed.length === own.length ? "complete" : observed.length ? "partial" : "none" };
  });
  return { status: yearComplete ? "complete" : items.some(i => i.observedDays > 0) ? "incomplete-year" : "none", yearComplete, items };
}
