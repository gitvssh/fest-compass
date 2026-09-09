import test from "node:test";
import assert from "node:assert/strict";
import { archive, copy, encodePlanning, importPlanning, newOption, newPlanning, newTask, parsePlanning, writePlanning } from "./model";
import { archiveProposal } from "./proposal";
import { newBudget, newBudgetLine, newFunding } from "./budget-model";
import { archiveOutcome, compareFund, compareMetric, emptyResult, fundTotal, newMetric, nextEdition, startOutcome } from "./outcome-model";
import type { ResultValue } from "./outcome-types";
const value = (v: string): ResultValue => ({ value: v, origin: "manual", reference: "가상 검증용 기록", missingReason: "" });
function fixture() {
  let p = newPlanning(2027); const d = p.draft, o = d.options[0]; d.regionKey = "44/230";
  d.options.push(newOption("대안 B")); o.decision = "selected"; o.reason = "시험용 선택";
  o.tasks = [{ ...newTask(o), title: "기존 준비", progress: "done" }]; o.budget = newBudget(d, o);
  Object.assign(o.budget, { fundingUnique: true, fundingComplete: true, fundingVat: "included", scope: { kind: "partial", name: "가상 지원사업", includes: "프로그램", excludes: "그 외", departments: "관광부서", departmentsKnown: true } });
  o.budget.funds = [{ ...newFunding(), name: "보조금", amount: "30000000", sourceId: "subsidy" }, { ...newFunding(), name: "자부담", amount: "5000000", sourceId: "self" }];
  o.budget.lines = [{ ...newBudgetLine(2027), name: "홍보비", rate: "100000", reference: "전년도 가상 견적", sourceKind: "quote" }];
  p = archiveProposal(p, "가상 P1"); return startOutcome(p, p.revisions[0].id);
}
function complete() { const p = fixture(); p.outcomes!.draft!.funds.forEach((f, i) => Object.assign(f, { stage: "payment", scopeMatches: true, scope: "가상 지원사업 프로그램", vat: "included", actual: value(i ? "5118200" : "30000000") })); return p; }
test("M6 같은 지표·단위·기간·출처만 비교하고 계획 0의 비율은 보류한다", () => {
  const m = { ...newMetric(), name: "가상 입장", planned: "100", planReference: "가상 계획", planDefinition: "입장 건수", actualDefinition: "지역 방문자", planUnit: "건", actualUnit: "명", period: { start: "2027-01-01", end: "2027-01-02" }, actual: value("120") };
  assert.equal(compareMetric(m).difference, null); m.actualDefinition = m.planDefinition; m.actualUnit = m.planUnit;
  assert.equal(compareMetric(m).difference, 20); assert.equal(compareMetric(m).percent, 20);
  m.planned = "0"; assert.equal(compareMetric(m).difference, 120); assert.equal(compareMetric(m).percent, null);
  m.actual = emptyResult(); assert.equal(compareMetric(m).difference, null); m.actual = value("120"); m.planReference = ""; assert.equal(compareMetric(m).difference, null);
});
test("M6 재원 합계 35000000→35118200, 빈 잔액·반납·이자와 실제 0을 구분한다", () => {
  const p = complete(), d = p.outcomes!.draft!, r = p.revisions[0];
  assert.deepEqual(fundTotal(d, r), { planned: 35000000, actual: 35118200 });
  assert.equal(compareFund(d.funds[0], r).difference, 0); assert.equal(compareFund(d.funds[1], r).difference, 118200);
  assert.equal(d.funds[0].balance.value, ""); d.funds[0].interest = value("0");
  const result = parsePlanning(encodePlanning(archiveOutcome(p, "R1"))).outcomes!.revisions[0];
  assert.equal(result.draft.funds[0].interest.value, "0"); assert.equal(result.draft.funds[0].returned.value, "");
});
test("M6 범위·세금·지급/정산 혼재·결측·중복 재원은 합계를 보류한다", () => {
  for (const mutate of [(p: ReturnType<typeof complete>) => { p.outcomes!.draft!.funds[0].scopeMatches = false; }, (p: ReturnType<typeof complete>) => { p.outcomes!.draft!.funds[0].vat = "unknown"; }, (p: ReturnType<typeof complete>) => { p.outcomes!.draft!.funds[0].stage = "settlement"; }, (p: ReturnType<typeof complete>) => { p.outcomes!.draft!.funds[0].actual = emptyResult(); }, (p: ReturnType<typeof complete>) => { p.revisions[0].draft.options[0].budget!.fundingUnique = false; }]) { const p = complete(); mutate(p); assert.equal(fundTotal(p.outcomes!.draft!, p.revisions[0]), null); }
});
test("M6 기존 R1·P1은 수정·제거 불가하고 R2만 변경된다", () => {
  let p = archiveOutcome(complete(), "R1"); const p1 = JSON.stringify(p.revisions[0]), r1 = JSON.stringify(p.outcomes!.revisions[0]);
  let raw = encodePlanning(p); const storage = { getItem: () => raw, setItem: (_: string, v: string) => { raw = v; } };
  p.outcomes!.draft!.funds[1].actual = value("6000000"); p = archiveOutcome(p, "R2"); raw = writePlanning(p, raw, storage);
  assert.equal(JSON.stringify(p.revisions[0]), p1); assert.equal(JSON.stringify(p.outcomes!.revisions[0]), r1);
  for (const mutate of [(n: typeof p) => { n.outcomes!.revisions[0].draft.funds[0].actual.value = "0"; }, (n: typeof p) => { n.outcomes!.revisions.shift(); }]) { const n = copy(p); mutate(n); assert.throws(() => writePlanning(n, raw, storage), /보관한 결과/); }
});
test("M6 다음 회차는 날짜·판단·실측·외부확인 초기화, 원본과 개선·예산참조 보존", () => {
  let p = complete(); p.outcomes!.draft!.improvements.push({ id: "improvement", problem: "홍보 부족", action: "안내 개선", nextTask: "홍보 자료 준비", nextBudget: "홍보비 재검토", reference: "가상 설문" }); p = archiveOutcome(p, "R1");
  const p1 = JSON.stringify(p.revisions[0]), r1 = JSON.stringify(p.outcomes!.revisions[0]);
  const n = nextEdition(p, p.outcomes!.revisions[0].id, 2028), o = n.draft.options[0];
  assert.equal(n.draft.year, 2028); assert.equal(n.draft.period.start, ""); assert.equal(n.outcomes!.draft, null); assert.equal(o.decision, "undecided"); assert.equal(o.reason, ""); assert.equal(o.periods.event.start, ""); assert.equal(o.venueChecks.length, 0);
  assert.ok(o.tasks.every(t => !t.due && t.progress === "todo" && !t.reviews.length)); assert.match(o.tasks.at(-1)!.needed, /홍보비 재검토/);
  assert.equal(o.budget!.lines[0].reference, "전년도 가상 견적"); assert.equal(o.budget!.lines[0].classification.status, "unknown"); assert.equal(o.budget!.records.length, 0); assert.ok(o.budget!.funds.every(f => f.status === "unknown"));
  assert.equal(JSON.stringify(n.revisions[0]), p1); assert.equal(JSON.stringify(n.outcomes!.revisions[0]), r1); assert.doesNotThrow(() => encodePlanning(n));
  assert.throws(() => nextEdition(p, p.outcomes!.revisions[0].id, 2027), /이후/);
});
test("M6 v1~v3 가져오기·v4 왕복·다음 기획안 재보관 시 결과를 보존한다", () => {
  let p = archiveOutcome(complete(), "R1"); const original = JSON.stringify(p.outcomes!.revisions[0]);
  const legacy = archive(newPlanning(2028), "기존 기획"); p = importPlanning(p, legacy); assert.equal(p.version, 4); assert.equal(JSON.stringify(p.outcomes!.revisions[0]), original);
  const other = importPlanning(newPlanning(2028), parsePlanning(encodePlanning(p))); assert.equal(JSON.stringify(other.outcomes!.revisions[0]), original);
  const restored = complete(); restored.outcomes = { draft: null, revisions: [] };
  assert.equal(archiveProposal(restored, "M5 재보관").version, 4);
});
test("M6 잘못된 참조·숫자·출처·증빙 확인·버전·중복을 저장하지 않는다", () => {
  for (const mutate of [(p: ReturnType<typeof fixture>) => { p.outcomes!.draft!.proposalId = "missing"; }, (p: ReturnType<typeof fixture>) => { p.outcomes!.draft!.funds[0].actual = value("-1"); }, (p: ReturnType<typeof fixture>) => { p.outcomes!.draft!.funds[0].actual = value("1.5"); }, (p: ReturnType<typeof fixture>) => { p.outcomes!.draft!.funds[0].actual = { ...value("1"), reference: "" }; }, (p: ReturnType<typeof fixture>) => { p.version = 3; }, (p: ReturnType<typeof fixture>) => { p.outcomes!.draft!.funds.push(copy(p.outcomes!.draft!.funds[0])); }, (p: ReturnType<typeof fixture>) => { p.outcomes!.draft!.evidence.push({ id: "e", kind: "contract", scope: "", reference: "link", status: "confirmed", reviewer: "", checkedAt: "", note: "" }); }]) { const p = fixture(); mutate(p); assert.throws(() => encodePlanning(p)); }
});
test("M6 결과 충돌·20개 한도·다른 창 저장 충돌에서 원본을 유지한다", () => {
  const p = archiveOutcome(complete(), "R1"), before = encodePlanning(p), bad = copy(p); bad.outcomes!.revisions[0].note = "변조";
  assert.throws(() => importPlanning(p, bad), /같은 결과/); assert.equal(encodePlanning(p), before);
  assert.throws(() => writePlanning(p, null, { getItem: () => before, setItem: () => assert.fail() }), /다른 창/);
  while (p.outcomes!.revisions.length < 20) p.outcomes!.revisions.push({ ...copy(p.outcomes!.revisions[0]), id: `result-${p.outcomes!.revisions.length}` });
  assert.throws(() => archiveOutcome(p, "over"), /최대 20/); assert.equal(p.outcomes!.revisions.length, 20);
  const many = fixture(); const budget = many.revisions[0].draft.options[0].budget!;
  while (budget.funds.length < 40) budget.funds.push({ ...newFunding(), sourceId: `fund-${budget.funds.length}` });
  const opened = startOutcome(many, many.revisions[0].id); assert.equal(opened.outcomes!.draft!.funds.length, 40);
  assert.doesNotThrow(() => encodePlanning(opened));
});
