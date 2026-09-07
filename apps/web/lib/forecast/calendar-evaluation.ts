import { daysBetween, hash, shiftDay, type HistoryDataset } from "../kto/history";
import { availableAt, baseline, issueAt, makeRidgeTrainer, predictRidge, scores, type Forecast, type RidgeModel } from "./model";
import { calendarFeatures, calendarHash, type Calendar, type CalendarCandidate } from "./calendar";
import { CALENDAR_MODEL, calendarCoefficients, makeCalendarTrainer, predictCalendar, type CalendarModel } from "./calendar-model";
import { selectVintages, validateHistoryDataset, vintageObservations, vintageTimeline } from "./vintages";

export const CANDIDATES = ["holiday", "festival", "combined"] as const;
export const CALENDAR_METHODS = ["B1", "B2", "ridge", ...CANDIDATES] as const;
export type CalendarMethod = typeof CALENDAR_METHODS[number];
export const DEVELOPMENT = { ...CALENDAR_MODEL, version: "nonsan-calendar-development-v1", mode: "revised-series-experiment" as const,
  evaluationStart: "2024-01-01", evaluationEnd: "2026-08-08", initialTrainingYear: 2023,
  window: "Thursday-Sunday", horizons: [28, 7] as const, minimumRelativeMAEImprovement: 0.1 };

export function thursdayWindows(start: string, end: string) {
  return daysBetween(start, end).filter((d) => new Date(`${d}T00:00:00Z`).getUTCDay() === 4 && shiftDay(d, 3) <= end)
    .map((d) => ({ start: d, end: shiftDay(d, 3) }));
}
export const WINTER_WINDOWS = thursdayWindows("2026-11-05", "2027-01-31");
export type CalendarEvaluationRow = { date: string; windowStart: string; year: number; issuedAt: string; cutoff: string;
  actual: number | null; festivalDay: boolean; holidayWindow: boolean; models: Partial<Record<CalendarMethod, string>>;
  predictions: Record<CalendarMethod, Forecast> };

export function compareCalendarRows(rows: CalendarEvaluationRow[], methods: readonly CalendarMethod[]) {
  const common = rows.filter((r) => r.actual !== null && methods.every((m) => r.predictions[m].value !== null));
  return { expected: rows.length, observed: rows.filter((r) => r.actual !== null).length, common: common.length,
    methods: Object.fromEntries(methods.map((m) => [m, {
      available: rows.filter((r) => r.predictions[m].value !== null).length,
      unavailable: Object.fromEntries([...new Set(rows.map((r) => r.predictions[m].reason).filter((s): s is string => s !== null))]
        .map((reason) => [reason, rows.filter((r) => r.predictions[m].reason === reason).length])),
      ...scores(common.map((r) => ({ actual: r.actual!, predicted: r.predictions[m].value! }))),
    }])) as Record<CalendarMethod, ReturnType<typeof scores> & { available: number; unavailable: Record<string, number> }> };
}

