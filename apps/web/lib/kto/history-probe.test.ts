import assert from "node:assert/strict";
import test from "node:test";
import { summarizeRegionalDay } from "./history-probe";

const rows = () => ["현지인(a)", "외지인(b)", "외국인(c)"].map((name, i) => ({
  signguCode: "44230", signguNm: "논산시", baseYmd: "20250327",
  touDivCd: String(i + 1), touDivNm: name, touNum: i === 0 ? "0" : "52,671.5",
}));
const nonsan = (items: Record<string, unknown>[], complete = true) => summarizeRegionalDay(items, "20250327", complete)[3];

test("municipal series keeps visitor types and fractional estimates separate", () => {
  const result = nonsan(rows());
  assert.equal(result.status, "complete-day");
  assert.deepEqual(result.points.map((p) => p.value), [0, 52671.5, 52671.5]);
  assert.equal(result.points[1].visitorTypeCode, "2");
  assert.equal(summarizeRegionalDay(rows(), "20250327", true)[0].status, "unusable");
});

test("a matching region on a partial national page is not complete coverage", () => {
  assert.ok(nonsan(rows(), false).issues.includes("incomplete-response"));
});

test("missing types, duplicates and Jeonbuk aliases cannot silently produce targets", () => {
  assert.ok(nonsan(rows().slice(0, 2)).issues.includes("missing-visitor-type"));
  assert.ok(nonsan([...rows(), rows()[1]]).issues.includes("duplicate-visitor-type"));
  const imsil = rows().map((row) => ({ ...row, signguCode: "45750", signguNm: "임실군" }));
  assert.equal(summarizeRegionalDay(imsil, "20250327", true)[0].status, "complete-day");
  const doubled = [...imsil, { ...imsil[1], signguCode: "52750" }];
  assert.ok(summarizeRegionalDay(doubled, "20250327", true)[0].issues.includes("duplicate-visitor-type"));
});

test("region, date, category and invalid value mismatches reject a daily target", () => {
  const cases: [Record<string, unknown>, string][] = [
    [{ signguNm: "공주시" }, "region-mismatch"],
    [{ signguCode: "44150" }, "region-mismatch"],
    [{ baseYmd: "20250328" }, "date-mismatch"],
    [{ touDivNm: "전체" }, "visitor-type-mismatch"],
    ...["", ",", "12,34", "0x10", -1, "NaN", null, true, []].map((touNum): [Record<string, unknown>, string] => [{ touNum }, "invalid-visitor-value"]),
  ];
  for (const [patch, issue] of cases) {
    const items = rows();
    const result = nonsan([{ ...items[0], ...patch }, ...items.slice(1)]);
    assert.ok(result.issues.includes(issue));
  }
});
