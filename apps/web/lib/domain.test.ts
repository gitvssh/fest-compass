import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildScenarioCalculation,
  latestAssumptionRows,
  nextLabelLevel,
  normalizeGranularity,
  normalizeOccurredAt,
  scenarioChangeSummary,
  validateAssumptionSet,
  validateFestivalDates,
} from "./queries";

test("시나리오 계산은 운영안과 분리된 최소·기준·최대 유입 매트릭스를 만든다", () => {
  const calculation = buildScenarioCalculation({
    inflow: { min: 12000, base: 18000, max: 26000 },
    peakRatio: 0.35,
    dwellHours: 2.5,
    operatingHours: 8,
    approvedCapacity: 2500,
    hasApprovalBasis: true,
  });

  assert.equal(calculation.result.byInflow.min.peakConcurrent, 1312.5);
  assert.equal(calculation.result.byInflow.base.peakConcurrent, 1968.75);
  assert.equal(calculation.result.byInflow.max.peakConcurrent, 2843.75);
  assert.deepEqual(calculation.formula.byInflow, { min: 12000, base: 18000, max: 26000 });
  assert.equal(calculation.formula.sharedInputs.approvedCapacity, 2500);
});

test("가정 세트는 빈 값을 허용하고 올바른 범위를 통과시킨다", () => {
  assert.doesNotThrow(() =>
    validateAssumptionSet({
      inflowMin: null,
      inflowBase: 18000,
      inflowMax: null,
      peakRatio: 0.35,
      dwellHours: 2.5,
      operatingHours: 8,
    }),
  );
});

test("가정 세트는 유입 순서와 각 범위를 거부한다", () => {
  const valid = {
    inflowMin: 12000,
    inflowBase: 18000,
    inflowMax: 26000,
    peakRatio: 0.35,
    dwellHours: 2.5,
    operatingHours: 8,
  };
  assert.throws(
    () => validateAssumptionSet({ ...valid, inflowMin: 20000, inflowBase: 18000 }),
    /최소 ≤ 기준 ≤ 최대/,
  );
  assert.throws(() => validateAssumptionSet({ ...valid, inflowMin: -1 }), /0 이상/);
  assert.throws(() => validateAssumptionSet({ ...valid, peakRatio: 1.1 }), /피크비율/);
  assert.throws(() => validateAssumptionSet({ ...valid, dwellHours: 0 }), /평균체류시간/);
  assert.throws(() => validateAssumptionSet({ ...valid, operatingHours: 25 }), /운영시간/);
});

test("최신 가정 선택은 배열 순서가 아니라 version과 createdAt을 따른다", () => {
  const rows = [
    { item: "inflow", version: 1, createdAt: new Date("2026-01-01"), marker: "old" },
    { item: "peakRatio", version: 2, createdAt: new Date("2026-02-01"), marker: "peak" },
    { item: "inflow", version: 2, createdAt: new Date("2026-02-01"), marker: "new" },
    { item: "dwellHours", version: 1, createdAt: new Date("2026-01-01"), marker: "dwell" },
    { item: "operatingHours", version: 1, createdAt: new Date("2026-01-01"), marker: "hours" },
  ];
  const latest = latestAssumptionRows(rows);
  assert.equal(latest.find((row) => row.item === "inflow")?.marker, "new");
  assert.deepEqual(
    latest.map((row) => row.item),
    ["inflow", "peakRatio", "dwellHours", "operatingHours"],
  );
});

test("불완전한 상위 버전은 완전한 가정 세트와 섞지 않는다", () => {
  const rows = [
    ...["inflow", "peakRatio", "dwellHours", "operatingHours"].map((item) => ({
      item,
      version: 1,
      createdAt: new Date("2026-01-01"),
      marker: `${item}-v1`,
    })),
    { item: "inflow", version: 2, createdAt: new Date("2026-02-01"), marker: "partial-v2" },
  ];
  const latest = latestAssumptionRows(rows);
  assert.equal(latest.length, 4);
  assert.ok(latest.every((row) => row.version === 1));
});

test("축제 날짜는 실제 달력 날짜와 시작·종료 순서를 검증한다", () => {
  assert.doesNotThrow(() => validateFestivalDates("2026-04-10", "2026-04-12"));
  assert.doesNotThrow(() => validateFestivalDates(null, null));
  assert.throws(() => validateFestivalDates("2026-02-30", null), /유효한 날짜/);
  assert.throws(() => validateFestivalDates("2026-04-12", "2026-04-10"), /늦을 수 없습니다/);
});

test("현장 시각은 datetime-local 값을 원장 형식으로 정규화한다", () => {
  assert.equal(normalizeOccurredAt("2026-04-11T13:40"), "2026-04-11 13:40");
  assert.throws(() => normalizeOccurredAt("2026-02-30 13:40"), /유효한 날짜와 시간/);
  assert.throws(() => normalizeOccurredAt("2026-04-11"), /YYYY-MM-DD HH:mm/);
});

test("집계 단위는 total, hourly, zone만 허용한다", () => {
  assert.equal(normalizeGranularity(undefined), "total");
  assert.equal(normalizeGranularity("hourly"), "hourly");
  assert.throws(() => normalizeGranularity("daily"), /집계 단위/);
});

test("라벨 전이는 확인된 실제값이 있을 때만 단조 증가한다", () => {
  const base = { actualValue: 100, confirmed: true, kind: "measured" };
  assert.equal(nextLabelLevel("L0", { ...base, granularity: "total" }), "L1");
  assert.equal(nextLabelLevel("L0", { ...base, granularity: "hourly" }), "L2");
  assert.equal(nextLabelLevel("L1", { ...base, granularity: "zone" }), "L2");
  assert.equal(nextLabelLevel("L2", { ...base, granularity: "total" }), "L2");
  assert.equal(nextLabelLevel("L3", { ...base, granularity: "hourly" }), "L3");
  assert.equal(
    nextLabelLevel("L0", { ...base, actualValue: null, granularity: "total" }),
    "L0",
  );
  assert.equal(
    nextLabelLevel("L0", { ...base, confirmed: false, granularity: "total" }),
    "L0",
  );
});

test("결정 요약은 모든 운영자원과 동선을 포함한다", () => {
  assert.equal(
    scenarioChangeSummary({
      name: "확대안",
      shuttles: 3,
      staffParking: 6,
      sessions: 3,
      zone: "호수 무대 앞",
      routeNote: "우회 동선 예비",
    }),
    "확대안: 셔틀 3대, 주차 안내 6명, 회차 3회, 구역: 호수 무대 앞, 동선: 우회 동선 예비",
  );
});
