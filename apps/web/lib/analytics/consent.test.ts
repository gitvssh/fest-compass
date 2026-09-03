import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { afterEach, test } from "node:test";
import { canManageConsent, openConsentSettings } from "./consent";

afterEach(() => {
  delete (globalThis as { window?: unknown }).window;
});

function installWindow(zaraz: unknown) {
  (globalThis as { window?: unknown }).window = { zaraz };
}

test("서버 렌더에서는 동의 상태를 묻지도 바꾸지도 않는다", () => {
  delete (globalThis as { window?: unknown }).window;
  assert.equal(canManageConsent(), false);
  assert.doesNotThrow(() => openConsentSettings());
});

test("태그 관리자가 없거나 모달을 못 열면 조용히 무시한다", () => {
  for (const zaraz of [undefined, {}, { showConsentModal: "not-a-function" }]) {
    installWindow(zaraz);
    assert.equal(canManageConsent(), false);
    assert.doesNotThrow(() => openConsentSettings());
  }
});

test("모달을 열 수 있으면 정확히 한 번 연다", () => {
  let calls = 0;
  installWindow({ showConsentModal: () => { calls += 1; } });
  assert.equal(canManageConsent(), true);
  openConsentSettings();
  assert.equal(calls, 1);
});

test("모달이 예외를 던져도 화면을 중단시키지 않는다", () => {
  installWindow({ showConsentModal: () => { throw new Error("boom"); } });
  assert.doesNotThrow(() => openConsentSettings());
});

test("앱은 동의 어휘를 전혀 갖지 않는다", () => {
  // 존 전체가 태그 관리자의 모달 하나를 쓰므로, 앱이 purpose ID 나 결정 자체를
  // 보관하면 사이트 수만큼 중복되고 어긋난다. 소스에서 직접 확인한다.
  const source = readFileSync(new URL("./consent.ts", import.meta.url), "utf8");
  assert.ok(source.includes("showConsentModal"));
  assert.equal(/consent\s*\.\s*set(All)?\s*\(/.test(source), false, "동의 값을 앱이 설정하면 안 된다");
  assert.equal(/localStorage|sessionStorage|document\.cookie/.test(source), false, "결정을 앱이 저장하면 안 된다");
  assert.equal(/["'][A-Za-z0-9]{4}["']/.test(source), false, "purpose ID 형태의 리터럴이 있으면 안 된다");
});
