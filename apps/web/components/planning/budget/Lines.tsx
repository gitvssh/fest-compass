import { useState } from "react";
import type { Budget, BudgetLine } from "@/lib/planning/budget-types";
import { VAT } from "@/lib/planning/budget-types";
import { newBudgetLine } from "@/lib/planning/budget-model";
import { lineAmount, money } from "@/lib/planning/budget-math";
import { taskStatus } from "@/lib/planning/model";
import type { Option, PlanDraft } from "@/lib/planning/types";
import { Field, Select } from "../Fields";
import { Check, NumberField } from "./Fields";
import { EvidenceView } from "../EvidenceView";

export function BudgetLines({ budget: b, draft: d, option: o, change }: { budget: Budget; draft: PlanDraft; option: Option; change: (b: Budget) => void }) {
  const [opened, setOpened] = useState("");
  return <section className="region-card space-y-4"><div className="flex flex-wrap items-center justify-between gap-3"><h3 className="text-xl font-extrabold">지출 항목 산출</h3><button className="region-button" disabled={b.lines.length >= 100} onClick={() => { const l = newBudgetLine(d.year); change({ ...b, lines: [...b.lines, l], expensesComplete: false }); setOpened(l.id); }}>지출 항목 추가</button></div>
    <p className="text-sm leading-6 text-muted">수량×단가 또는 수량×기간×기간당 단가를 선택합니다. 기간이 포함된 견적에는 기간을 다시 곱하지 않습니다. 단위는 원이며 빈칸은 미산정, 0은 명시적 0원입니다.</p>
    {b.lines.map((l, i) => {
      const set = (patch: Partial<BudgetLine>) => change({ ...b, lines: b.lines.map(x => x.id === l.id ? { ...l, ...patch } : x) });
      const calc = lineAmount(l), c = l.classification;
      return <details key={l.id} open={opened === l.id} className="rounded-xl border border-ink/15 p-4"><summary className="cursor-pointer font-bold" onClick={e => { e.preventDefault(); setOpened(opened === l.id ? "" : l.id); }}>지출 {i + 1} · {l.name || "이름 미정"} · {money(calc.amount)}</summary>
        <fieldset className="mt-4 min-w-0 space-y-4"><legend className="sr-only">지출 항목 {i + 1}</legend><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="지출 항목 이름" value={l.name} onChange={name => set({ name })} /><Field label="규격·포함 작업" value={l.specification} onChange={specification => set({ specification })} />
          <Select label="산출 방식" value={l.method} onChange={method => set({ method: method as BudgetLine["method"] })} options={{ unknown: "단가 적용 방식 미확인", quantity: "수량 × 단가 (기간 포함)", period: "수량 × 기간 × 기간당 단가" }} />
          <NumberField label="수량" value={l.quantity} onChange={quantity => set({ quantity })} /><Field label="수량 단위" value={l.unit} onChange={unit => set({ unit })} /><NumberField label="단가(원)" value={l.rate} onChange={rate => set({ rate })} />
          <NumberField label="기간 수" value={l.periods} onChange={periods => set({ periods })} /><Field label="기간 단위" value={l.periodUnit} onChange={periodUnit => set({ periodUnit })} /><Field label="견적에 포함된 기간·조건" value={l.coveredPeriod} onChange={coveredPeriod => set({ coveredPeriod })} />
          <Select label="항목 세금 기준" value={l.vat} onChange={vat => set({ vat: vat as BudgetLine["vat"] })} options={VAT} /><NumberField label="별도 세금액(원)" value={l.taxAmount} onChange={taxAmount => set({ taxAmount })} /><Field label="별도 세금액 근거" value={l.taxReference} onChange={taxReference => set({ taxReference })} />
          <Select label="단가 자료 성격" value={l.sourceKind} onChange={sourceKind => set({ sourceKind: sourceKind as BudgetLine["sourceKind"] })} options={{ unknown: "미확인", assumption: "담당자 가정", quote: "견적 기록", public: "공개 자료 참고" }} /><Field label="단가 출처·가정 이유" value={l.reference} onChange={reference => set({ reference })} />
        </div><p className="text-sm font-bold">항목 계산: {money(calc.amount)} · {VAT[calc.vat]}{l.method === "quantity" ? " · 입력한 기간 수를 추가로 곱하지 않음" : ""}</p>{calc.error && <p role="alert" className="text-sm text-coral">{calc.error}</p>}
        {(!l.reference.trim() || l.sourceKind === "unknown") && <p className="text-sm text-coral">단가의 출처·가정은 추가 확인이 필요합니다.</p>}
        <details><summary className="cursor-pointer font-bold">회계연도별 원문 분류</summary><p className="my-3 text-xs leading-6">기존 분류명·코드는 보존합니다. 현재 사업연도와 다르거나 확인 전이면 재검토가 필요합니다. 지침·분류·세율을 자동 입력하지 않습니다.</p><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="분류 적용 연도" value={c.year} max={4} onChange={year => set({ classification: { ...c, year, status: "unknown", date: "" } })} /><Field label="원문 분류명" value={c.label} onChange={label => set({ classification: { ...c, label, status: "unknown", date: "" } })} /><Field label="원문 분류 코드" value={c.code} onChange={code => set({ classification: { ...c, code, status: "unknown", date: "" } })} />
          <Field label="분류 지침명·버전·출처" value={c.guideline} onChange={guideline => set({ classification: { ...c, guideline, status: "unknown", date: "" } })} /><Select label="분류 검토 상태" value={c.status} onChange={status => set({ classification: { ...c, status: status as typeof c.status } })} options={{ unknown: "재확인 필요", reviewed: "원문 확인 기록" }} /><Field label="분류 확인일" type="date" value={c.date} onChange={date => set({ classification: { ...c, date } })} />
        </div><p className="mt-3 text-sm">현재 사업연도 {d.year}년 · 원문 적용 연도 {c.year || "미정"}년 · {c.status === "reviewed" && c.year === String(d.year) ? "해당 연도 확인 기록 있음" : "재확인 필요"}</p></details>
        <details><summary className="cursor-pointer font-bold">보관 근거·준비 과제 연결</summary><p className="my-3 text-xs">기획 후보에서 연결한 자료의 사본을 사용합니다. 과제 연결만으로 완료·외부 확인 상태를 바꾸지 않습니다.</p><div className="space-y-2">{d.evidence.map(e => <Check key={e.key} label={`근거: ${e.value.title}`} checked={l.evidenceKeys.includes(e.key)} onChange={yes => set({ evidenceKeys: yes ? [...l.evidenceKeys, e.key] : l.evidenceKeys.filter(k => k !== e.key) })} />)}{!d.evidence.length && <p className="text-sm text-muted">후보 작성에서 자료를 연결한 뒤 선택할 수 있습니다.</p>}{o.tasks.map(t => <Check key={t.id} label={`준비 과제: ${t.title || "이름 미정"} · ${taskStatus(o, t).stale ? "재확인 필요" : t.owner || "담당 미정"}`} checked={l.taskIds.includes(t.id)} onChange={yes => set({ taskIds: yes ? [...l.taskIds, t.id] : l.taskIds.filter(id => id !== t.id) })} />)}{l.evidenceKeys.map(k => { const e = d.evidence.find(e => e.key === k); return e ? <details key={k}><summary className="cursor-pointer font-bold text-blue">연결한 예산 근거: {e.value.title}</summary><EvidenceView source={e} /></details> : null; })}</div></details>
        <button className="region-button" onClick={() => change({ ...b, lines: b.lines.filter(x => x.id !== l.id), expensesComplete: false })}>이 지출 항목 제외</button></fieldset>
      </details>;
    })}
    {!b.lines.length && <p className="text-sm text-muted">아직 산출 항목이 없습니다.</p>}
    <Check label="지출 항목의 중복이 없음을 확인했습니다" checked={b.expensesUnique} onChange={expensesUnique => change({ ...b, expensesUnique })} />
    <Check label="선택한 범위의 지출 항목을 모두 입력했습니다" checked={b.expensesComplete} onChange={expensesComplete => change({ ...b, expensesComplete })} />
  </section>;
}
