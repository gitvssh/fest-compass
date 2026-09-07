import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { gzipSync, gunzipSync } from "node:zlib";
import { evaluateFestivalHistory, festivalHistorySummary, type FestivalHistoryReport } from "../lib/forecast/festival-history";
import type { CalendarReport } from "../lib/forecast/calendar-evaluation";
import type { HistoryDataset } from "../lib/kto/history";

async function main() {
  const root = "../../docs/validation/evidence/2026-09-07-nonsan-";
  const output = `${root}festival-history.json.gz`, summaryPath = "data/nonsan-festival-history-summary.json";
  const control = JSON.parse(gunzipSync(await readFile(`${root}calendar.json.gz`)).toString()) as CalendarReport;
  const datasets = await Promise.all(["history", "current-history", "2022-history"].map(async (name) => JSON.parse(await readFile(`${root}${name}.json`, "utf8")) as HistoryDataset));
  const previous = process.argv.includes("--verify") ? JSON.parse(gunzipSync(await readFile(output)).toString()) as FestivalHistoryReport : null;
  const report = evaluateFestivalHistory(datasets.slice(0, 2), datasets[2], control, previous?.generatedAt ?? new Date().toISOString(), console.log);
  const summary = festivalHistorySummary(report);
  if (previous) {
    assert.deepEqual(report, previous);
    assert.deepEqual(summary, JSON.parse(await readFile(summaryPath, "utf8")));
    console.log("선행 이력 비교의 전체 모델·예측·입력·계수·화면 요약 재계산 일치");
  } else {
    await writeFile(output, gzipSync(`${JSON.stringify(report)}\n`), { flag: "wx" });
    await writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, { flag: "wx" });
  }
  for (const run of report.runs) console.log(JSON.stringify({ horizonDays: run.horizonDays, common: run.comparison.common,
    mae: Object.fromEntries(Object.entries(run.comparison.methods).map(([m, s]) => [m, s.mae])),
    festivalMAE: Object.fromEntries(Object.entries(run.groups.festival.methods).map(([m, s]) => [m, s.mae])), training: run.training }));
}
main().catch((error) => { console.error(error instanceof Error ? error.message : "festival-history-evaluation-failed"); process.exitCode = 1; });
