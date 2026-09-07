import { daysBetween, hash, shiftDay, type HistoryDataset } from "../kto/history";
import { availableAt, baseline, evaluationWindows, issueAt, makeRidgeTrainer, observationsFromDataset, predictRidge,
  relativeIndex, residualRadius, scores, type Forecast, type RidgeModel } from "./model";

export const EXPERIMENT = {
  version: "nonsan-experiment-v1", mode: "revised-series-experiment" as const,
  primaryLagDays: 35, lagDays: [35, 7, 60], horizons: [28, 7], lambdas: [1, 10, 100],
  tuning: { start: "2024-01-01", end: "2024-06-30" }, calibration: { start: "2024-10-01", end: "2024-11-30" },
  test: { start: "2025-01-01", end: "2025-12-31" },
};
type Method = "B1" | "B2" | "ridge";
type Prediction = Forecast & { index: number | null; lower: number | null; upper: number | null; intervalReason: string | null };
export type EvaluationRow = { phase: "tuning" | "calibration" | "test"; group: string; date: string; windowStart: string;
  issuedAt: string; cutoff: string; lastObservation: string | null; actual: number | null; modelId: string | null;
  predictions: Record<string, Prediction> };
export function commonRows(rows: EvaluationRow[], methods: string[]) {
  return rows.filter((r) => r.actual !== null && methods.every((method) => r.predictions[method]?.value != null));
}
function metric(rows: EvaluationRow[], method: string) {
  return scores(rows.map((r) => ({ actual: r.actual!, predicted: r.predictions[method].value!, lower: r.predictions[method].lower, upper: r.predictions[method].upper })));
}
export function summarizeEvaluation(rows: EvaluationRow[], methods: string[]) {
  const common = commonRows(rows, methods);
  return { attempted: rows.length, comparable: common.length, excluded: rows.length - common.length,
    origins: new Set(rows.map((r) => r.issuedAt)).size, distinctDates: new Set(rows.map((r) => r.date)).size,
    missingActual: rows.filter((r) => r.actual === null).map((r) => r.date),
    unavailable: Object.fromEntries(methods.map((method) => [method, rows.filter((r) => r.predictions[method]?.value == null).map((r) => ({ date: r.date, reason: r.predictions[method]?.reason ?? "missing-method" }))])),
    metrics: Object.fromEntries(methods.map((method) => [method, metric(common, method)])) };
}
export function modelChoice(rows: EvaluationRow[]) {
  const methods = ["B1", "B2", ...EXPERIMENT.lambdas.map((l) => `ridge-${l}`)], common = commonRows(rows, methods);
  if (!common.length) throw new Error("no-common-tuning-observations");
  const rank = (names: string[]) => [...names].sort((a, b) => metric(common, a).mae! - metric(common, b).mae!)[0];
  return { baseline: rank(["B1", "B2"]) as "B1" | "B2", lambda: Number(rank(methods.slice(2)).slice(6)),
    tuning: summarizeEvaluation(rows, methods), selectedAfter: common.map((r) => r.date).sort().at(-1)! };
}

