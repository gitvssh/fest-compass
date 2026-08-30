import {
  computeCapacity,
  type CapacityInputs,
  type CapacityResult,
} from "@/lib/calc/capacity";
import { prisma } from "@/lib/db";

export const SEED_FESTIVAL_ID = "seed-spring-flower";

export const ASSUMPTION_ITEMS = [
  "inflow",
  "peakRatio",
  "dwellHours",
  "operatingHours",
] as const;

export type AssumptionItem = (typeof ASSUMPTION_ITEMS)[number];
export type InflowBand = "min" | "base" | "max";

export type ScenarioCapacityMatrix = {
  byInflow: Record<InflowBand, CapacityResult>;
};

export type ScenarioCalculationInput = Omit<CapacityInputs, "inflow"> & {
  inflow: Record<InflowBand, number | null>;
};

export type ScenarioFormulaSnapshot = {
  formula: CapacityResult["formula"];
  sharedInputs: Omit<CapacityInputs, "inflow">;
  byInflow: Record<InflowBand, number | null>;
};

export type AssumptionSetValues = {
  inflowMin: number | null;
  inflowBase: number | null;
  inflowMax: number | null;
  peakRatio: number | null;
  dwellHours: number | null;
  operatingHours: number | null;
};

export type OutcomeForLabel = {
  actualValue: number | null;
  confirmed: boolean;
  kind: string;
  granularity: string;
};

export async function listFestivals() {
  return prisma.festival.findMany({
    orderBy: [{ isDemo: "desc" }, { createdAt: "desc" }],
    include: { decisions: { orderBy: { decidedAt: "desc" }, take: 1 } },
  });
}

export async function getFestival(id: string) {
  return prisma.festival.findUnique({
    where: { id },
    include: {
      snapshots: { orderBy: { fetchedAt: "desc" } },
      assumptions: { orderBy: [{ version: "desc" }, { createdAt: "desc" }] },
      capacityRules: true,
      scenarios: true,
      decisions: { orderBy: { decidedAt: "desc" }, include: { scenario: true } },
      triggers: { orderBy: { createdAt: "asc" } },
      fieldActions: {
        orderBy: { occurredAt: "desc" },
        include: { operationTrigger: true },
      },
      outcomes: true,
      quality: true,
    },
  });
}

export type FestivalDetail = NonNullable<Awaited<ReturnType<typeof getFestival>>>;

type AssumptionLike = {
  item: string;
  version: number;
  createdAt: Date;
};

export function latestAssumptionRows<T extends AssumptionLike>(rows: readonly T[]): T[] {
  const byVersion = new Map<number, Map<string, T>>();
  for (const row of rows) {
    const group = byVersion.get(row.version) ?? new Map<string, T>();
    const current = group.get(row.item);
    if (!current || row.createdAt.getTime() > current.createdAt.getTime()) group.set(row.item, row);
    byVersion.set(row.version, group);
  }
  const completeVersion = [...byVersion.entries()]
    .filter(([, group]) => ASSUMPTION_ITEMS.every((item) => group.has(item)))
    .sort(([a], [b]) => b - a)[0];
  if (completeVersion) {
    return ASSUMPTION_ITEMS.map((item) => completeVersion[1].get(item)).filter((row): row is T => Boolean(row));
  }

  // 레거시 데이터에 완전한 세트가 하나도 없을 때만 항목별 최신 행으로 폴백한다.
  const latest = new Map<string, T>();
  for (const row of rows) {
    const current = latest.get(row.item);
    if (!current || isNewerAssumption(row, current)) latest.set(row.item, row);
  }
  return ASSUMPTION_ITEMS.map((item) => latest.get(item)).filter((row): row is T => Boolean(row));
}

export function latestAssumption(festival: FestivalDetail, item: string) {
  return latestAssumptionRows(festival.assumptions).find((row) => row.item === item) ?? null;
}

