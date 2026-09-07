import { daysBetween, hash, shiftDay, type HistoryDataset } from "../kto/history";

export const MODEL_VERSION = "nonsan-direct-ridge-v1";
export type Observation = { id: string; date: string; value: number; fetchedAt: string; sourcePublishedAt: string | null };
export type Availability = { mode: "revised-series-experiment"; assumedLagDays: number } | { mode: "strict-replay" };
export type Forecast = { value: number | null; reason: string | null; inputIds: string[] };
export const mean = (values: number[]) => values.reduce((a, b) => a + b, 0) / values.length;
export const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b), m = Math.floor(sorted.length / 2);
  return sorted.length ? sorted.length % 2 ? sorted[m] : (sorted[m - 1] + sorted[m]) / 2 : null;
};
const weekday = (date: string) => new Date(`${date}T00:00:00Z`).getUTCDay();
export const issueAt = (date: string) => `${date}T09:00:00+09:00`;

export function observationsFromDataset(dataset: HistoryDataset): Observation[] {
  const pages = new Map(dataset.pages.map((p) => [p.bodyHash, p.fetchedAt]));
  return dataset.days.filter((d) => d.quality === "complete" && d.values["2"] !== null).map((d) => ({
    id: `${d.date}/2`, date: d.date, value: d.values["2"]!, sourcePublishedAt: dataset.sourcePublishedAt,
    fetchedAt: d.sourcePages.map((id) => { const fetched = pages.get(id); if (!fetched) throw new Error("missing-source-page"); return fetched; }).sort().at(-1)!,
  }));
}

export function availableAt(rows: Observation[], issuedAt: string, availability: Availability): Observation[] {
  if (!Number.isFinite(Date.parse(issuedAt))) throw new Error("invalid-issuance");
  const koreanDay = new Date(Date.parse(issuedAt) + 9 * 3_600_000).toISOString().slice(0, 10);
  if (availability.mode === "revised-series-experiment" && (!Number.isInteger(availability.assumedLagDays) || availability.assumedLagDays < 1 || availability.assumedLagDays > 90)) throw new Error("invalid-assumed-lag");
  const cutoff = availability.mode === "revised-series-experiment" ? shiftDay(koreanDay, -availability.assumedLagDays) : shiftDay(koreanDay, -1);
  const seen = new Set<string>();
  for (const row of rows) {
    if (seen.has(row.date) || !Number.isFinite(row.value) || row.value < 0 || !Number.isFinite(Date.parse(row.fetchedAt))) throw new Error("invalid-observations");
    seen.add(row.date);
  }
  return rows.filter((r) => r.date <= cutoff && (availability.mode === "revised-series-experiment"
    || Date.parse(r.fetchedAt) <= Date.parse(issuedAt)
    || (r.sourcePublishedAt !== null && Number.isFinite(Date.parse(r.sourcePublishedAt)) && Date.parse(r.sourcePublishedAt) <= Date.parse(issuedAt))))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function baseline(rows: Observation[], target: string, kind: "B1" | "B2"): Forecast {
  const past = rows.filter((r) => r.date < target);
  if (kind === "B2") {
    const previous = past.find((r) => r.date === shiftDay(target, -364));
    return previous ? { value: previous.value, reason: null, inputIds: [previous.id] } : { value: null, reason: "previous-year-unavailable", inputIds: [] };
  }
  const selected = past.filter((r) => weekday(r.date) === weekday(target)).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 4);
  return selected.length === 4 ? { value: median(selected.map((r) => r.value)), reason: null, inputIds: selected.map((r) => r.id) }
    : { value: null, reason: "four-weekdays-unavailable", inputIds: selected.map((r) => r.id) };
}
export const relativeIndex = (value: number | null, base: number | null) => value === null || base === null || base <= 0 ? null : 100 * value / base;

const FEATURE_NAMES = ["intercept", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday",
  "year-sin", "year-cos", "half-year-sin", "half-year-cos", "trend-years", "recent-weekday-median", "recent-28-day-mean", "28-day-change"];
