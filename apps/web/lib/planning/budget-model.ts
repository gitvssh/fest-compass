import type { Option, PlanDraft } from "./types";
import type { AmountRecord, Budget, BudgetLine, CostScope, Funding, Vat } from "./budget-types";
import { lineAmount, sumWon, won } from "./budget-math";

const uid = () => crypto.randomUUID();
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
export const blankScope = (): CostScope => ({ kind: "unknown", name: "", includes: "", excludes: "", departments: "", departmentsKnown: false });
export function budgetBasis(d: PlanDraft, o: Option): string {
  return JSON.stringify({ optionId: o.id, year: d.year, regionKey: d.regionKey, department: d.department, venue: o.venue, item: o.item, audience: o.audience, periods: o.periods });
}
export function newBudget(d: PlanDraft, o: Option): Budget {
  return { basis: budgetBasis(d, o), stage: "estimate", scope: blankScope(), asOf: d.asOf,
    limit: "", limitVat: "unknown", fundingVat: "unknown", fundingMatchesScope: false,
    expensesComplete: false, expensesUnique: false, fundingComplete: false, fundingUnique: false,
    lines: [], funds: [], records: [], baselineRevision: "", baselineOption: "",
    changeReasons: { quantity: "", rate: "", period: "", scope: "", reference: "" } };
}
export function newBudgetLine(year: number): BudgetLine {
  return { id: uid(), name: "", specification: "", quantity: "", unit: "", rate: "", method: "unknown", periods: "", periodUnit: "", coveredPeriod: "", vat: "unknown", taxAmount: "", taxReference: "", sourceKind: "unknown", reference: "", classification: { year: String(year), label: "", code: "", guideline: "", status: "unknown", date: "" }, evidenceKeys: [], taskIds: [] };
}
export function newFunding(): Funding {
  return { id: uid(), name: "", provider: "", relation: "", sourceId: "", parentId: "", included: true, amount: "", status: "unknown", reference: "", date: "" };
}
export function newAmountRecord(b: Budget): AmountRecord {
  return { id: uid(), recorded: false, name: "", stage: "request", original: "", unit: "unknown", currency: "KRW", vat: "unknown", scope: clone(b.scope), period: { start: "", end: "" }, reference: "", page: "", asOf: b.asOf, missingReason: "", kind: "individual", includesIds: [], basis: b.basis };
}
export function copiedBudget(b: Budget, o: Option, taskIds: Map<string, string>): Budget {
  const next = clone(b), ids = new Map(b.funds.map(f => [f.id, uid()]));
  next.basis = JSON.stringify({ ...JSON.parse(b.basis), optionId: o.id });
  next.lines = next.lines.map(l => ({ ...l, id: uid(), classification: { ...l.classification, status: "unknown", date: "" }, taskIds: l.taskIds.map(id => taskIds.get(id)!).filter(Boolean) }));
  next.funds = next.funds.map(f => ({ ...f, id: ids.get(f.id)!, parentId: ids.get(f.parentId) ?? "", status: "unknown", date: "" }));
  next.records = []; next.baselineRevision = ""; next.baselineOption = "";
  next.expensesComplete = false; next.expensesUnique = false; next.fundingComplete = false; next.fundingUnique = false; next.fundingMatchesScope = false;
  next.changeReasons = { quantity: "", rate: "", period: "", scope: "", reference: "" }; return next;
}
export function renewBudget(b: Budget, d: PlanDraft, o: Option): Budget {
  const next = clone(b); next.basis = budgetBasis(d, o);
  next.funds = next.funds.map(f => ({ ...f, status: "unknown", date: "" }));
  next.lines = next.lines.map(l => ({ ...l, classification: { ...l.classification, status: "unknown", date: "" } }));
  next.expensesComplete = false; next.expensesUnique = false; next.fundingComplete = false; next.fundingUnique = false; next.fundingMatchesScope = false;
  return next; // Old source labels and stage records keep their original year/basis.
}
const normalize = (s: string) => s.trim().replace(/\s+/g, " ");
export const scopeKnown = (s: CostScope) => s.kind !== "unknown" && !!normalize(s.name) && !!normalize(s.includes) && s.departmentsKnown && !!normalize(s.departments);
export function scopeKey(s: CostScope): string { return JSON.stringify([s.kind, normalize(s.name), normalize(s.includes), normalize(s.excludes), normalize(s.departments)]); }
export function fundingIssue(b: Budget): string {
  if (!b.fundingUnique) return "재원 중복 여부 미확인";
  const ancestors = (f: Funding) => { const ids: string[] = []; let p = f.parentId; while (p) { if (p === f.id || ids.includes(p)) throw new Error("상위 재원이 순환합니다."); ids.push(p); p = b.funds.find(x => x.id === p)?.parentId ?? ""; } return ids; };
  try { b.funds.forEach(ancestors); } catch (e) { return (e as Error).message; }
  const included = b.funds.filter(f => f.included);
  if (included.some(f => !f.sourceId.trim())) return "합산할 재원 식별 메모를 입력하세요.";
  if (new Set(included.map(f => f.sourceId.trim())).size !== included.length) return "같은 재원 식별 메모가 중복되어 합산을 보류합니다.";
  for (const f of included) {
    let parent = b.funds.find(p => p.id === f.parentId); const seen = new Set<string>();
    while (parent && !seen.has(parent.id)) { if (parent.included) return "상위 재원과 하위 분담액을 함께 합산할 수 없습니다."; seen.add(parent.id); parent = b.funds.find(p => p.id === parent!.parentId); }
  }
  for (const parent of b.funds.filter(f => !f.included)) {
    const children = included.filter(f => ancestors(f).includes(parent.id));
    if (b.fundingComplete && children.length && parent.amount !== "" && children.every(c => c.amount !== "") && sumWon(children.map(c => won(c.amount)!)) !== won(parent.amount)) return "상위 재원과 선택한 하위 분담액의 합계가 다릅니다.";
  }
  return "";
}
function duplicateLine(b: Budget): boolean {
  const keys = b.lines.filter(l => l.name.trim()).map(l => JSON.stringify([l.name.trim(), l.specification.trim(), l.quantity, l.unit, l.rate, l.method, l.periods, l.periodUnit, l.coveredPeriod, l.vat, l.taxAmount, l.reference]));
  return new Set(keys).size !== keys.length;
}
export function summarizeBudget(b: Budget, d: PlanDraft, o: Option) {
  const rows = b.lines.map(lineAmount), groups: Partial<Record<Vat, number>> = {};
  const reasons: string[] = [], stale = b.basis !== budgetBasis(d, o), missing = rows.filter(r => r.amount === null).length;
  let total: number | null = null, subtotal: number | null = null, vat: Vat = "unknown";
  let fundingPlan: number | null = null, secured: number | null = null, planned: number | null = null, unknownFunding: number | null = null;
  let excess: number | null = null, shortage: number | null = null;
  let expensePie = false, fundingPie = false;
  try {
    if (stale) reasons.push("기획 조건 변경 · 예산·재원 재확인 필요");
    if (!scopeKnown(b.scope)) reasons.push("전체/부분 범위와 포함 부서를 확인하세요.");
    if (!b.expensesComplete) reasons.push("지출 전체 항목 확인 전");
    if (missing) reasons.push(`지출 미산정 ${missing}건`);
    if (rows.some(r => r.error)) reasons.push(...rows.filter(r => r.error).map(r => r.error));
    const unique = b.expensesUnique && !duplicateLine(b);
    if (!unique) reasons.push(b.expensesUnique ? "동일한 지출 행 중복 · 합산 보류" : "지출 항목 중복 여부 미확인");
    if (unique) {
      for (const kind of ["included", "excluded", "exempt", "unknown"] as Vat[]) {
        const values = rows.filter(r => r.vat === kind && r.amount !== null).map(r => r.amount!);
        if (values.length) groups[kind] = sumWon(values);
      }
      const kinds = Object.keys(groups) as Vat[];
      if (kinds.length === 1 && kinds[0] !== "unknown") { vat = kinds[0]; subtotal = groups[vat]!; }
      else if (b.lines.length) reasons.push("세금 기준 혼재·미확인 · 총액 비교 보류");
      if (!stale && scopeKnown(b.scope) && b.expensesComplete && b.lines.length && missing === 0 && !rows.some(r => r.error)) total = subtotal;
    }
    const fi = fundingIssue(b);
    if (fi) reasons.push(fi);
    const included = b.funds.filter(f => f.included), fundAmounts = included.map(f => won(f.amount));
    if (!fi) {
      if (included.length && fundAmounts.every(v => v !== null)) fundingPlan = sumWon(fundAmounts as number[]);
      const amountOf = (status: Funding["status"]) => {
        const fs = included.filter(f => f.status === status);
        return fs.some(f => f.amount === "") ? null : sumWon(fs.map(f => won(f.amount)!));
      };
      if (!stale && (included.length || b.fundingComplete)) { secured = amountOf("confirmed"); planned = amountOf("planned"); unknownFunding = amountOf("unknown"); }
    }
    expensePie = total !== null && total > 0;
    fundingPie = !stale && scopeKnown(b.scope) && b.fundingComplete && !fi && fundingPlan !== null && fundingPlan > 0;
    const limit = won(b.limit);
    if (!stale && scopeKnown(b.scope) && subtotal !== null && vat === b.limitVat && limit !== null) {
      if (total !== null || subtotal > limit) excess = Math.max(0, subtotal - limit);
    }
    if (!stale && scopeKnown(b.scope) && b.fundingMatchesScope && vat === b.fundingVat && subtotal !== null && secured !== null) {
      if (total !== null || subtotal > secured) shortage = Math.max(0, subtotal - secured);
    }
  } catch (e) { reasons.push((e as Error).message); total = null; subtotal = null; fundingPlan = null; secured = null; planned = null; unknownFunding = null; excess = null; shortage = null; expensePie = false; fundingPie = false; }
  return { rows, groups, total, subtotal, vat, missing, stale, fundingPlan, secured, planned, unknownFunding, excess, shortage, expensePie, fundingPie, reasons: [...new Set(reasons)] };
}
export function compareBudgets(a: Budget, ad: PlanDraft, ao: Option, b: Budget, bd: PlanDraft, bo: Option): { difference: number | null; reason: string } {
  const av = summarizeBudget(a, ad, ao), bv = summarizeBudget(b, bd, bo);
  if (av.total === null || bv.total === null) return { difference: null, reason: "미산정·중복·기획 조건·범위를 먼저 확인하세요." };
  if (a.stage !== b.stage || av.vat !== bv.vat || scopeKey(a.scope) !== scopeKey(b.scope)) return { difference: null, reason: "금액 단계·세금·포함 항목/부서 범위가 다릅니다." };
  return { difference: av.total - bv.total, reason: "같은 정의의 명목 차액 · 물가·효율 보정 없음" };
}
