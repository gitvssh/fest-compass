import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { daysBetween, hash, shiftDay, type HistoryDataset } from "../kto/history";
import { CALENDAR_MODEL, makeCalendarTrainer, predictCalendar } from "./calendar-model";
import { calendarFeatures, calendarHash, validateCalendar, type Calendar } from "./calendar";
import { WINTER_WINDOWS, type CalendarReport } from "./calendar-evaluation";
import { issueAt, scores } from "./model";
import { makeIssuance, receiptOf, type Request, type SnapshotRef } from "./prospective";
import { createImmutable, loadSnapshots } from "./store";
import { koreanDay, selectVintages, vintageObservations, vintageTimeline } from "./vintages";

export const TRIAL_POLICY = { version: "nonsan-winter-calendar-trial-v1", model: CALENDAR_MODEL, primaryMaturityDays: 60,
  sensitivityMaturityDays: 90, minMAEImprovement: 0.1, missingCheck: "no-backfill", interval: "withheld",
  calendarUpdates: "fixed-registration-snapshot", target: "nonsan-daily-nonresident-estimate" } as const;
export const TRIAL_REQUESTS: Request[] = WINTER_WINDOWS.flatMap((w) => ([28, 7] as const).map((horizonDays) => ({
  requestId: `winter-${w.start.replaceAll("-", "")}-d${horizonDays}`, horizonDays,
  target: { kind: "regional-check", label: "겨울 공휴일 지역 예측 비교", ...w, schedule: null },
})));
const FIRST_ISSUE = issueAt(shiftDay(WINTER_WINDOWS[0].start, -28));
const DATES = WINTER_WINDOWS.flatMap((w) => daysBetween(w.start, w.end));
const encode = (value: unknown) => `${JSON.stringify(value)}\n`;
function sealed<T extends object>(value: T) { return { ...value, id: hash(JSON.stringify(value)) }; }
function validateSeal(value: object & { id: string }) {
  const { id, ...rest } = value;
  if (hash(JSON.stringify(rest)) !== id) throw new Error("corrupt-calendar-trial-record");
}
async function readOptional<T>(path: string): Promise<T | null> {
  try { return JSON.parse(await readFile(path, "utf8")); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return null; throw error; }
}
async function preserve(path: string, value: unknown) {
  const content = encode(value);
  if (!await createImmutable(path, content) && await readFile(path, "utf8") !== content) throw new Error("calendar-trial-record-conflict");
}

export function makeTrialPlan(report: CalendarReport, calendar: Calendar, codeHashes: Record<string, string>, now: string) {
  validateCalendar(calendar);
  if (!Number.isFinite(Date.parse(now)) || Date.parse(now) >= Date.parse(FIRST_ISSUE)
    || Date.parse(report.generatedAt) > Date.parse(now) || report.calendarHash !== calendarHash(calendar)) throw new Error("invalid-calendar-trial-registration");
  const choices = report.runs.map((run) => {
    if (!run.selection.candidate || ![7, 28].includes(run.horizonDays)) throw new Error("calendar-trial-candidate-unavailable");
    return { horizonDays: run.horizonDays, candidate: run.selection.candidate, reference: run.selection.reference };
  });
  const plan = sealed({ schemaVersion: 1, frozenAt: now, firstIssueAt: FIRST_ISSUE, policy: TRIAL_POLICY,
    calendar, calendarHash: calendarHash(calendar), developmentReportHash: hash(JSON.stringify(report)), codeHashes, requests: TRIAL_REQUESTS, choices });
  validateTrialPlan(plan); return plan;
}
export type TrialPlan = ReturnType<typeof makeTrialPlan>;
export function validateTrialPlan(plan: TrialPlan) {
  validateSeal(plan); validateCalendar(plan.calendar);
  if (plan.schemaVersion !== 1 || JSON.stringify(plan.policy) !== JSON.stringify(TRIAL_POLICY)
    || JSON.stringify(plan.requests) !== JSON.stringify(TRIAL_REQUESTS) || plan.calendarHash !== calendarHash(plan.calendar)
    || plan.firstIssueAt !== FIRST_ISSUE || !Number.isFinite(Date.parse(plan.frozenAt)) || Date.parse(plan.frozenAt) >= Date.parse(FIRST_ISSUE)
    || !/^[a-f0-9]{64}$/.test(plan.developmentReportHash) || !Object.keys(plan.codeHashes).length
    || Object.values(plan.codeHashes).some((v) => !/^[a-f0-9]{64}$/.test(v))
    || plan.choices.length !== 2 || new Set(plan.choices.map((c) => c.horizonDays)).size !== 2) throw new Error("invalid-calendar-trial-plan");
  for (const choice of plan.choices) {
    if (![7, 28].includes(choice.horizonDays) || !["holiday", "festival", "combined"].includes(choice.candidate)
      || !["ridge", "B1", "B2"].includes(choice.reference)
      || !DATES.every((d) => calendarFeatures(plan.calendar, choice.candidate, d, plan.frozenAt, "collected").x !== null)) throw new Error("invalid-calendar-trial-choice");
  }
}

