import { readFile, mkdir, writeFile, rename } from "node:fs/promises";
import { dirname } from "node:path";
import { parseArgs } from "node:util";
import { randomUUID } from "node:crypto";
import type { HistoryDataset } from "../lib/kto/history";
import { publicSummary } from "../lib/forecast/summary";
import { assessForecast, issueForecast, verifyStore } from "../lib/forecast/store";
import type { Request, Target } from "../lib/forecast/prospective";

async function main() {
  const { values, positionals } = parseArgs({ allowPositionals: true, options: {
    store: { type: "string" }, snapshot: { type: "string", multiple: true }, target: { type: "string" },
    "request-id": { type: "string" }, horizon: { type: "string" }, output: { type: "string" }, summary: { type: "string" },
  } });
  const [command] = positionals, store = values.store;
  if (!store || positionals.length !== 1 || !["issue", "assess", "verify", "export"].includes(command)) throw new Error("usage: forecast:records issue|assess|verify|export --store DIR [--snapshot FILE ...]");
  const datasets = await Promise.all((values.snapshot ?? []).map(async (p) => JSON.parse(await readFile(p, "utf8")) as HistoryDataset));
  if (command !== "verify" && !datasets.length) throw new Error("at-least-one-snapshot-required");
  if (command === "issue") {
    if (!values.target || !values["request-id"] || !["7", "28"].includes(values.horizon ?? "")) throw new Error("issue-requires-target-request-id-horizon");
    const target = JSON.parse(await readFile(values.target, "utf8")) as Target;
    const request: Request = { requestId: values["request-id"], horizonDays: Number(values.horizon) as 7 | 28, target };
    const result = await issueForecast(store, request, datasets, new Date().toISOString());
    console.log(JSON.stringify({ reused: result.reused, id: result.receipt.id, status: result.receipt.status,
      issuedAt: result.receipt.issuedAt, dates: result.receipt.predictions.map((r) => r.date) }));
  } else if (command === "assess") {
    if (!values["request-id"]) throw new Error("assess-requires-request-id");
    const result = await assessForecast(store, values["request-id"], datasets, new Date().toISOString());
    console.log(JSON.stringify({ id: result.id, observedDays: result.observedDays, comparableDays: result.comparableDays }));
  } else {
    const verified = await verifyStore(store);
    if (command === "verify") {
      if (values.summary) {
        if (!datasets.length) throw new Error("summary-verification-requires-snapshots");
        const summary = JSON.parse(await readFile(values.summary, "utf8"));
        if (JSON.stringify(publicSummary(verified, datasets, summary.generatedAt)) !== JSON.stringify(summary)) throw new Error("public-summary-mismatch");
      }
      console.log(JSON.stringify({ verifiedForecasts: verified.receipts.length, verifiedAssessments: verified.assessments.length, summaryVerified: Boolean(values.summary) })); return;
    }
    if (!values.output) throw new Error("export-requires-output");
    const generatedAt = new Date().toISOString();
    const summary = publicSummary(verified, datasets, generatedAt);
    await mkdir(dirname(values.output), { recursive: true });
    const temporary = `${values.output}.${randomUUID()}.tmp`;
    await writeFile(temporary, `${JSON.stringify(summary, null, 2)}\n`, { flag: "wx" });
    await rename(temporary, values.output);
    console.log(JSON.stringify({ forecasts: summary.records.length, availableDays: summary.monitor.coverage.availableDays,
      latestObservation: summary.monitor.coverage.latestObservation, missingDays: summary.monitor.coverage.missingDates.length }));
  }
}
main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : "forecast-records-failed"); process.exitCode = 1; });
