import type { DayPoint } from "./types";

/**
 * Mean of the shown days on one side of the festival period. Only a side whose every shown day has a value gets a
 * mean; a side with a missing day reports how many days were observed and no mean (never a gap filled with zero).
 */
export type SideMean = { days: number; observedDays: number; mean: number | null; rounded: number | null };

function sideMean(points: DayPoint[]): SideMean | null {
  if (!points.length) return null;
  const values = points.map(p => p.value).filter((v): v is number => v !== null);
  const complete = values.length === points.length;
  const mean = complete ? values.reduce((sum, v) => sum + v, 0) / values.length : null;
  return { days: points.length, observedDays: values.length, mean, rounded: mean === null ? null : Math.round(mean) };
}

/** Days shown before the start and after the end of an edition (the chart window), each averaged on its own. */
export function sideMeans(points: DayPoint[], start: string | null, end: string | null): { before: SideMean | null; after: SideMean | null } {
  if (!start || !end) return { before: null, after: null };
  return { before: sideMean(points.filter(p => p.date < start)), after: sideMean(points.filter(p => p.date > end)) };
}