function trialIssuance(plan: TrialPlan, request: Request, datasets: HistoryDataset[], snapshots: SnapshotRef[], now: string) {
  const v1 = receiptOf(makeIssuance(request, datasets, snapshots, now));
  const candidate = plan.choices.find((c) => c.horizonDays === request.horizonDays)!.candidate;
  const rows = vintageObservations(selectVintages(vintageTimeline(datasets), now)).filter((r) => r.date <= v1.inputCutoff);
  const reason = v1.predictions.find((p) => p.predictions.ridge.reason)?.predictions.ridge.reason ?? null;
  const model = reason ? null : makeCalendarTrainer(rows, plan.calendar, candidate, request.horizonDays)(v1.inputCutoff);
  const predictions = v1.predictions.map((p) => ({ date: p.date, reference: p.predictions,
    candidate: reason ? { value: null, reason, inputIds: [] } : predictCalendar(model, rows, plan.calendar, p.date, v1.inputCutoff, now, "collected") }));
  return sealed({ schemaVersion: 1, planId: plan.id, issuedAt: now, candidate, v1, model, predictions });
}
type TrialForecast = ReturnType<typeof trialIssuance>;
function trialOutcome(planId: string, date: string, maturityDays: 60 | 90, datasets: HistoryDataset[], snapshots: SnapshotRef[], now: string) {
  const dueDate = shiftDay(date, maturityDays), today = koreanDay(now);
  if (today < dueDate || Date.parse(now) < Date.parse(issueAt(today))) throw new Error("calendar-outcome-not-due");
  const selected = selectVintages(vintageTimeline(datasets), now).find((v) => v.date === date);
  const status = today > dueDate ? "missed-check" : selected?.quality === "complete" ? "observed" : selected?.quality === "invalid" ? "invalid" : "missing";
  return sealed({ schemaVersion: 1, planId, date, maturityDays, dueDate, checkedAt: now, status,
    actual: status === "observed" ? selected!.value : null, vintage: status === "observed" ? selected! : null, snapshots });
}
type TrialOutcome = ReturnType<typeof trialOutcome>;
type Registration = { plan: TrialPlan; registeredAt: string; id: string };

/** The existing worker flock owns this store. Receipts and maturity results are immutable, including failures. */
export async function runCalendarTrial(store: string, plan: TrialPlan, datasets: HistoryDataset[], snapshots: SnapshotRef[], now: string, canIssue = true) {
  validateTrialPlan(plan);
  if (!Number.isFinite(Date.parse(now)) || datasets.some((d) => Date.parse(d.generatedAt) > Date.parse(now))) throw new Error("snapshot-not-yet-observed");
  const root = join(store, "calendar-trial", plan.id), registrationPath = join(root, "registration.json");
  let registration = await readOptional<Registration>(registrationPath);
  if (!registration) {
    if (Date.parse(now) >= Date.parse(FIRST_ISSUE) || Date.parse(now) < Date.parse(plan.frozenAt)) throw new Error("calendar-trial-registration-missed");
    registration = sealed({ plan, registeredAt: now }); await preserve(registrationPath, registration);
  }
  validateSeal(registration);
  if (JSON.stringify(registration.plan) !== JSON.stringify(plan) || Date.parse(registration.registeredAt) >= Date.parse(FIRST_ISSUE)
    || Date.parse(registration.registeredAt) > Date.parse(now)) throw new Error("invalid-calendar-trial-registration");
  await preserve(join(store, "calendar-trial", "active-plan.json"), { planId: plan.id });
  const forecasts: TrialForecast[] = [], schedule = [];
  for (const request of plan.requests) {
    const path = join(root, "forecasts", `${request.requestId}.json`), dueDate = shiftDay(request.target.start, -request.horizonDays);
    let record = await readOptional<TrialForecast>(path);
    if (!record && canIssue && dueDate === koreanDay(now) && Date.parse(now) >= Date.parse(issueAt(dueDate))) {
      record = trialIssuance(plan, request, datasets, snapshots, now); await preserve(path, record);
    }
    if (record) {
      validateSeal(record);
      if (record.planId !== plan.id || record.v1.request.requestId !== request.requestId || Date.parse(record.issuedAt) > Date.parse(now)) throw new Error("invalid-calendar-trial-reference");
      const replay = trialIssuance(plan, request, await loadSnapshots(store, record.v1.snapshots), record.v1.snapshots, record.issuedAt);
      if (JSON.stringify(replay) !== JSON.stringify(record)) throw new Error("calendar-trial-replay-mismatch");
      forecasts.push(record);
    }
    schedule.push({ requestId: request.requestId, start: request.target.start, horizonDays: request.horizonDays, dueDate,
      status: record ? record.predictions.every((p) => p.candidate.value !== null) ? "issued" : "withheld" : dueDate < koreanDay(now) ? "missed"
        : dueDate === koreanDay(now) && !canIssue ? "collection-failed" : "upcoming" });
  }
  const outcomes: TrialOutcome[] = [];
  for (const date of DATES) for (const maturityDays of [60, 90] as const) {
    if (koreanDay(now) < shiftDay(date, maturityDays) || Date.parse(now) < Date.parse(issueAt(koreanDay(now)))) continue;
    const path = join(root, "outcomes", `${date}-d${maturityDays}.json`);
    let record = await readOptional<TrialOutcome>(path);
    if (!record) { record = trialOutcome(plan.id, date, maturityDays, datasets, snapshots, now); await preserve(path, record); }
    validateSeal(record);
    if (record.planId !== plan.id || record.date !== date || record.maturityDays !== maturityDays || Date.parse(record.checkedAt) > Date.parse(now)) throw new Error("invalid-calendar-outcome-reference");
    const replay = trialOutcome(plan.id, date, maturityDays, await loadSnapshots(store, record.snapshots), record.snapshots, record.checkedAt);
    if (JSON.stringify(replay) !== JSON.stringify(record)) throw new Error("calendar-outcome-replay-mismatch");
    outcomes.push(record);
  }
  return summarizeTrial(plan, registration, forecasts, outcomes, schedule);
}

