import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { dispatchAnalyticsEvent } from "./transport";

type TrackCall = [string, Record<string, string | number> | undefined];

function withWindow(zaraz: unknown): TrackCall[] {
  const calls: TrackCall[] = [];
  (globalThis as { window?: unknown }).window = { zaraz };
  return calls;
}

afterEach(() => {
  delete (globalThis as { window?: unknown }).window;
});

test("Zaraz가 없으면 조용히 무시한다 — 동의 전 상태가 기본값이다", () => {
  delete (globalThis as { window?: unknown }).window;
  assert.doesNotThrow(() => dispatchAnalyticsEvent("privacy_view", { app_mode: "public-readonly" }));

  withWindow(undefined);
  assert.doesNotThrow(() => dispatchAnalyticsEvent("privacy_view", { app_mode: "public-readonly" }));

  withWindow({ track: "not-a-function" });
  assert.doesNotThrow(() => dispatchAnalyticsEvent("privacy_view", { app_mode: "public-readonly" }));
});

test("동의된 Zaraz에는 이름과 속성 사본을 전달한다", () => {
  const calls: TrackCall[] = [];
  (globalThis as { window?: unknown }).window = {
    zaraz: {
      track: (name: string, properties?: Record<string, string | number>) => {
        calls.push([name, properties]);
      },
    },
  };

  const properties = { app_mode: "public-readonly" } as const;
  dispatchAnalyticsEvent("privacy_view", properties);

  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], "privacy_view");
  assert.deepEqual(calls[0][1], { app_mode: "public-readonly" });
  assert.notEqual(calls[0][1], properties, "호출자 객체를 그대로 넘기지 않는다");
});

test("track이 던지거나 거부해도 화면을 중단시키지 않는다", () => {
  (globalThis as { window?: unknown }).window = {
    zaraz: {
      track: () => {
        throw new Error("tag manager unavailable");
      },
    },
  };
  assert.doesNotThrow(() => dispatchAnalyticsEvent("privacy_view", { app_mode: "editor" }));

  (globalThis as { window?: unknown }).window = {
    zaraz: { track: () => Promise.reject(new Error("network")) },
  };
  assert.doesNotThrow(() => dispatchAnalyticsEvent("privacy_view", { app_mode: "editor" }));
});
