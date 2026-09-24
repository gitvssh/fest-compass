import test from "node:test";
import assert from "node:assert/strict";
import { compareDestinations, percentagePointChange } from "./visitor-profile-compare";
import type { VisitorProfileDestination } from "./visitor-profile-types";

const place = (id: string, rank: number, over: Partial<VisitorProfileDestination> = {}): VisitorProfileDestination =>
  ({ id, rank, name: `장소${id}`, address: `전북 임실군 길${id}`, category: "테마공원", resource: null, ...over });

test("percentage-point change is exact on the published one-decimal shares", () => {
  assert.notEqual(7.3 - 7.0, 0.3, "plain float subtraction would show 0.29999…");
  assert.equal(percentagePointChange(7.0, 7.3), 0.3);
  assert.equal(percentagePointChange(13.0, 11.3), -1.7);
  assert.equal(percentagePointChange(0.1, 0.2), 0.1);
  assert.equal(percentagePointChange(0, 100), 100);
  assert.ok(Object.is(percentagePointChange(4.4, 4.4), 0), "no change is 0, never -0");
  assert.ok(Object.is(percentagePointChange(12.3, 12.3), 0));
});

test("destination union: latest order first, then older-only places; ranks as published, ties kept", () => {
  const before = [place("1", 1), place("2", 2), place("3", 2), place("4", 4)];
  const after = [place("3", 1), place("1", 2), place("5", 2), place("2", 4)];
  const rows = compareDestinations(before, after);
  assert.deepEqual(rows.map(r => [r.id, r.beforeRank, r.afterRank, r.rankChange]), [
    ["3", 2, 1, 1], ["1", 1, 2, -1], ["5", null, 2, null], ["2", 2, 4, -2], ["4", 4, null, null],
  ]);
  assert.deepEqual(Object.keys(rows[0]).sort(), ["address", "afterRank", "beforeRank", "category", "id", "name", "rankChange", "resource"]);
  assert.deepEqual(compareDestinations(before, before).map(r => r.rankChange), [0, 0, 0, 0], "unchanged tie ranks are 0, not a move");
});

test("places join by exact ID only; metadata and resource come from the latest edition each place appears in", () => {
  const park = { id: "2718832", kind: "12" as const, title: "임실치즈테마파크" };
  const before = [place("173403", 5, { name: "성수산자연휴양림", address: "전북 임실군", category: "자연공원", resource: park }), place("10", 1, { name: "같은 이름" }), place("8343126", 7, { name: "수월제", resource: park })];
  const after = [place("173403", 3, { name: "성수산왕의숲자연휴양림", address: "전북 임실군 성수산길 373-0", category: "자연휴양림" }), place("11", 1, { name: "같은 이름" })];
  const rows = compareDestinations(before, after);
  assert.deepEqual(rows.map(r => r.id), ["173403", "11", "10", "8343126"], "same name, different ID stays two places");
  assert.deepEqual(rows[0], { id: "173403", name: "성수산왕의숲자연휴양림", address: "전북 임실군 성수산길 373-0", category: "자연휴양림", resource: null, beforeRank: 5, afterRank: 3, rankChange: 2 });
  assert.deepEqual([rows[1].beforeRank, rows[2].afterRank], [null, null]);
  assert.deepEqual([rows[3].name, rows[3].resource], ["수월제", park], "older-only place keeps its own metadata");
});

test("inputs are never mutated and every row carries fresh copies", () => {
  const before = [place("1", 1, { resource: { id: "317571", kind: "12", title: "상이암(임실)" } })], after = [place("1", 1, { resource: { id: "527279", kind: "12", title: "소충사" } })];
  const snapshot = JSON.stringify([before, after]), rows = compareDestinations(before, after);
  rows[0].resource!.id = "x"; rows[0].name = "x";
  assert.equal(JSON.stringify([before, after]), snapshot);
  assert.deepEqual(compareDestinations([], []), []);
  assert.deepEqual(compareDestinations(before, []).map(r => [r.beforeRank, r.afterRank, r.rankChange]), [[1, null, null]]);
  assert.deepEqual(compareDestinations([], after).map(r => [r.beforeRank, r.afterRank, r.rankChange]), [[null, 1, null]]);
});
