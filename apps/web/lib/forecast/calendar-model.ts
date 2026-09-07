import { hash, shiftDay } from "../kto/history";
import { FEATURE_NAMES, features, issueAt, mean, solve, type Forecast, type Observation, type RidgeModel } from "./model";
import { calendarFeatures, calendarHash, extraFeatureNames, validateCalendar, type Calendar, type CalendarCandidate, type CalendarMode } from "./calendar";

export const CALENDAR_MODEL = { version: "nonsan-calendar-ridge-v1", lambda: 100, inputLagDays: 35 } as const;
export type CalendarModel = Omit<RidgeModel, "version"> & { version: typeof CALENDAR_MODEL.version; candidate: CalendarCandidate;
  calendarHash: string; sourceIds: string[]; omittedFestivalYear: number | null; skippedCalendarRows: number };

/** Calendar features of a training row use that row's historical issue date, never today's holiday list. */
export function makeCalendarTrainer(rows: Observation[], calendar: Calendar, candidate: CalendarCandidate, horizonDays: 7 | 28, omittedFestivalYear: number | null = null) {
  validateCalendar(calendar);
  if (![7, 28].includes(horizonDays)) throw new Error("invalid-model-configuration");
  const past = [...rows].sort((a, b) => a.date.localeCompare(b.date)), lag = CALENDAR_MODEL.inputLagDays;
  const omitted = calendar.festivals.find((f) => f.year === omittedFestivalYear);
  const skipped: string[] = [];
  const prepared = past.flatMap((target) => {
    if (omitted && target.date >= omitted.start && target.date <= omitted.end) return [];
    const cutoff = shiftDay(target.date, -horizonDays - lag);
    const base = features(past.filter((r) => r.date <= cutoff), target.date, cutoff);
    if (!base) return [];
    const extra = calendarFeatures(calendar, candidate, target.date, issueAt(shiftDay(target.date, -horizonDays)), "dated-announcement");
    if (!extra.x) { skipped.push(target.date); return []; }
    return [{ x: [...base.x, ...extra.x], inputIds: base.inputIds, sourceIds: extra.sourceIds, target,
      y: target.value / 100_000 }];
  });
  return (cutoff: string): CalendarModel | null => {
    const samples = prepared.filter((s) => s.target.date <= cutoff);
    if (samples.length < 120) return null;
    const featureNames = [...FEATURE_NAMES, ...extraFeatureNames(candidate)], dimensions = featureNames.length;
    const means = featureNames.map((_, i) => i === 0 ? 0 : mean(samples.map((s) => s.x[i])));
    const scales = means.map((center, i) => i === 0 ? 1 : Math.sqrt(mean(samples.map((s) => (s.x[i] - center) ** 2))) || 1);
    const gram = featureNames.map(() => Array(dimensions).fill(0) as number[]), rhs = Array(dimensions).fill(0) as number[];
    for (const sample of samples) {
      const x = sample.x.map((value, i) => (value - means[i]) / scales[i]);
      for (let i = 0; i < dimensions; i++) {
        rhs[i] += x[i] * sample.y;
        for (let j = 0; j < dimensions; j++) gram[i][j] += x[i] * x[j];
      }
    }
    for (let i = 1; i < dimensions; i++) gram[i][i] += CALENDAR_MODEL.lambda;
    const inputIds = [...new Set(samples.flatMap((s) => [...s.inputIds, s.target.id]))].sort();
    return { version: CALENDAR_MODEL.version, candidate, calendarHash: calendarHash(calendar), lambda: CALENDAR_MODEL.lambda,
      horizonDays, assumedLagDays: lag, trainedThrough: samples.at(-1)!.target.date, trainingSamples: samples.length,
      featureNames, means, scales, coefficients: solve(gram, rhs), inputIds, trainingTargetIds: samples.map((s) => s.target.id),
      inputHash: hash(JSON.stringify(inputIds)), sourceIds: [...new Set(samples.flatMap((s) => s.sourceIds))].sort(),
      omittedFestivalYear, skippedCalendarRows: skipped.filter((d) => d <= cutoff).length };
  };
}

export function predictCalendar(model: CalendarModel | null, rows: Observation[], calendar: Calendar, target: string, cutoff: string, issuedAt: string, mode: CalendarMode): Forecast {
  if (!model) return { value: null, reason: "insufficient-training-history", inputIds: [] };
  if (model.calendarHash !== calendarHash(calendar) || model.trainedThrough > cutoff || target <= cutoff) throw new Error("invalid-calendar-model");
  const extra = calendarFeatures(calendar, model.candidate, target, issuedAt, mode);
  if (!extra.x) return { value: null, reason: extra.reason, inputIds: [] };
  const base = features(rows.filter((r) => r.date <= cutoff), target, cutoff);
  if (!base) return { value: null, reason: "recent-history-unavailable", inputIds: [] };
  const value = [...base.x, ...extra.x].reduce((sum, x, i) => sum + (x - model.means[i]) / model.scales[i] * model.coefficients[i], 0) * 100_000;
  return { value: Number.isFinite(value) ? Math.max(0, value) : null, reason: Number.isFinite(value) ? null : "nonfinite-model-result", inputIds: base.inputIds };
}

export function calendarCoefficients(model: CalendarModel) {
  return Object.fromEntries(extraFeatureNames(model.candidate).map((name) => {
    const i = model.featureNames.indexOf(name);
    return [name, model.coefficients[i] / model.scales[i] * 100_000];
  }));
}
