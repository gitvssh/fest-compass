"use client";

import {
  useActionState,
  type ComponentProps,
  type ReactNode,
} from "react";
import { useFormStatus } from "react-dom";
import type { FormActionState } from "@/lib/actions";

export type StatefulFormAction = (
  state: FormActionState,
  formData: FormData,
) => Promise<FormActionState>;

export function useValidatedForm(action: StatefulFormAction) {
  return useActionState(action, {
    status: "idle",
    submissionId: 0,
    values: {},
    fieldErrors: {},
  } satisfies FormActionState);
}

type InputFieldProps = Omit<
  ComponentProps<"input">,
  "id" | "name" | "defaultValue"
> & {
  formId: string;
  name: string;
  label: string;
  state: FormActionState;
  initialValue?: string | number | null;
  hint?: ReactNode;
};

export function InputField({
  formId,
  name,
  label,
  state,
  initialValue,
  hint,
  className,
  ...inputProps
}: InputFieldProps) {
  const id = `${formId}-${name}`;
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const error = state.fieldErrors[name];
  const value = state.values[name] ?? toInputValue(initialValue);
  const describedBy = [hint ? hintId : null, error ? errorId : null]
    .filter(Boolean)
    .join(" ") || undefined;

  return (
    <label className="block text-sm" htmlFor={id}>
      <span className="mb-1 block font-bold">{label}</span>
      <input
        {...inputProps}
        key={`${name}-${state.submissionId}`}
        id={id}
        name={name}
        defaultValue={value}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={
          className ??
          "w-full rounded-2xl border border-ink/10 bg-paper px-4 py-3 aria-[invalid=true]:border-coral"
        }
      />
      {hint ? (
        <span id={hintId} className="mt-1 block text-xs text-muted">
          {hint}
        </span>
      ) : null}
      <FieldError id={errorId} error={error} />
    </label>
  );
}

type TextareaFieldProps = Omit<
  ComponentProps<"textarea">,
  "id" | "name" | "defaultValue"
> & {
  formId: string;
  name: string;
  label: string;
  state: FormActionState;
  initialValue?: string | null;
  hint?: ReactNode;
};

export function TextareaField({
  formId,
  name,
  label,
  state,
  initialValue,
  hint,
  className,
  ...textareaProps
}: TextareaFieldProps) {
  const id = `${formId}-${name}`;
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const error = state.fieldErrors[name];
  const value = state.values[name] ?? toInputValue(initialValue);
  const describedBy = [hint ? hintId : null, error ? errorId : null]
    .filter(Boolean)
    .join(" ") || undefined;

  return (
    <label className="block text-sm" htmlFor={id}>
      <span className="mb-1 block font-bold">{label}</span>
      <textarea
        {...textareaProps}
        key={`${name}-${state.submissionId}`}
        id={id}
        name={name}
        defaultValue={value}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={
          className ??
          "min-h-24 w-full rounded-2xl border border-ink/10 bg-paper px-4 py-3 aria-[invalid=true]:border-coral"
        }
      />
      {hint ? (
        <span id={hintId} className="mt-1 block text-xs text-muted">
          {hint}
        </span>
      ) : null}
      <FieldError id={errorId} error={error} />
    </label>
  );
}

type SelectFieldProps = Omit<
  ComponentProps<"select">,
  "id" | "name" | "defaultValue" | "children"
> & {
  formId: string;
  name: string;
  label: string;
  state: FormActionState;
  initialValue?: string | null;
  options: ReadonlyArray<{ value: string; label: string }>;
  emptyLabel?: string;
  hint?: ReactNode;
};

export function SelectField({
  formId,
  name,
  label,
  state,
  initialValue,
  options,
  emptyLabel,
  hint,
  className,
  ...selectProps
}: SelectFieldProps) {
  const id = `${formId}-${name}`;
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const error = state.fieldErrors[name];
  const value = state.values[name] ?? toInputValue(initialValue);
  const describedBy = [hint ? hintId : null, error ? errorId : null]
    .filter(Boolean)
    .join(" ") || undefined;

  return (
    <label className="block text-sm" htmlFor={id}>
      <span className="mb-1 block font-bold">{label}</span>
      <select
        {...selectProps}
        key={`${name}-${state.submissionId}`}
        id={id}
        name={name}
        defaultValue={value}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={
          className ??
          "w-full rounded-2xl border border-ink/10 bg-paper px-4 py-3 aria-[invalid=true]:border-coral"
        }
      >
        {emptyLabel !== undefined ? <option value="">{emptyLabel}</option> : null}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {hint ? (
        <span id={hintId} className="mt-1 block text-xs text-muted">
          {hint}
        </span>
      ) : null}
      <FieldError id={errorId} error={error} />
    </label>
  );
}

export function HiddenField({ name, value }: { name: string; value: string }) {
  return <input type="hidden" name={name} value={value} />;
}

export function InlineFieldError({
  formId,
  name,
  state,
}: {
  formId: string;
  name: string;
  state: FormActionState;
}) {
  return <FieldError id={`${formId}-${name}-error`} error={state.fieldErrors[name]} />;
}

export function FormFeedback({ state }: { state: FormActionState }) {
  return (
    <div className="min-h-5 text-sm" aria-live="polite" aria-atomic="true">
      {state.formError ? (
        <p role="alert" className="rounded-xl bg-coral-soft px-3 py-2 font-semibold text-ink">
          {state.formError}
        </p>
      ) : state.status === "success" && state.message ? (
        <p role="status" className="rounded-xl bg-mint-soft px-3 py-2 font-semibold text-ink">
          {state.message}
        </p>
      ) : null}
    </div>
  );
}

export function SubmitButton({
  children,
  pendingLabel = "저장 중…",
  className = "w-full rounded-2xl bg-navy py-3 text-sm font-bold text-white disabled:cursor-wait disabled:opacity-60",
}: {
  children: ReactNode;
  pendingLabel?: string;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} aria-disabled={pending} className={className}>
      {pending ? pendingLabel : children}
    </button>
  );
}

function FieldError({ id, error }: { id: string; error?: string }) {
  return error ? (
    <span id={id} role="alert" aria-live="polite" className="mt-1 block text-xs font-semibold text-coral">
      {error}
    </span>
  ) : null;
}

function toInputValue(value: string | number | null | undefined) {
  return value === null || value === undefined ? "" : String(value);
}
