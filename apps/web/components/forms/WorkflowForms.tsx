"use client";

import {
  addFieldActionFormAction,
  addOutcomeFormAction,
  addTriggerFormAction,
  decideScenarioFormAction,
  updateAssumptionsFormAction,
  updateCapacityFormAction,
  updateScenarioResourcesFormAction,
} from "@/lib/actions";
import {
  FormFeedback,
  HiddenField,
  InputField,
  SelectField,
  SubmitButton,
  TextareaField,
  useValidatedForm,
} from "@/components/forms/FormPrimitives";
import { KindBadge } from "@/components/KindBadge";

type InputValue = string | number | null | undefined;

export type AssumptionsFormProps = {
  festivalId: string;
  version?: number;
  inflowMin?: InputValue;
  inflowBase?: InputValue;
  inflowMax?: InputValue;
  dwellHours?: InputValue;
  operatingHours?: InputValue;
  peakRatio?: InputValue;
  rationale?: string | null;
  author?: string | null;
  className?: string;
};

export function AssumptionsForm({
  festivalId,
  version = 0,
  inflowMin,
  inflowBase,
  inflowMax,
  dwellHours,
  operatingHours,
  peakRatio,
  rationale,
  author,
  className = "mt-6 rounded-3xl bg-white p-6 shadow-card",
}: AssumptionsFormProps) {
  const [state, action] = useValidatedForm(updateAssumptionsFormAction);
  const formId = `assumptions-${festivalId}`;
  return (
    <form action={action} noValidate className={className}>
      <HiddenField name="festivalId" value={festivalId} />
      <HiddenField name="version" value={String(version)} />
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-xl font-extrabold">방문 규모 가정</h2>
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-blue">가정 세트 v{version} 저장됨</span>
          <KindBadge kind="assumption" />
        </div>
      </div>
      <FormFeedback state={state} />
      <div className="grid gap-4 md:grid-cols-3">
        <InputField formId={formId} name="inflowMin" label="최소" type="number" step="any" min="0" state={state} initialValue={inflowMin} />
        <InputField formId={formId} name="inflowBase" label="기준" type="number" step="any" min="0" state={state} initialValue={inflowBase} />
        <InputField formId={formId} name="inflowMax" label="최대" type="number" step="any" min="0" state={state} initialValue={inflowMax} />
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <InputField formId={formId} name="dwellHours" label="평균 체류(시간)" type="number" step="0.1" min="0.1" max="24" state={state} initialValue={dwellHours} />
        <InputField formId={formId} name="operatingHours" label="운영시간" type="number" step="0.1" min="0.1" max="24" state={state} initialValue={operatingHours} />
        <InputField formId={formId} name="peakRatio" label="피크비율" type="number" step="0.01" min="0.01" max="1" state={state} initialValue={peakRatio} />
      </div>
      <div className="mt-4">
        <TextareaField formId={formId} name="rationale" label="가정 근거" rows={2} state={state} initialValue={rationale} />
      </div>
      <div className="mt-3">
        <InputField formId={formId} name="author" label="작성자" state={state} initialValue={author || "총괄기획"} />
      </div>
      <div className="mt-4">
        <SubmitButton pendingLabel="가정 세트 저장 중…">가정 세트 v{version + 1} 저장</SubmitButton>
      </div>
    </form>
  );
}

export type CapacityFormProps = {
  festivalId: string;
  zone?: string | null;
  approvedCapacity?: InputValue;
  dwellHours?: InputValue;
  documentRef?: string | null;
  approver?: string | null;
  className?: string;
};

