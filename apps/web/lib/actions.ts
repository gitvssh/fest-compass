"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { assertEditorMode } from "@/lib/app-mode";
import { prisma } from "@/lib/db";
import { parseOptionalNumber } from "@/lib/format";
import { getFestivalDetail, searchFestivalsByKeyword } from "@/lib/kto/client";
import { refreshFestivalEvidence } from "@/lib/kto/refresh";
import {
  buildScenarioCalculation,
  latestAssumptionRows,
  nextLabelLevel,
  normalizeGranularity,
  normalizeOccurredAt,
  scenarioChangeSummary,
  validateAssumptionSet,
  validateFestivalDates,
} from "@/lib/queries";

export type FormActionState = {
  status: "idle" | "error" | "success";
  submissionId: number;
  values: Record<string, string>;
  fieldErrors: Record<string, string>;
  formError?: string;
  message?: string;
};

type FestivalCreateInput = {
  name: string;
  organization: string | null;
  place: string | null;
  program: string | null;
  startDate: string | null;
  endDate: string | null;
  areaCode: string | null;
  sigunguCode: string | null;
  ldongRegnCd: string | null;
  ldongSignguCd: string | null;
  mapX: string | null;
  mapY: string | null;
  contentId: string | null;
  provenance: "manual" | "kto";
  author: string;
};

class FormValidationError extends Error {
  constructor(
    readonly fieldErrors: Record<string, string> = {},
    readonly formError?: string,
  ) {
    super(formError ?? Object.values(fieldErrors)[0] ?? "입력값을 확인해 주세요.");
    this.name = "FormValidationError";
  }
}

function pathOf(id: string, tab: "evidence" | "scenarios" | "ledger" | "report") {
  return `/festivals/${id}/${tab}`;
}

export async function searchKtoAction(formData: FormData) {
  assertEditorMode();
  const keyword = String(formData.get("keyword") ?? "").trim();
  if (!keyword) redirect("/festivals/new");
  redirect(`/festivals/new?q=${encodeURIComponent(keyword)}`);
}

export async function createFestivalAction(formData: FormData) {
  assertEditorMode();
  const name = requiredText(formData.get("name"), "축제 이름", "name");
  const startDate = emptyToNull(formData.get("startDate"));
  const endDate = emptyToNull(formData.get("endDate"));
  validateDatesForForm(startDate, endDate);

  const id = await createFestivalWorkspace({
    name,
    organization: emptyToNull(formData.get("organization")),
    place: emptyToNull(formData.get("place")),
    program: emptyToNull(formData.get("program")),
    startDate,
    endDate,
    areaCode: emptyToNull(formData.get("areaCode")),
    sigunguCode: emptyToNull(formData.get("sigunguCode")),
    ldongRegnCd: emptyToNull(formData.get("ldongRegnCd") ?? formData.get("lDongRegnCd")),
    ldongSignguCd: emptyToNull(formData.get("ldongSignguCd") ?? formData.get("lDongSignguCd")),
    mapX: emptyToNull(formData.get("mapX")),
    mapY: emptyToNull(formData.get("mapY")),
    // 수동 등록에서는 클라이언트가 contentId/provenance를 보내더라도 신뢰하지 않는다.
    contentId: null,
    provenance: "manual",
    author: emptyToNull(formData.get("author")) ?? "총괄기획",
  });
  redirect(pathOf(id, "evidence"));
}

export async function createFestivalFormAction(previous: FormActionState, formData: FormData) {
  assertEditorMode();
  return captureFormState(previous, formData, () => createFestivalAction(formData));
}

