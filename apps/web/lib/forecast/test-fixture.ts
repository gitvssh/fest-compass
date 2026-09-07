import { daysBetween, hash, HISTORY_SOURCE, monthWindows, type HistoryDataset } from "../kto/history";

/** Synthetic pagination and values, never published as actual observations. */
export function fixture(start: string, end: string, fetchedAt: string, value: (date: string, i: number) => number | null = (_, i) => 40_000 + i * 3): HistoryDataset {
  const values = new Map(daysBetween(start, end).map((date, i) => [date, value(date, i)]));
  const pages = monthWindows(start, end).map((w) => {
    const points = daysBetween(w.start, w.end).map((date) => values.get(date)), count = points.filter((v) => v !== null).length * 3;
    return { schemaVersion: 1 as const, ...w, pageNo: 1, pageSize: 10_000, totalCount: count, rowCount: count, fetchedAt, bodyHash: hash(JSON.stringify({ w, fetchedAt, points })) };
  });
  const days = [...values].map(([date, v]) => {
    const page = pages.find((p) => p.start <= date && p.end >= date)!;
    return { date, quality: v === null ? "missing" as const : "complete" as const, issues: v === null ? ["no-rows"] : [],
      values: { "1": v === null ? null : 1, "2": v, "3": v === null ? null : 3 }, sourcePages: v === null ? [] : [page.bodyHash] };
  });
  const content = { source: HISTORY_SOURCE, region: { code: "44230" as const, name: "논산시" as const }, sourcePublishedAt: null, range: { start, end }, pages, days };
  return { schemaVersion: 1, snapshotId: hash(JSON.stringify(content)), generatedAt: fetchedAt, ...content,
    quality: { expectedDays: days.length, completeDays: days.filter((d) => d.quality === "complete").length,
      missingDates: days.filter((d) => d.quality === "missing").map((d) => d.date), invalidDates: [] } };
}