export function CapacityForm({
  festivalId,
  zone = "주요 구역",
  approvedCapacity,
  dwellHours,
  documentRef,
  approver,
  className = "mt-5 rounded-3xl bg-white p-6 shadow-card",
}: CapacityFormProps) {
  const [state, action] = useValidatedForm(updateCapacityFormAction);
  const formId = `capacity-${festivalId}`;
  return (
    <form action={action} noValidate className={className}>
      <HiddenField name="festivalId" value={festivalId} />
      <h2 className="mb-4 text-xl font-extrabold">승인 수용량</h2>
      <FormFeedback state={state} />
      <div className="grid gap-4 md:grid-cols-2">
        <InputField formId={formId} name="zone" label="구역" state={state} initialValue={zone} />
        <InputField
          formId={formId}
          name="approvedCapacity"
          label="승인 수용량(명)"
          type="number"
          step="any"
          state={state}
          initialValue={approvedCapacity}
          hint="비워 두거나 0보다 큰 값만 입력합니다."
        />
        <InputField
          formId={formId}
          name="dwellHours"
          label="기준 평균체류시간(시간)"
          type="number"
          step="0.1"
          min="0.1"
          max="24"
          state={state}
          initialValue={dwellHours}
        />
        <InputField formId={formId} name="documentRef" label="기준문서" state={state} initialValue={documentRef} />
        <InputField formId={formId} name="approver" label="승인자" state={state} initialValue={approver} />
      </div>
      <p className="mt-3 text-xs text-muted">기준문서와 승인자가 모두 있어야 안전 관련 계산이 활성화됩니다.</p>
      <div className="mt-4"><SubmitButton pendingLabel="수용량 저장 중…">수용량 저장</SubmitButton></div>
    </form>
  );
}

export type ScenarioResourcesFormProps = {
  festivalId: string;
  scenarioId: string;
  shuttles?: InputValue;
  staffParking?: InputValue;
  sessions?: InputValue;
  zone?: string | null;
  routeNote?: string | null;
  className?: string;
};

export function ScenarioResourcesForm({
  festivalId,
  scenarioId,
  shuttles,
  staffParking,
  sessions,
  zone,
  routeNote,
  className = "mt-4 space-y-3",
}: ScenarioResourcesFormProps) {
  const [state, action] = useValidatedForm(updateScenarioResourcesFormAction);
  const formId = `resources-${scenarioId}`;
  return (
    <form action={action} noValidate className={className}>
      <HiddenField name="festivalId" value={festivalId} />
      <HiddenField name="scenarioId" value={scenarioId} />
      <FormFeedback state={state} />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <InputField formId={formId} name="shuttles" label="셔틀" type="number" min="0" step="1" state={state} initialValue={shuttles} />
        <InputField formId={formId} name="staffParking" label="주차 안내" type="number" min="0" step="1" state={state} initialValue={staffParking} />
        <InputField formId={formId} name="sessions" label="회차" type="number" min="0" step="1" state={state} initialValue={sessions} />
        <InputField formId={formId} name="zone" label="운영 구역" state={state} initialValue={zone} />
      </div>
      <TextareaField formId={formId} name="routeNote" label="동선 메모" rows={2} state={state} initialValue={routeNote} />
      <SubmitButton pendingLabel="자원 저장 중…" className="w-full rounded-2xl bg-white py-2 text-sm font-bold shadow-card disabled:opacity-60">자원 저장</SubmitButton>
    </form>
  );
}

export type ScenarioDecisionFormProps = {
  festivalId: string;
  scenarioId: string;
  initialReason?: string;
  initialApprover?: string;
  className?: string;
};

export function ScenarioDecisionForm({
  festivalId,
  scenarioId,
  initialReason = "",
  initialApprover = "축제 총괄",
  className = "mt-4 space-y-2 border-t border-ink/5 pt-4",
}: ScenarioDecisionFormProps) {
  const [state, action] = useValidatedForm(decideScenarioFormAction);
  const formId = `decision-${scenarioId}`;
  return (
    <form action={action} noValidate className={className}>
      <HiddenField name="festivalId" value={festivalId} />
      <HiddenField name="scenarioId" value={scenarioId} />
      <FormFeedback state={state} />
      <InputField formId={formId} name="reason" label="선택 이유" required state={state} initialValue={initialReason} />
      <InputField formId={formId} name="approver" label="승인자" required state={state} initialValue={initialApprover} />
      <SubmitButton pendingLabel="결정 기록 중…">이 안으로 결정</SubmitButton>
    </form>
  );
}

