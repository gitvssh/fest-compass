import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { parseArgs } from "node:util";
import { gzipSync } from "node:zlib";
import { evaluateHistory, sampleSummary } from "../lib/forecast/evaluation";
import type { HistoryDataset } from "../lib/kto/history";

async function main() {
  const { values } = parseArgs({ options: { input: { type: "string" }, output: { type: "string" }, summary: { type: "string" } } });
  if (!values.input || !values.output || !values.summary || !values.output.endsWith(".json.gz")) throw new Error("input, output (.json.gz) and summary paths required");
  const dataset: HistoryDataset = JSON.parse(await readFile(resolve(values.input), "utf8"));
  const report = evaluateHistory(dataset, console.log);
  for (const path of [values.output, values.summary]) await mkdir(dirname(resolve(path)), { recursive: true });
  await writeFile(resolve(values.output), gzipSync(JSON.stringify(report) + "\n"), { flag: "wx" });
  await writeFile(resolve(values.summary), JSON.stringify(sampleSummary(report), null, 2) + "\n", { flag: "wx" });
  for (const run of report.runs) console.log(`지연 ${run.lagDays}일 D-${run.horizonDays}: ${run.test.comparable}일 평가, ${run.decision}`);
}
main().catch((e: unknown) => { console.error(e instanceof Error ? e.message : "forecast-evaluation-failed"); process.exitCode = 1; });