export async function createFromKtoAction(formData: FormData) {
  assertEditorMode();
  const contentId = requiredText(formData.get("contentId"), "KTO 콘텐츠 ID", "contentId");
  const detail = await getFestivalDetail(contentId);
  if (!detail.ok || !detail.data) {
    throw new FormValidationError(
      { contentId: "선택한 축제의 KTO 상세정보를 확인할 수 없습니다." },
      "KTO 상세정보를 다시 불러온 뒤 재시도해 주세요.",
    );
  }

  const title = String(detail.data.title ?? "").trim();
  if (!title) {
    throw new FormValidationError(
      { contentId: "KTO 상세정보에 축제 이름이 없습니다." },
      "이 항목은 자동 등록할 수 없습니다. 직접 입력으로 계속해 주세요.",
    );
  }

  const startDate = ymdToDate(detail.data.eventstartdate ?? "");
  const endDate = ymdToDate(detail.data.eventenddate ?? "");
  validateDatesForForm(startDate, endDate);
  const authoritativeContentId = String(detail.data.contentId ?? contentId).trim() || contentId;
  const id = await createFestivalWorkspace({
    name: title,
    organization: null,
    place: emptyStringToNull(detail.data.addr1),
    program: emptyStringToNull(detail.data.overview?.slice(0, 180)),
    startDate,
    endDate,
    areaCode: emptyStringToNull(detail.data.areacode),
    sigunguCode: emptyStringToNull(detail.data.sigungucode),
    ldongRegnCd: emptyStringToNull(detail.data.ldongRegnCd),
    ldongSignguCd: emptyStringToNull(detail.data.ldongSignguCd),
    mapX: emptyStringToNull(detail.data.mapx),
    mapY: emptyStringToNull(detail.data.mapy),
    contentId: authoritativeContentId,
    provenance: "kto",
    author: "총괄기획",
  });
  redirect(pathOf(id, "evidence"));
}

export async function createFromKtoFormAction(previous: FormActionState, formData: FormData) {
  assertEditorMode();
  return captureFormState(previous, formData, () => createFromKtoAction(formData));
}

export async function updateAssumptionsAction(formData: FormData) {
  assertEditorMode();
  const festivalId = requiredText(formData.get("festivalId"), "축제 ID", "festivalId");
  const author = String(formData.get("author") ?? "총괄기획").trim() || "총괄기획";
  const rationale = emptyToNull(formData.get("rationale"));
  const values = {
    inflowMin: readOptionalNumber(formData, "inflowMin", "최소 유입"),
    inflowBase: readOptionalNumber(formData, "inflowBase", "기준 유입"),
    inflowMax: readOptionalNumber(formData, "inflowMax", "최대 유입"),
    dwellHours: readOptionalNumber(formData, "dwellHours", "평균체류시간"),
    operatingHours: readOptionalNumber(formData, "operatingHours", "운영시간"),
    peakRatio: readOptionalNumber(formData, "peakRatio", "피크비율"),
  };
  validateAssumptionsForForm(values);

  await prisma.$transaction(async (tx) => {
    const festival = await tx.festival.findUnique({ where: { id: festivalId }, select: { id: true } });
    if (!festival) throw new FormValidationError({}, "축제를 찾을 수 없습니다. 목록에서 다시 선택해 주세요.");
    const current = await tx.assumption.aggregate({
      where: { festivalId },
      _max: { version: true },
    });
    const version = (current._max.version ?? 0) + 1;
    const common = { festivalId, author, rationale, version };
    await tx.assumption.createMany({
      data: [
        {
          ...common,
          item: "inflow",
          minValue: values.inflowMin,
          baseValue: values.inflowBase,
          maxValue: values.inflowMax,
          unit: "명",
        },
        { ...common, item: "dwellHours", baseValue: values.dwellHours, unit: "시간" },
        { ...common, item: "operatingHours", baseValue: values.operatingHours, unit: "시간" },
        { ...common, item: "peakRatio", baseValue: values.peakRatio, unit: "비율" },
      ],
    });
  });

  await persistScenarioCalcs(festivalId);
  revalidatePath(pathOf(festivalId, "evidence"));
  revalidatePath(pathOf(festivalId, "scenarios"));
  revalidatePath(pathOf(festivalId, "report"));
}

export async function updateAssumptionsFormAction(previous: FormActionState, formData: FormData) {
  assertEditorMode();
  return captureFormState(previous, formData, () => updateAssumptionsAction(formData), "가정 세트를 저장했습니다.");
}

export async function updateCapacityAction(formData: FormData) {
  assertEditorMode();
  const festivalId = requiredText(formData.get("festivalId"), "축제 ID", "festivalId");
  const approvedCapacity = readOptionalNumber(formData, "approvedCapacity", "승인 수용량");
  if (approvedCapacity !== null && approvedCapacity <= 0) {
    throw new FormValidationError({ approvedCapacity: "승인 수용량은 비워 두거나 0보다 커야 합니다." });
  }
  const dwellHours = readOptionalNumber(formData, "dwellHours", "평균체류시간");
  if (dwellHours !== null && (dwellHours <= 0 || dwellHours > 24)) {
    throw new FormValidationError({ dwellHours: "평균체류시간은 비워 두거나 0보다 크고 24 이하여야 합니다." });
  }

  await prisma.$transaction([
    prisma.capacityRule.deleteMany({ where: { festivalId } }),
    prisma.capacityRule.create({
      data: {
        festivalId,
        zone: String(formData.get("zone") ?? "").trim() || "주요 구역",
        approvedCapacity,
        dwellHours,
        documentRef: emptyToNull(formData.get("documentRef")),
        approver: emptyToNull(formData.get("approver")),
      },
    }),
  ]);
  await persistScenarioCalcs(festivalId);
  revalidatePath(pathOf(festivalId, "evidence"));
  revalidatePath(pathOf(festivalId, "scenarios"));
  revalidatePath(pathOf(festivalId, "report"));
}

