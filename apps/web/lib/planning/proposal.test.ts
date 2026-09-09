import test from "node:test";
import assert from "node:assert/strict";
import { archive, copy, encodePlanning, importPlanning, newOption, newPlanning, newTask, parsePlanning, taskBasis, validatePlanning, writePlanning } from "./model";
import { archiveProposal, proposalBlockers } from "./proposal";
import { newBudget, newBudgetLine, summarizeBudget } from "./budget-model";
import { makeComparison } from "../comparison/evidence";
import catalogue from "../../data/festival-editions.json";
import type { Edition } from "../comparison/types";

function fixture() {
  const p = newPlanning(2027), d = p.draft, o = d.options[0];
  d.options.push(newOption("가상 후보 B")); o.name = "가상 후보 A"; o.decision = "selected"; o.reason = "가족 참여 프로그램을 비교한 검증용 선택";
  o.budget = newBudget(d, o); o.budget.lines = [{ ...newBudgetLine(2027), name: "가상 프로그램", method: "quantity", quantity: "1", unit: "식", rate: "500000", vat: "included", sourceKind: "assumption", reference: "가상 시험" }, { ...newBudgetLine(2027), name: "미산정 항목" }];
  o.tasks = [newTask(o)]; o.tasks[0].title = "가상 준비 과제";
  return p;
}

test("M5 후보 하나·우선 후보 없음·이유 공백은 보관을 막고 초안은 저장한다", () => {
  const p = newPlanning(2027); assert.equal(proposalBlockers(p.draft).length, 2);
  assert.doesNotThrow(() => encodePlanning(p)); assert.throws(() => archiveProposal(p, ""), /후보/);
  p.draft.options.push(newOption()); p.draft.options[0].decision = "selected"; p.draft.options[0].reason = " \n ";
  assert.throws(() => archiveProposal(p, ""), /선택 이유/); assert.doesNotThrow(() => encodePlanning(p));
});

test("M5 미산정·장소 미확인·근거 없음도 표시된 기획안으로 보관한다", () => {
  const p = archiveProposal(fixture(), "미정 상태 검수"), r = p.revisions.at(-1)!;
  assert.equal(p.version, 3); assert.equal(r.proposal?.format, 1); assert.equal(r.draft.options[0].venue, "");
  const o = r.draft.options[0], s = summarizeBudget(o.budget!, r.draft, o);
  assert.equal(s.rows[0].amount, 500000); assert.equal(s.total, null); assert.equal(s.missing, 1); assert.equal(r.draft.evidence.length, 0);
});

test("M5 P1의 100/500000과 준비 상태를 P2 120/600000과 분리한다", async () => {
  let p = fixture();
  // Fictional values in a test-only copy; shipped source evidence is untouched.
  const editions = copy(catalogue.editions.filter(e => e.id.startsWith("nonsan"))) as Edition[];
  editions[0].visits!.points[0].value = 100;
  const e = await makeComparison(editions, { mode: "archive", regions: ["44/230"], start: "2023-01-01", end: "2025-12-31", keyword: "가상 수치 시험", theme: "", dateRule: "overlap", queriedAt: null }, { kind: "visits", from: 0, to: 0 }, "실제 관측값이 아닌 테스트 사본");
  p.draft.evidence = [{ kind: "comparison", key: `comparison:${e.id}`, value: e }]; p.draft.options[0].links = [{ sourceKey: `comparison:${e.id}`, field: "item", reason: "가상 수치 검증" }];
  p = archiveProposal(p, "P1"); const original = JSON.stringify(p.revisions[0]);
  const source = p.draft.evidence[0]; assert.equal(source.kind, "comparison"); if (source.kind === "comparison") source.value.editions[0].visits!.points[0].value = 120;
  p.draft.options[0].budget!.lines[0].rate = "600000";
  p.draft.options[0].tasks[0].reviews.push({ id: "review-p2", status: "confirmed", owner: "검증 담당", date: "2026-09-09", reference: "가상 확인 기록", basis: taskBasis(p.draft.options[0]) });
  p = archiveProposal(p, "P2"); assert.equal(JSON.stringify(p.revisions[0]), original);
  assert.equal(p.revisions[1].draft.options[0].budget!.lines[0].rate, "600000"); assert.equal(p.revisions[0].draft.options[0].tasks[0].reviews.length, 0);
  assert.equal(p.revisions[1].draft.options[0].tasks[0].reviews.length, 1);
});

test("M5 보관한 기획안·선택 이유·출처·측정 계획의 수정과 제거를 거부한다", () => {
  let p = fixture(); p.version = 3; p.draft.measurementPlan = "지표·단위·기간·방법·담당"; p = archiveProposal(p, "P1");
  let raw = encodePlanning(p); const before = raw, storage = { getItem: () => raw, setItem: (_k: string, v: string) => { raw = v; } };
  for (const change of [(n: typeof p) => { n.revisions[0].draft.options[0].reason = "변조"; }, (n: typeof p) => { n.revisions[0].draft.measurementPlan = "변조"; }, (n: typeof p) => { n.revisions = []; }]) {
    const n = copy(p); change(n); assert.throws(() => writePlanning(n, before, storage), /보관한 버전/); assert.equal(raw, before);
  }
});

test("M5 구 v1/v2 보관본을 변경하지 않고 v3 가져오기·내보내기를 왕복한다", () => {
  const legacy = newPlanning(2027); legacy.version = 1;
  const old = archive(legacy, "구 초안"), bytes = JSON.stringify(old.revisions[0]);
  const incoming = archiveProposal(fixture(), "새 기획안"), merged = importPlanning(old, incoming), roundtrip = parsePlanning(encodePlanning(merged));
  assert.equal(roundtrip.version, 3); assert.equal(JSON.stringify(roundtrip.revisions[0]), bytes);
  assert.deepEqual(roundtrip.revisions.find(r => r.proposal), incoming.revisions[0]);
  assert.equal(roundtrip.revisions.filter(r => r.proposal).length, 1);
});

test("M5 미래 형식·v2 위장 기획안·불완전 비교 기획안은 읽기를 거부한다", () => {
  const p = archiveProposal(fixture(), "P1");
  for (const value of [{ ...p, version: 5 }, { ...p, version: 2 }]) assert.throws(() => parsePlanning(JSON.stringify(value)));
  p.revisions[0].draft.options = [p.revisions[0].draft.options[0]]; assert.throws(() => validatePlanning(p), /후보 두 개/);
});

test("M5 동시 창 충돌과 보관 한도 초과는 기존 기획안을 유지한다", () => {
  const p = archiveProposal(fixture(), "P1"), raw = encodePlanning(p); let writes = 0;
  assert.throws(() => writePlanning(p, "old", { getItem: () => raw, setItem: () => { writes++; } }), /다른 창/); assert.equal(writes, 0);
  while (p.revisions.length < 20) p.revisions.push({ ...copy(p.revisions[0]), id: `copy-${p.revisions.length}` });
  assert.throws(() => archiveProposal(p, "over"), /최대 20/); assert.equal(p.revisions.length, 20);
});
