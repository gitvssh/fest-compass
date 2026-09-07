import assert from "node:assert/strict";
import test from "node:test";
import { runKtoProbe, validDate, type ProbeSpec } from "./probe";

const spec: ProbeSpec = {
  label: "지역 방문자 표본", service: "DataLabService", operation: "metcoRegnVisitrDDList",
  params: { numOfRows: 2 }, requiredFields: ["baseYmd", "touNum"], numericFields: ["touNum"],
  dateField: "baseYmd", sourceUrl: "https://www.data.go.kr/data/15101972/openapi.do", meaning: "regional-statistic",
};
function response(items: unknown[], totalCount = items.length, pageNo = 1) {
  return new Response(JSON.stringify({ response: { header: { resultCode: "0000" }, body: { totalCount, pageNo, items: { item: items } } } }));
}
const fake = (result: Response): typeof fetch => async () => result;

test("a partial page is sample-only and zero remains an observed numeric value", async () => {
  const { summary } = await runKtoProbe(spec, "test-key", fake(response([{ baseYmd: "20260401", touNum: 0 }], 30)));
  assert.equal(summary.status, "success");
  assert.equal(summary.collection, "sample-only");
  assert.equal(summary.fields.touNum.missing, 0);
  assert.equal(summary.totalCount, 30);
  assert.deepEqual(summary.sampleDateRange, { min: "2026-04-01", max: "2026-04-01" });
});

test("authorized empty is recorded without inventing values", async () => {
  const { summary, items } = await runKtoProbe(spec, "test-key", fake(response([])));
  assert.equal(summary.status, "empty");
  assert.equal(summary.sampleDateRange, null);
  assert.deepEqual(items, []);
});

test("malformed numeric or missing required values never become usable samples", async () => {
  for (const touNum of [null, "not-a-number", true]) {
    const { summary, items } = await runKtoProbe(spec, "test-key", fake(response([{ baseYmd: "20260401", touNum }])));
    assert.equal(summary.status, "error");
    assert.equal(summary.reason, "invalid-sample-fields");
    assert.deepEqual(items, []);
  }
});

test("provider errors in HTTP 200 and a mismatched page are not successful collection", async () => {
  const providerError = new Response(JSON.stringify({ resultCode: "11", resultMsg: "bad request" }));
  assert.equal((await runKtoProbe(spec, "test-key", fake(providerError))).summary.status, "error");
  const mismatch = await runKtoProbe(spec, "test-key", fake(response([{ baseYmd: "20260401", touNum: 1 }], 1, 2)));
  assert.equal(mismatch.summary.reason, "invalid-pagination");
});

test("keys cannot be overridden, redirected, or leaked through exception and field metadata", async () => {
  const key = "private +/key=";
  await assert.rejects(runKtoProbe({ ...spec, params: { serviceKey: "other" } }, key), /덮어쓸/);
  await assert.rejects(runKtoProbe({ ...spec, operation: "../../elsewhere" }, key), /허용되지/);
  const summary = (await runKtoProbe(spec, key, async (_url, init) => {
    assert.equal(init?.redirect, "error");
    assert.ok(init?.signal);
    throw new Error(`failed https://example.org/?serviceKey=${encodeURIComponent(key)}`);
  })).summary;
  assert.equal(summary.reason, "fetch-error");
  assert.ok(!JSON.stringify(summary).includes("example.org"));
  const echo = await runKtoProbe(spec, key, fake(response([{ baseYmd: "20260401", touNum: 2, [key]: "x" }])));
  assert.ok(!JSON.stringify(echo.summary).includes(key));
});

test("invalid and leap dates are distinguished", () => {
  assert.equal(validDate("20260230"), null);
  assert.equal(validDate("20260229"), null);
  assert.equal(validDate("20240229"), "2024-02-29");
  assert.equal(validDate("20-24-02-29"), null);
});

test("invalid provider dates do not disappear into an apparently successful date range", async () => {
  const { summary, items } = await runKtoProbe(spec, "test-key", fake(response([{ baseYmd: "20260230", touNum: 1 }])));
  assert.equal(summary.status, "error");
  assert.equal(summary.reason, "invalid-sample-fields");
  assert.deepEqual(items, []);
});
