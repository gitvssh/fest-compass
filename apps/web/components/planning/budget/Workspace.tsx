import { useState } from "react";
import type { Planning, Option } from "@/lib/planning/types";
import type { Budget } from "@/lib/planning/budget-types";
import { AMOUNT_STAGES, VAT } from "@/lib/planning/budget-types";
import { budgetBasis, newBudget } from "@/lib/planning/budget-model";
import { taskStatus } from "@/lib/planning/model";
import { Field, Select } from "../Fields";
import { NumberField, ScopeFields } from "./Fields";
import { BudgetSummary } from "./Summary";
import { BudgetLines } from "./Lines";
import { BudgetFunds } from "./Funds";
import { BudgetRecords } from "./Records";
import { BudgetBaseline, BudgetComparison } from "./Comparison";

export function BudgetWorkspace({ planning: p, option: o, select, change, renew, archive }: { planning: Planning; option: Option; select: (id: string) => void; change: (o: Option) => void; renew: () => void; archive: (note: string) => void }) {
  const b = o.budget, d = p.draft, [note, setNote] = useState("");
  const set = (next: Budget) => change({ ...o, budget: next });
  return <div className="space-y-5"><BudgetComparison draft={d} /><section className="region-card space-y-3"><h2 className="text-xl font-extrabold">예산을 작성할 후보</h2><Select label="예산 편집 후보" value={o.id} onChange={select}>{d.options.map(x => <option key={x.id} value={x.id}>{x.name || "이름 미정"}</option>)}</Select><p className="text-sm leading-6">사업·장소·기간·준비 과제는 후보 작성과 함께 사용합니다. 견적·금액 단계별 원문은 출처와 별도로 보관하세요.</p></section>
    {b ? <><section className="region-card space-y-4"><h2 className="text-xl font-extrabold">{o.name} · 산출 기준</h2><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Select label="산출 비교 단계" value={b.stage} onChange={stage => set({ ...b, stage: stage as Budget["stage"] })} options={AMOUNT_STAGES} /><Field label="예산 기준일" type="date" value={b.asOf} onChange={asOf => set({ ...b, asOf })} /><NumberField label="예산 한도(원)" value={b.limit} onChange={limit => set({ ...b, limit })} /><Select label="한도 세금 기준" value={b.limitVat} onChange={limitVat => set({ ...b, limitVat: limitVat as Budget["limitVat"] })} options={VAT} /></div>
      <ScopeFields scope={b.scope} change={scope => set({ ...b, scope, expensesComplete: false, expensesUnique: false, fundingComplete: false, fundingUnique: false, fundingMatchesScope: false, funds: b.funds.map(f => ({ ...f, status: "unknown", date: "" })) })} />
      <p className="text-xs text-muted">후보 간 범위 이름·포함/제외 항목·관련 부서가 같아야 차액을 계산합니다. 범위 변경 시 전체 입력·재원 확인을 다시 기록합니다.</p>
      {b.basis !== budgetBasis(d, o) && <div className="space-y-3 rounded-xl bg-coral-soft p-4"><p className="text-sm font-bold">장소·시기·사업연도 등 기획 조건이 바뀌었습니다. 기존 금액과 원문 분류는 유지하며 현재 조건의 총액·확보 재원 비교를 보류합니다.</p><button className="region-button" onClick={renew}>이전 예산 보관 후 현재 조건으로 재검토</button><p className="text-xs">당시 기획을 보관본으로 남기고 재원 확정·분류·전체 범위 확인을 초기화합니다. 과거 금액 기록의 적용 조건은 바꾸지 않습니다.</p></div>}
    </section><BudgetSummary budget={b} draft={d} option={o} />
    <BudgetFunds budget={b} change={set} /><BudgetLines key={o.id} budget={b} draft={d} option={o} change={set} /><BudgetRecords budget={b} draft={d} option={o} change={set} />
    <BudgetBaseline budget={b} draft={d} option={o} revisions={p.revisions} change={set} />
    <section className="region-card space-y-3"><h3 className="text-xl font-extrabold">비용에 연결한 준비 규모</h3><p className="text-sm">수량·기간·단가와 과제 상태를 함께 검토하세요. 비용 증가를 안전·준비 효과로 자동 환산하지 않습니다.</p>{b.lines.filter(l => l.taskIds.length).map(l => <article key={l.id} className="rounded-xl bg-paper p-3 text-sm leading-6"><h4 className="font-bold">{l.name || "항목 미정"} · {l.quantity || "수량 미정"}{l.unit} · {l.coveredPeriod || `${l.periods || "기간 미정"}${l.periodUnit}`}</h4>{l.taskIds.map(id => { const t = o.tasks.find(t => t.id === id); return t ? <p key={id}>{t.title || "과제 미정"} · 담당 {t.owner || "미정"} · 기한 {t.due || "미정"} · {taskStatus(o, t).stale ? "재확인 필요" : t.progress === "done" ? "완료 기록" : t.progress === "doing" ? "진행" : "미착수"}</p> : null; })}</article>)}{!b.lines.some(l => l.taskIds.length) && <p className="text-sm text-muted">지출 항목의 ‘보관 근거·준비 과제 연결’에서 후보의 과제를 선택할 수 있습니다.</p>}</section>
    <section className="region-card space-y-3"><Field label="예산 보관 메모" value={note} onChange={setNote} /><button className="region-primary" onClick={() => archive(note)}>예산·근거를 보관본으로 남기기</button><p className="text-xs text-muted">현재 기획·후보·예산·미산정·출처·준비 과제를 함께 보관합니다. 보관본 탭에서 재조회·복원할 수 있습니다.</p></section></> : <section className="region-card space-y-3"><h3 className="text-lg font-extrabold">이 후보의 예산은 아직 작성하지 않았습니다.</h3><p className="text-sm text-muted">기존 기획 근거와 준비 과제를 유지하면서 빈 예산부터 시작합니다.</p><button className="region-primary" onClick={() => set(newBudget(d, o))}>이 후보 예산 작성 시작</button></section>}
  </div>;
}
