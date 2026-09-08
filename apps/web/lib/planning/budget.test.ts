import test from "node:test";
import assert from "node:assert/strict";
import { archive, copy, duplicateOption, encodePlanning, importPlanning, newPlanning, newTask, parsePlanning, PLANNING_KEY, pruneEvidence, validatePlanning, writePlanning } from "./model";
import { budgetBasis, compareBudgets, fundingIssue, newAmountRecord, newBudget, newBudgetLine, newFunding, renewBudget, summarizeBudget } from "./budget-model";
import { decimal, lineAmount, recordWon } from "./budget-math";
import { makeComparison } from "../comparison/evidence";
import catalogue from "../../data/festival-editions.json";
import type { Edition } from "../comparison/types";

function fixture() {
  const p = newPlanning(2027), d = p.draft, o = d.options[0];
  d.regionKey = "44/150"; d.department = "관광부서"; o.name = "봄꽃 산책"; o.item = "지역 해설"; o.venue = "시험 장소";
  const b = newBudget(d, o); o.budget = b;
  b.stage = "request"; b.scope = { kind: "whole", name: "행사 운영", includes: "프로그램·시설·홍보", excludes: "", departments: "관광부서", departmentsKnown: true };
  b.expensesUnique = true; b.expensesComplete = true; b.fundingUnique = true; b.fundingComplete = true;
  b.limit = "450000"; b.limitVat = "included"; b.fundingVat = "included"; b.fundingMatchesScope = true;
  const line = (name: string, quantity: string, rate: string) => ({ ...newBudgetLine(2027), name, quantity, rate, unit: "회", method: "quantity" as const, vat: "included" as const, sourceKind: "assumption" as const, reference: "검증용 가정" });
  b.lines = [line("프로그램", "2", "100000"), { ...line("시설", "1", "300000"), unit: "식", periods: "2", periodUnit: "일", coveredPeriod: "2일 포함" }, line("홍보", "1", "")];
  b.funds = [{ ...newFunding(), name: "시군비", sourceId: "시군-2027", amount: "300000", status: "confirmed", reference: "검증용 확정 기록", date: "2026-09-09" }, { ...newFunding(), name: "예정 재원", sourceId: "예정-2027", amount: "200000", status: "planned" }];
  return { p, d, o, b };
}
test("M4 미산정 지출과 예정 재원을 분리하고 최소 초과·부족액을 표시한다", () => {
  const { p, d, o, b } = fixture(); validatePlanning(p);
  const s = summarizeBudget(b, d, o);
  assert.equal(s.subtotal, 500000); assert.equal(s.total, null); assert.equal(s.missing, 1);
  assert.equal(s.secured, 300000); assert.equal(s.planned, 200000); assert.equal(s.fundingPlan, 500000);
  assert.equal(s.excess, 50000); assert.equal(s.shortage, 200000); assert.equal(s.expensePie, false); assert.equal(s.fundingPie, true);
  b.lines[2].rate = "0"; const complete = summarizeBudget(b, d, o);
  assert.equal(complete.total, 500000); assert.equal(complete.missing, 0); assert.equal(complete.expensePie, true);
  b.lines[2].rate = ""; assert.equal(summarizeBudget(b, d, o).total, null);
});
test("M4 일괄 포함 기간과 기간당 단가를 구분하고 항목 마지막에 정확히 반올림한다", () => {
  const { b } = fixture(), facility = b.lines[1];
  assert.equal(lineAmount(facility).amount, 300000);
  assert.equal(lineAmount({ ...facility, quantity: "3", rate: "50000", method: "period", periods: "2" }).amount, 300000);
  assert.equal(lineAmount({ ...facility, quantity: "1.5", rate: "1001" }).amount, 1502);
  assert.equal(lineAmount({ ...facility, quantity: "1.005", rate: "100" }).amount, 101);
  assert.equal(lineAmount({ ...facility, quantity: "1.5", rate: "1001", vat: "excluded", taxAmount: "150.5", taxReference: "세금액 가정" }).amount, 1652);
  assert.equal(lineAmount({ ...facility, method: "unknown", quantity: "0" }).amount, null);
  assert.equal(lineAmount({ ...facility, method: "period", periodUnit: "" }).amount, null);
});
test("M4 세금 혼재·미확인에서는 기준별 소계만 남기고 한도·재원·파이를 보류한다", () => {
  const { b, d, o } = fixture(); b.lines[2].rate = "0"; b.lines[1].vat = "excluded";
  const s = summarizeBudget(b, d, o); assert.deepEqual(s.groups, { included: 200000, excluded: 300000 });
  assert.equal(s.total, null); assert.equal(s.excess, null); assert.equal(s.shortage, null); assert.equal(s.expensePie, false);
  b.lines[1].taxAmount = "30000"; b.lines[1].taxReference = "가정한 별도 세금액";
  assert.equal(summarizeBudget(b, d, o).total, 530000);
  b.lines[0].vat = "unknown"; assert.equal(summarizeBudget(b, d, o).total, null);
});
test("M4 음수·지수·정밀도 초과·안전 범위 초과를 거부하고 저장값을 유지한다", () => {
  for (const s of ["-1", "1e3", "1,000", "Infinity", "NaN", "0.0000001", "9007199254740992"]) assert.throws(() => decimal(s));
  const { p, b } = fixture(); let raw = encodePlanning(p); const before = raw;
  const store = { getItem: () => raw, setItem: (_k: string, v: string) => { raw = v; } };
  b.lines[0].quantity = "-1"; assert.throws(() => writePlanning(p, before, store)); assert.equal(raw, before);
  b.lines[0].quantity = "1"; b.lines[0].rate = "9007199254740991"; assert.throws(() => validatePlanning(p), /범위/);
  b.lines[0].quantity = "2"; assert.match(lineAmount(b.lines[0]).error, /범위/);
});
test("M4 전체·중복 여부 미확인과 동일 지출 행은 완전 합계·구성비를 만들지 않는다", () => {
  const { d, o, b } = fixture(); b.lines[2].rate = "0"; b.expensesComplete = false;
  assert.equal(summarizeBudget(b, d, o).total, null);
  b.expensesComplete = true; b.expensesUnique = false; assert.equal(summarizeBudget(b, d, o).subtotal, null);
  b.expensesUnique = true; b.lines.push({ ...b.lines[0], id: crypto.randomUUID() }); assert.equal(summarizeBudget(b, d, o).subtotal, null);
  b.fundingComplete = false; assert.equal(summarizeBudget(b, d, o).fundingPie, false);
});
test("M4 합계 0은 값으로 보존하며 재원·지출 파이를 표시하지 않는다", () => {
  const { d, o, b } = fixture(); b.lines.forEach(l => { l.rate = "0"; }); b.funds.forEach(f => { f.amount = "0"; });
  const s = summarizeBudget(b, d, o); assert.equal(s.total, 0); assert.equal(s.fundingPlan, 0); assert.equal(s.expensePie, false); assert.equal(s.fundingPie, false);
});
test("M4 같은 지원금·상하위 재원 중복과 3단계 분담 불일치를 막는다", () => {
  const { b, d, o, p } = fixture(); b.funds[1].sourceId = b.funds[0].sourceId;
  assert.equal(summarizeBudget(b, d, o).secured, null); assert.match(fundingIssue(b), /중복/);
  b.funds[1].sourceId = "하위"; b.funds[1].parentId = b.funds[0].id; assert.match(fundingIssue(b), /상위/);
  b.funds[0].included = false; b.funds[0].amount = "200000"; assert.equal(fundingIssue(b), "");
  const leaf = { ...newFunding(), name: "분담", sourceId: "세부", amount: "100000", parentId: b.funds[1].id };
  b.funds[1].included = false; b.funds.push(leaf); assert.match(fundingIssue(b), /합계가 다릅니다/);
  b.funds[0].parentId = leaf.id; assert.throws(() => validatePlanning(p), /순환/);
});
test("M4 원문 단계·단위·누계와 결측 표기를 독립 보관하고 자동 합산하지 않는다", () => {
  const { p, b } = fixture(); const records = [newAmountRecord(b), newAmountRecord(b), newAmountRecord(b)];
  records.forEach((r, i) => { r.recorded = true; r.name = `같은 업무 ${i}`; r.reference = "검증용 문서"; r.asOf = "2026-09-09"; r.unit = "won"; });
  records[0].stage = "request"; records[0].original = "500000"; records[1].stage = "contract"; records[1].original = "480000"; records[2].stage = "payment"; records[2].original = "300000";
  b.records = records; validatePlanning(p); const next = parsePlanning(encodePlanning(archive(p, "단계별 기록")));
  assert.deepEqual(next.draft.options[0].budget!.records.map(r => r.original), ["500000", "480000", "300000"]);
  assert.equal(recordWon("35118.2", "thousandWon", "KRW"), 35118200);
  assert.equal(recordWon("0", "won", "KRW"), 0);
  for (const [raw, unit, currency] of [["-", "won", "KRW"], ["35118.2", "unknown", "KRW"], ["10", "won", "USD"], ["9007199254740991", "thousandWon", "KRW"]]) assert.equal(recordWon(raw, unit, currency), null);
  records[2].original = "-"; records[2].missingReason = "원문 미공개"; validatePlanning(p);
  records[2].kind = "cumulative"; records[2].includesIds = [records[0].id, records[1].id]; validatePlanning(p);
  records[0].kind = "cumulative"; records[0].includesIds = [records[2].id]; assert.throws(() => validatePlanning(p), /순환/);
});
test("M4 원문 작성 중 입력은 초안·파일에 남고 기록 확정에는 출처·날짜가 필요하다", () => {
  const { p, b } = fixture(); const r = newAmountRecord(b); r.original = "원문 확인 중"; b.records.push(r);
  assert.equal(parsePlanning(encodePlanning(p)).draft.options[0].budget!.records[0].original, "원문 확인 중");
  r.recorded = true; assert.throws(() => validatePlanning(p), /이름·출처·기준일/);
});
test("M4 같은 기준의 이전 40만원과 현재 50만원만 차액을 계산한다", () => {
  const { p, d, o, b } = fixture(); b.lines[2].rate = "0"; b.lines[0].quantity = "1";
  const saved = archive(p, "기준 40만원"), old = saved.revisions[0].draft.options[0];
  b.lines[0].quantity = "2"; b.changeReasons.quantity = "해설 프로그램 1회 추가";
  assert.equal(compareBudgets(b, d, o, old.budget!, saved.revisions[0].draft, old).difference, 100000);
  b.scope.departmentsKnown = false; assert.equal(compareBudgets(b, d, o, old.budget!, saved.revisions[0].draft, old).difference, null);
  b.scope.departmentsKnown = true; b.stage = "payment"; assert.equal(compareBudgets(b, d, o, old.budget!, saved.revisions[0].draft, old).difference, null);
});
test("M4 사업연도·장소 변경은 총액·확정 재원 적용을 보류하고 과거 분류를 보존한다", () => {
  const { p, d, o, b } = fixture(); b.lines[2].rate = "0"; const c = b.lines[0].classification;
  c.year = "2027"; c.label = "검증용 원문 분류"; c.code = "시험 코드"; c.guideline = "검증용 2027 지침"; c.date = "2026-09-09"; c.status = "reviewed";
  const old = archive(p, "기준 분류"); d.year = 2028; assert.equal(summarizeBudget(b, d, o).total, null); assert.equal(summarizeBudget(b, d, o).secured, null);
  const next = renewBudget(b, d, o); assert.equal(next.lines[0].classification.label, c.label); assert.equal(next.lines[0].classification.year, "2027"); assert.equal(next.lines[0].classification.status, "unknown"); assert.equal(next.funds[0].status, "unknown");
  assert.equal(old.revisions[0].draft.options[0].budget!.lines[0].classification.status, "reviewed");
  assert.equal(next.basis, budgetBasis(d, o)); o.venue = "다른 장소"; assert.equal(summarizeBudget(next, d, o).stale, true);
});
test("M4 후보 복사는 재원·분류 확인과 단계 기록을 초기화하고 준비 연결을 새 ID로 바꾼다", () => {
  const { o, b } = fixture(); const task = newTask(o); o.tasks.push(task); b.lines[0].taskIds = [task.id]; b.records.push(newAmountRecord(b));
  const next = duplicateOption(o); assert.equal(next.budget!.funds[0].status, "unknown"); assert.equal(next.budget!.records.length, 0); assert.equal(next.budget!.lines[0].taskIds[0], next.tasks[0].id); assert.notEqual(next.tasks[0].id, task.id); assert.equal(next.budget!.expensesComplete, false);
});
test("M4 실제 비용 근거 사본과 원값은 M3 연결 해제·보관·파일 복원 뒤 유지된다", async () => {
  const { p, b, d, o } = fixture();
  const edition = (catalogue.editions as unknown as Edition[]).find(e => e.id === "wonju-peach-2022-21")!;
  const evidence = await makeComparison([edition], { mode: "archive", regions: [], start: "2022-01-01", end: "2022-12-31", keyword: "", theme: "", dateRule: "overlap", queriedAt: null }, { kind: "cost", editionId: edition.id, costId: "wonju-2022-actual" }, "지원사업 참고");
  const key = `comparison:${evidence.id}`; d.evidence.push({ key, kind: "comparison", value: evidence }); b.lines[0].evidenceKeys = [key];
  pruneEvidence(d); assert.equal(d.evidence.length, 1);
  assert.equal(evidence.editions[0].costs.find(c => c.id === "wonju-2022-actual")!.amount, 35118200);
  const saved = archive(p, "예산 근거"), exact = JSON.stringify(saved.revisions[0]); saved.draft.options[0].budget!.lines[0].evidenceKeys = []; pruneEvidence(saved.draft);
  assert.equal(saved.draft.evidence.length, 0); assert.equal(JSON.stringify(saved.revisions[0]), exact);
  const restored = importPlanning(newPlanning(2027), parsePlanning(encodePlanning(saved)));
  assert.equal(JSON.stringify(restored.revisions.find(r => r.id === saved.revisions[0].id)), exact);
  assert.equal(o.budget!.lines[0].evidenceKeys[0], key);
});
test("M4 기존 v1 파일의 보관본을 바꾸지 않고 v2로 저장하며 충돌 시 양쪽 입력을 지킨다", () => {
  let legacy = newPlanning(2027); legacy.version = 1; legacy = archive(legacy, "M3 기존 보관본");
  const oldRevision = JSON.stringify(legacy.revisions[0]); let raw = JSON.stringify(legacy); const expected = raw;
  const store = { getItem: (key: string) => { assert.equal(key, PLANNING_KEY); return raw; }, setItem: (_k: string, value: string) => { raw = value; } };
  const loaded = parsePlanning(raw); loaded.version = 2; loaded.draft.options[0].budget = newBudget(loaded.draft, loaded.draft.options[0]);
  writePlanning(loaded, expected, store); assert.equal(parsePlanning(raw).version, 2); assert.equal(JSON.stringify(parsePlanning(raw).revisions[0]), oldRevision);
  const current = raw; loaded.draft.title = "미저장 예산"; assert.throws(() => writePlanning(loaded, expected, store), /다른 창/); assert.equal(raw, current); assert.equal(loaded.draft.title, "미저장 예산");
  const invalid = copy(loaded); invalid.version = 1; assert.throws(() => validatePlanning(invalid), /v2/);
});
