import { daysBetween, hash, HISTORY_SOURCE, monthWindows, type HistoryDataset, type HistoryDay } from "../kto/history";
import { validDate } from "../kto/probe";
import type { Observation } from "./model";

export const koreanDay = (timestamp: string) => new Date(Date.parse(timestamp) + 9 * 3_600_000).toISOString().slice(0, 10);
export const dayDistance = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
const timestamp = (value: unknown): value is string => typeof value === "string" && /^\d{4}-\d\d-\d\dT.*(?:Z|[+-]\d\d:\d\d)$/.test(value) && Number.isFinite(Date.parse(value));
const digest = (value: unknown): value is string => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);

/** Validate files on import, including missing dates. A hash alone is not a data-quality check. */
export function validateHistoryDataset(data: HistoryDataset): void {
  if (data.schemaVersion !== 1 || data.source !== HISTORY_SOURCE || data.region?.code !== "44230" || data.region.name !== "논산시"
    || data.sourcePublishedAt !== null || !timestamp(data.generatedAt) || !digest(data.snapshotId)
    || !Array.isArray(data.pages) || !Array.isArray(data.days)) throw new Error("invalid-history-envelope");
  const content = { source: data.source, region: data.region, sourcePublishedAt: data.sourcePublishedAt, range: data.range, pages: data.pages, days: data.days };
  if (hash(JSON.stringify(content)) !== data.snapshotId) throw new Error("history-hash-mismatch");
  const expected = daysBetween(data.range.start, data.range.end);
  if (expected.length > 1_500 || data.days.length !== expected.length || data.range.end >= koreanDay(data.generatedAt)) throw new Error("invalid-history-coverage");
  for (const window of monthWindows(data.range.start, data.range.end)) {
    const pages = data.pages.filter((p) => p.start === window.start && p.end === window.end).sort((a, b) => a.pageNo - b.pageNo);
    const first = pages[0];
    if (!first || !Number.isSafeInteger(first.pageSize) || first.pageSize < 1 || first.pageSize > 10_000
      || !Number.isSafeInteger(first.totalCount) || first.totalCount < 0 || first.totalCount > 100_000
      || pages.length !== Math.max(1, Math.ceil(first.totalCount / first.pageSize))) throw new Error("invalid-history-pages");
    for (const [i, page] of pages.entries()) {
      const rows = Math.max(0, Math.min(first.pageSize, first.totalCount - i * first.pageSize));
      if (page.schemaVersion !== 1 || page.pageNo !== i + 1 || page.totalCount !== first.totalCount || page.rowCount !== rows
        || (page.pageSize !== first.pageSize && !(i === pages.length - 1 && page.pageSize === rows))
        || !digest(page.bodyHash) || !timestamp(page.fetchedAt) || Date.parse(page.fetchedAt) > Date.parse(data.generatedAt)
        || page.end >= koreanDay(page.fetchedAt)) throw new Error("invalid-history-pages");
    }
  }
  if (data.pages.some((p) => p.start < data.range.start || p.end > data.range.end
    || !monthWindows(data.range.start, data.range.end).some((w) => w.start === p.start && w.end === p.end))) throw new Error("unexpected-history-page");
  const pageMap = new Map(data.pages.map((p) => [p.bodyHash, p]));
  for (const [i, day] of data.days.entries()) {
    if (day.date !== expected[i] || !["complete", "missing", "invalid"].includes(day.quality)
      || !Array.isArray(day.sourcePages) || new Set(day.sourcePages).size !== day.sourcePages.length || !Array.isArray(day.issues)) throw new Error("invalid-history-day");
    if (day.quality === "complete" && (!day.sourcePages.length || day.issues.length)) throw new Error("invalid-history-day");
    for (const type of ["1", "2", "3"]) {
      const value = day.values?.[type];
      if (day.quality === "complete" ? typeof value !== "number" || !Number.isFinite(value) || value < 0 : value !== null) throw new Error("invalid-history-value");
    }
    for (const id of day.sourcePages) {
      const page = pageMap.get(id);
      if (!page || day.date < page.start || day.date > page.end || day.date >= koreanDay(page.fetchedAt)) throw new Error("invalid-history-provenance");
    }
  }
  const quality = { expectedDays: expected.length, completeDays: data.days.filter((d) => d.quality === "complete").length,
    missingDates: data.days.filter((d) => d.quality === "missing").map((d) => d.date), invalidDates: data.days.filter((d) => d.quality === "invalid").map((d) => d.date) };
  if (JSON.stringify(quality) !== JSON.stringify(data.quality)) throw new Error("history-quality-mismatch");
}

export type Vintage = { id: string; snapshotId: string; date: string; quality: HistoryDay["quality"]; value: number | null;
  observedAt: string; collectedAt: string; sourcePublishedAt: null };
export function snapshotVintages(data: HistoryDataset): Vintage[] {
  validateHistoryDataset(data);
  return data.days.map((day) => ({ id: `${data.snapshotId}/${day.date}/2`, snapshotId: data.snapshotId, date: day.date,
    quality: day.quality, value: day.values["2"], observedAt: new Date(data.generatedAt).toISOString(),
    // The complete window, including a normal empty result, must be collected before it is usable.
    collectedAt: new Date(Math.max(...data.pages.filter((p) => p.start <= day.date && p.end >= day.date).map((p) => Date.parse(p.fetchedAt)))).toISOString(), sourcePublishedAt: null }));
}