function features(rows: Observation[], target: string, cutoff: string): { x: number[]; inputIds: string[] } | null {
  const b = baseline(rows, target, "B1"), last = rows.filter((r) => r.date >= shiftDay(cutoff, -27) && r.date <= cutoff);
  const previous = rows.filter((r) => r.date >= shiftDay(cutoff, -55) && r.date <= shiftDay(cutoff, -28));
  if (b.value === null || last.length < 21 || previous.length < 21) return null;
  const elapsed = (Date.parse(`${target}T00:00:00Z`) - Date.parse("2023-01-01T00:00:00Z")) / 86_400_000;
  const angle = 2 * Math.PI * elapsed / 365.2425, recent = mean(last.map((r) => r.value)), older = mean(previous.map((r) => r.value));
  return { x: [1, ...[1, 2, 3, 4, 5, 6].map((d) => Number(weekday(target) === d)), Math.sin(angle), Math.cos(angle),
    Math.sin(2 * angle), Math.cos(2 * angle), elapsed / 365.2425, b.value / 100_000, recent / 100_000, (recent - older) / 100_000],
    inputIds: [...new Set([...b.inputIds, ...last.map((r) => r.id), ...previous.map((r) => r.id)])].sort() };
}

export type RidgeModel = { version: typeof MODEL_VERSION; lambda: number; horizonDays: number; assumedLagDays: number;
  trainedThrough: string; trainingSamples: number; featureNames: string[]; means: number[]; scales: number[]; coefficients: number[];
  inputIds: string[]; trainingTargetIds: string[]; inputHash: string };

/** Pivoted elimination solves the small positive ridge system; no external ML runtime is needed. */
export function solve(matrix: number[][], vector: number[]): number[] {
  const a = matrix.map((row, i) => [...row, vector[i]]), n = vector.length;
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let row = col + 1; row < n; row++) if (Math.abs(a[row][col]) > Math.abs(a[pivot][col])) pivot = row;
    if (Math.abs(a[pivot][col]) < 1e-12) throw new Error("singular-model");
    [a[col], a[pivot]] = [a[pivot], a[col]];
    const divisor = a[col][col];
    for (let j = col; j <= n; j++) a[col][j] /= divisor;
    for (let row = 0; row < n; row++) {
      if (row === col) continue;
      const factor = a[row][col];
      for (let j = col; j <= n; j++) a[row][j] -= factor * a[col][j];
    }
  }
  return a.map((row) => row[n]);
}

export function fitRidge(rows: Observation[], cutoff: string, horizonDays: number, assumedLagDays: number, lambda: number): RidgeModel | null {
  return makeRidgeTrainer(rows, horizonDays, assumedLagDays)(cutoff, lambda);
}

/** Cache causal features only, never fitted parameters or future training targets. */
export function makeRidgeTrainer(rows: Observation[], horizonDays: number, assumedLagDays: number) {
  if (![7, 28].includes(horizonDays) || !Number.isInteger(assumedLagDays) || assumedLagDays < 1 || assumedLagDays > 90) throw new Error("invalid-model-configuration");
  const past = [...rows].sort((a, b) => a.date.localeCompare(b.date));
  const prepared = past.flatMap((target) => {
    const featureCutoff = shiftDay(target.date, -horizonDays - assumedLagDays);
    const feature = features(past.filter((r) => r.date <= featureCutoff), target.date, featureCutoff);
    return feature ? [{ ...feature, y: target.value / 100_000, targetId: target.id, date: target.date }] : [];
  });
  return (cutoff: string, lambda: number): RidgeModel | null => {
    if (!Number.isFinite(lambda) || lambda <= 0) throw new Error("invalid-model-configuration");
    const samples = prepared.filter((s) => s.date <= cutoff);
    if (samples.length < 120) return null;
    const dimensions = FEATURE_NAMES.length;
    const means = Array.from({ length: dimensions }, (_, i) => i === 0 ? 0 : mean(samples.map((s) => s.x[i])));
    const scales = means.map((center, i) => i === 0 ? 1 : Math.sqrt(mean(samples.map((s) => (s.x[i] - center) ** 2))) || 1);
    const gram = Array.from({ length: dimensions }, () => Array(dimensions).fill(0) as number[]), rhs = Array(dimensions).fill(0) as number[];
    for (const sample of samples) {
      const x = sample.x.map((value, i) => (value - means[i]) / scales[i]);
      for (let i = 0; i < dimensions; i++) {
        rhs[i] += x[i] * sample.y;
        for (let j = 0; j < dimensions; j++) gram[i][j] += x[i] * x[j];
      }
    }
    for (let i = 1; i < dimensions; i++) gram[i][i] += lambda;
    const inputIds = [...new Set(samples.flatMap((s) => [...s.inputIds, s.targetId]))].sort();
    return { version: MODEL_VERSION, lambda, horizonDays, assumedLagDays, trainedThrough: past.filter((r) => r.date <= cutoff).at(-1)!.date,
      trainingSamples: samples.length, featureNames: FEATURE_NAMES, means, scales, coefficients: solve(gram, rhs), inputIds,
      trainingTargetIds: samples.map((s) => s.targetId), inputHash: hash(JSON.stringify(inputIds)) };
  };
}