export function buildScenarioCalculation(input: ScenarioCalculationInput): {
  result: ScenarioCapacityMatrix;
  formula: ScenarioFormulaSnapshot;
} {
  const sharedInputs: Omit<CapacityInputs, "inflow"> = {
    peakRatio: input.peakRatio,
    dwellHours: input.dwellHours,
    operatingHours: input.operatingHours,
    approvedCapacity: input.approvedCapacity,
    hasApprovalBasis: input.hasApprovalBasis,
  };
  const byInflow: Record<InflowBand, CapacityResult> = {
    min: computeCapacity({ ...sharedInputs, inflow: input.inflow.min }),
    base: computeCapacity({ ...sharedInputs, inflow: input.inflow.base }),
    max: computeCapacity({ ...sharedInputs, inflow: input.inflow.max }),
  };

  return {
    result: { byInflow },
    formula: {
      formula: byInflow.base.formula,
      sharedInputs,
      byInflow: { ...input.inflow },
    },
  };
}

export function scenarioResults(festival: FestivalDetail) {
  const inflow = latestAssumption(festival, "inflow");
  const peak = latestAssumption(festival, "peakRatio");
  const dwell = latestAssumption(festival, "dwellHours");
  const hours = latestAssumption(festival, "operatingHours");
  const rule = festival.capacityRules[0] ?? null;
  const calculation = buildScenarioCalculation({
    inflow: {
      min: inflow?.minValue ?? null,
      base: inflow?.baseValue ?? null,
      max: inflow?.maxValue ?? null,
    },
    peakRatio: peak?.baseValue ?? null,
    dwellHours: dwell?.baseValue ?? rule?.dwellHours ?? null,
    operatingHours: hours?.baseValue ?? null,
    approvedCapacity: rule?.approvedCapacity ?? null,
    hasApprovalBasis: Boolean(rule?.documentRef && rule?.approver),
  });

  return festival.scenarios
    .map((scenario) => ({
      scenario,
      matrix: calculation.result,
      byInflow: calculation.result.byInflow,
      // 기존 화면이 P1 화면 개편과 독립적으로 계속 컴파일되도록 기준값 별칭을 유지한다.
      live: calculation.result.byInflow.base,
      stored: parseScenarioMatrix(scenario.resultJson),
    }))
    .sort((a, b) => orderOf(a.scenario.kind) - orderOf(b.scenario.kind));
}

export function validateAssumptionSet(values: AssumptionSetValues): void {
  const { inflowMin, inflowBase, inflowMax, peakRatio, dwellHours, operatingHours } = values;
  const inflows = [inflowMin, inflowBase, inflowMax].filter(isPresent);
  if (inflows.some((value) => value < 0)) {
    throw new Error("유입 가정은 0 이상이어야 합니다.");
  }

  if (
    (isPresent(inflowMin) && isPresent(inflowBase) && inflowMin > inflowBase) ||
    (isPresent(inflowBase) && isPresent(inflowMax) && inflowBase > inflowMax) ||
    (isPresent(inflowMin) && isPresent(inflowMax) && inflowMin > inflowMax)
  ) {
    throw new Error("최소 ≤ 기준 ≤ 최대 순서여야 합니다.");
  }

  if (isPresent(peakRatio) && (peakRatio <= 0 || peakRatio > 1)) {
    throw new Error("피크비율은 0보다 크고 1 이하여야 합니다.");
  }
  if (isPresent(dwellHours) && (dwellHours <= 0 || dwellHours > 24)) {
    throw new Error("평균체류시간은 0보다 크고 24 이하여야 합니다.");
  }
  if (isPresent(operatingHours) && (operatingHours <= 0 || operatingHours > 24)) {
    throw new Error("운영시간은 0보다 크고 24 이하여야 합니다.");
  }
}

