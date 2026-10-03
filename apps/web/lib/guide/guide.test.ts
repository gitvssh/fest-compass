import assert from "node:assert/strict";
import test from "node:test";
import { sideMeans } from "@/lib/existing/side-means";
import type { DayPoint } from "@/lib/existing/types";
import { CHECK_KINDS, EXISTING_GUIDE, JOURNEYS, NEW_GUIDE, guideTask, nextTask, visitsScope, VISITS_SCOPE_NOTE } from "./content";
import { GUIDE_SOURCES, PHASES, STAGE_LABELS, guideSource } from "./process";

const journeys = Object.values(JOURNEYS);
const texts = (value: unknown): string[] => typeof value === "string" ? [value] : Array.isArray(value) ? value.flatMap(texts)
  : value && typeof value === "object" ? Object.values(value).flatMap(texts) : [];
const visible = [...texts(JOURNEYS), ...texts(PHASES.map(({ explore, read, ...rest }) => rest)), ...texts(VISITS_SCOPE_NOTE)];

test("each journey keeps its recommended order and ends with the summary", () => {
  assert.deepEqual(EXISTING_GUIDE.tasks.map(t => t.view), ["visits", "resources", "timing", "summary"]);
  assert.deepEqual(NEW_GUIDE.tasks.map(t => t.view), ["resources", "visits", "timing", "summary"]);
  assert.equal(nextTask("existing", "visits")?.view, "resources");
  assert.equal(nextTask("new", "visits")?.view, "timing");
  assert.equal(nextTask("new", "summary"), null);
  assert.equal(guideTask("existing", "timing").data, "개최 시기");
});

test("guide wording stays short: one-line goals, at most two short questions, a few unknowns", () => {
  for (const journey of journeys) {
    assert.ok(journey.goal.length <= 36, journey.goal);
    assert.ok(journey.outcome.length <= 24, journey.outcome);
    assert.equal(journey.judgments.length, 3);
    for (const j of journey.judgments) assert.ok(j.text.length <= 20, j.text);
    for (const task of journey.tasks) {
      assert.ok(task.title.length <= 10 && task.data.length <= 8, task.title);
      assert.ok(task.goal.length <= 30, task.goal);
      assert.ok(task.hint.length <= 16, task.hint);
      assert.ok(task.questions.length <= 2, task.title);
      for (const q of task.questions) { assert.ok(q.length <= 28, q); assert.match(q, /\?$/); }
      assert.ok(task.unknown.length <= 2, task.title);
      for (const u of task.unknown) assert.ok(u.length <= 12, u);
      if (task.view !== "summary") assert.ok(task.questions.length > 0 && task.unknown.length > 0, task.title);
    }
  }
});

test("next checks are actions with a place to ask and one of three kinds", () => {
  for (const journey of journeys) {
    assert.ok(journey.checks.length >= 3 && journey.checks.length <= 5);
    for (const c of journey.checks) {
      assert.ok(c.kind in CHECK_KINDS);
      assert.ok(c.action.length <= 32 && c.consult.length <= 10, c.action);
    }
  }
});

test("no wording decides for the reader, promises a result or treats district visits as an audience", () => {
  const banned = [/추천/, /적합/, /최적/, /입장객 추정/, /수요/, /참가 규모/, /완료/, /합격/, /적법/, /보장/, /예측/, /점수/];
  for (const text of visible) for (const word of banned) assert.doesNotMatch(text, word, text);
});

test("the preparation process names no amounts or deadlines until a maintained source exists", () => {
  for (const text of visible) assert.doesNotMatch(text, /\d+\s*(억|만\s*원|원|일\s*전|주\s*전|일\s*이내|개월|명\s*이상)/, text);
  assert.deepEqual(PHASES.map(p => p.step), [1, 2, 3, 4, 5, 6, 7]);
  assert.deepEqual([...new Set(PHASES.map(p => STAGE_LABELS[p.stage]))], ["개최 전", "개최", "개최 후"]);
  for (const phase of PHASES) {
    assert.ok(phase.work.length >= 1 && phase.work.length <= 3, phase.title);
    assert.ok(phase.consult.length >= 1 && phase.read.length >= 1, phase.title);
    for (const id of phase.read) guideSource(id);
    for (const e of phase.explore) guideTask(e.journey, e.view);
  }
});

test("every reading is an official https page with a check date", () => {
  assert.equal(new Set(GUIDE_SOURCES.map(s => s.id)).size, GUIDE_SOURCES.length);
  for (const s of GUIDE_SOURCES) {
    assert.match(s.url, /^https:\/\/[^/]*\.(go\.kr|or\.kr|re\.kr)\//, s.id);
    assert.match(s.checkedOn, /^\d{4}-\d{2}-\d{2}$/);
  }
  assert.throws(() => guideSource("S99"));
});

test("data-scope note appears only when the record is limited", () => {
  assert.equal(visitsScope(null), "none");
  assert.equal(visitsScope([{ start: null }]), "none");
  assert.equal(visitsScope([{ start: "2025-03-27" }, { start: null }]), "single");
  assert.equal(visitsScope([{ start: "2025-03-27" }, { start: "2024-03-21" }]), "editions");
  assert.equal(VISITS_SCOPE_NOTE.editions, null);
});

const day = (date: string, value: number | null, inFestival = false): DayPoint => ({ date, weekday: 0, inFestival, value, collectedAt: null });

test("side means average only fully observed shown days and never fill gaps", () => {
  const points = [day("2025-03-25", 10), day("2025-03-26", 21), day("2025-03-27", 99, true), day("2025-03-28", 99, true), day("2025-03-29", 5), day("2025-03-30", null)];
  const { before, after } = sideMeans(points, "2025-03-27", "2025-03-28");
  assert.deepEqual(before, { days: 2, observedDays: 2, mean: 15.5, rounded: 16 });
  assert.deepEqual(after, { days: 2, observedDays: 1, mean: null, rounded: null });
  assert.deepEqual(sideMeans(points, null, null), { before: null, after: null });
  assert.deepEqual(sideMeans([day("2025-03-27", 3, true)], "2025-03-27", "2025-03-27"), { before: null, after: null });
});
