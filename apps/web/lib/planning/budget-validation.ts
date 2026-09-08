import { day } from "../region/model";
import { AMOUNT_STAGES, FUND_STATUS, VAT } from "./budget-types";
import type { Budget, CostScope } from "./budget-types";
import type { Option, PlanDraft } from "./types";
import { decimal, lineAmount, recordWon, sumWon, won } from "./budget-math";

function check(ok: unknown, message = "예산 자료의 구조나 값을 확인하세요."): asserts ok { if (!ok) throw new Error(message); }
const str = (s: unknown, max = 2000): s is string => typeof s === "string" && s.length <= max;
const id = (s: unknown) => str(s, 80) && /^[a-zA-Z0-9_-]+$/.test(s);
const date = (s: unknown) => str(s, 10) && (s === "" || day(s));
const member = (s: unknown, o: object) => typeof s === "string" && Object.hasOwn(o, s);
function list<T>(a: T[], max: number) { check(Array.isArray(a) && a.length <= max, `예산 목록은 최대 ${max}개입니다.`); }
function unique(a: string[]) { check(new Set(a).size === a.length, "예산 식별자·연결이 중복되었습니다."); }
function number(s: string) { check(str(s, 30)); decimal(s); }
export function validateCostScope(s: CostScope) { check(s && ["unknown", "whole", "partial"].includes(s.kind) && [s.name, s.includes, s.excludes, s.departments].every(v => str(v)) && typeof s.departmentsKnown === "boolean"); }
function basis(raw: string) {
  check(str(raw, 12000)); const b = JSON.parse(raw);
  check(b && id(b.optionId) && Number.isInteger(b.year) && b.year >= 2000 && b.year <= 2100 && [b.regionKey, b.department, b.venue, b.item, b.audience].every(v => str(v)));
  for (const stage of ["setup", "event", "teardown"]) check(b.periods?.[stage] && date(b.periods[stage].start) && date(b.periods[stage].end));
}
export function validateBudget(b: Budget, d: PlanDraft, o: Option) {
  check(b && member(b.stage, AMOUNT_STAGES) && date(b.asOf)); basis(b.basis); validateCostScope(b.scope);
  check([b.limitVat, b.fundingVat].every(v => member(v, VAT)));
  for (const value of [b.fundingMatchesScope, b.expensesComplete, b.expensesUnique, b.fundingComplete, b.fundingUnique]) check(typeof value === "boolean");
  number(b.limit); check(str(b.baselineRevision, 80) && str(b.baselineOption, 80));
  check(b.changeReasons && [b.changeReasons.quantity, b.changeReasons.rate, b.changeReasons.period, b.changeReasons.scope, b.changeReasons.reference].every(v => str(v)));
  list(b.lines, 100); unique(b.lines.map(l => l.id));
  for (const l of b.lines) {
    check(id(l.id) && [l.name, l.specification, l.unit, l.periodUnit, l.coveredPeriod, l.taxReference, l.reference].every(v => str(v)));
    check(["unknown", "quantity", "period"].includes(l.method) && member(l.vat, VAT) && ["unknown", "assumption", "quote", "public"].includes(l.sourceKind));
    [l.quantity, l.rate, l.periods, l.taxAmount].forEach(number);
    const amount = lineAmount(l); check(!amount.error, amount.error);
    const c = l.classification;
    check(c && str(c.year, 4) && (c.year === "" || /^(20\d\d|2100)$/.test(c.year)) && [c.label, c.code, c.guideline].every(v => str(v)) && ["unknown", "reviewed"].includes(c.status) && date(c.date));
    check(c.status !== "reviewed" || !!(c.year && c.label.trim() && c.guideline.trim() && c.date), "분류 확인에는 적용 연도·원문 분류·지침 출처·확인일이 필요합니다.");
    list(l.evidenceKeys, 100); unique(l.evidenceKeys); check(l.evidenceKeys.every(k => d.evidence.some(e => e.key === k)), "예산 근거는 이 기획에 보관한 자료를 선택하세요.");
    list(l.taskIds, 30); unique(l.taskIds); check(l.taskIds.every(id => o.tasks.some(t => t.id === id)), "연결한 준비 과제를 확인하세요.");
  }
  if (b.expensesUnique) for (const vat of Object.keys(VAT)) sumWon(b.lines.map(lineAmount).filter(r => r.vat === vat && r.amount !== null).map(r => r.amount!));
  list(b.funds, 40); unique(b.funds.map(f => f.id));
  for (const f of b.funds) {
    check(id(f.id) && [f.name, f.provider, f.relation, f.sourceId, f.reference].every(v => str(v)) && str(f.parentId, 80) && typeof f.included === "boolean" && member(f.status, FUND_STATUS) && date(f.date)); number(f.amount);
    check(!f.parentId || (f.parentId !== f.id && b.funds.some(p => p.id === f.parentId)), "상위 재원은 같은 후보의 다른 재원을 선택하세요.");
    check(f.status !== "confirmed" || !!(f.reference.trim() && f.date), "확정 재원 기록에는 근거와 확인일이 필요합니다.");
    const seen = new Set([f.id]); let current = f;
    while (current.parentId) { check(!seen.has(current.parentId), "상위 재원이 순환합니다."); seen.add(current.parentId); current = b.funds.find(p => p.id === current.parentId)!; check(current); }
  }
  if (b.fundingUnique) sumWon(b.funds.filter(f => f.included && f.amount !== "").map(f => won(f.amount)!));
  list(b.records, 100); unique(b.records.map(r => r.id));
  for (const r of b.records) {
    check(id(r.id) && typeof r.recorded === "boolean" && [r.name, r.original, r.currency, r.reference, r.page, r.missingReason].every(v => str(v)) && member(r.stage, AMOUNT_STAGES) && member(r.vat, VAT) && ["won", "thousandWon", "unknown"].includes(r.unit));
    check(date(r.asOf) && r.period && date(r.period.start) && date(r.period.end) && (!r.period.start || !r.period.end || r.period.start <= r.period.end), "금액 기록의 날짜를 확인하세요.");
    check(!r.recorded || (r.name.trim() && r.reference.trim() && r.asOf), "금액 기록에는 이름·출처·기준일이 필요합니다.");
    validateCostScope(r.scope); basis(r.basis); check(["individual", "cumulative"].includes(r.kind));
    const converted = recordWon(r.original, r.unit, r.currency);
    check(!r.recorded || converted !== null || !!r.missingReason.trim(), "원 환산이 불가능한 원문은 결측·단위 미확인 이유를 남기세요.");
    list(r.includesIds, 100); unique(r.includesIds);
    check(r.kind !== "individual" || r.includesIds.length === 0, "포함 기록 연결은 누계 자료에서만 사용하세요.");
    check(r.includesIds.every(id => id !== r.id && b.records.some(x => x.id === id && (!r.recorded || x.recorded))), "누계에 포함된 기록을 확인하세요.");
  }
  const visiting = new Set<string>(), visited = new Set<string>();
  function visit(recordId: string) { check(!visiting.has(recordId), "누계 기록 연결이 순환합니다."); if (visited.has(recordId)) return; visiting.add(recordId); b.records.find(r => r.id === recordId)!.includesIds.forEach(visit); visiting.delete(recordId); visited.add(recordId); }
  b.records.forEach(r => visit(r.id));
}
