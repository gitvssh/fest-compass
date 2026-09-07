import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CALENDAR, calendarHash } from "./calendar";
import { makeTrialPlan, runCalendarTrial, TRIAL_REQUESTS, validateTrialPlan } from "./calendar-trial";
import type { CalendarReport } from "./calendar-evaluation";
import { archiveSnapshots } from "./store";
import { hash } from "../kto/history";
import { fixture } from "./test-fixture";
import { atomicJson, runDaily, type DailyResult } from "./daily";

const registrationAt = "2026-09-08T00:00:00.000Z";
function plan() {
  // A synthetic report establishes the boundary under test; it is never production evidence.
  const report = { generatedAt: registrationAt, calendarHash: calendarHash(CALENDAR),
    runs: [28, 7].map((horizonDays) => ({ horizonDays, selection: { candidate: "holiday", reference: "ridge" } })) } as unknown as CalendarReport;
  return makeTrialPlan(report, CALENDAR, { fixture: hash("synthetic-test-code") }, registrationAt);
}
async function withStore(fn: (store: string) => Promise<void>) {
  const store = await mkdtemp(join(tmpdir(), "fest-calendar-trial-test-"));
  try { await fn(store); } finally { await rm(store, { recursive: true, force: true }); }
}
test("registration is sealed before first issue and cannot be moved after outcomes become known", async () => withStore(async (store) => {
  const p = plan(); assert.equal(TRIAL_REQUESTS.length, 26); validateTrialPlan(p);
  assert.throws(() => validateTrialPlan({ ...p, frozenAt: "2026-10-09T00:00:00Z" }), /corrupt/);
  await assert.rejects(runCalendarTrial(store, p, [], [], "2026-10-08T00:00:00Z"), /registration-missed/);
  const registered = await runCalendarTrial(store, p, [], [], registrationAt);
  assert.equal(registered.issued, 0); assert.equal(registered.schedule.length, 26);
  assert.equal(registered.outcomes.length, 0);
  const beforeNine = await runCalendarTrial(store, p, [], [], "2026-10-07T23:59:59Z");
  assert.equal(beforeNine.issued, 0);
}));
test("future issue uses collected inputs, preserves all methods on restart and rejects record corruption", async () => withStore(async (store) => {
  const p = plan(); await runCalendarTrial(store, p, [], [], registrationAt);
  const data = fixture("2023-01-01", "2026-09-06", "2026-10-08T00:00:00.000Z");
  const refs = await archiveSnapshots(store, [data]);
  const blocked = await runCalendarTrial(store, p, [data], refs, "2026-10-08T00:00:01.000Z", false);
  assert.equal(blocked.issued, 0); assert.equal(blocked.schedule[0].status, "collection-failed");
  const issued = await runCalendarTrial(store, p, [data], refs, "2026-10-08T00:00:01.000Z");
  assert.equal(issued.issued, 1); assert.equal(issued.records[0].predictions.length, 4);
  assert.ok(issued.records[0].predictions.every((r) => r.candidate !== null && Object.values(r.reference).every((v) => v !== null)));
  const repeated = await runCalendarTrial(store, p, [data], refs, "2026-10-08T02:00:00.000Z");
  assert.deepEqual(repeated.records, issued.records);
  const missed = await runCalendarTrial(store, p, [data], refs, "2026-10-16T00:00:00.000Z");
  assert.equal(missed.issued, 1); assert.equal(missed.schedule.filter((s) => s.status === "missed").length, 1);
  const file = join(store, "calendar-trial", p.id, "forecasts", `${TRIAL_REQUESTS[0].requestId}.json`);
  const record = JSON.parse(await readFile(file, "utf8")); record.predictions[0].candidate.value = -1;
  await writeFile(file, JSON.stringify(record));
  await assert.rejects(runCalendarTrial(store, p, [data], refs, "2026-10-16T01:00:00.000Z"), /corrupt-calendar-trial-record/);
}));
test("60-day zero and missing truth stay frozen; 90-day revisions and missed checks remain separate", async () => withStore(async (store) => {
  const p = plan(); await runCalendarTrial(store, p, [], [], registrationAt);
  const first = fixture("2026-11-05", "2026-11-08", "2026-12-20T00:00:00.000Z", (_, i) => i === 0 ? 0 : null);
  const refs1 = await archiveSnapshots(store, [first]);
  const d60 = await runCalendarTrial(store, p, [first], refs1, "2027-01-04T00:01:00.000Z");
  assert.equal(d60.outcomes.find((o) => o.date === "2026-11-05" && o.maturityDays === 60)?.actual, 0);
  const missing = await runCalendarTrial(store, p, [first], refs1, "2027-01-05T00:01:00.000Z");
  assert.equal(missing.outcomes.find((o) => o.date === "2026-11-06" && o.maturityDays === 60)?.status, "missing");
  const revised = fixture("2026-11-05", "2026-11-08", "2027-02-03T00:00:00.000Z", () => 99);
  const refs2 = await archiveSnapshots(store, [first, revised]);
  const d90 = await runCalendarTrial(store, p, [first, revised], refs2, "2027-02-03T00:01:00.000Z");
  assert.equal(d90.outcomes.find((o) => o.date === "2026-11-05" && o.maturityDays === 60)?.actual, 0);
  assert.equal(d90.outcomes.find((o) => o.date === "2026-11-05" && o.maturityDays === 90)?.actual, 99);
  assert.equal(d90.outcomes.find((o) => o.date === "2026-11-06" && o.maturityDays === 60)?.actual, null);
  assert.equal(d90.outcomes.find((o) => o.date === "2026-11-07" && o.maturityDays === 60)?.status, "missed-check");
  assert.ok(d90.comparisons.every((c) => c.decision === "insufficient-outcomes"));
}));
test("adding the trial to an already completed daily run does not call the provider again", async () => withStore(async (store) => {
  const p = plan(), data = fixture("2025-01-01", "2026-08-08", "2026-09-07T00:00:00.000Z");
  await archiveSnapshots(store, [data]);
  const result: DailyResult = { schemaVersion: 1, date: "2026-09-08", startedAt: registrationAt, completedAt: registrationAt,
    status: "partial", calls: 7, error: null, snapshot: null, nextRunAt: "2026-09-09T09:00:00+09:00" };
  const { mkdir } = await import("node:fs/promises");
  await mkdir(join(store, "runs", result.date), { recursive: true });
  await atomicJson(join(store, "runs", result.date, "result.json"), result);
  let calls = 0;
  await runDaily(store, [], "", () => registrationAt, async () => { calls++; throw new Error("must-not-call"); }, p);
  const summary = JSON.parse(await readFile(join(store, "public-summary.json"), "utf8"));
  assert.equal(calls, 0); assert.equal(summary.payload.calendarTrialError, null);
  assert.equal(summary.payload.calendarTrial.schedule.length, 26); assert.equal(summary.payload.calendarTrial.issued, 0);
}));
