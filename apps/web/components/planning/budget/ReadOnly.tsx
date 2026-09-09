import type { Option, PlanDraft } from "@/lib/planning/types";
import { VAT, FUND_STATUS } from "@/lib/planning/budget-types";
import { lineAmount, money } from "@/lib/planning/budget-math";
import { BudgetSummary } from "./Summary";
import { AmountRecordsView } from "./Records";
import { EvidenceView } from "../EvidenceView";

export function BudgetReadOnly({ draft: d, option: o, report = false }: { draft: PlanDraft; option: Option; report?: boolean }) {
  const b = o.budget;
  if (!b) return <p className="text-sm text-muted">{o.name} · 이 보관본에는 예산 기록이 없습니다.</p>;
  return <section className="space-y-4"><h3 className="text-xl font-extrabold">{o.name}의 당시 예산·준비 규모</h3><BudgetSummary budget={b} draft={d} option={o} />
    <div className="overflow-x-auto"><table className="comparison-table"><caption className="pb-2 text-left font-bold">당시 지출 산출과 원문 분류</caption><thead><tr><th>항목</th><th>수량·기간·단가</th><th>원 반올림 금액</th><th>출처·가정 / 분류</th></tr></thead><tbody>{b.lines.map(l => { const a = lineAmount(l); return <tr key={l.id}><th>{l.name || "미정"}<br />{l.specification}</th><td>{l.quantity || "미정"}{l.unit} × {l.rate || "미정"}원{l.method === "period" ? ` × ${l.periods || "미정"}${l.periodUnit}` : " · 기간 추가 곱셈 없음"}<br />{l.coveredPeriod}</td><td>{money(a.amount)}<br />{VAT[a.vat]}<br />별도 세금 {l.taxAmount || "미입력"} · {l.taxReference || "근거 미입력"}</td><td className="whitespace-pre-wrap break-words">{{ unknown: "자료 성격 미확인", assumption: "담당자 가정", quote: "견적 기록", public: "공개 자료 참고" }[l.sourceKind]} · {l.reference || "미입력"}<br />{l.classification.year || "연도 미정"} · {l.classification.label || "분류 미정"} · {l.classification.code}<br />{l.classification.guideline || "지침 미입력"} · {l.classification.date || "미확인"}<br />{l.classification.status === "reviewed" && l.classification.year === String(d.year) ? "해당 연도 원문 확인 기록" : "재확인 필요"}</td></tr>; })}</tbody></table></div>
    <div className="space-y-2 text-sm leading-6">{b.funds.map(f => <p key={f.id}>{f.name || "재원 미정"} · {f.provider || "주체 미정"} · {f.relation || "관계 미정"} · 식별 {f.sourceId || "미정"} · {f.amount || "미산정"}원 · {FUND_STATUS[f.status]} · {f.included ? "합산 선택" : "참고 기록"}<br />{f.parentId && `상위: ${b.funds.find(p => p.id === f.parentId)?.name || f.parentId} · `}근거 {f.reference || "미정"} · 확인일 {f.date || "미정"}</p>)}</div>
    {b.lines.map(l => <div key={l.id} className="space-y-2">{l.taskIds.length > 0 && <p className="text-sm">{l.name}의 준비 과제: {l.taskIds.map(id => o.tasks.find(t => t.id === id)?.title || id).join(" · ")}</p>}{l.evidenceKeys.map(k => { const e = d.evidence.find(e => e.key === k); return e ? report ? <p key={k} className="text-sm">{l.name}의 당시 근거: {e.value.title} · 아래 보관 자료의 값·출처 참조</p> : <details key={k}><summary className="cursor-pointer font-bold text-blue">{l.name}의 당시 근거: {e.value.title}</summary><EvidenceView source={e} readOnly={report} /></details> : null; })}</div>)}
    <p className="whitespace-pre-wrap text-sm leading-6">기준 보관본: {b.baselineRevision || "미선택"}<br />수량 변경: {b.changeReasons.quantity || "미입력"}<br />단가 변경: {b.changeReasons.rate || "미입력"}<br />기간 변경: {b.changeReasons.period || "미입력"}<br />범위 변경: {b.changeReasons.scope || "미입력"}<br />변경 근거: {b.changeReasons.reference || "미입력"}</p><AmountRecordsView budget={b} />
  </section>;
}
