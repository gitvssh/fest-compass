import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { afterEach, test } from "node:test";
import {
  CONSENT_STORAGE_KEY,
  applyConsent,
  isConsentChoice,
  readStoredConsent,
  recordConsent,
  storeConsent,
} from "./consent";

function installWindow(options: { store?: Map<string, string> | null; zaraz?: unknown } = {}) {
  const store: Map<string, string> | null =
    options.store === undefined ? new Map<string, string>() : options.store;
  const localStorage = store
    ? {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => void store.set(k, v),
      }
    : {
        getItem: () => {
          throw new Error("storage disabled");
        },
        setItem: () => {
          throw new Error("storage disabled");
        },
      };
  (globalThis as { window?: unknown }).window = { localStorage, zaraz: options.zaraz };
  return store;
}

afterEach(() => {
  delete (globalThis as { window?: unknown }).window;
});

test("서버 렌더에서는 아무 상태도 읽거나 쓰지 않는다", () => {
  delete (globalThis as { window?: unknown }).window;
  assert.equal(readStoredConsent(), null);
  assert.doesNotThrow(() => storeConsent("granted"));
  assert.doesNotThrow(() => applyConsent("granted"));
});

test("선택하지 않은 방문자는 분석 꺼짐으로 취급한다", () => {
  installWindow();
  assert.equal(readStoredConsent(), null);
});

test("저장된 값만 인정하고 조작된 값은 미선택으로 되돌린다", () => {
  const store = installWindow() as Map<string, string>;
  for (const bogus of ["yes", "true", "GRANTED", "", "1"]) {
    store.set(CONSENT_STORAGE_KEY, bogus);
    assert.equal(readStoredConsent(), null, `${JSON.stringify(bogus)} 이(가) 통과했다`);
  }
  store.set(CONSENT_STORAGE_KEY, "granted");
  assert.equal(readStoredConsent(), "granted");
  store.set(CONSENT_STORAGE_KEY, "denied");
  assert.equal(readStoredConsent(), "denied");
});

test("저장소가 막힌 브라우저도 미선택으로 안전하게 처리된다", () => {
  installWindow({ store: null });
  assert.equal(readStoredConsent(), null);
  assert.doesNotThrow(() => storeConsent("granted"));
});

test("동의·거부 모두 Zaraz에 전달되며 purpose ID를 쓰지 않는다", () => {
  const calls: unknown[] = [];
  installWindow({ zaraz: { consent: { setAll: (granted: boolean) => calls.push(granted) } } });

  recordConsent("granted");
  recordConsent("denied");

  assert.deepEqual(calls, [true, false]);
});

test("동의 소스에 CMP purpose ID가 들어 있지 않다", () => {
  // 선언한 경계(appDefinesCmpPurposeId: false)를 소스에서 직접 확인한다.
  // Zaraz purpose ID는 짧은 영숫자 토큰이라 setAll 대신 그것을 쓰면 여기서 걸린다.
  const source = readFileSync(new URL("./consent.ts", import.meta.url), "utf8");
  assert.ok(source.includes("setAll"), "setAll 경로를 써야 한다");
  assert.equal(/consent\.set\s*\(/.test(source), false, "purpose 단위 set 을 쓰면 안 된다");
  assert.equal(/["'][A-Za-z0-9]{4}["']\s*:\s*(true|false|granted)/.test(source), false);
});

test("Zaraz가 없거나 setAll이 없으면 조용히 무시한다", () => {
  installWindow({ zaraz: undefined });
  assert.doesNotThrow(() => applyConsent("granted"));

  installWindow({ zaraz: { consent: {} } });
  assert.doesNotThrow(() => applyConsent("granted"));

  installWindow({ zaraz: { consent: { setAll: () => { throw new Error("boom"); } } } });
  assert.doesNotThrow(() => applyConsent("granted"));
});

test("선택은 저장되고 다음 방문에서 복원된다", () => {
  const store = installWindow({ zaraz: { consent: { setAll: () => undefined } } }) as Map<string, string>;
  recordConsent("granted");
  assert.equal(store.get(CONSENT_STORAGE_KEY), "granted");
  assert.equal(readStoredConsent(), "granted");
});

test("동의 값 판별기는 두 값만 인정한다", () => {
  assert.ok(isConsentChoice("granted"));
  assert.ok(isConsentChoice("denied"));
  for (const v of [null, undefined, 1, true, "other", {}]) {
    assert.equal(isConsentChoice(v), false);
  }
});