export async function updateCapacityFormAction(previous: FormActionState, formData: FormData) {
  assertEditorMode();
  return captureFormState(previous, formData, () => updateCapacityAction(formData), "수용량 기준을 저장했습니다.");
}

export async function updateScenarioResourcesAction(formData: FormData) {
  assertEditorMode();
  const festivalId = requiredText(formData.get("festivalId"), "축제 ID", "festivalId");
  const scenarioId = requiredText(formData.get("scenarioId"), "시나리오 ID", "scenarioId");
  const scenario = await prisma.scenario.findFirst({ where: { id: scenarioId, festivalId } });
  if (!scenario) throw new FormValidationError({ scenarioId: "이 축제의 시나리오를 찾을 수 없습니다." });

  await prisma.scenario.update({
    where: { id: scenario.id },
    data: {
      shuttles: readOptionalNonNegativeInteger(formData, "shuttles", "셔틀 대수"),
      staffParking: readOptionalNonNegativeInteger(formData, "staffParking", "주차 안내 인력"),
      sessions: readOptionalNonNegativeInteger(formData, "sessions", "회차"),
      zone: emptyToNull(formData.get("zone")),
      routeNote: emptyToNull(formData.get("routeNote")),
    },
  });
  await persistScenarioCalcs(festivalId);
  revalidatePath(pathOf(festivalId, "scenarios"));
  revalidatePath(pathOf(festivalId, "report"));
}

export async function updateScenarioResourcesFormAction(previous: FormActionState, formData: FormData) {
  assertEditorMode();
  return captureFormState(
    previous,
    formData,
    () => updateScenarioResourcesAction(formData),
    "운영자원을 저장했습니다.",
  );
}

export async function decideScenarioAction(formData: FormData) {
  assertEditorMode();
  const festivalId = requiredText(formData.get("festivalId"), "축제 ID", "festivalId");
  const scenarioId = requiredText(formData.get("scenarioId"), "시나리오 ID", "scenarioId");
  const reason = requiredText(formData.get("reason"), "선택 이유", "reason");
  const approver = requiredText(formData.get("approver"), "승인자", "approver");
  const scenario = await prisma.scenario.findFirst({ where: { id: scenarioId, festivalId } });
  if (!scenario) throw new FormValidationError({ scenarioId: "이 축제의 시나리오를 찾을 수 없습니다." });

  await prisma.decision.create({
    data: {
      festivalId,
      scenarioId,
      changeSummary: scenarioChangeSummary(scenario),
      reason,
      approver,
      decidedAt: new Date(),
    },
  });
  revalidatePath(pathOf(festivalId, "scenarios"));
  revalidatePath(pathOf(festivalId, "ledger"));
  revalidatePath(pathOf(festivalId, "report"));
}

export async function decideScenarioFormAction(previous: FormActionState, formData: FormData) {
  assertEditorMode();
  return captureFormState(previous, formData, () => decideScenarioAction(formData), "운영안 결정을 기록했습니다.");
}

export async function addTriggerAction(formData: FormData) {
  assertEditorMode();
  const festivalId = requiredText(formData.get("festivalId"), "축제 ID", "festivalId");
  const condition = requiredText(formData.get("condition"), "트리거 조건", "condition");
  const plannedAction = requiredText(formData.get("plannedAction"), "계획 대응", "plannedAction");
  const owner = requiredText(formData.get("owner"), "책임자", "owner");
  await prisma.operationTrigger.create({ data: { festivalId, condition, plannedAction, owner } });
  revalidatePath(pathOf(festivalId, "ledger"));
  revalidatePath(pathOf(festivalId, "report"));
}

export async function addTriggerFormAction(previous: FormActionState, formData: FormData) {
  assertEditorMode();
  return captureFormState(previous, formData, () => addTriggerAction(formData), "대응 트리거를 등록했습니다.");
}

