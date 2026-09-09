import { archive, copy, duplicateOption, newTask, today, uid, validatePlanning } from "./model";
import { budgetBasis, fundingIssue, scopeKnown } from "./budget-model";
import { sumWon, won } from "./budget-math";
import { resultNumber } from "./outcome-validation";
import type { FundResult, OutcomeDraft, ResultMetric, ResultValue } from "./outcome-types";
import type { Planning, Revision } from "./types";

export const emptyResult = (): ResultValue => ({ value: "", origin: "unknown", reference: "", missingReason: "" });
export const newMetric = (): ResultMetric => ({ id: uid(), name: "", planned: "", planReference: "", planDefinition: "", actualDefinition: "", planUnit: "", actualUnit: "", period: { start: "", end: "" }, actual: emptyResult() });
export function newOutcome(r: Revision): OutcomeDraft {
  if (!r.proposal) throw new Error("기준 기획안을 먼저 보관하세요.");
  const o = r.draft.options.find(o => o.decision === "selected")!;
  return { id: uid(), proposalId: r.id, asOf: today(), operations: "", metrics: [], funds: (o.budget?.funds ?? []).filter(f => f.included).map(f => ({ id: uid(), fundId: f.id, stage: "unknown", scopeMatches: false, scope: "", vat: "unknown", actual: emptyResult(), balance: emptyResult(), returned: emptyResult(), interest: emptyResult() })), evidence: [], improvements: [] };
}
export function archiveOutcome(p: Planning, note: string): Planning {
  if (!p.outcomes?.draft) throw new Error("결과 초안을 먼저 만드세요.");
  const n = copy(p); n.version = 4; n.outcomes!.revisions.push({ id: uid(), savedAt: new Date().toISOString(), note, draft: copy(p.outcomes.draft) }); validatePlanning(n); return n;
}
export function startOutcome(p: Planning, proposalId: string): Planning {
  const r = p.revisions.find(r => r.id === proposalId && r.proposal); if (!r) throw new Error("기준 기획안을 선택하세요.");
  const n = p.outcomes?.draft ? archiveOutcome(p, "다른 결과를 열기 직전 초안") : copy(p);
  n.version = 4; n.outcomes ??= { draft: null, revisions: [] }; n.outcomes.draft = newOutcome(r); validatePlanning(n); return n;
}
export function compareMetric(m: ResultMetric) {
  try {
    const planned = resultNumber(m.planned), actual = resultNumber(m.actual.value);
    const same = m.planDefinition.trim() && m.planDefinition.trim() === m.actualDefinition.trim() && m.planUnit.trim() && m.planUnit.trim() === m.actualUnit.trim();
    const reason = !same ? "지표 정의·단위 미입력 또는 불일치" : !m.planReference.trim() ? "계획값의 근거 미입력" : !m.period.start || !m.period.end ? "비교 대상 기간 미입력" : planned === null || actual === null ? "계획 또는 실측 미확인" : m.actual.origin === "unknown" || !m.actual.reference.trim() ? "실측 출처 미확인" : "";
    if (reason) return { planned, actual, difference: null, percent: null, reason };
    return { planned, actual, difference: actual! - planned!, percent: planned === 0 ? null : (actual! - planned!) / planned! * 100, reason: planned === 0 ? "계획 0 · 비율 미산정" : "" };
  } catch (e) { return { planned: null, actual: null, difference: null, percent: null, reason: (e as Error).message }; }
}
export function compareFund(f: FundResult, r: Revision) {
  const o = r.draft.options.find(o => o.decision === "selected")!, b = o.budget, source = b?.funds.find(v => v.id === f.fundId);
  try {
    const planned = source ? won(source.amount) : null, actual = resultNumber(f.actual.value);
    const reason = !b || !source?.included || fundingIssue(b) ? "계획 재원의 중복·포함 여부 미확인" : b.basis !== budgetBasis(r.draft, o) || !scopeKnown(b.scope) || !f.scopeMatches || !f.scope.trim() ? "계획과 실제 사용의 사업 범위 미확인" : b.fundingVat === "unknown" || b.fundingVat !== f.vat ? "세금 기준 미확인 또는 불일치" : f.stage === "unknown" ? "실제 사용액 단계 미확인" : planned === null || actual === null ? "계획 또는 실제 사용액 미확인" : f.actual.origin === "unknown" || !f.actual.reference.trim() ? "실제 사용액 출처 미확인" : "";
    return { name: source?.name || "재원 이름 미정", planned, actual, difference: reason ? null : actual! - planned!, percent: !reason && planned !== 0 ? (actual! - planned!) / planned! * 100 : null, reason: reason || (planned === 0 ? "계획 0 · 비율 미산정" : "") };
  } catch (e) { return { name: source?.name || "재원", planned: null, actual: null, difference: null, percent: null, reason: (e as Error).message }; }
}
export function fundTotal(d: OutcomeDraft, r: Revision) {
  const b = r.draft.options.find(o => o.decision === "selected")!.budget;
  const rows = d.funds.map(f => compareFund(f, r));
  if (!b?.fundingComplete || !rows.length || rows.some(f => f.difference === null) || d.funds.length !== b.funds.filter(f => f.included).length || new Set(d.funds.map(f => f.stage)).size !== 1) return null;
  try { return { planned: sumWon(rows.map(f => f.planned!)), actual: sumWon(rows.map(f => f.actual!)) }; } catch { return null; }
}
export function nextEdition(p: Planning, outcomeId: string, year: number): Planning {
  const result = p.outcomes?.revisions.find(r => r.id === outcomeId); if (!result) throw new Error("보관한 결과 버전을 선택하세요.");
  if (!Number.isInteger(year) || year < 2000 || year > 2100) throw new Error("새 사업연도는 2000~2100년으로 입력하세요.");
  const r = p.revisions.find(r => r.id === result.draft.proposalId)!;
  if (year <= r.draft.year) throw new Error("다음 회차의 사업연도는 기준 기획보다 이후여야 합니다.");
  const n = archive(p, "다음 회차를 만들기 직전 기획 초안"), d = copy(r.draft);
  d.id = uid(); d.year = year; d.title = `${year} ${r.draft.title}`.slice(0, 200); d.previousOutcomeId = result.id; d.period = { start: "", end: "" }; d.asOf = ""; d.continuity = "continuing";
  d.relations = d.relations.map(v => ({ ...v, id: uid(), relation: "unknown", checkedAt: "" }));
  d.options = d.options.map(old => {
    const o = duplicateOption(old); o.name = old.name; for (const period of Object.values(o.periods)) { period.start = ""; period.end = ""; }
    o.tasks = o.tasks.map(t => ({ ...t, basis: JSON.stringify({ venue: o.venue, item: o.item, audience: o.audience, periods: o.periods }) }));
    if (o.budget) { o.budget.stage = "estimate"; o.budget.asOf = ""; }
    if (old.decision === "selected") for (const i of result.draft.improvements) if (i.nextTask.trim() || i.nextBudget.trim()) {
      if (o.tasks.length >= 30) throw new Error("차기 준비 과제 30개 한도를 초과합니다. 기존 기획을 유지합니다.");
      o.tasks.push({ ...newTask(o), title: (i.nextTask || "전회차 개선 예산 검토").slice(0, 300), needed: `${i.action}\n차기 예산 검토: ${i.nextBudget}`.slice(0, 2000), reference: `개인 결과 ${result.id} · 개선 ${i.id}` });
    }
    return o;
  });
  n.draft = d; n.version = 4;
  if (n.outcomes?.draft) { const saved = archiveOutcome(n, "다음 회차 작성 직전 결과 초안"); saved.outcomes!.draft = null; validatePlanning(saved); return saved; }
  validatePlanning(n); return n;
}
