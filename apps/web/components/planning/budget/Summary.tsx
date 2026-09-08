import type { Budget } from "@/lib/planning/budget-types";
import { AMOUNT_STAGES, FUND_STATUS, VAT } from "@/lib/planning/budget-types";
import { summarizeBudget } from "@/lib/planning/budget-model";
import { money, won } from "@/lib/planning/budget-math";
import type { Option, PlanDraft } from "@/lib/planning/types";
import { Composition } from "./Charts";

export function BudgetSummary({ budget: b, draft: d, option: o }: { budget: Budget; draft: PlanDraft; option: Option }) {
  const s = summarizeBudget(b, d, o);
  const expenses = b.lines.flatMap((l, i) => s.rows[i].amount === null ? [] : [{ label: l.name || "항목 미정", amount: s.rows[i].amount! }]);
  const funds = b.funds.filter(f => f.included).flatMap(f => { try { const amount = won(f.amount); return amount === null ? [] : [{ label: `${f.name || "재원 미정"} · ${FUND_STATUS[f.status]}`, amount }]; } catch { return []; } });
  const cards = [["지출 산출 합계", money(s.total)], ["확정 재원 기록", money(s.secured)], ["예정 재원", money(s.planned)], ["미산정 지출", `${s.missing}건`]];
  return <div className="space-y-4"><div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{cards.map(([label, value]) => <div key={label} className="region-card min-w-0"><p className="text-xs font-bold text-muted">{label}</p><p className="mt-2 break-words text-xl font-extrabold">{value}</p></div>)}</div>
    <div className="region-card space-y-2 text-sm leading-6"><p className="font-bold">{d.year}년 · {o.name} · {AMOUNT_STAGES[b.stage]} 기준의 담당자 산출 · {VAT[s.vat]}</p><p>범위: {b.scope.name || "미정"} · 포함 부서: {b.scope.departments || "미확인"} · 기준일 {b.asOf || "미정"}</p>
      <p>세금 기준별 확인 소계: {Object.entries(s.groups).map(([vat, amount]) => `${VAT[vat as keyof typeof VAT]} ${money(amount!)}`).join(" / ") || "합산 보류 또는 산정 항목 없음"}</p>
      <p>{s.total === null ? "전체 총액 미확정" : "표시된 항목별 원 반올림 합계"} · {s.stale ? "이전 기획 조건의 입력 · 재확인 필요" : "입력한 견적·가정에 따른 계산"}</p>
      <p>{s.total === null ? "최소 초과액" : "한도 초과액"}: {s.excess === null ? "비교 보류" : money(s.excess)} · {s.total === null ? "최소 부족액(미산정 포함)" : "확정 재원 대비 부족액"}: {s.shortage === null ? "비교 보류" : money(s.shortage)}</p>
      <p>확정 상태 미확인 재원: {money(s.unknownFunding)} · 예정·미확인 금액은 확보액에 넣지 않습니다.</p>
      <p className="text-xs text-muted">한도·재원 대조는 같은 범위와 세금 기준에서만 합니다. 계획 재원과 지출을 더하지 않습니다. 기록·계산 결과이며 예산 확정·계약·지급을 실행하지 않습니다.</p>
      {s.reasons.length > 0 && <ul className="list-disc pl-5 text-coral">{s.reasons.map(r => <li key={r}>{r}</li>)}</ul>}
    </div>
    <div className="grid gap-4 lg:grid-cols-2"><Composition title="계획 재원 구성" values={funds} allowed={s.fundingPie} reason="전체 분모·중복·금액·현재 기획 조건을 확인해야 합니다. 총액 0이면 비율을 표시하지 않습니다." /><Composition title="지출 산출 구성" values={expenses} allowed={s.expensePie} reason="미산정·세금·범위·중복을 확인해야 합니다. 총액 0이면 비율을 표시하지 않습니다." /></div>
  </div>;
}