export async function addFieldAction(formData: FormData) {
  assertEditorMode();
  const festivalId = requiredText(formData.get("festivalId"), "축제 ID", "festivalId");
  const occurredAtRaw = requiredText(formData.get("occurredAt"), "발생 시각", "occurredAt");
  const occurredAt = normalizeOccurredAtForForm(occurredAtRaw);
  const action = requiredText(formData.get("action"), "조치", "action");
  const triggerId = emptyToNull(formData.get("triggerId"));
  let trigger = String(formData.get("trigger") ?? "").trim();

  if (triggerId) {
    const selected = await prisma.operationTrigger.findFirst({ where: { id: triggerId, festivalId } });
    if (!selected) throw new FormValidationError({ triggerId: "선택한 트리거를 찾을 수 없습니다." });
    // 등록된 트리거를 선택했다면 직접 입력값보다 저장된 조건을 우선한다.
    trigger = selected.condition;
  }

  await prisma.fieldAction.create({
    data: {
      festivalId,
      triggerId,
      trigger,
      occurredAt,
      action,
      actor: emptyToNull(formData.get("actor")),
    },
  });
  revalidatePath(pathOf(festivalId, "ledger"));
  revalidatePath(pathOf(festivalId, "report"));
}

export async function addFieldActionFormAction(previous: FormActionState, formData: FormData) {
  assertEditorMode();
  return captureFormState(previous, formData, () => addFieldAction(formData), "현장 조치를 기록했습니다.");
}

export async function addOutcomeAction(formData: FormData) {
  assertEditorMode();
  const festivalId = requiredText(formData.get("festivalId"), "축제 ID", "festivalId");
  const metric = requiredText(formData.get("metric"), "지표", "metric");
  const actualValue = readOptionalNumber(formData, "actualValue", "실제값");
  const granularity = normalizeGranularityForForm(String(formData.get("granularity") ?? "total"));
  const bucketLabel = emptyToNull(formData.get("bucketLabel"));
  if (granularity !== "total" && !bucketLabel) {
    throw new FormValidationError({
      bucketLabel: "시간대별·구역별 실측에는 시간대 또는 구역 이름이 필요합니다.",
    });
  }
  const outcome = { actualValue, confirmed: true, kind: "measured", granularity } as const;

  await prisma.$transaction(async (tx) => {
    const festival = await tx.festival.findUnique({ where: { id: festivalId } });
    if (!festival) throw new FormValidationError({}, "축제를 찾을 수 없습니다. 목록에서 다시 선택해 주세요.");
    await tx.outcome.create({
      data: {
        festivalId,
        metric,
        plannedValue: readOptionalNumber(formData, "plannedValue", "계획값"),
        actualValue,
        unit: emptyToNull(formData.get("unit")),
        source: emptyToNull(formData.get("source")),
        measureMethod: emptyToNull(formData.get("measureMethod")),
        granularity,
        bucketLabel: granularity === "total" ? null : bucketLabel,
        kind: outcome.kind,
        confirmed: outcome.confirmed,
      },
    });
    const labelLevel = nextLabelLevel(festival.labelLevel, outcome);
    if (labelLevel !== festival.labelLevel) {
      await tx.festival.update({ where: { id: festivalId }, data: { labelLevel } });
    }
  });

  revalidatePath("/");
  revalidatePath(pathOf(festivalId, "evidence"));
  revalidatePath(pathOf(festivalId, "ledger"));
  revalidatePath(pathOf(festivalId, "report"));
}

export async function addOutcomeFormAction(previous: FormActionState, formData: FormData) {
  assertEditorMode();
  return captureFormState(previous, formData, () => addOutcomeAction(formData), "실측값을 기록했습니다.");
}

