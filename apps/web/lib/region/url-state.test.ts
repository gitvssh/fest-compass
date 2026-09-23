import test from "node:test";
import assert from "node:assert/strict";
import { parseRegionState, queryKey, regionSearch } from "./url-state";

test("a complete valid address restores the applied condition and month", () => {
  const state = parseRegionState({ province: "44", district: "230", start: "2026-02-15", end: "2026-04-10", kind: "15", month: "2026-03" });
  assert.deepEqual(state, { query: { province: "44", district: "230", start: "2026-02-15", end: "2026-04-10", kind: "15" }, month: "2026-03" });
  assert.equal(regionSearch(state!.query, state!.month), "province=44&district=230&start=2026-02-15&end=2026-04-10&kind=15&month=2026-03");
  assert.deepEqual(parseRegionState(new URLSearchParams(regionSearch(state!.query, state!.month))), state);
  assert.equal(queryKey(state!.query), "44/230/15/2026-02-15/2026-04-10");
});

test("invalid or partial addresses start from the nationwide view", () => {
  const ok = { province: "44", district: "230", start: "2026-01-01", end: "2026-12-31", kind: "15" };
  assert.equal(parseRegionState({}), null);
  assert.equal(parseRegionState({ ...ok, district: "999" }), null);
  assert.equal(parseRegionState({ ...ok, end: "2027-06-01" }), null);
  assert.equal(parseRegionState({ ...ok, start: "2026-02-30" }), null);
  assert.equal(parseRegionState({ ...ok, kind: "99" }), null);
  assert.equal(parseRegionState({ ...ok, province: ["44", "11"] }), null);
});

test("a month is kept only for event results and only in YYYY-MM form", () => {
  const ok = { province: "44", district: "230", start: "2026-01-01", end: "2026-12-31" };
  assert.equal(parseRegionState({ ...ok, kind: "12", month: "2026-03" })?.month, null);
  assert.equal(parseRegionState({ ...ok, kind: "15", month: "2026-3" })?.month, null);
  assert.equal(regionSearch({ ...ok, kind: "12" }, "2026-03"), "province=44&district=230&start=2026-01-01&end=2026-12-31&kind=12");
});