export function evaluateHistory(dataset: HistoryDataset, progress: (message: string) => void = () => {}) {
  if (dataset.schemaVersion !== 1 || dataset.region.code !== "44230" || dataset.range.start > "2023-01-01" || dataset.range.end < "2025-12-31") throw new Error("unsupported-history-dataset");
  const observations = observationsFromDataset(dataset), actuals = new Map(observations.map((r) => [r.date, r.value]));
  const models: Record<string, Omit<RidgeModel, "inputIds" | "trainingTargetIds"> & { inputSet: string; trainingTargetSet: string }> = {};
  const inputSets: Record<string, string[]> = {};
  const saveIds = (ids: string[]) => { const id = hash(JSON.stringify(ids)); inputSets[id] ??= ids; return id; };
  const runs = [];
  for (const lagDays of EXPERIMENT.lagDays) for (const horizonDays of EXPERIMENT.horizons) {
    progress(`공개 지연 가정 ${lagDays}일 / D-${horizonDays}: 학습·평가`);
    const train = makeRidgeTrainer(observations, horizonDays, lagDays);
    const runPhase = (phase: EvaluationRow["phase"], lambdas: number[], radii?: Record<Method, number | null>, calibratedAt?: string) => {
      const rows: EvaluationRow[] = [];
      for (const window of evaluationWindows(EXPERIMENT[phase].start, EXPERIMENT[phase].end)) {
        const issuedDay = shiftDay(window.start, -horizonDays), issuedAt = issueAt(issuedDay), cutoff = shiftDay(issuedDay, -lagDays);
        const available = availableAt(observations, issuedAt, { mode: EXPERIMENT.mode, assumedLagDays: lagDays });
        const fitted = lambdas.map((lambda) => ({ lambda, model: train(cutoff, lambda), id: null as string | null }));
        for (const entry of fitted) if (entry.model && phase !== "tuning") {
          const model = entry.model;
          const { inputIds, trainingTargetIds, ...parameters } = model;
          const saved = { ...parameters, inputSet: saveIds(inputIds), trainingTargetSet: saveIds(trainingTargetIds) };
          entry.id = hash(JSON.stringify(saved));
          models[entry.id] = saved;
        }
        for (const date of daysBetween(window.start, window.end)) {
          const b1 = baseline(available, date, "B1"), b2 = baseline(available, date, "B2");
          const predictions: Record<string, Prediction> = {};
          const add = (name: string, prediction: Forecast) => {
            const radius = radii?.[name as Method], eligible = calibratedAt !== undefined && Date.parse(issuedAt) >= Date.parse(calibratedAt);
            const hasInterval = radius != null && eligible && prediction.value !== null;
            predictions[name] = { ...prediction, index: relativeIndex(prediction.value, b1.value),
              lower: hasInterval ? Math.max(0, prediction.value! - radius!) : null,
              upper: hasInterval ? prediction.value! + radius! : null,
              intervalReason: hasInterval ? null : !eligible ? "calibration-not-yet-available" : "insufficient-calibration" };
          };
          add("B1", b1); add("B2", b2);
          for (const { lambda, model } of fitted) add(phase === "tuning" ? `ridge-${lambda}` : "ridge", predictRidge(model, available, date, cutoff));
          rows.push({ phase, group: window.group, date, windowStart: window.start, issuedAt, cutoff,
            lastObservation: available.at(-1)?.date ?? null, actual: actuals.get(date) ?? null,
            modelId: fitted[0].id, predictions });
        }
      }
      return rows;
    };
    const tuningRows = runPhase("tuning", EXPERIMENT.lambdas), choice = modelChoice(tuningRows);
    const selectionAvailableAt = issueAt(shiftDay(choice.selectedAfter, lagDays));
    const calibrationRows = runPhase("calibration", [choice.lambda]);
    if (calibrationRows.some((r) => Date.parse(r.issuedAt) < Date.parse(selectionAvailableAt))) throw new Error("selection-leaks-into-calibration");
    const methods: Method[] = ["B1", "B2", "ridge"], common = commonRows(calibrationRows, methods);
    const radii = Object.fromEntries(methods.map((method) => [method, residualRadius(common.map((r) => r.predictions[method].value! - r.actual!))])) as Record<Method, number | null>;
    const calibratedAt = common.length ? issueAt(shiftDay(common.map((r) => r.date).sort().at(-1)!, lagDays)) : issueAt("9999-01-01");
    const testRows = runPhase("test", [choice.lambda], radii, calibratedAt);
    if (testRows.some((r) => Date.parse(r.issuedAt) < Date.parse(selectionAvailableAt))) throw new Error("selection-leaks-into-test");
    const summary = summarizeEvaluation(testRows, methods), ridge = summary.metrics.ridge, selected = summary.metrics[choice.baseline];
    const improved = ridge.mae !== null && selected.mae !== null && ridge.wape !== null && selected.wape !== null && ridge.mae < selected.mae && ridge.wape < selected.wape;
    const groups = Object.fromEntries(["festival", "nearby-nonfestival", "other-nonfestival"].map((group) => [group, summarizeEvaluation(testRows.filter((r) => r.group === group), methods)]));
    runs.push({ lagDays, horizonDays, choice, selectionAvailableAt,
      calibration: { summary: summarizeEvaluation(calibrationRows, methods), radii, availableAt: calibratedAt, nominalCoverage: 0.8 },
      test: summary, groups, decision: improved ? "ridge-research-candidate" : "retain-selected-baseline",
      selectedMethod: improved ? "ridge" : choice.baseline, rows: [...tuningRows, ...calibrationRows, ...testRows] });
  }
  for (const run of runs) for (const row of run.rows) if (row.modelId && !models[row.modelId]) throw new Error("missing-model-reference");
  return { schemaVersion: 1, generatedAt: new Date().toISOString(), experiment: EXPERIMENT, experimentHash: hash(JSON.stringify(EXPERIMENT)),
    dataset: { snapshotId: dataset.snapshotId, source: dataset.source, range: dataset.range, generatedAt: dataset.generatedAt,
      quality: dataset.quality, observationIdScope: "snapshotId + date/2", sourcePublishedAt: dataset.sourcePublishedAt },
    strictReplay: { availableObservationsAt2025Festival: availableAt(observations, issueAt("2025-03-20"), { mode: "strict-replay" }).length,
      status: "historical-vintages-unavailable" },
    runs, models, inputSets };
}
export type EvaluationReport = ReturnType<typeof evaluateHistory>;

export function sampleSummary(report: EvaluationReport) {
  return { schemaVersion: 1, generatedAt: report.generatedAt, dataset: report.dataset, experiment: report.experiment,
    strictReplay: report.strictReplay, runs: report.runs.map(({ rows, ...run }) => ({ ...run,
      festival: rows.filter((r) => r.phase === "test" && r.group === "festival") })) };
}
