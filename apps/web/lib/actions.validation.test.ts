import assert from "node:assert/strict";
import test from "node:test";
import {
  addFieldActionFormAction,
  addOutcomeFormAction,
  addTriggerFormAction,
  createFestivalFormAction,
  createFromKtoFormAction,
  decideScenarioFormAction,
  updateAssumptionsFormAction,
  updateCapacityFormAction,
  type FormActionState,
} from "./actions";

const initialState = (): FormActionState => ({
  status: "idle",
  submissionId: 0,
  values: {},
  fieldErrors: {},
});

test("festival form returns field errors and preserves submitted values", async () => {
  const formData = new FormData();
  formData.set("name", "");
  formData.set("organization", "지역문화재단");
  formData.set("provenance", "kto");
  formData.set("contentId", "untrusted-client-value");

  const state = await createFestivalFormAction(initialState(), formData);

  assert.equal(state.status, "error");
  assert.match(state.fieldErrors.name, /필수/);
  assert.equal(state.values.organization, "지역문화재단");
  assert.equal(state.submissionId, 1);
});

test("KTO form rejects a missing content id without making an external request", async () => {
  const state = await createFromKtoFormAction(initialState(), new FormData());
  assert.equal(state.status, "error");
  assert.match(state.fieldErrors.contentId, /필수/);
});

test("assumption validation maps monotonic errors to all inflow fields", async () => {
  const formData = new FormData();
  formData.set("festivalId", "fixture");
  formData.set("inflowMin", "200");
  formData.set("inflowBase", "100");
  formData.set("inflowMax", "300");

  const state = await updateAssumptionsFormAction(initialState(), formData);
  assert.equal(state.status, "error");
  assert.ok(state.fieldErrors.inflowMin);
  assert.ok(state.fieldErrors.inflowBase);
  assert.ok(state.fieldErrors.inflowMax);
  assert.equal(state.values.inflowMin, "200");
});

test("capacity rejects zero and negative approved capacity before persistence", async () => {
  for (const value of ["0", "-1"]) {
    const formData = new FormData();
    formData.set("festivalId", "fixture");
    formData.set("approvedCapacity", value);
    const state = await updateCapacityFormAction(initialState(), formData);
    assert.equal(state.status, "error");
    assert.match(state.fieldErrors.approvedCapacity, /0보다 커야/);
    assert.equal(state.values.approvedCapacity, value);
  }
});

test("decision, trigger, field-action and outcome forms return typed errors", async () => {
  const decision = new FormData();
  decision.set("festivalId", "fixture");
  decision.set("scenarioId", "scenario");
  assert.ok((await decideScenarioFormAction(initialState(), decision)).fieldErrors.reason);

  const trigger = new FormData();
  trigger.set("festivalId", "fixture");
  assert.ok((await addTriggerFormAction(initialState(), trigger)).fieldErrors.condition);

  const fieldAction = new FormData();
  fieldAction.set("festivalId", "fixture");
  fieldAction.set("occurredAt", "not-a-date");
  fieldAction.set("action", "우회 동선 개방");
  assert.ok((await addFieldActionFormAction(initialState(), fieldAction)).fieldErrors.occurredAt);

  const outcome = new FormData();
  outcome.set("festivalId", "fixture");
  assert.ok((await addOutcomeFormAction(initialState(), outcome)).fieldErrors.metric);
});

test("hourly and zone outcomes require a reproducible bucket label", async () => {
  for (const granularity of ["hourly", "zone"]) {
    const outcome = new FormData();
    outcome.set("festivalId", "fixture");
    outcome.set("metric", "현장 유입");
    outcome.set("actualValue", "120");
    outcome.set("granularity", granularity);
    const state = await addOutcomeFormAction(initialState(), outcome);
    assert.equal(state.status, "error");
    assert.match(state.fieldErrors.bucketLabel, /시간대 또는 구역/);
  }
});
