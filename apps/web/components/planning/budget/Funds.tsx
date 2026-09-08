import type { Budget, Funding } from "@/lib/planning/budget-types";
import { FUND_STATUS, VAT } from "@/lib/planning/budget-types";
import { newFunding } from "@/lib/planning/budget-model";
import { Field, Select } from "../Fields";
import { Check, NumberField } from "./Fields";

export function BudgetFunds({ budget: b, change }: { budget: Budget; change: (b: Budget) => void }) {
  return <details className="region-card"><summary className="cursor-pointer text-xl font-extrabold">재원 입력 · {b.funds.length}개</summary><div className="mt-4 space-y-4"><p className="text-sm leading-6">국비·지방비 등 제공 주체와 보조·자부담 등 전달 관계를 각각 적습니다. 같은 지원금은 동일한 식별 메모를 사용하고 상위 총액과 하위 분담액 중 한 수준만 합산합니다.</p>
    {b.funds.map((f, i) => { const set = (patch: Partial<Funding>) => { const reset = ["name", "provider", "relation", "sourceId", "amount", "parentId", "reference"].some(k => Object.hasOwn(patch, k)); change({ ...b, funds: b.funds.map(x => x.id === f.id ? { ...f, ...(reset ? { status: "unknown" as const, date: "" } : {}), ...patch } : x) }); }; return <fieldset key={f.id} className="min-w-0 space-y-3 rounded-xl bg-paper p-4"><legend className="text-sm font-bold">재원 {i + 1}</legend><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <Field label="재원 이름" value={f.name} onChange={name => set({ name })} /><Field label="재원 제공 주체" value={f.provider} onChange={provider => set({ provider })} /><Field label="재원 전달 관계" value={f.relation} onChange={relation => set({ relation })} />
      <Field label="재원 식별 메모" value={f.sourceId} onChange={sourceId => set({ sourceId })} /><NumberField label="계획 재원액(원)" value={f.amount} onChange={amount => set({ amount, status: "unknown", date: "" })} /><Select label="재원 확보 상태" value={f.status} onChange={status => set({ status: status as Funding["status"] })} options={FUND_STATUS} />
      <Field label="재원 확인 근거" value={f.reference} onChange={reference => set({ reference })} /><Field label="재원 확인일" type="date" value={f.date} onChange={date => set({ date })} />
      <Select label="상위 재원" value={f.parentId} onChange={parentId => set({ parentId })}><option value="">상위 재원 없음</option>{b.funds.filter(p => p.id !== f.id).map(p => <option key={p.id} value={p.id}>{p.name || "이름 미정"}</option>)}</Select>
    </div><Check label="이 재원을 합산 수준에 포함" checked={f.included} onChange={included => set({ included })} /><button className="region-button" onClick={() => change({ ...b, fundingComplete: false, funds: b.funds.filter(x => x.id !== f.id).map(x => x.parentId === f.id ? { ...x, parentId: "" } : x) })}>이 재원 제외</button></fieldset>; })}
    <button className="region-button" disabled={b.funds.length >= 40} onClick={() => change({ ...b, funds: [...b.funds, newFunding()], fundingComplete: false })}>재원 추가</button>
    <Check label="같은 지원금·상하위 재원의 중복을 확인했습니다" checked={b.fundingUnique} onChange={fundingUnique => change({ ...b, fundingUnique })} />
    <Check label="선택한 범위의 계획 재원을 모두 입력했습니다" checked={b.fundingComplete} onChange={fundingComplete => change({ ...b, fundingComplete })} />
    <Select label="재원 대조 세금 기준" value={b.fundingVat} onChange={fundingVat => change({ ...b, fundingVat: fundingVat as Budget["fundingVat"] })} options={VAT} />
    <Check label="이 재원이 위 지출과 같은 포함·제외 범위를 충당함을 확인했습니다" checked={b.fundingMatchesScope} onChange={fundingMatchesScope => change({ ...b, fundingMatchesScope })} />
    <p className="text-xs text-muted">확정은 근거를 확인한 담당자의 기록입니다. 앱의 승인이나 교부·입금을 뜻하지 않습니다.</p>
  </div></details>;
}
