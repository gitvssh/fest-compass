import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { afterEach, test } from "node:test";
import {
  CONSENT_READY_EVENT,
  CONSENT_TAKEOVER_ATTRIBUTE,
  OPEN_CONSENT_EVENT,
  closeDefaultModal,
  getConsentApi,
  isConsentModalOpen,
  isSiteConsentOpen,
  openConsentSettings,
  setConsentTakeover,
  submitConsentChoice,
  watchDefaultModal,
  whenConsentApiReady,
} from "./consent";
import type { ZarazConsentApi } from "./transport";

/**
 * Mimics the live Zaraz consent object (pickday.damecasol.com, 2026-10-04): the `modal` setter
 * throws when an already closed modal is set to false, and the choice is recorded through `setAll`.
 */
function createZarazConsentStub({ apiReady = true, modalOpen = false, queued = true } = {}) {
  let open = modalOpen;
  const modalWrites: boolean[] = [];
  const setAllCalls: boolean[] = [];
  let sent = 0;
  const api: ZarazConsentApi = {
    APIReady: apiReady,
    setAll: (status: boolean) => { setAllCalls.push(status); },
    sendQueuedEvents: queued ? () => { sent += 1; } : undefined,
    get modal() { return open; },
    set modal(value: boolean) {
      if (!value && !open) throw new Error("Zaraz: the consent modal is not open");
      open = value;
      modalWrites.push(value);
    },
  };
  return {
    api,
    modalWrites,
    setAllCalls,
    sentCount: () => sent,
    /** Zaraz opening its default modal for a visitor who has not decided yet. */
    openModal: () => { open = true; },
    isModalOpen: () => open,
  };
}

class FakeRoot {
  attributes = new Set<string>();
  setAttribute(name: string) { this.attributes.add(name); }
  removeAttribute(name: string) { this.attributes.delete(name); }
  hasAttribute(name: string) { return this.attributes.has(name); }
}

/** A browser just large enough for the module: timers, events and the `<html>` element. */
function installBrowser(zaraz?: unknown) {
  const win = Object.assign(new EventTarget(), {
    zaraz,
    setInterval: (handler: () => void, ms: number) => setInterval(handler, ms) as unknown as number,
    clearInterval: (id: number) => clearInterval(id as unknown as NodeJS.Timeout),
  });
  const doc = Object.assign(new EventTarget(), { documentElement: new FakeRoot(), querySelector: () => null });
  (globalThis as { window?: unknown }).window = win;
  (globalThis as { document?: unknown }).document = doc;
  return { win, doc };
}

function takeover(doc: { documentElement: FakeRoot }) {
  return doc.documentElement.hasAttribute(CONSENT_TAKEOVER_ATTRIBUTE);
}

afterEach(() => {
  delete (globalThis as { window?: unknown }).window;
  delete (globalThis as { document?: unknown }).document;
});

test("서버 렌더에서는 동의 상태를 묻지도 바꾸지도 않는다", () => {
  assert.equal(getConsentApi(), undefined);
  assert.doesNotThrow(() => openConsentSettings());
  assert.doesNotThrow(() => setConsentTakeover(true));
  assert.equal(isSiteConsentOpen(), false);
  assert.equal(isConsentModalOpen(), false);
  const cancel = whenConsentApiReady(() => assert.fail("호출되면 안 된다"));
  assert.doesNotThrow(cancel);
});

test("태그 관리자가 없거나 선택을 기록할 수 없으면 동의 API가 없다", () => {
  for (const zaraz of [undefined, {}, { consent: { modal: false } }, { consent: { setAll: "not-a-function" } }]) {
    installBrowser(zaraz);
    assert.equal(getConsentApi(), undefined);
  }
  const stub = createZarazConsentStub();
  installBrowser({ track: () => undefined, consent: stub.api });
  assert.equal(getConsentApi(), stub.api);
});

test("기본 창은 열려 있을 때만 닫는다 — 닫힌 창에 false를 넣으면 Zaraz가 예외를 던진다", () => {
  const stub = createZarazConsentStub({ modalOpen: true });
  closeDefaultModal(stub.api);
  assert.equal(stub.isModalOpen(), false);
  assert.doesNotThrow(() => closeDefaultModal(stub.api));
  assert.deepEqual(stub.modalWrites, [false]);
  assert.throws(() => { stub.api.modal = false; }, /not open/);
});