export function vintageTimeline(datasets: HistoryDataset[]): Map<string, Vintage[]> {
  const timeline = new Map<string, Vintage[]>(), unique = new Map<string, HistoryDataset>();
  for (const dataset of datasets) {
    validateHistoryDataset(dataset);
    const prior = unique.get(dataset.snapshotId);
    if (!prior || Date.parse(dataset.generatedAt) < Date.parse(prior.generatedAt)) unique.set(dataset.snapshotId, dataset);
  }
  for (const data of unique.values()) for (const vintage of snapshotVintages(data)) {
    const entries = timeline.get(vintage.date) ?? [];
    entries.push(vintage); timeline.set(vintage.date, entries);
  }
  for (const entries of timeline.values()) entries.sort((a, b) => Date.parse(a.collectedAt) - Date.parse(b.collectedAt)
    || Date.parse(a.observedAt) - Date.parse(b.observedAt) || a.snapshotId.localeCompare(b.snapshotId));
  return timeline;
}

/** Later absence/invalidity supersedes an older value. Never silently fall back to a withdrawn observation. */
export function selectVintages(timeline: Map<string, Vintage[]>, asOf: string): Vintage[] {
  if (!timestamp(asOf)) throw new Error("invalid-as-of");
  return [...timeline.values()].flatMap((entries) => {
    const eligible = entries.filter((v) => Date.parse(v.observedAt) <= Date.parse(asOf) && Date.parse(v.collectedAt) <= Date.parse(asOf));
    if (!eligible.length) return [];
    const latest = eligible.at(-1)!;
    if (eligible.some((v) => v.collectedAt === latest.collectedAt && (v.value !== latest.value || v.quality !== latest.quality))) throw new Error("ambiguous-vintage");
    return [latest];
  }).sort((a, b) => a.date.localeCompare(b.date));
}
export function vintageObservations(vintages: Vintage[]): Observation[] {
  return vintages.filter((v) => v.quality === "complete").map((v) => ({ id: v.id, date: v.date, value: v.value!, fetchedAt: v.observedAt, sourcePublishedAt: null }));
}

export function monitorHistory(datasets: HistoryDataset[], asOf: string) {
  const timeline = vintageTimeline(datasets), selected = selectVintages(timeline, asOf), today = koreanDay(asOf);
  const usable = selected.filter((v) => v.quality === "complete"), latest = usable.at(-1)?.date ?? null;
  const missing = selected.filter((v) => v.quality === "missing").map((v) => v.date);
  const changes: { date: string; kind: "revised" | "newly-observed" | "withdrawn" | "invalidated"; before: Vintage; after: Vintage }[] = [];
  const transitions: { date: string; lastMissingAt: string; firstPresentAt: string }[] = [];
  let repeatedDays = 0;
  for (const [date, entries] of timeline) {
    const eligible = entries.filter((v) => Date.parse(v.observedAt) <= Date.parse(asOf));
    if (eligible.length > 1) repeatedDays++;
    let absent: string | null = null;
    for (const [i, current] of eligible.entries()) {
      const previous = eligible[i - 1];
      if (current.quality === "missing") absent = current.observedAt;
      if (current.quality === "complete" && absent) {
        if (Date.parse(absent) < Date.parse(current.observedAt)) transitions.push({ date, lastMissingAt: absent, firstPresentAt: current.observedAt });
        absent = null;
      }
      if (!previous || previous.quality === current.quality && previous.value === current.value) continue;
      changes.push({ date, kind: current.quality === "missing" ? "withdrawn" : current.quality === "invalid" ? "invalidated" : previous.quality === "complete" ? "revised" : "newly-observed", before: previous, after: current });
    }
  }
  return { schemaVersion: 1, asOf, source: HISTORY_SOURCE,
    snapshots: [...new Map([...datasets].sort((a, b) => Date.parse(b.generatedAt) - Date.parse(a.generatedAt))
      .filter((d) => Date.parse(d.generatedAt) <= Date.parse(asOf))
      .map((d) => [d.snapshotId, { snapshotId: d.snapshotId, generatedAt: d.generatedAt, range: d.range, quality: d.quality }])).values()],
    coverage: { start: selected[0]?.date ?? null, end: selected.at(-1)?.date ?? null, queriedDays: selected.length, availableDays: usable.length,
      latestObservation: latest, observationAgeDays: latest ? dayDistance(latest, today) : null,
      latestCollectionAt: selected.map((v) => v.collectedAt).sort().at(-1) ?? null,
      missingDates: missing, invalidDates: selected.filter((v) => v.quality === "invalid").map((v) => v.date),
      interiorMissing: missing.filter((d) => latest !== null && d < latest), trailingMissing: missing.filter((d) => latest === null || d > latest) },
    comparison: { repeatedDays, changes, availabilityTransitions: transitions },
    releaseTiming: { sourcePublishedAt: null, status: "unknown" as const,
      explanation: "자료 기준일의 나이와 최초 관측 시각은 실제 공개 지연이 아니다. 정상 빈 응답에서 값으로 바뀐 관측 구간만 별도로 기록한다." } };
}

export function validateFutureRange(start: string, end: string) {
  if (validDate(start) !== start || validDate(end) !== end || start > end || daysBetween(start, end).length > 4) throw new Error("invalid-forecast-range");
}
