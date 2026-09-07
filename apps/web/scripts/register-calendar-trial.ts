import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import { hash } from "../lib/kto/history";
import { CALENDAR, calendarHash } from "../lib/forecast/calendar";
import { makeTrialPlan, validateTrialPlan, type TrialPlan } from "../lib/forecast/calendar-trial";
import type { CalendarReport } from "../lib/forecast/calendar-evaluation";

const files = ["lib/forecast/calendar.ts", "lib/forecast/calendar-model.ts", "lib/forecast/calendar-evaluation.ts",
  "lib/forecast/calendar-trial.ts", "lib/forecast/model.ts", "lib/forecast/prospective.ts", "lib/forecast/vintages.ts",
  "lib/forecast/store.ts", "lib/forecast/daily.ts", "lib/kto/history.ts", "lib/kto/wire.ts", "lib/kto/security.ts",
  "scripts/forecast-worker.ts", "scripts/register-calendar-trial.ts"];
async function main() {
  const codeHashes = Object.fromEntries(await Promise.all(files.map(async (path) => [path, hash(await readFile(path, "utf8"))])));
  const path = "data/calendar-trial-plan.json";
  if (process.argv.includes("--verify")) {
    const plan = JSON.parse(await readFile(path, "utf8")) as TrialPlan;
    validateTrialPlan(plan); assert.deepEqual(plan.codeHashes, codeHashes); assert.equal(plan.calendarHash, calendarHash(CALENDAR));
    const summary = JSON.parse(await readFile("data/nonsan-calendar-summary.json", "utf8"));
    assert.equal(plan.developmentReportHash, summary.reportHash);
    assert.deepEqual(plan.choices, summary.runs.map((r: CalendarReport["runs"][number]) => ({ horizonDays: r.horizonDays, candidate: r.selection.candidate, reference: r.selection.reference })));
    console.log(`사전 시험 검증 통과: 26건, 달력·개발 결과·${files.length}개 코드 해시 일치. ${plan.id}`);
  } else {
    const report = JSON.parse(gunzipSync(await readFile("../../docs/validation/evidence/2026-09-07-nonsan-calendar.json.gz")).toString()) as CalendarReport;
    const plan = makeTrialPlan(report, CALENDAR, codeHashes, new Date().toISOString());
    await writeFile(path, `${JSON.stringify(plan, null, 2)}\n`, { flag: "wx" });
    console.log(`사전 시험 목록 고정: ${plan.requests.length}건, 최초 발행 ${plan.firstIssueAt}, 계획 ${plan.id}`);
  }
}
main().catch(() => { console.error("calendar-trial-plan-verification-failed; inspect calendar, code and report versions"); process.exitCode = 1; });
