import assert from "node:assert/strict";
import { test } from "node:test";
import { computeCapacity } from "./capacity";

const seedInputs = {
  peakRatio: 0.35,
  dwellHours: 2.5,
  operatingHours: 8,
  approvedCapacity: 2500,
  hasApprovalBasis: true,
};

test("시드 기준 유입 1.8만 명 계산이 수기와 일치한다", () => {
  const result = computeCapacity({ ...seedInputs, inflow: 18000 });
  assert.equal(result.peakConcurrent, 1968.75);
  assert.equal(result.slack, 531.25);
  assert.equal(result.occupancy, 0.7875);
  assert.equal(result.safetyEnabled, true);
});

test("시드 최소 1.2만 / 최대 2.6만 명 계산이 수기와 일치한다", () => {
  const min = computeCapacity({ ...seedInputs, inflow: 12000 });
  const max = computeCapacity({ ...seedInputs, inflow: 26000 });
  assert.equal(min.peakConcurrent, 1312.5);
  assert.equal(min.slack, 1187.5);
  assert.equal(max.peakConcurrent, 2843.75);
  assert.equal(max.slack, -343.75);
  assert.ok((max.occupancy ?? 0) > 1);
});

test("승인 수용량이 없으면 여유를 0으로 위장하지 않는다", () => {
  const result = computeCapacity({
    inflow: 18000,
    peakRatio: 0.35,
    dwellHours: 2.5,
    operatingHours: 8,
    approvedCapacity: null,
    hasApprovalBasis: true,
  });
  assert.equal(result.peakConcurrent, 1968.75);
  assert.equal(result.slack, null);
  assert.equal(result.occupancy, null);
  assert.equal(result.safetyEnabled, false);
});

test("기준문서·승인자가 없으면 수용량이 있어도 안전 계산을 켜지 않는다", () => {
  const result = computeCapacity({ ...seedInputs, inflow: 18000, hasApprovalBasis: false });
  assert.equal(result.peakConcurrent, 1968.75);
  assert.equal(result.slack, null);
  assert.equal(result.occupancy, null);
  assert.equal(result.safetyEnabled, false);
});

test("빈 유입 가정은 피크를 계산하지 않는다", () => {
  const result = computeCapacity({
    inflow: null,
    peakRatio: 0.35,
    dwellHours: 2.5,
    operatingHours: 8,
    approvedCapacity: 2500,
    hasApprovalBasis: true,
  });
  assert.equal(result.peakConcurrent, null);
  assert.equal(result.slack, null);
});
