import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { gzipSync, gunzipSync } from "node:zlib";
import { CALENDAR } from "../lib/forecast/calendar";
import { calendarSummary, evaluateCalendar, type CalendarReport } from "../lib/forecast/calendar-evaluation";
import type { HistoryDataset } from "../lib/kto/history";

async function main() {
  const evidence = "../../docs/validation/evidence/2026-09-07-nonsan-calendar.json.gz", summary = "data/nonsan-calendar-summary.json";
  const inputs = ["../../docs/validation/evidence/2026-09-07-nonsan-history.json", "../../docs/validation/evidence/2026-09-07-nonsan-current-history.json"];
  const datasets = await Promise.all(inputs.map(async (p) => JSON.parse(await readFile(p, "utf8")) as HistoryDataset));
  const previous = process.argv.includes("--verify") ? JSON.parse(gunzipSync(await readFile(evidence)).toString()) as CalendarReport : null;
  const report = evaluateCalendar(datasets, CALENDAR, previous?.generatedAt ?? new Date().toISOString(), console.log);
  if (previous) {
    assert.deepEqual(report, previous);
    assert.deepEqual(calendarSummary(report), JSON.parse(await readFile(summary, "utf8")));
    console.log("달력·시간순 학습·모든 계수와 예측·민감도·화면 요약 재계산 일치");
  } else {
    await writeFile(evidence, gzipSync(`${JSON.stringify(report)}\n`), { flag: "wx" });
    await writeFile(summary, `${JSON.stringify(calendarSummary(report), null, 2)}\n`, { flag: "wx" });
  }
  for (const run of report.runs) console.log(JSON.stringify({ horizonDays: run.horizonDays, common: run.comparison.common,
    methods: Object.fromEntries(Object.entries(run.comparison.methods).map(([m, s]) => [m, { mae: s.mae, available: s.available }])),
    selection: { candidate: run.selection.candidate, reference: run.selection.reference, improvement: run.selection.relativeMAEImprovement } }));
}
main().catch((error) => { console.error(error instanceof Error ? error.message : "calendar-evaluation-failed"); process.exitCode = 1; });
