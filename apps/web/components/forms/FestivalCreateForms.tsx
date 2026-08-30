"use client";

import { useId } from "react";
import {
  createFestivalFormAction,
  createFromKtoFormAction,
} from "@/lib/actions";
import { SIDO_MAPPINGS } from "@/lib/kto/areacode";
import {
  FormFeedback,
  HiddenField,
  InlineFieldError,
  InputField,
  SelectField,
  SubmitButton,
  TextareaField,
  useValidatedForm,
} from "@/components/forms/FormPrimitives";

const AREA_OPTIONS = SIDO_MAPPINGS.map((row) => ({
  value: row.korAreaCode,
  label: row.name,
}));

export function ManualFestivalForm({ initialName = "" }: { initialName?: string }) {
  const [state, action] = useValidatedForm(createFestivalFormAction);
  const formId = "manual-festival";

  return (
    <form action={action} noValidate className="space-y-4 rounded-3xl bg-white p-6 shadow-card">
      <h2 className="text-xl font-extrabold">직접 입력</h2>
      <p className="text-sm text-muted">
        직접 입력한 축제는 KTO 출처로 표시되지 않습니다. 확인된 지역코드만 입력해 주세요.
      </p>
      <FormFeedback state={state} />
      <InputField
        formId={formId}
        name="name"
        label="축제 이름"
        required
        state={state}
        initialValue={initialName}
      />
      <InputField formId={formId} name="organization" label="운영조직" state={state} />
      <InputField formId={formId} name="place" label="장소" state={state} />
      <TextareaField formId={formId} name="program" label="프로그램" rows={3} state={state} />
      <div className="grid grid-cols-2 gap-3">
        <InputField formId={formId} name="startDate" label="시작일" type="date" state={state} />
        <InputField formId={formId} name="endDate" label="종료일" type="date" state={state} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <SelectField
          formId={formId}
          name="areaCode"
          label="지역"
          state={state}
          emptyLabel="선택 안 함"
          options={AREA_OPTIONS}
        />
        <InputField formId={formId} name="sigunguCode" label="KTO 시군구코드" state={state} />
      </div>
      <details className="rounded-2xl bg-paper px-4 py-3 text-sm">
        <summary className="cursor-pointer font-bold">법정동 코드 직접 입력(선택)</summary>
        <p className="mt-2 text-xs text-muted">
          KTO 지역코드와 다른 체계입니다. 공식 자료에서 확인한 코드가 있을 때만 입력합니다.
        </p>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <InputField formId={formId} name="ldongRegnCd" label="법정동 시도 코드" state={state} />
          <InputField formId={formId} name="ldongSignguCd" label="법정동 시군구 코드" state={state} />
        </div>
      </details>
      <InputField
        formId={formId}
        name="author"
        label="작성자"
        state={state}
        initialValue="총괄기획"
      />
      <SubmitButton pendingLabel="축제 작업공간 생성 중…">가정 보드로 이동</SubmitButton>
    </form>
  );
}

export function KtoFestivalCreateForm({ contentId }: { contentId: string }) {
  const [state, action] = useValidatedForm(createFromKtoFormAction);
  const reactId = useId().replaceAll(":", "");
  const formId = `kto-festival-${reactId}`;

  return (
    <form action={action} noValidate className="shrink-0">
      <HiddenField name="contentId" value={contentId} />
      <SubmitButton
        pendingLabel="확인 중…"
        className="rounded-full bg-blue px-3 py-1.5 text-xs font-bold text-white disabled:cursor-wait disabled:opacity-60"
      >
        이 축제로 시작
      </SubmitButton>
      <InlineFieldError formId={formId} name="contentId" state={state} />
      <FormFeedback state={state} />
    </form>
  );
}
