import type { HistoryDataset } from "../kto/history";
import { monitorHistory } from "./vintages";
import type { Assessment, Receipt } from "./prospective";

export function publicSummary(verified: { receipts: Receipt[]; assessments: Assessment[] }, datasets: HistoryDataset[], generatedAt: string) {
  if (datasets.some((d) => Date.parse(d.generatedAt) > Date.parse(generatedAt))) throw new Error("snapshot-not-yet-observed");
  return { schemaVersion: 1, generatedAt, monitor: monitorHistory(datasets, generatedAt),
    records: verified.receipts.filter((r) => Date.parse(r.issuedAt) <= Date.parse(generatedAt)).map((r) => {
      const assessment = verified.assessments.filter((a) => a.forecastId === r.id && Date.parse(a.assessedAt) <= Date.parse(generatedAt))
        .sort((a, b) => a.assessedAt.localeCompare(b.assessedAt)).at(-1);
      return { id: r.id, request: r.request, issuedAt: r.issuedAt, scheduledIssuedAt: r.scheduledIssuedAt, latenessSeconds: r.latenessSeconds,
        status: r.status, inputCutoff: r.inputCutoff, lastInputDate: r.lastInputDate, policy: r.policy,
        snapshots: r.snapshots, trainingSamples: r.model?.trainingSamples ?? 0, interval: r.interval,
        predictions: r.predictions.map((row) => ({ date: row.date, predictions: Object.fromEntries(Object.entries(row.predictions).map(([method, p]) => [method, { value: p.value, index: p.index, reason: p.reason }])) })),
        assessment: assessment ? { id: assessment.id, assessedAt: assessment.assessedAt, observedDays: assessment.observedDays,
          comparableDays: assessment.comparableDays, metrics: assessment.metrics,
          rows: assessment.rows.map((row) => ({ date: row.date, status: row.status, actual: row.actual, vintageId: row.vintage?.id ?? null })) } : null };
    }) };
}
