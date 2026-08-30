import assert from "node:assert/strict";
import { test } from "node:test";
import { buildVisitorWindows, previousYearMonth } from "./windows";

test("미래 축제는 평시와 전년 동기간만 조회한다", () => {
  assert.deepEqual(buildVisitorWindows("2026-10-10", "2026-10-12", "2026-08-30"), [
    { window: "평시", startYmd: "2026-09-12", endYmd: "2026-09-18" },
    { window: "전년 동기간", startYmd: "2025-10-07", endYmd: "2025-10-15" },
  ]);
});

test("지난 축제는 당해 기간을 별도 창으로 추가한다", () => {
  const windows = buildVisitorWindows("2026-04-10", "2026-04-12", "2026-08-30");
  assert.deepEqual(windows[2], { window: "당해", startYmd: "2026-04-10", endYmd: "2026-04-12" });
});

test("윤년 전년 동일은 2월 말일로 보정한다", () => {
  const windows = buildVisitorWindows("2024-02-29", "2024-02-29", "2024-03-10");
  assert.deepEqual(windows[1], {
    window: "전년 동기간",
    startYmd: "2023-02-25",
    endYmd: "2023-03-03",
  });
  assert.equal(previousYearMonth("2024-02-29"), "202302");
});

test("종료일이 시작일보다 빠르면 거부한다", () => {
  assert.throws(() => buildVisitorWindows("2026-04-12", "2026-04-10", "2026-08-30"), /\uc885\ub8cc\uc77c/);
});
