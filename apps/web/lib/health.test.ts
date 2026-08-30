import assert from "node:assert/strict";
import { test } from "node:test";
import { livenessResponse, readinessResponse } from "./health";

test("livez는 외부 의존성 없이 200과 no-store를 반환한다", async () => {
  const response = livenessResponse();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("cache-control") ?? "", /no-store/);
  assert.deepEqual(await response.json(), { status: "alive" });
});

test("readyz는 read probe 성공/실패를 200/503으로만 노출한다", async () => {
  const ready = await readinessResponse(async () => ({ id: "one" }));
  assert.equal(ready.status, 200);
  assert.deepEqual(await ready.json(), { status: "ready" });

  const unavailable = await readinessResponse(async () => {
    throw new Error("DATABASE_URL=secret-detail");
  });
  assert.equal(unavailable.status, 503);
  const body = await unavailable.text();
  assert.deepEqual(JSON.parse(body), { status: "not_ready" });
  assert.doesNotMatch(body, /secret-detail/);
});