export async function cloneFestivalAction(formData: FormData) {
  assertEditorMode();
  const festivalId = requiredText(formData.get("festivalId"), "축제 ID", "festivalId");
  const source = await prisma.festival.findUniqueOrThrow({
    where: { id: festivalId },
    include: { assumptions: true, capacityRules: true, scenarios: true },
  });
  const id = `fst_${randomUUID().slice(0, 8)}`;
  const year = (source.startDate ?? "2026").slice(0, 4);
  const nextYear = String(Number(year) + 1);
  const latestAssumptions = latestAssumptionRows(source.assumptions);

  await prisma.festival.create({
    data: {
      id,
      name: source.name.replace(year, nextYear) + (source.name.includes(year) ? "" : ` ${nextYear}`),
      organization: source.organization,
      place: source.place,
      program: source.program,
      startDate: source.startDate ? source.startDate.replace(year, nextYear) : `${nextYear}-04-10`,
      endDate: source.endDate ? source.endDate.replace(year, nextYear) : `${nextYear}-04-12`,
      areaCode: source.areaCode,
      sigunguCode: source.sigunguCode,
      ldongRegnCd: source.ldongRegnCd,
      ldongSignguCd: source.ldongSignguCd,
      mapX: source.mapX,
      mapY: source.mapY,
      // 다음 연도 복제본은 이전 행사의 KTO 콘텐츠와 동일한 축제가 아니다.
      // clonedFromId만 계보로 남기고 새 항목은 직접 입력 출처에서 시작한다.
      contentId: null,
      provenance: "manual",
      labelLevel: "L0",
      isDemo: false,
      isExample: true,
      clonedFromId: source.id,
      assumptions: {
        create: latestAssumptions.map((row) => ({
          item: row.item,
          minValue: row.minValue,
          baseValue: row.baseValue,
          maxValue: row.maxValue,
          unit: row.unit,
          rationale: `이전 행사(${source.name}) 원장에서 복제`,
          author: row.author,
          version: 1,
        })),
      },
      capacityRules: {
        create: source.capacityRules.map((row) => ({
          zone: row.zone,
          approvedCapacity: row.approvedCapacity,
          dwellHours: row.dwellHours,
          documentRef: row.documentRef,
          approver: row.approver,
        })),
      },
      scenarios: {
        create: source.scenarios.map((row) => ({
          kind: row.kind,
          name: row.name,
          sessions: row.sessions,
          staffParking: row.staffParking,
          shuttles: row.shuttles,
          zone: row.zone,
          routeNote: row.routeNote,
        })),
      },
    },
  });

  await persistScenarioCalcs(id);
  await refreshFestivalEvidence(id);
  revalidatePath("/");
  redirect(pathOf(id, "evidence"));
}

export async function refreshEvidenceAction(formData: FormData) {
  assertEditorMode();
  const festivalId = requiredText(formData.get("festivalId"), "축제 ID", "festivalId");
  await refreshFestivalEvidence(festivalId);
  revalidatePath(pathOf(festivalId, "evidence"));
  revalidatePath("/logs");
}

export async function runKtoSearch(keyword: string) {
  assertEditorMode();
  return searchFestivalsByKeyword(keyword);
}

async function createFestivalWorkspace(input: FestivalCreateInput): Promise<string> {
  const id = `fst_${randomUUID().slice(0, 8)}`;
  await prisma.festival.create({
    data: {
      id,
      name: input.name,
      organization: input.organization,
      place: input.place,
      program: input.program,
      startDate: input.startDate,
      endDate: input.endDate,
      areaCode: input.areaCode,
      sigunguCode: input.sigunguCode,
      ldongRegnCd: input.ldongRegnCd,
      ldongSignguCd: input.ldongSignguCd,
      mapX: input.mapX,
      mapY: input.mapY,
      contentId: input.contentId,
      provenance: input.provenance,
      labelLevel: "L0",
      isDemo: false,
      isExample: true,
      assumptions: {
        create: [
          { item: "inflow", unit: "명", author: input.author, version: 1 },
          { item: "peakRatio", baseValue: 0.35, unit: "비율", author: "기본값", version: 1 },
          { item: "dwellHours", unit: "시간", author: input.author, version: 1 },
          { item: "operatingHours", baseValue: 8, unit: "시간", author: "기본값", version: 1 },
        ],
      },
      scenarios: {
        create: [
          { kind: "conservative", name: "보수안", shuttles: 2, staffParking: 4, sessions: 3 },
          { kind: "base", name: "기본안", shuttles: 2, staffParking: 4, sessions: 3 },
          { kind: "expanded", name: "확대안", shuttles: 3, staffParking: 6, sessions: 3 },
        ],
      },
    },
  });
  await persistScenarioCalcs(id);
  await refreshFestivalEvidence(id);
  revalidatePath("/");
  return id;
}