/** This is development on already seen observations, not a prospective performance claim. */
export function evaluateCalendar(datasets: HistoryDataset[], calendar: Calendar, generatedAt: string, progress: (s: string) => void = () => {}) {
  datasets.forEach(validateHistoryDataset);
  if (datasets.some((d) => Date.parse(d.generatedAt) > Date.parse(generatedAt))) throw new Error("snapshot-not-yet-observed");
  const observations = vintageObservations(selectVintages(vintageTimeline(datasets), generatedAt));
  const latest = observations.at(-1)?.date;
  if (!latest || observations[0].date > "2023-01-01") throw new Error("calendar-development-history-missing");
  const end = latest < DEVELOPMENT.evaluationEnd ? latest : DEVELOPMENT.evaluationEnd;
  const windows = thursdayWindows(DEVELOPMENT.evaluationStart, end);
  const models: Record<string, RidgeModel | CalendarModel> = {};
  const save = (model: RidgeModel | CalendarModel | null) => {
    if (!model) return undefined;
    const id = hash(JSON.stringify(model)); models[id] = model; return id;
  };
  const eligible = CANDIDATES.filter((candidate) => WINTER_WINDOWS.every((w) => daysBetween(w.start, w.end)
    .every((date) => calendarFeatures(calendar, candidate, date, generatedAt, "collected").x !== null)));
  const runs = DEVELOPMENT.horizons.map((horizonDays) => {
    progress(`D-${horizonDays}: ${windows.length}개 창의 달력 후보 학습·비교`);
    const trainBase = makeRidgeTrainer(observations, horizonDays, DEVELOPMENT.inputLagDays);
    const trainers = Object.fromEntries(CANDIDATES.map((c) => [c, makeCalendarTrainer(observations, calendar, c, horizonDays)])) as Record<CalendarCandidate, ReturnType<typeof makeCalendarTrainer>>;
    const rows: CalendarEvaluationRow[] = [];
    const stability: { year: number; candidate: CalendarCandidate; trainedThrough: string; samples: number; skippedCalendarRows: number; coefficients: Record<string, number> }[] = [];
    for (const window of windows) {
      const issuedDay = shiftDay(window.start, -horizonDays), issuedAt = issueAt(issuedDay), cutoff = shiftDay(issuedDay, -DEVELOPMENT.inputLagDays);
      const available = availableAt(observations, issuedAt, { mode: DEVELOPMENT.mode, assumedLagDays: DEVELOPMENT.inputLagDays });
      const ridge = trainBase(cutoff, DEVELOPMENT.lambda), fitted = Object.fromEntries(CANDIDATES.map((c) => [c, trainers[c](cutoff)])) as Record<CalendarCandidate, CalendarModel | null>;
      const ids = { ridge: save(ridge), ...Object.fromEntries(CANDIDATES.map((c) => [c, save(fitted[c])])) };
      const year = Number(window.start.slice(0, 4));
      if (!windows.some((w) => w.start > window.start && w.start.startsWith(String(year)))) {
        for (const c of CANDIDATES) {
          const model = fitted[c];
          if (model) stability.push({ year, candidate: c, trainedThrough: model.trainedThrough, samples: model.trainingSamples,
            skippedCalendarRows: model.skippedCalendarRows, coefficients: calendarCoefficients(model) });
        }
      }
      const holidayWindow = calendar.holidays.some((h) => window.start <= h.date && h.date <= window.end);
      for (const date of daysBetween(window.start, window.end)) {
        const predictions = { B1: baseline(available, date, "B1"), B2: baseline(available, date, "B2"), ridge: predictRidge(ridge, available, date, cutoff),
          ...Object.fromEntries(CANDIDATES.map((c) => [c, predictCalendar(fitted[c], available, calendar, date, cutoff, issuedAt, "dated-announcement")])) } as Record<CalendarMethod, Forecast>;
        rows.push({ date, windowStart: window.start, year, issuedAt, cutoff, actual: observations.find((r) => r.date === date)?.value ?? null,
          festivalDay: calendar.festivals.some((f) => f.start <= date && date <= f.end), holidayWindow, models: ids, predictions });
      }
    }
    const selectionMethods: CalendarMethod[] = ["B1", "B2", "ridge", ...eligible], selectionComparison = compareCalendarRows(rows, selectionMethods);
    const order = (a: CalendarMethod, b: CalendarMethod) => (selectionComparison.methods[a].mae ?? Infinity) - (selectionComparison.methods[b].mae ?? Infinity);
    const candidate = [...eligible].sort(order)[0] ?? null;
    const reference = (["ridge", "B1", "B2"] as const).slice().sort(order)[0];
    const referenceMAE = selectionComparison.methods[reference].mae, candidateMAE = candidate ? selectionComparison.methods[candidate].mae : null;
    const sensitivity = CANDIDATES.flatMap((c) => calendar.festivals.map((f) => {
      const cutoff = rows.at(-1)!.cutoff, fit = makeCalendarTrainer(observations, calendar, c, horizonDays, f.year)(cutoff), id = save(fit);
      return { candidate: c, omittedFestivalYear: f.year, modelId: id ?? null, coefficients: fit ? calendarCoefficients(fit) : null,
        trainingSamples: fit?.trainingSamples ?? 0 };
    }));
    return { horizonDays, comparison: compareCalendarRows(rows, CALENDAR_METHODS),
      folds: [2024, 2025, 2026].map((year) => ({ year, ...compareCalendarRows(rows.filter((r) => r.year === year), CALENDAR_METHODS) })),
      groups: Object.fromEntries(["festival", "holiday-window", "other"].map((g) => [g, compareCalendarRows(rows.filter((r) =>
        g === "festival" ? r.festivalDay : g === "holiday-window" ? r.holidayWindow : !r.festivalDay && !r.holidayWindow), CALENDAR_METHODS)])),
      weeks: windows.map((w) => ({ start: w.start, ...compareCalendarRows(rows.filter((r) => r.windowStart === w.start), CALENDAR_METHODS) })),
      selection: { eligible, candidate, reference, comparison: selectionComparison,
        relativeMAEImprovement: referenceMAE && candidateMAE !== null ? 1 - candidateMAE / referenceMAE : null,
        status: "development-selection-only" as const }, stability, sensitivity, rows };
  });
  return { schemaVersion: 1, generatedAt, mode: "dated-calendar-revised-series-development", policy: DEVELOPMENT,
    calendarHash: calendarHash(calendar), snapshots: datasets.map((d) => ({ snapshotId: d.snapshotId, generatedAt: d.generatedAt })),
    observations: observations.length, range: { start: observations[0].date, end: latest }, runs, models };
}
export type CalendarReport = ReturnType<typeof evaluateCalendar>;
export function calendarSummary(report: CalendarReport) {
  const { models, ...rest } = report;
  return { ...rest, modelCount: Object.keys(models).length, reportHash: hash(JSON.stringify(report)),
    runs: report.runs.map(({ rows, weeks, ...run }) => ({ ...run, weeklyWindows: weeks.length, festivalRows: rows.filter((r) => r.festivalDay)
      .map(({ predictions, models: ids, ...row }) => ({ ...row, models: ids, predictions: Object.fromEntries(CALENDAR_METHODS.map((m) => [m, { value: predictions[m].value, reason: predictions[m].reason }])) })) })) };
}
