import { useState } from "react";
import type { Budget } from "@/lib/planning/budget-types";
import { AMOUNT_STAGES, VAT } from "@/lib/planning/budget-types";
import { compareBudgets, summarizeBudget } from "@/lib/planning/budget-model";
import { money } from "@/lib/planning/budget-math";
import type { Option, PlanDraft, Revision } from "@/lib/planning/types";
import { Field, Select } from "../Fields";
import { AmountBars } from "./Charts";
import { BudgetReadOnly } from "./ReadOnly";

export function BudgetComparison({ draft: d }: { draft: PlanDraft }) {
  const [baseId, setBase] = useState(d.options[0].id), base = d.options.find(o => o.id === baseId) ?? d.options[0];
  const rows = d.options.map(o => { const b = o.budget, summary = b ? summarizeBudget(b, d, o) : null; const comparison = b && base.budget ? compareBudgets(b, d, o, base.budget, d, base) : { difference: null, reason: "예산 미입력" }; return { o, b, summary, comparison }; });
  const available = rows.filter(r => r.comparison.difference !== null && r.summary?.total !== null && r.summary);
  return <section className="space-y-4"><div className="region-card space-y-3"><h2 className="text-2xl font-extrabold">후보별 예산 비교</h2><p className="text-sm leading-6">{d.year}년 · {d.title} · 입력한 비용과 준비 규모를 비교합니다. 다른 단계의 원문 금액을 합산하거나 안전·흥행 순위를 만들지 않습니다.</p><Select label="후보 비교 기준" value={base.id} onChange={setBase}>{d.options.map(o => <option key={o.id} value={o.id}>{o.name || "이름 미정"}</option>)}</Select><div className="overflow-x-auto" role="region" aria-label="후보별 예산 수치 표" tabIndex={0}><table className="comparison-table min-w-[600px]"><thead><tr><th>후보</th><th>산출 합계</th><th>단계·세금·범위</th><th>기준 후보 대비</th></tr></thead><tbody>{rows.map(r => <tr key={r.o.id}><th>{r.o.name}</th><td>{money(r.summary?.total ?? null)}</td><td>{r.b ? `${AMOUNT_STAGES[r.b.stage]} · ${VAT[r.summary!.vat]} · ${r.b.scope.name || "범위 미정"}` : "예산 미입력"}</td><td>{r.comparison.difference === null ? `비교 보류 · ${r.comparison.reason}` : `${r.comparison.difference > 0 ? "+" : ""}${money(r.comparison.difference)}`}</td></tr>)}</tbody></table></div></div>
    {available.length >= 2 ? <AmountBars values={available.map(r => ({ name: r.o.name, amount: r.summary!.total!, pieces: r.b!.lines.map((l, i) => ({ name: l.name || "항목 미정", amount: r.summary!.rows[i].amount! })) }))} /> : <p className="region-card text-sm text-muted">금액 비교 그래프 보류 · 같은 기준으로 산정된 후보가 두 개 이상 필요합니다.</p>}
  </section>;
}
export function BudgetBaseline({ budget: b, draft: d, option: o, revisions, change }: { budget: Budget; draft: PlanDraft; option: Option; revisions: Revision[]; change: (b: Budget) => void }) {
  const revision = revisions.find(r => r.id === b.baselineRevision), old = revision?.draft.options.find(x => x.id === b.baselineOption);
  const comparison = old?.budget && revision ? compareBudgets(b, d, o, old.budget, revision.draft, old) : null;
  return <details className="region-card"><summary className="cursor-pointer text-xl font-extrabold">이전 보관본과 변경 이유</summary><div className="mt-4 space-y-4"><div className="grid gap-3 sm:grid-cols-2"><Select label="예산 기준 보관본" value={b.baselineRevision} onChange={baselineRevision => { const r = revisions.find(r => r.id === baselineRevision); change({ ...b, baselineRevision, baselineOption: r?.draft.options.find(o => o.budget)?.id ?? "" }); }}><option value="">기준 보관본 선택</option>{revisions.filter(r => r.draft.options.some(o => o.budget)).map((r, i) => <option key={r.id} value={r.id}>{i + 1} · {r.draft.year}년 · {r.note || r.draft.title} · {r.savedAt}</option>)}</Select><Select label="보관본 기준 후보" value={b.baselineOption} onChange={baselineOption => change({ ...b, baselineOption })}><option value="">후보 선택</option>{revision?.draft.options.filter(o => o.budget).map(o => <option key={o.id} value={o.id}>{o.name}</option>)}</Select></div>
    {comparison && <p className="rounded-xl bg-blue-soft p-4 text-sm font-bold">{comparison.difference === null ? "기준 버전 대비 차액 보류" : `기준 버전 대비 ${comparison.difference > 0 ? "+" : ""}${money(comparison.difference)}`} · {comparison.reason}</p>}
    <div className="grid gap-3 sm:grid-cols-2">{([ ["quantity", "수량 변경 이유"], ["rate", "단가 변경 이유"], ["period", "기간 변경 이유"], ["scope", "범위·관련 부서 변경 이유"], ["reference", "변경 판단 근거"] ] as const).map(([key, label]) => <Field key={key} label={label} multiline value={b.changeReasons[key]} onChange={v => change({ ...b, changeReasons: { ...b.changeReasons, [key]: v } })} />)}</div>
    {comparison?.difference !== null && comparison?.difference !== undefined && comparison.difference !== 0 && !Object.values(b.changeReasons).some(v => v.trim()) && <p className="text-sm text-coral">증감 이유가 아직 없습니다. 수량·단가·기간·범위의 변경 이유를 남기세요.</p>}
    {old && revision && <details><summary className="cursor-pointer font-bold text-blue">기준 버전의 산출·근거 다시 보기</summary><div className="mt-4"><BudgetReadOnly draft={revision.draft} option={old} /></div></details>}
  </div></details>;
}