async function persistScenarioCalcs(festivalId: string) {
  const festival = await prisma.festival.findUniqueOrThrow({
    where: { id: festivalId },
    include: {
      assumptions: { orderBy: [{ version: "desc" }, { createdAt: "desc" }] },
      capacityRules: true,
      scenarios: true,
    },
  });
  const latest = new Map(latestAssumptionRows(festival.assumptions).map((row) => [row.item, row]));
  const inflow = latest.get("inflow");
  const rule = festival.capacityRules[0];
  const calculation = buildScenarioCalculation({
    inflow: {
      min: inflow?.minValue ?? null,
      base: inflow?.baseValue ?? null,
      max: inflow?.maxValue ?? null,
    },
    peakRatio: latest.get("peakRatio")?.baseValue ?? null,
    dwellHours: latest.get("dwellHours")?.baseValue ?? rule?.dwellHours ?? null,
    operatingHours: latest.get("operatingHours")?.baseValue ?? null,
    approvedCapacity: rule?.approvedCapacity ?? null,
    hasApprovalBasis: Boolean(rule?.documentRef && rule?.approver),
  });
  const resultJson = JSON.stringify(calculation.result);
  const formulaJson = JSON.stringify(calculation.formula);
  await prisma.$transaction(
    festival.scenarios.map((scenario) =>
      prisma.scenario.update({ where: { id: scenario.id }, data: { resultJson, formulaJson } }),
    ),
  );
}

async function captureFormState(
  previous: FormActionState,
  formData: FormData,
  mutation: () => Promise<void>,
  successMessage = "저장했습니다.",
): Promise<FormActionState> {
  const values = valuesFromForm(formData);
  try {
    await mutation();
    return {
      status: "success",
      submissionId: previous.submissionId + 1,
      values,
      fieldErrors: {},
      message: successMessage,
    };
  } catch (error) {
    if (!(error instanceof FormValidationError)) throw error;
    return {
      status: "error",
      submissionId: previous.submissionId + 1,
      values,
      fieldErrors: error.fieldErrors,
      formError: error.formError,
    };
  }
}

function valuesFromForm(formData: FormData): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [name, value] of formData.entries()) {
    if (typeof value === "string") values[name] = value;
  }
  return values;
}

function validateDatesForForm(startDate: string | null, endDate: string | null): void {
  try {
    validateFestivalDates(startDate, endDate);
  } catch (error) {
    const message = errorMessage(error);
    if (message.startsWith("시작일은 YYYY")) throw new FormValidationError({ startDate: message });
    if (message.startsWith("종료일은 YYYY")) throw new FormValidationError({ endDate: message });
    throw new FormValidationError({ startDate: message, endDate: message });
  }
}

function validateAssumptionsForForm(values: Parameters<typeof validateAssumptionSet>[0]): void {
  try {
    validateAssumptionSet(values);
  } catch (error) {
    const message = errorMessage(error);
    if (message.includes("피크비율")) throw new FormValidationError({ peakRatio: message });
    if (message.includes("평균체류시간")) throw new FormValidationError({ dwellHours: message });
    if (message.includes("운영시간")) throw new FormValidationError({ operatingHours: message });
    throw new FormValidationError({ inflowMin: message, inflowBase: message, inflowMax: message });
  }
}

function normalizeOccurredAtForForm(value: string): string {
  try {
    return normalizeOccurredAt(value);
  } catch (error) {
    throw new FormValidationError({ occurredAt: errorMessage(error) });
  }
}

function normalizeGranularityForForm(value: string): "total" | "hourly" | "zone" {
  try {
    return normalizeGranularity(value);
  } catch (error) {
    throw new FormValidationError({ granularity: errorMessage(error) });
  }
}

function emptyToNull(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text ? text : null;
}

function emptyStringToNull(value: string | null | undefined) {
  const text = String(value ?? "").trim();
  return text ? text : null;
}

function requiredText(value: FormDataEntryValue | null, label: string, field: string): string {
  const text = String(value ?? "").trim();
  if (!text) throw new FormValidationError({ [field]: `${label}은(는) 필수입니다.` });
  return text;
}

function readOptionalNumber(formData: FormData, name: string, label: string): number | null {
  const raw = formData.get(name);
  const text = String(raw ?? "").trim();
  const value = parseOptionalNumber(raw);
  if (text && value === null) {
    throw new FormValidationError({ [name]: `${label}은(는) 유효한 숫자여야 합니다.` });
  }
  return value;
}

function readOptionalNonNegativeInteger(formData: FormData, name: string, label: string): number | null {
  const value = readOptionalNumber(formData, name, label);
  if (value !== null && (!Number.isInteger(value) || value < 0)) {
    throw new FormValidationError({ [name]: `${label}은(는) 0 이상의 정수여야 합니다.` });
  }
  return value;
}

function ymdToDate(value: string) {
  if (!/^\d{8}$/.test(value)) return null;
  return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "입력값을 확인해 주세요.";
}
