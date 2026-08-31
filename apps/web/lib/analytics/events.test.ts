import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import {
  analyticsConsentBoundary,
  analyticsEventDictionary,
} from "../analytics-events";
import { buildAnalyticsEvent, isKnownAnalyticsEvent, trackAnalyticsEvent } from "./events";

afterEach(() => {
  delete (globalThis as { window?: unknown }).window;
});

test("전송 가능한 이벤트는 공개된 사전과 정확히 일치한다", () => {
  const declared = analyticsEventDictionary.map((entry) => entry.name).sort();
  const wired = ["festival_list_view", "festival_workspace_view", "privacy_view"].sort();

  assert.deepEqual(wired, declared);
  for (const name of declared) {
    assert.ok(isKnownAnalyticsEvent(name));
  }
  assert.equal(isKnownAnalyticsEvent("festival_detail_view"), false);
});

test("사전에 없는 속성은 조용히 제거된다", () => {
  const built = buildAnalyticsEvent("privacy_view", {
    app_mode: "public-readonly",
    // @ts-expect-error 사전에 없는 속성은 타입에서도 거부되어야 한다.
    tab: "evidence",
  });

  assert.deepEqual(built.properties, { app_mode: "public-readonly" });
});

test("금지 속성은 사전을 통과하더라도 전송되지 않는다", () => {
  for (const forbidden of analyticsConsentBoundary.forbiddenProperties) {
    // 계산된 키는 컴파일 타임에 잡히지 않는다. 런타임 경계가 마지막 방어선인
    // 이유이고, 이 검사가 그 경계를 증명한다.
    const properties = {
      tab: "report",
      app_mode: "public-readonly",
      [forbidden]: "봄꽃축제",
    } as unknown as Parameters<typeof buildAnalyticsEvent<"festival_workspace_view">>[1];

    const built = buildAnalyticsEvent("festival_workspace_view", properties);
    assert.equal(built.properties[forbidden], undefined, `${forbidden} 이(가) 전송되었다`);
    assert.deepEqual(built.properties, { tab: "report", app_mode: "public-readonly" });
  }
});

test("열거되지 않은 값과 자유 입력은 버린다", () => {
  const rejected = [
    "unknown-tab",
    "https://kto.damecasol.com/festivals/seed-spring-flower/report",
    "www.example.com",
    "person@example.com",
    "line1\nline2",
    "",
    "e".repeat(33),
  ];

  for (const value of rejected) {
    const built = buildAnalyticsEvent("festival_workspace_view", {
      // @ts-expect-error 허용 목록 밖의 값은 타입에서도 거부되어야 한다.
      tab: value,
      app_mode: "public-readonly",
    });
    assert.equal(built.properties.tab, undefined, `${JSON.stringify(value)} 이(가) 통과했다`);
    assert.equal(built.properties.app_mode, "public-readonly");
  }
});

test("숫자·불리언·객체 값은 문자열 열거가 아니므로 버린다", () => {
  for (const value of [1, 0, true, null, undefined, { id: 1 }, ["evidence"]]) {
    const built = buildAnalyticsEvent("privacy_view", {
      // @ts-expect-error 스칼라 문자열 열거만 허용한다.
      app_mode: value,
    });
    assert.deepEqual(built.properties, {});
  }
});

test("허용된 조합은 그대로 통과한다", () => {
  for (const tab of ["evidence", "scenarios", "ledger", "report"] as const) {
    for (const mode of ["public-readonly", "editor"] as const) {
      const built = buildAnalyticsEvent("festival_workspace_view", { tab, app_mode: mode });
      assert.deepEqual(built.properties, { tab, app_mode: mode });
    }
  }
});

test("track은 정제된 속성만 Zaraz로 보낸다", () => {
  const calls: [string, Record<string, string | number> | undefined][] = [];
  (globalThis as { window?: unknown }).window = {
    zaraz: {
      track: (name: string, properties?: Record<string, string | number>) => {
        calls.push([name, properties]);
      },
    },
  };

  trackAnalyticsEvent("festival_workspace_view", {
    tab: "ledger",
    app_mode: "public-readonly",
    // @ts-expect-error 금지 속성은 타입에서도 거부되어야 한다.
    festival_name: "봄꽃축제",
  });

  assert.deepEqual(calls, [["festival_workspace_view", { tab: "ledger", app_mode: "public-readonly" }]]);
});

test("앱은 측정 ID나 CMP purpose ID를 포함하지 않는다", () => {
  assert.equal(analyticsConsentBoundary.appEmbedsVendorMeasurementId, false);
  assert.equal(analyticsConsentBoundary.appDefinesCmpPurposeId, false);
});
