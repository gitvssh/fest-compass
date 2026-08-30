export type CapacityInputs = {
  inflow: number | null;
  peakRatio: number | null;
  dwellHours: number | null;
  operatingHours: number | null;
  approvedCapacity: number | null;
  /** 승인 수용량의 기준문서와 승인자가 모두 확인된 경우에만 true — 없으면 안전 관련 계산을 켜지 않는다(기획서 §6.4) */
  hasApprovalBasis: boolean;
};

export type CapacityResult = {
  peakConcurrent: number | null;
  slack: number | null;
  occupancy: number | null;
  safetyEnabled: boolean;
  formula: {
    peakConcurrent: string;
    slack: string;
    occupancy: string;
  };
  inputs: CapacityInputs;
};

export const CAPACITY_FORMULA = {
  peakConcurrent: "유입가정 × 피크비율 × (평균체류시간 / 운영시간)",
  slack: "승인수용량 − 피크동시체류",
  occupancy: "피크동시체류 / 승인수용량",
} as const;

function isPresent(value: number | null | undefined): value is number {
  return value !== null && value !== undefined && Number.isFinite(value);
}

export function computeCapacity(inputs: CapacityInputs): CapacityResult {
  const { inflow, peakRatio, dwellHours, operatingHours, approvedCapacity, hasApprovalBasis } = inputs;
  const canPeak =
    isPresent(inflow) &&
    isPresent(peakRatio) &&
    isPresent(dwellHours) &&
    isPresent(operatingHours) &&
    operatingHours > 0;

  const peakConcurrent = canPeak
    ? inflow * peakRatio * (dwellHours / operatingHours)
    : null;

  const safetyEnabled = isPresent(approvedCapacity) && approvedCapacity > 0 && hasApprovalBasis;
  const slack =
    safetyEnabled && isPresent(peakConcurrent) ? approvedCapacity - peakConcurrent : null;
  const occupancy =
    safetyEnabled && isPresent(peakConcurrent) ? peakConcurrent / approvedCapacity : null;

  return {
    peakConcurrent,
    slack,
    occupancy,
    safetyEnabled,
    formula: { ...CAPACITY_FORMULA },
    inputs,
  };
}

export function occupancyWarning(occupancy: number | null): "ok" | "watch" | "over" | "off" {
  if (occupancy === null) return "off";
  if (occupancy > 1) return "over";
  if (occupancy >= 0.85) return "watch";
  return "ok";
}