export function predictRidge(model: RidgeModel | null, rows: Observation[], target: string, cutoff: string): Forecast {
  if (!model) return { value: null, reason: "insufficient-training-history", inputIds: [] };
  if (model.trainedThrough > cutoff || target <= cutoff) throw new Error("future-model-input");
  const feature = features(rows.filter((r) => r.date <= cutoff), target, cutoff);
  if (!feature) return { value: null, reason: "recent-history-unavailable", inputIds: [] };
  const value = feature.x.reduce((sum, x, i) => sum + (x - model.means[i]) / model.scales[i] * model.coefficients[i], 0) * 100_000;
  return Number.isFinite(value) ? { value: Math.max(0, value), reason: null, inputIds: feature.inputIds }
    : { value: null, reason: "nonfinite-model-result", inputIds: feature.inputIds };
}

export function scores(pairs: { actual: number; predicted: number; lower?: number | null; upper?: number | null }[]) {
  if (!pairs.length) return { n: 0, mae: null, wape: null, bias: null, intervalN: 0, coverage: null, meanWidth: null };
  const errors = pairs.map((p) => p.predicted - p.actual), sum = pairs.reduce((s, p) => s + p.actual, 0);
  const intervals = pairs.filter((p) => p.lower != null && p.upper != null);
  return { n: pairs.length, mae: mean(errors.map(Math.abs)), wape: sum === 0 ? null : errors.map(Math.abs).reduce((a, b) => a + b, 0) / sum,
    bias: mean(errors), intervalN: intervals.length,
    coverage: intervals.length ? mean(intervals.map((p) => Number(p.actual >= p.lower! && p.actual <= p.upper!))) : null,
    meanWidth: intervals.length ? mean(intervals.map((p) => p.upper! - p.lower!)) : null };
}

export function residualRadius(errors: number[], minimum = 30): number | null {
  if (errors.length < minimum) return null;
  const sorted = errors.map(Math.abs).sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil((sorted.length + 1) * 0.8) - 1)];
}

export const FESTIVALS = { 2023: { start: "2023-03-08", end: "2023-03-12" }, 2024: { start: "2024-03-21", end: "2024-03-24" }, 2025: { start: "2025-03-27", end: "2025-03-30" } };
export function evaluationWindows(start: string, end: string) {
  const festival = FESTIVALS[Number(start.slice(0, 4)) as keyof typeof FESTIVALS];
  const special = [
    { start: shiftDay(festival.start, -14), end: shiftDay(festival.start, -11), group: "nearby-nonfestival" },
    { ...festival, group: "festival" },
    { start: shiftDay(festival.start, 14), end: shiftDay(festival.start, 17), group: "nearby-nonfestival" },
  ].filter((w) => w.start >= start && w.end <= end);
  const used = new Set(special.flatMap((w) => daysBetween(w.start, w.end)));
  const regular = [];
  for (let date = start; shiftDay(date, 3) <= end; date = shiftDay(date, 7)) {
    const window = { start: date, end: shiftDay(date, 3), group: "other-nonfestival" };
    if (daysBetween(window.start, window.end).every((d) => !used.has(d))) regular.push(window);
  }
  return [...special, ...regular].sort((a, b) => a.start.localeCompare(b.start));
}