test("허용은 전체로 넘기고 대기 중 이벤트를 보낸다", () => {
  const stub = createZarazConsentStub({ modalOpen: true });
  submitConsentChoice(stub.api, true);
  assert.equal(stub.isModalOpen(), false);
  assert.deepEqual(stub.setAllCalls, [true]);
  assert.equal(stub.sentCount(), 1);
});

test("거부는 아무것도 보내지 않고, 대기 이벤트 API가 없어도 동작한다", () => {
  const stub = createZarazConsentStub();
  submitConsentChoice(stub.api, false);
  assert.deepEqual(stub.setAllCalls, [false]);
  assert.equal(stub.sentCount(), 0);
  assert.deepEqual(stub.modalWrites, []);

  const withoutQueue = createZarazConsentStub({ queued: false });
  assert.doesNotThrow(() => submitConsentChoice(withoutQueue.api, true));
  assert.deepEqual(withoutQueue.setAllCalls, [true]);
});

test("동의 API가 이미 준비됐으면 바로 부른다", () => {
  const stub = createZarazConsentStub();
  installBrowser({ consent: stub.api });
  const calls: ZarazConsentApi[] = [];
  whenConsentApiReady((api) => calls.push(api));
  assert.deepEqual(calls, [stub.api]);
});

test("준비 알림을 기다렸다가 그 순간의 API를 한 번만 넘기고, 취소할 수 있다", () => {
  const early = createZarazConsentStub({ apiReady: false });
  const { win, doc } = installBrowser({ consent: early.api });
  const calls: ZarazConsentApi[] = [];
  whenConsentApiReady((api) => calls.push(api));
  assert.deepEqual(calls, []);

  const ready = createZarazConsentStub();
  win.zaraz = { consent: ready.api };
  doc.dispatchEvent(new Event(CONSENT_READY_EVENT));
  doc.dispatchEvent(new Event(CONSENT_READY_EVENT));
  assert.deepEqual(calls, [ready.api]);

  // A ready event without a usable API is ignored; a cancelled wait never fires.
  win.zaraz = undefined;
  const ignored: ZarazConsentApi[] = [];
  whenConsentApiReady((api) => ignored.push(api));
  doc.dispatchEvent(new Event(CONSENT_READY_EVENT));
  assert.deepEqual(ignored, []);

  const cancelled: ZarazConsentApi[] = [];
  whenConsentApiReady((api) => cancelled.push(api))();
  win.zaraz = { consent: createZarazConsentStub().api };
  doc.dispatchEvent(new Event(CONSENT_READY_EVENT));
  assert.deepEqual(cancelled, []);
});

test("아직 고르지 않은 방문자: Zaraz가 기본 창을 여는 순간 창을 닫고 배너에 넘긴다", (t) => {
  t.mock.timers.enable({ apis: ["setInterval", "Date"], now: 1_000 });
  const stub = createZarazConsentStub();
  const { doc } = installBrowser({ consent: stub.api });
  let undecided = 0;
  watchDefaultModal(stub.api, () => { undecided += 1; });
  assert.equal(takeover(doc), true);
  assert.equal(isSiteConsentOpen(doc as never), true, "지켜보는 동안은 묻는 중이다");

  t.mock.timers.tick(1500);
  assert.equal(undecided, 0);

  stub.openModal();
  t.mock.timers.tick(50);
  assert.equal(stub.isModalOpen(), false);
  assert.deepEqual(stub.modalWrites, [false]);
  assert.equal(undecided, 1);

  // The banner is asking, so the default modal stays hidden until the visitor chooses.
  t.mock.timers.tick(6000);
  assert.equal(takeover(doc), true);
});

test("이미 고른 방문자: 창이 열리지 않으면 지켜보기가 끝난 뒤 숨김을 거둔다", (t) => {
  t.mock.timers.enable({ apis: ["setInterval", "Date"], now: 1_000 });
  const stub = createZarazConsentStub();
  const { doc } = installBrowser({ consent: stub.api });
  let undecided = 0;
  watchDefaultModal(stub.api, () => { undecided += 1; }, { intervalMs: 100, limitMs: 1000 });

  t.mock.timers.tick(900);
  assert.equal(takeover(doc), true);
  t.mock.timers.tick(200);
  assert.equal(takeover(doc), false);
  assert.equal(isSiteConsentOpen(doc as never), false);
  assert.equal(undecided, 0);

  // Watching has stopped: a late modal is Zaraz's business again.
  stub.openModal();
  t.mock.timers.tick(1000);
  assert.equal(stub.isModalOpen(), true);
  assert.equal(undecided, 0);
});

