import { hash, type HistoryDataset } from "../kto/history";
import { availableAt, scores, type Forecast, type Observation } from "./model";
import { CALENDAR, calendarHash } from "./calendar";
import { calendarCoefficients, makeCalendarTrainer, predictCalendar, type CalendarModel } from "./calendar-model";
import type { CalendarReport } from "./calendar-evaluation";
import { selectVintages, validateHistoryDataset, vintageObservations, vintageTimeline } from "./vintages";
import sources from "../../data/nonsan-history-sources.json";

export const HISTORY_STUDY = {
  version: "nonsan-festival-history-v1", mode: "revised-series-development",
  controlReportHash: "abbeddc425884c6cea20c593bfd97be8a3cd588923d17c24963058d4830b727e",
  lambda: 100, inputLagDays: 35, addedStart: "2022-01-01", addedEnd: "2022-12-31",
  trainingTargetStart: "2023-01-01", omittedFestivalYear: 2023,
  purpose: "development-only-no-production-model-change",
} as const;
export const HISTORY_METHODS = ["ridge", "original", "extended", "without2023"] as const;
export type HistoryMethod = typeof HISTORY_METHODS[number];
export type HistoryStudyRow = { date: string; windowStart: string; year: number; issuedAt: string; cutoff: string;
  actual: number | null; festivalDay: boolean; holidayWindow: boolean;
  models: Partial<Record<HistoryMethod, string>>; predictions: Record<HistoryMethod, Forecast> };

export function compareHistoryRows(rows: Pick<HistoryStudyRow, "actual" | "predictions">[]) {
  const common = rows.filter((r) => r.actual !== null && HISTORY_METHODS.every((m) => r.predictions[m].value !== null));
  return { expected: rows.length, observed: rows.filter((r) => r.actual !== null).length, common: common.length,
    methods: Object.fromEntries(HISTORY_METHODS.map((m) => [m, {
      available: rows.filter((r) => r.predictions[m].value !== null).length,
      unavailable: Object.fromEntries([...new Set(rows.map((r) => r.predictions[m].reason).filter((s): s is string => s !== null))]
        .map((reason) => [reason, rows.filter((r) => r.predictions[m].reason === reason).length])),
      ...scores(common.map((r) => ({ actual: r.actual!, predicted: r.predictions[m].value! }))),
    }])) as Record<HistoryMethod, ReturnType<typeof scores> & { available: number; unavailable: Record<string, number> }> };
}

/** A target label and a lagged observation are different roles. Count labels, not all input IDs. */
export function festivalTraining(model: CalendarModel | null, observations: Observation[]) {
  if (!model) return null;
  const targets = new Set(model.trainingTargetIds);
  return { samples: model.trainingSamples, trainedThrough: model.trainedThrough,
    festivalTargets: Object.fromEntries(CALENDAR.festivals.map((f) => [String(f.year), observations.filter((r) =>
      f.start <= r.date && r.date <= f.end && targets.has(r.id)).length])), coefficients: calendarCoefficients(model) };
}

export function validateHistoryControl(control: CalendarReport) {
  if (hash(JSON.stringify(control)) !== HISTORY_STUDY.controlReportHash || control.calendarHash !== calendarHash(CALENDAR)) {
    throw new Error("history-study-control-mismatch");
  }
}

