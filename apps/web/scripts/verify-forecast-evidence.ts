import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import { parseArgs } from "node:util";
import { EXPERIMENT, modelChoice, sampleSummary, summarizeEvaluation, type EvaluationReport } from "../lib/forecast/evaluation";
import { availableAt, baseline, observationsFromDataset, predictRidge, relativeIndex, residualRadius } from "../lib/forecast/model";
import { hash, shiftDay, type HistoryDataset } from "../lib/kto/history";

async function main() {
  const { values } = parseArgs({ options: { input: { type: "string" }, report: { type: "string" }, summary: { type: "string" } } });
  if (!values.input || !values.report || !values.summary) throw new Error("input, report and summary required");
  const dataset: HistoryDataset = JSON.parse(await readFile(values.input, "utf8"));
  const report: EvaluationReport = JSON.parse(gunzipSync(await readFile(values.report)).toString("utf8"));
  assert.equal(dataset.snapshotId, hash(JSON.stringify({ source: dataset.source, region: dataset.region, sourcePublishedAt: dataset.sourcePublishedAt,
    range: dataset.range, pages: dataset.pages, days: dataset.days })));
  assert.equal(report.dataset.snapshotId, dataset.snapshotId);
  assert.deepEqual(report.experiment, EXPERIMENT);
  assert.equal(report.experimentHash, hash(JSON.stringify(EXPERIMENT)));
  assert.deepEqual(JSON.parse(await readFile(values.summary, "utf8")), sampleSummary(report));
  const observations = observationsFromDataset(dataset), byId = new Map(observations.map((r) => [r.id, r]));
  assert.equal(observations.length, dataset.quality.completeDays);
  let predictions = 0, models = 0;
  for (const [key, ids] of Object.entries(report.inputSets)) {
    assert.equal(hash(JSON.stringify(ids)), key);
    assert.equal(new Set(ids).size, ids.length);
    assert.ok(ids.every((id) => byId.has(id)));
  }
  for (const [id, model] of Object.entries(report.models)) {
    assert.equal(hash(JSON.stringify(model)), id);
    assert.equal(model.inputHash, model.inputSet);
    assert.ok(report.inputSets[model.inputSet].every((key) => byId.get(key)!.date <= model.trainedThrough));
    assert.equal(report.inputSets[model.trainingTargetSet].length, model.trainingSamples);
    assert.ok(report.inputSets[model.trainingTargetSet].every((key) => report.inputSets[model.inputSet].includes(key)));
    models++;
  }
  for (const run of report.runs) {
    assert.deepEqual(run.choice, modelChoice(run.rows.filter((r) => r.phase === "tuning")));
    const calibrationRows = run.rows.filter((r) => r.phase === "calibration");
    const methods = ["B1", "B2", "ridge"] as const;
    const commonCalibration = calibrationRows.filter((r) => r.actual !== null && methods.every((m) => r.predictions[m].value !== null));
    for (const method of methods) assert.equal(run.calibration.radii[method], residualRadius(commonCalibration.map((r) => r.predictions[method].value! - r.actual!)));
    assert.deepEqual(run.test, summarizeEvaluation(run.rows.filter((r) => r.phase === "test"), [...methods]));
    const testDates = run.rows.filter((r) => r.phase === "test").map((r) => r.date);
    assert.equal(new Set(testDates).size, testDates.length);
    for (const row of run.rows) {
      const issuedDay = row.issuedAt.slice(0, 10);
      assert.equal(issuedDay, shiftDay(row.windowStart, -run.horizonDays));
      assert.equal(row.cutoff, shiftDay(issuedDay, -run.lagDays));
      assert.equal(row.actual, byId.get(`${row.date}/2`)?.value ?? null);
      const available = availableAt(observations, row.issuedAt, { mode: EXPERIMENT.mode, assumedLagDays: run.lagDays });
      assert.equal(row.lastObservation, available.at(-1)?.date ?? null);
      for (const [method, prediction] of Object.entries(row.predictions)) {
        assert.ok(prediction.inputIds.every((id) => byId.get(id)!.date <= row.cutoff));
        assert.equal(prediction.index, relativeIndex(prediction.value, row.predictions.B1.value));
        if (method === "B1" || method === "B2") {
          const expected = baseline(available, row.date, method);
          assert.equal(prediction.value, expected.value); assert.deepEqual(prediction.inputIds, expected.inputIds);
        }
        if (prediction.lower !== null) {
          assert.ok(Date.parse(row.issuedAt) >= Date.parse(run.calibration.availableAt));
          assert.equal(prediction.lower, Math.max(0, prediction.value! - run.calibration.radii[method as typeof methods[number]]!));
          assert.equal(prediction.upper, prediction.value! + run.calibration.radii[method as typeof methods[number]]!);
        }
        predictions++;
      }
      if (row.modelId) {
        const saved = report.models[row.modelId];
        assert.ok(saved.trainedThrough <= row.cutoff);
        const model = { ...saved, inputIds: report.inputSets[saved.inputSet], trainingTargetIds: report.inputSets[saved.trainingTargetSet] };
        const expected = predictRidge(model, available, row.date, row.cutoff);
        assert.equal(row.predictions.ridge.value, expected.value);
        assert.deepEqual(row.predictions.ridge.inputIds, expected.inputIds);
      }
    }
  }
  assert.equal(report.strictReplay.availableObservationsAt2025Festival, 0);
  console.log(`검증 통과: ${observations.length}일, 모델 ${models}개, 예측 ${predictions}개. 자료 해시·입력 시점·모델 재계산·기준·구간·평가 수치·화면 자료 일치.`);
}
main().catch((e: unknown) => { console.error(e instanceof Error ? e.message : "evidence-verification-failed"); process.exitCode = 1; });
