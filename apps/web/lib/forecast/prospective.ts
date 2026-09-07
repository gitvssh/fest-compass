import { daysBetween, hash, shiftDay, type HistoryDataset } from "../kto/history";
import { baseline, fitRidge, issueAt, MODEL_VERSION, predictRidge, relativeIndex, scores, type Forecast } from "./model";
import { dayDistance, koreanDay, monitorHistory, selectVintages, validateFutureRange, vintageObservations, vintageTimeline } from "./vintages";

// Frozen from the 2024 selection in experiment v1. No tuning on the newly collected 2026 series.
export const POLICY = { version: "nonsan-prospective-v1", modelVersion: MODEL_VERSION, lambda: 100, inputLagDays: 35,
  maxObservationAgeDays: 60, maxCollectionAgeDays: 7 } as const;
export type Target = { kind: "regional-check" | "festival"; label: string; start: string; end: string;
  schedule: { url: string; publishedAt: string } | null };
export type Request = { requestId: string; horizonDays: 7 | 28; target: Target };
export type SnapshotRef = { archiveId: string; snapshotId: string };
export const methods = ["ridge", "B1", "B2"] as const;
type Prediction = Forecast & { index: number | null };
export const requestKey = (value: string) => {
  if (!/^[a-z0-9][a-z0-9-]{0,79}$/.test(value)) throw new Error("invalid-request-id");
  return value;
};
export function requestHash(request: Request) {
  requestKey(request.requestId);
  if (![7, 28].includes(request.horizonDays) || !["regional-check", "festival"].includes(request.target?.kind)
    || typeof request.target.label !== "string" || !request.target.label.trim() || request.target.label.length > 120) throw new Error("invalid-forecast-request");
  validateFutureRange(request.target.start, request.target.end);
  const schedule = request.target.schedule;
  if (request.target.kind === "regional-check" ? schedule !== null : !schedule) throw new Error("invalid-schedule-evidence");
  if (schedule) {
    const url = new URL(schedule.url);
    if (url.protocol !== "https:" || url.username || url.password || !Number.isFinite(Date.parse(schedule.publishedAt))) throw new Error("invalid-schedule-evidence");
  }
  return hash(JSON.stringify({ policy: POLICY, request }));
}

/** Only the CLI supplies the real clock. The parameter makes time boundaries testable, not backdatable via CLI. */
export function makeIssuance(request: Request, datasets: HistoryDataset[], snapshots: SnapshotRef[], now: string) {
  const intentHash = requestHash(request), today = koreanDay(now), scheduledDay = shiftDay(request.target.start, -request.horizonDays);
  const scheduledIssuedAt = issueAt(scheduledDay);
  if (today !== scheduledDay || Date.parse(now) < Date.parse(scheduledIssuedAt)) throw new Error("forecast-not-due");
  if (request.target.schedule && Date.parse(request.target.schedule.publishedAt) > Date.parse(now)) throw new Error("schedule-not-yet-published");
  if (datasets.some((d) => Date.parse(d.generatedAt) > Date.parse(now))) throw new Error("snapshot-not-yet-observed");
  const monitor = monitorHistory(datasets, now), selected = selectVintages(vintageTimeline(datasets), now);
  const cutoff = shiftDay(today, -POLICY.inputLagDays), rows = vintageObservations(selected).filter((r) => r.date <= cutoff);
  const coverage = monitor.coverage;
  const collectionAge = coverage.latestCollectionAt ? dayDistance(koreanDay(coverage.latestCollectionAt), today) : null;
  const reason = coverage.observationAgeDays === null ? "no-observations"
    : coverage.observationAgeDays > POLICY.maxObservationAgeDays ? "observations-too-old"
    : collectionAge === null || collectionAge > POLICY.maxCollectionAgeDays ? "collection-too-old" : null;
  const model = reason ? null : fitRidge(rows, cutoff, request.horizonDays, POLICY.inputLagDays, POLICY.lambda);
  const predictions = daysBetween(request.target.start, request.target.end).map((date) => {
    const unavailable: Forecast = { value: null, reason, inputIds: [] };
    const b1 = reason ? unavailable : baseline(rows, date, "B1"), b2 = reason ? unavailable : baseline(rows, date, "B2");
    const ridge = reason ? unavailable : predictRidge(model, rows, date, cutoff);
    const indexed = (prediction: Forecast): Prediction => ({ ...prediction, index: relativeIndex(prediction.value, b1.value) });
    return { date, predictions: { ridge: indexed(ridge), B1: indexed(b1), B2: indexed(b2) } };
  });
  return { schemaVersion: 1 as const, intentHash, request, policy: POLICY, issuedAt: new Date(now).toISOString(), scheduledIssuedAt,
    latenessSeconds: Math.round((Date.parse(now) - Date.parse(scheduledIssuedAt)) / 1_000),
    status: predictions.every((p) => p.predictions.ridge.value !== null) ? "issued" as const : "withheld" as const,
    purpose: "prospective-research" as const, snapshots, inputCutoff: cutoff, lastInputDate: rows.at(-1)?.date ?? null,
    availability: { mode: "actually-collected-before-issue" as const, sourcePublishedAt: null, coverage },
    interval: { status: "withheld" as const, reason: "v1-held-out-coverage-below-nominal" }, model, predictions };
}
export type Issuance = ReturnType<typeof makeIssuance>;
export type Receipt = Issuance & { id: string };
export function receiptOf(issuance: Issuance): Receipt { return { ...issuance, id: hash(JSON.stringify(issuance)) }; }
export function validateReceipt(receipt: Receipt) {
  const { id, ...issuance } = receipt;
  if (id !== hash(JSON.stringify(issuance)) || issuance.schemaVersion !== 1 || issuance.intentHash !== requestHash(issuance.request)) throw new Error("invalid-forecast-receipt");
}

/** An assessment is another immutable record. Missing/late/revised outcomes never change the issuance. */
export function makeAssessment(receipt: Receipt, datasets: HistoryDataset[], snapshots: SnapshotRef[], now: string) {
  validateReceipt(receipt);
  if (Date.parse(now) < Date.parse(receipt.issuedAt)) throw new Error("assessment-before-issue");
  if (datasets.some((d) => Date.parse(d.generatedAt) > Date.parse(now))) throw new Error("snapshot-not-yet-observed");
  const selected = new Map(selectVintages(vintageTimeline(datasets), now).map((v) => [v.date, v]));
  const rows = receipt.predictions.map((forecast) => {
    const observation = selected.get(forecast.date);
    const status = forecast.date >= koreanDay(now) ? "not-yet-occurred" as const : !observation || observation.quality === "missing"
      ? "waiting-provider" as const : observation.quality === "invalid" ? "invalid-observation" as const : "observed" as const;
    return { date: forecast.date, status, actual: status === "observed" ? observation!.value : null,
      vintage: observation ?? null, predictions: forecast.predictions };
  });
  const comparable = rows.filter((r) => r.actual !== null && methods.every((m) => r.predictions[m].value !== null));
  const metrics = Object.fromEntries(methods.map((m) => [m, scores(comparable.map((r) => ({ actual: r.actual!, predicted: r.predictions[m].value! })))]));
  const result = { schemaVersion: 1 as const, forecastId: receipt.id, assessedAt: new Date(now).toISOString(), snapshots, rows,
    observedDays: rows.filter((r) => r.status === "observed").length, comparableDays: comparable.length, metrics,
    truth: "latest-observed-version-at-assessment" as const };
  return { ...result, id: hash(JSON.stringify(result)) };
}
export type Assessment = ReturnType<typeof makeAssessment>;