export function validateFestivalDates(startDate: string | null, endDate: string | null): void {
  if (startDate && !isValidIsoDate(startDate)) {
    throw new Error("시작일은 YYYY-MM-DD 형식의 유효한 날짜여야 합니다.");
  }
  if (endDate && !isValidIsoDate(endDate)) {
    throw new Error("종료일은 YYYY-MM-DD 형식의 유효한 날짜여야 합니다.");
  }
  if (startDate && endDate && startDate > endDate) {
    throw new Error("시작일은 종료일보다 늦을 수 없습니다.");
  }
}

export function normalizeOccurredAt(value: string): string {
  const normalized = value.trim().replace("T", " ");
  const match = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/.exec(normalized);
  if (!match) throw new Error("발생 시각은 YYYY-MM-DD HH:mm 형식이어야 합니다.");
  const [, year, month, day, hour, minute] = match;
  if (
    !isValidDateParts(Number(year), Number(month), Number(day)) ||
    Number(hour) > 23 ||
    Number(minute) > 59
  ) {
    throw new Error("발생 시각은 유효한 날짜와 시간이어야 합니다.");
  }
  return normalized;
}

export function normalizeGranularity(value: string | null | undefined): "total" | "hourly" | "zone" {
  const normalized = value?.trim() || "total";
  if (normalized === "total" || normalized === "hourly" || normalized === "zone") {
    return normalized;
  }
  throw new Error("집계 단위는 total, hourly, zone 중 하나여야 합니다.");
}

export function nextLabelLevel(current: string, outcome: OutcomeForLabel): string {
  if (!outcome.confirmed || outcome.kind !== "measured" || outcome.actualValue === null) return current;
  if (current === "L2" || current === "L3") return current;
  if (outcome.granularity === "hourly" || outcome.granularity === "zone") return "L2";
  if (outcome.granularity === "total" && current === "L0") return "L1";
  return current;
}

export function scenarioChangeSummary(scenario: {
  name: string;
  shuttles: number | null;
  staffParking: number | null;
  sessions: number | null;
  routeNote: string | null;
  zone: string | null;
}): string {
  const resources = [
    `셔틀 ${valueWithUnit(scenario.shuttles, "대")}`,
    `주차 안내 ${valueWithUnit(scenario.staffParking, "명")}`,
    `회차 ${valueWithUnit(scenario.sessions, "회")}`,
  ];
  if (scenario.zone?.trim()) resources.push(`구역: ${scenario.zone.trim()}`);
  const routeNote = scenario.routeNote?.trim();
  if (routeNote) resources.push(`동선: ${routeNote}`);
  return `${scenario.name}: ${resources.join(", ")}`;
}

export type ApiLogKind = "success" | "empty" | "error";

export async function listApiLogs({
  limit = 40,
  kind,
}: {
  limit?: number;
  kind?: ApiLogKind;
} = {}) {
  return prisma.apiCallLog.findMany({
    where: kind ? { resultKind: kind } : undefined,
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

function parseScenarioMatrix(raw: string | null): ScenarioCapacityMatrix | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<ScenarioCapacityMatrix>;
    return parsed.byInflow?.min && parsed.byInflow.base && parsed.byInflow.max
      ? (parsed as ScenarioCapacityMatrix)
      : null;
  } catch {
    return null;
  }
}

function orderOf(kind: string) {
  if (kind === "conservative") return 0;
  if (kind === "base") return 1;
  return 2;
}

function isNewerAssumption(candidate: AssumptionLike, current: AssumptionLike): boolean {
  if (candidate.version !== current.version) return candidate.version > current.version;
  return candidate.createdAt.getTime() > current.createdAt.getTime();
}

function isPresent(value: number | null | undefined): value is number {
  return value !== null && value !== undefined && Number.isFinite(value);
}

function isValidIsoDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  return isValidDateParts(Number(match[1]), Number(match[2]), Number(match[3]));
}

function isValidDateParts(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function valueWithUnit(value: number | null, unit: string): string {
  return value === null ? "없음" : `${value}${unit}`;
}
