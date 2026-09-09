import { day } from "../region/model";
import { VAT } from "./budget-types";
import { EVIDENCE_KINDS, RESULT_ORIGINS, RESULT_STAGES } from "./outcome-types";
import type { OutcomeDraft, ResultValue } from "./outcome-types";
import type { Planning } from "./types";

function check(v: unknown, text = "결과 기록의 형식·참조를 확인하세요."): asserts v { if (!v) throw new Error(text); }
const str = (v: unknown, max = 2000): v is string => typeof v === "string" && v.length <= max;
const id = (v: unknown) => str(v, 80) && /^[a-zA-Z0-9_-]+$/.test(v);
const date = (v: unknown) => str(v, 10) && (v === "" || day(v));
const member = (v: unknown, keys: object) => typeof v === "string" && Object.hasOwn(keys, v);
export function resultNumber(v: string): number | null {
  if (v === "") return null;
  check(typeof v === "string" && /^\d{1,16}(?:\.\d{1,6})?$/.test(v) && Number(v) <= Number.MAX_SAFE_INTEGER, "결과 값은 음수·쉼표 없이 안전한 범위의 숫자로 입력하세요.");
  return Number(v);
}
function value(v: ResultValue, money = false) {
  check(v && str(v.value, 30) && member(v.origin, RESULT_ORIGINS) && str(v.reference) && str(v.missingReason));
  const n = resultNumber(v.value); check(!money || n === null || Number.isSafeInteger(n), "비용은 원 단위 정수로 입력하세요.");
  check(n === null || (v.origin !== "unknown" && !!v.reference.trim()), "입력한 결과 값에는 출처 구분과 참조가 필요합니다.");
}
function rows<T extends { id: string }>(v: T[], max = 30) { check(Array.isArray(v) && v.length <= max, `결과 항목은 최대 ${max}개입니다.`); check(v.every(r => r && id(r.id)) && new Set(v.map(r => r.id)).size === v.length); }
function draft(d: OutcomeDraft, p: Planning) {
  check(d && id(d.id) && date(d.asOf) && str(d.operations));
  const proposal = p.revisions.find(r => r.id === d.proposalId && r.proposal);
  check(proposal, "결과의 기준 기획안 보관본이 필요합니다.");
  const option = proposal.draft.options.find(o => o.decision === "selected")!;
  rows(d.metrics); rows(d.funds, 40); rows(d.evidence); rows(d.improvements, 20);
  check(new Set(d.funds.map(f => f.fundId)).size === d.funds.length, "같은 재원의 결과가 중복됐습니다.");
  for (const m of d.metrics) {
    check([m.name, m.planReference, m.planDefinition, m.actualDefinition, m.planUnit, m.actualUnit].every(v => str(v)) && str(m.planned, 30)); resultNumber(m.planned); value(m.actual);
    check(m.period && date(m.period.start) && date(m.period.end) && (!m.period.start || !m.period.end || m.period.start <= m.period.end));
  }
  for (const f of d.funds) { check(option.budget?.funds.some(x => x.id === f.fundId) && member(f.stage, RESULT_STAGES) && member(f.vat, VAT) && typeof f.scopeMatches === "boolean" && str(f.scope)); for (const v of [f.actual, f.balance, f.returned, f.interest]) value(v, true); }
  for (const e of d.evidence) check(member(e.kind, EVIDENCE_KINDS) && [e.scope, e.reference, e.reviewer, e.note].every(v => str(v)) && ["unknown", "reviewing", "confirmed"].includes(e.status) && date(e.checkedAt) && (e.status !== "confirmed" || !!(e.reviewer.trim() && e.checkedAt && e.reference.trim())), "증빙 확인 기록에는 참조·검토 담당·확인일이 필요합니다.");
  for (const i of d.improvements) check([i.problem, i.action, i.nextTask, i.nextBudget, i.reference].every(v => str(v)));
}
export function validateOutcomes(p: Planning) {
  if (p.outcomes !== undefined) {
    check(p.version === 4 && p.outcomes && Array.isArray(p.outcomes.revisions), "결과 기록은 기획 파일 v4가 필요합니다."); rows(p.outcomes.revisions, 20);
    if (p.outcomes.draft !== null) draft(p.outcomes.draft, p);
    for (const r of p.outcomes.revisions) { check(str(r.savedAt, 40) && Number.isFinite(Date.parse(r.savedAt)) && str(r.note)); draft(r.draft, p); }
  }
  for (const d of [p.draft, ...p.revisions.map(r => r.draft)]) if (d.previousOutcomeId !== undefined) check(p.version === 4 && p.outcomes?.revisions.some(r => r.id === d.previousOutcomeId), "다음 회차의 원본 결과 보관본이 필요합니다.");
}
