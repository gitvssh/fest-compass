import assert from "node:assert/strict";
import { test } from "node:test";
import { cloneEdition, createDraft, decisionChanged, outcomeComparison, parseWorkspace, recordDecision, type Workspace } from "./workspace";
function prepared() {
  const d = createDraft(true); d.expected = 10000; d.basis = "출입 계수기 · 재입장 포함 · 행사 전체";
  d.plans = d.plans.map(p => ({ ...p, staff: 10, shuttles: 0, sessions: 4, budget: 1000000 }));
  return d;
}
test("빈 자료를 실측 0이나 지역 예측으로 채우지 않는다", () => {
  const d = createDraft(true);
  assert.equal(d.expected, null); assert.equal(d.outcome.actual, null);
  assert.equal(outcomeComparison(d), null);
  assert.throws(() => recordDecision(d, d.plans[0].id, "선택", "운영팀"), /가정과 근거/);
});
test("결정 당시 입력을 보존하고 준비 정보 변경을 표시한다", () => {
  const d = prepared(), saved = recordDecision(d, d.plans[0].id, "예산 범위 충족", "운영팀");
  assert.equal(decisionChanged(saved), false);
  const edited = { ...saved, expected: 15000, plans: saved.plans.map(p => ({ ...p, staff: 20 })) };
  assert.equal(decisionChanged(edited), true);
  assert.equal(edited.decisions[0].plan.staff, 10);
  assert.equal(edited.decisions[0].expected, 10000);
  const second = recordDecision(edited, edited.plans[1].id, "새 계획", "운영팀");
  assert.equal(second.decisions.length, 2); assert.equal(second.decisions[0].expected, 10000);
});
test("결과는 출처·방법이 있을 때만 결정 당시 가정과 비교한다", () => {
  let d = prepared(); d = recordDecision(d, d.plans[0].id, "예산", "운영팀");
  d.expected = 20000; d.outcome.actual = 0;
  assert.equal(outcomeComparison(d), null);
  d.outcome.source = "입구 계수"; d.outcome.method = "전 기간·재입장 포함";
  assert.deepEqual(outcomeComparison(d), { planned: 10000, actual: 0, difference: -10000, rate: -1 });
  assert.throws(() => recordDecision(d, d.plans[0].id, "다시 선택", "운영팀"), /결과를 기록한 회차/);
});
test("0건 계획에 실제 0건은 유효하고 백분율은 계산하지 않는다", () => {
  let d = prepared(); d.expected = 0; d = recordDecision(d, d.plans[0].id, "휴장", "운영팀");
  d.outcome = { actual: 0, source: "휴장 기록", method: "전 기간 출입 통제", lesson: "" };
  assert.deepEqual(outcomeComparison(d), { planned: 0, actual: 0, difference: 0, rate: null });
});
test("다음 회차는 기존 기록을 보존하고 일정·결정·현장·실측을 새로 시작한다", () => {
  let d = prepared(); d = recordDecision(d, d.plans[0].id, "예산", "운영팀"); d.outcome.actual = 9000;
  const next = cloneEdition(d);
  assert.equal(next.parent, d.id); assert.notEqual(next.id, d.id); assert.equal(next.start, ""); assert.equal(next.end, "");
  assert.deepEqual(next.decisions, []); assert.deepEqual(next.records, []); assert.equal(next.outcome.actual, null);
  assert.match(next.basis, /재확인 필요/); assert.equal(d.outcome.actual, 9000); assert.equal(d.decisions.length, 1);
  next.plans[0].staff = 30; assert.equal(d.plans[0].staff, 10);
});
test("작업 파일은 왕복 복원하고 알 수 없는 필드를 제거한다", () => {
  const d = prepared(), workspace: Workspace = { schemaVersion: 1, activeId: d.id, drafts: [d] };
  assert.deepEqual(parseWorkspace(JSON.stringify(workspace)), workspace);
  const untrusted = JSON.parse(JSON.stringify(workspace)); untrusted.token = "not-allowed"; untrusted.drafts[0].script = "not-allowed";
  assert.deepEqual(parseWorkspace(JSON.stringify(untrusted)), workspace);
});
test("손상·과대 파일, 유효하지 않은 수치·날짜·참조·중복 ID를 거부한다", () => {
  const d = prepared(), base = { schemaVersion: 1, activeId: d.id, drafts: [d] };
  for (const mutate of [
    (w: typeof base) => { w.schemaVersion = 2; },
    (w: typeof base) => { w.activeId = "missing"; },
    (w: typeof base) => { w.drafts.push(w.drafts[0]); },
    (w: typeof base) => { w.drafts[0].start = "2026-02-30"; },
    (w: typeof base) => { w.drafts[0].expected = -1; },
    (w: typeof base) => { w.drafts[0].outcome.actual = 1.5; },
    (w: typeof base) => { w.drafts[0].plans[1].id = w.drafts[0].plans[0].id; },
  ]) { const copy = structuredClone(base); mutate(copy); assert.throws(() => parseWorkspace(JSON.stringify(copy))); }
  assert.throws(() => parseWorkspace("{")); assert.throws(() => parseWorkspace(" ".repeat(1_000_001)), /1MB/);
});