test("지켜보기를 멈추면 더 이상 창을 닫지 않는다", (t) => {
  t.mock.timers.enable({ apis: ["setInterval", "Date"], now: 1_000 });
  const stub = createZarazConsentStub();
  installBrowser({ consent: stub.api });
  let undecided = 0;
  const stop = watchDefaultModal(stub.api, () => { undecided += 1; });
  stop();
  stub.openModal();
  t.mock.timers.tick(7000);
  assert.equal(undecided, 0);
  assert.equal(stub.isModalOpen(), true);
});

test("숨김 표식을 켜고 끈다", () => {
  const { doc } = installBrowser();
  setConsentTakeover(true);
  assert.equal(takeover(doc), true);
  setConsentTakeover(false);
  assert.equal(takeover(doc), false);
  const root = new FakeRoot();
  setConsentTakeover(true, root);
  assert.equal(root.hasAttribute(CONSENT_TAKEOVER_ATTRIBUTE), true);
});

test("다시 보기는 창 이벤트로 배너를 부른다", () => {
  const { win } = installBrowser();
  let opened = 0;
  win.addEventListener(OPEN_CONSENT_EVENT, () => { opened += 1; });
  openConsentSettings();
  assert.equal(opened, 1);
});

test("사이트가 묻는 중인지는 숨김 표식이나 배너 요소로 안다", () => {
  const root = (attribute: boolean, banner: boolean) => ({
    documentElement: Object.assign(new FakeRoot(), attribute ? { attributes: new Set([CONSENT_TAKEOVER_ATTRIBUTE]) } : {}),
    querySelector: (selector: string) => (banner && selector === "[data-consent-banner]" ? {} : null),
  });
  assert.equal(isSiteConsentOpen(null), false);
  assert.equal(isSiteConsentOpen(root(false, false) as never), false);
  assert.equal(isSiteConsentOpen(root(true, false) as never), true);
  assert.equal(isSiteConsentOpen(root(false, true) as never), true);
  const throwing = { documentElement: new FakeRoot(), querySelector: () => { throw new Error("boom"); } };
  assert.equal(isSiteConsentOpen(throwing as never), false);
});

test("기본 창이 열려 있는지만 읽고, 없거나 닫혔으면 열려 있지 않다고 본다", () => {
  const rootWith = (host: unknown) => ({ querySelector: (selector: string) => (selector === ".cf_modal_container" ? host : null) }) as unknown as Pick<Document, "querySelector">;
  const openDialog = { querySelector: (selector: string) => (selector === "dialog[open]" ? {} : null) };
  const closedDialog = { querySelector: () => null };
  assert.equal(isConsentModalOpen(null), false);
  assert.equal(isConsentModalOpen(rootWith(null)), false);
  assert.equal(isConsentModalOpen(rootWith({ shadowRoot: openDialog, querySelector: () => null })), true);
  assert.equal(isConsentModalOpen(rootWith({ shadowRoot: closedDialog, querySelector: () => null })), false);
  assert.equal(isConsentModalOpen(rootWith({ shadowRoot: null, querySelector: openDialog.querySelector })), true);
  const throwing = { querySelector: () => { throw new Error("boom"); } } as unknown as Pick<Document, "querySelector">;
  assert.equal(isConsentModalOpen(throwing), false);
});

test("앱은 동의 어휘를 갖지 않는다 — 전체 허용·거부만 넘기고 저장하지 않는다", () => {
  // Zaraz owns the purposes and the record. The app relays the visitor's whole choice with
  // `setAll`, never a purpose-level `set`, and never keeps a copy. Checked in the source itself.
  const source = readFileSync(new URL("./consent.ts", import.meta.url), "utf8");
  assert.ok(source.includes("setAll("));
  assert.equal(/\.\s*set\s*\(/.test(source), false, "목적 단위로 동의를 설정하면 안 된다");
  assert.equal(/\.\s*get(All)?\s*\(/.test(source), false, "동의 결정을 읽으면 안 된다");
  assert.equal(/showConsentModal/.test(source), false, "기본 창을 다시 여는 경로는 화면에 없다");
  assert.equal(/localStorage|sessionStorage|document\.cookie/.test(source), false, "결정을 앱이 저장하면 안 된다");
  assert.equal(/["'][A-Za-z0-9]{4}["']/.test(source), false, "purpose ID 형태의 리터럴이 있으면 안 된다");
});