export function TriggerForm({ festivalId, className = "grid gap-3 md:grid-cols-4" }: { festivalId: string; className?: string }) {
  const [state, action] = useValidatedForm(addTriggerFormAction);
  const formId = `trigger-${festivalId}`;
  return (
    <form action={action} noValidate className={className}>
      <HiddenField name="festivalId" value={festivalId} />
      <div className="md:col-span-4"><FormFeedback state={state} /></div>
      <InputField formId={formId} name="condition" label="조건·임계 설명" required state={state} />
      <InputField formId={formId} name="plannedAction" label="대응 조치" required state={state} />
      <InputField formId={formId} name="owner" label="책임자" required state={state} />
      <SubmitButton pendingLabel="등록 중…" className="self-end rounded-2xl bg-navy px-3 py-3 text-sm font-bold text-white disabled:opacity-60">트리거 등록</SubmitButton>
    </form>
  );
}

export type FieldActionFormProps = {
  festivalId: string;
  triggers: ReadonlyArray<{ id: string; condition: string }>;
  className?: string;
};

export function FieldActionForm({
  festivalId,
  triggers,
  className = "grid gap-3 md:grid-cols-2 xl:grid-cols-5",
}: FieldActionFormProps) {
  const [state, action] = useValidatedForm(addFieldActionFormAction);
  const formId = `field-action-${festivalId}`;
  return (
    <form action={action} noValidate className={className}>
      <HiddenField name="festivalId" value={festivalId} />
      <div className="md:col-span-2 xl:col-span-5"><FormFeedback state={state} /></div>
      <InputField formId={formId} name="occurredAt" label="발생 시각" type="datetime-local" required state={state} />
      <SelectField
        formId={formId}
        name="triggerId"
        label="등록된 트리거"
        state={state}
        emptyLabel="직접 입력"
        options={triggers.map((trigger) => ({ value: trigger.id, label: trigger.condition }))}
        hint="선택하면 직접 트리거보다 등록된 조건을 우선합니다."
      />
      <InputField formId={formId} name="trigger" label="직접 트리거" placeholder="계획 밖 대응이면 입력" state={state} />
      <InputField formId={formId} name="action" label="조치" required placeholder="우회 동선 개방" state={state} />
      <InputField formId={formId} name="actor" label="담당자" placeholder="현장총괄" state={state} />
      <div className="md:col-span-2 xl:col-span-5"><SubmitButton pendingLabel="조치 기록 중…">조치 기록</SubmitButton></div>
    </form>
  );
}

export function OutcomeForm({ festivalId, className = "mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4" }: { festivalId: string; className?: string }) {
  const [state, action] = useValidatedForm(addOutcomeFormAction);
  const formId = `outcome-${festivalId}`;
  return (
    <form action={action} noValidate className={className}>
      <HiddenField name="festivalId" value={festivalId} />
      <div className="md:col-span-2 xl:col-span-4"><FormFeedback state={state} /></div>
      <InputField formId={formId} name="metric" label="지표" required state={state} />
      <InputField formId={formId} name="plannedValue" label="계획" type="number" step="any" state={state} />
      <InputField formId={formId} name="actualValue" label="실제" type="number" step="any" state={state} />
      <InputField formId={formId} name="unit" label="단위" state={state} />
      <InputField formId={formId} name="source" label="출처" state={state} />
      <InputField formId={formId} name="measureMethod" label="측정방식" state={state} />
      <InputField
        formId={formId}
        name="bucketLabel"
        label="집계 구간"
        placeholder="예: 13:00–14:00 또는 A구역"
        state={state}
        hint="시간대별·구역별 실측이면 필수입니다."
      />
      <SelectField
        formId={formId}
        name="granularity"
        label="집계 단위"
        state={state}
        initialValue="total"
        options={[
          { value: "total", label: "총계" },
          { value: "hourly", label: "시간대별" },
          { value: "zone", label: "구역별" },
        ]}
      />
      <div className="self-end"><SubmitButton pendingLabel="실측 저장 중…">실측 추가</SubmitButton></div>
    </form>
  );
}
