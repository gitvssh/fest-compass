import { decimal } from "@/lib/planning/budget-math";
import type { CostScope } from "@/lib/planning/budget-types";
import { Field, Select } from "../Fields";

export function NumberField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  let error = ""; try { decimal(value); } catch (e) { error = (e as Error).message; }
  return <label className="block min-w-0 space-y-2 text-sm font-bold"><span>{label}</span><input aria-label={label} aria-invalid={!!error} className="workspace-input" inputMode="decimal" maxLength={30} value={value} onChange={e => onChange(e.target.value)} placeholder="미입력 · 미산정" />{error && <span className="block text-xs text-coral" role="alert">{error}</span>}</label>;
}
export function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return <label className="flex items-start gap-2 text-sm leading-6"><input type="checkbox" className="mt-1" checked={checked} onChange={e => onChange(e.target.checked)} />{label}</label>;
}
export function ScopeFields({ scope, change, prefix = "" }: { scope: CostScope; change: (s: CostScope) => void; prefix?: string }) {
  const set = (patch: Partial<CostScope>) => change({ ...scope, ...patch });
  return <div className="space-y-3"><div className="grid gap-3 sm:grid-cols-2">
    <Select label={`${prefix}비용 범위`} value={scope.kind} onChange={kind => set({ kind: kind as CostScope["kind"] })} options={{ unknown: "미확인", whole: "전체 행사", partial: "부분 업무" }} />
    <Field label={`${prefix}범위 기준 이름`} value={scope.name} onChange={name => set({ name })} />
    <Field label={`${prefix}포함 항목`} value={scope.includes} onChange={includes => set({ includes })} />
    <Field label={`${prefix}제외 항목`} value={scope.excludes} onChange={excludes => set({ excludes })} />
    <Field label={`${prefix}포함 부서`} value={scope.departments} onChange={departments => set({ departments })} />
  </div><Check label={`${prefix}관련 부서의 포함·제외 범위를 확인했습니다`} checked={scope.departmentsKnown} onChange={departmentsKnown => set({ departmentsKnown })} /></div>;
}