function summarizeTrial(plan: TrialPlan, registration: Registration, forecasts: TrialForecast[], outcomes: TrialOutcome[], schedule: { requestId: string; start: string; horizonDays: number; dueDate: string; status: string }[]) {
  const comparisons = plan.choices.flatMap((choice) => ([60, 90] as const).map((maturityDays) => {
    const methodNames = ["candidate", "ridge", "B1", "B2"] as const;
    const rows = forecasts.filter((f) => f.v1.request.horizonDays === choice.horizonDays).flatMap((f) => f.predictions.map((p) => ({
      ...p, actual: outcomes.find((o) => o.date === p.date && o.maturityDays === maturityDays)?.actual ?? null,
      holidayWindow: plan.calendar.holidays.some((h) => f.v1.request.target.start <= h.date && h.date <= f.v1.request.target.end),
      predictions: { candidate: p.candidate, ...p.reference },
    })));
    const common = rows.filter((r) => r.actual !== null && methodNames.every((m) => r.predictions[m].value !== null));
    const metric = (subset: typeof common) => Object.fromEntries(methodNames.map((m) => [m, scores(subset.map((r) => ({ actual: r.actual!, predicted: r.predictions[m].value! })))])) as Record<typeof methodNames[number], ReturnType<typeof scores>>;
    const metrics = metric(common), holiday = metric(common.filter((r) => r.holidayWindow));
    const availability = Object.fromEntries(methodNames.map((m) => [m, rows.filter((r) => r.predictions[m].value !== null).length])) as Record<typeof methodNames[number], number>;
    const improvement = metrics[choice.reference].mae && metrics.candidate.mae !== null ? 1 - metrics.candidate.mae / metrics[choice.reference].mae! : null;
    const complete = common.length === DATES.length;
    const meetsCriteria = complete && improvement !== null && improvement >= TRIAL_POLICY.minMAEImprovement
      && availability.candidate >= availability[choice.reference] && holiday.candidate.bias !== null && holiday[choice.reference].bias !== null
      && Math.min(0, holiday.candidate.bias) >= Math.min(0, holiday[choice.reference].bias!);
    return { ...choice, maturityDays, expected: DATES.length, common: common.length, availability, metrics, holiday, relativeMAEImprovement: improvement,
      decision: !complete ? "insufficient-outcomes" : maturityDays === 90 ? "sensitivity-only" : meetsCriteria ? "meets-preregistered-criteria" : "retain-reference" };
  }));
  return { schemaVersion: 1, planId: plan.id, registeredAt: registration.registeredAt, frozenAt: plan.frozenAt, firstIssueAt: plan.firstIssueAt,
    calendarHash: plan.calendarHash, choices: plan.choices, expectedWindows: 13, expectedDates: DATES.length, schedule,
    issued: forecasts.length, outcomes: outcomes.map(({ date, maturityDays, status, actual, checkedAt }) => ({ date, maturityDays, status, actual, checkedAt })),
    comparisons, records: forecasts.map((f) => ({ id: f.id, issuedAt: f.issuedAt, request: f.v1.request,
      candidate: f.candidate, predictions: f.predictions.map((p) => ({ date: p.date, candidate: p.candidate.value,
        candidateReason: p.candidate.reason, reference: Object.fromEntries(Object.entries(p.reference).map(([m, v]) => [m, v.value])) })) })) };
}
export type TrialSummary = ReturnType<typeof summarizeTrial>;