/** Extend past inputs while retaining the exact old forecasts, outcomes and calendar as controls. */
export function evaluateFestivalHistory(originalDatasets: HistoryDataset[], added: HistoryDataset, control: CalendarReport,
  generatedAt: string, progress: (s: string) => void = () => {}) {
  validateHistoryControl(control);
  const datasets = [...originalDatasets, added];
  datasets.forEach(validateHistoryDataset);
  if (!Number.isFinite(Date.parse(generatedAt)) || datasets.some((d) => Date.parse(d.generatedAt) > Date.parse(generatedAt))) throw new Error("snapshot-not-yet-observed");
  if (JSON.stringify(originalDatasets.map((d) => ({ snapshotId: d.snapshotId, generatedAt: d.generatedAt }))) !== JSON.stringify(control.snapshots)) throw new Error("history-study-original-snapshots-mismatch");
  if (added.range.start !== HISTORY_STUDY.addedStart || added.range.end !== HISTORY_STUDY.addedEnd || added.quality.completeDays !== 365) throw new Error("history-study-extension-incomplete");
  const observations = vintageObservations(selectVintages(vintageTimeline(datasets), generatedAt));
  const byDate = new Map(observations.map((r) => [r.date, r]));
  const models: Record<string, CalendarModel> = {};
  const save = (model: CalendarModel | null) => {
    if (!model) return undefined;
    // 2022 is context only. Fail rather than silently admitting its online edition as a label.
    const targets = new Set(model.trainingTargetIds);
    if (observations.some((r) => r.date < HISTORY_STUDY.trainingTargetStart && targets.has(r.id))) throw new Error("history-study-context-used-as-label");
    const id = hash(JSON.stringify(model)); models[id] = model; return id;
  };
  const runs = control.runs.map((run) => {
    const horizonDays = run.horizonDays;
    progress(`D-${horizonDays}: 기존 평가 날짜에서 선행 이력 보강·2023년 제외 비교`);
    const train = makeCalendarTrainer(observations, CALENDAR, "combined", horizonDays);
    const trainWithout = makeCalendarTrainer(observations, CALENDAR, "combined", horizonDays, HISTORY_STUDY.omittedFestivalYear);
    const rows: HistoryStudyRow[] = [];
    const training: { year: number; issuedAt: string; cutoff: string; original: ReturnType<typeof festivalTraining>;
      extended: ReturnType<typeof festivalTraining>; without2023: ReturnType<typeof festivalTraining> }[] = [];
    for (const windowStart of [...new Set(run.rows.map((r) => r.windowStart))]) {
      const window = run.rows.filter((r) => r.windowStart === windowStart), first = window[0];
      const { cutoff, issuedAt } = first;
      const available = availableAt(observations, issuedAt, { mode: "revised-series-experiment", assumedLagDays: HISTORY_STUDY.inputLagDays });
      const extended = train(cutoff), without2023 = trainWithout(cutoff);
      const ids = { extended: save(extended), without2023: save(without2023) };
      if (window.some((r) => r.festivalDay) && !training.some((t) => t.year === first.year)) {
        const originalId = first.models.combined;
        training.push({ year: first.year, issuedAt, cutoff,
          original: festivalTraining(originalId ? control.models[originalId] as CalendarModel : null, observations),
          extended: festivalTraining(extended, observations), without2023: festivalTraining(without2023, observations) });
      }
      for (const row of window) {
        if (row.actual !== (byDate.get(row.date)?.value ?? null)) throw new Error("history-study-outcome-changed");
        rows.push({ date: row.date, windowStart, year: row.year, issuedAt, cutoff, actual: row.actual,
          festivalDay: row.festivalDay, holidayWindow: row.holidayWindow,
          models: { ridge: row.models.ridge, original: row.models.combined, ...ids },
          predictions: { ridge: row.predictions.ridge, original: row.predictions.combined,
            extended: predictCalendar(extended, available, CALENDAR, row.date, cutoff, issuedAt, "dated-announcement"),
            without2023: predictCalendar(without2023, available, CALENDAR, row.date, cutoff, issuedAt, "dated-announcement") } });
      }
    }
    return { horizonDays, comparison: compareHistoryRows(rows),
      folds: [2024, 2025, 2026].map((year) => ({ year, ...compareHistoryRows(rows.filter((r) => r.year === year)) })),
      groups: Object.fromEntries(["festival", "holiday-window", "other"].map((g) => [g, compareHistoryRows(rows.filter((r) =>
        g === "festival" ? r.festivalDay : g === "holiday-window" ? r.holidayWindow : !r.festivalDay && !r.holidayWindow))])),
      festivalFolds: [2024, 2025, 2026].map((year) => ({ year, ...compareHistoryRows(rows.filter((r) => r.year === year && r.festivalDay)) })),
      weeks: [...new Set(rows.map((r) => r.windowStart))].map((start) => ({ start, ...compareHistoryRows(rows.filter((r) => r.windowStart === start)) })),
      training, rows };
  });
  return { schemaVersion: 1, generatedAt, policy: HISTORY_STUDY, calendarHash: calendarHash(CALENDAR), sourcesHash: hash(JSON.stringify(sources)),
    snapshots: datasets.map((d) => ({ snapshotId: d.snapshotId, generatedAt: d.generatedAt, range: d.range, quality: d.quality })),
    observations: observations.length, range: { start: observations[0].date, end: observations.at(-1)!.date },
    runs, models };
}
export type FestivalHistoryReport = ReturnType<typeof evaluateFestivalHistory>;
export function festivalHistorySummary(report: FestivalHistoryReport) {
  const { models, runs, ...rest } = report;
  return { ...rest, modelCount: Object.keys(models).length, reportHash: hash(JSON.stringify(report)),
    runs: runs.map(({ rows, weeks, ...run }) => ({ ...run, weeklyWindows: weeks.length,
      festivalRows: rows.filter((r) => r.festivalDay).map(({ predictions, ...row }) => ({ ...row,
        predictions: Object.fromEntries(HISTORY_METHODS.map((m) => [m, { value: predictions[m].value, reason: predictions[m].reason }])) })) })) };
}
