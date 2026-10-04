// Site-owned consent banner logic. Cloudflare Zaraz keeps the consent record, the purposes and
// the analytics gate; this module only asks an undecided visitor in the product's own words and
// hands the choice to Zaraz.
//
// - No purpose identifiers: the choice is relayed as a whole with `setAll`. The published
//   dictionary declares appDefinesCmpPurposeId: false and this module keeps that true.
// - No cookies or browser storage: a visitor is known to be undecided when Zaraz tries to open
//   its default modal (the `modal` flag turning true).
// - The zone's default modal is hidden only while the site banner takes over
//   (`<html data-consent-takeover>` plus a stylesheet rule). The page is served with the mark, so
//   the modal cannot flash before the app starts; the app lifts it at once without the tag
//   manager, and after the watch window when the visitor had already decided. The flag is closed
//   as well so a hidden modal never stays open.
// Reference: https://developers.cloudflare.com/zaraz/consent-management/api/
import type { ZarazConsentApi } from "./transport";

export const CONSENT_READY_EVENT = "zarazConsentAPIReady";
export const CONSENT_TAKEOVER_ATTRIBUTE = "data-consent-takeover";
export const CONSENT_BANNER_ATTRIBUTE = "data-consent-banner";
export const OPEN_CONSENT_EVENT = "fest-compass:open-consent";
export const CONSENT_WATCH_INTERVAL_MS = 50;
export const CONSENT_WATCH_LIMIT_MS = 6000;

export interface ConsentWatchOptions {
  intervalMs?: number;
  limitMs?: number;
}

type TakeoverRoot = Pick<Element, "setAttribute" | "removeAttribute" | "hasAttribute">;
type ConsentDocument = Pick<Document, "querySelector"> & { documentElement?: TakeoverRoot };

function browserDocument(): Document | null {
  return typeof document === "undefined" ? null : document;
}

/** The Zaraz consent object, once it can record a choice. Absent without the tag manager. */
export function getConsentApi(): ZarazConsentApi | undefined {
  if (typeof window === "undefined") return undefined;
  const api = window.zaraz?.consent;
  return api && typeof api.setAll === "function" ? api : undefined;
}

/**
 * True when the tag manager is on the page. Its loader runs inline in `<head>`, before the app starts, so at the
 * app's first effect an absent `window.zaraz` means there is nothing to take over.
 */
export function hasConsentManager(): boolean {
  return typeof window !== "undefined" && window.zaraz !== undefined;
}

/** Marks `<html>` so the stylesheet hides the zone's default modal while the site banner asks. */
export function setConsentTakeover(active: boolean, root: TakeoverRoot | null | undefined = browserDocument()?.documentElement): void {
  if (!root) return;
  if (active) root.setAttribute(CONSENT_TAKEOVER_ATTRIBUTE, "");
  else root.removeAttribute(CONSENT_TAKEOVER_ATTRIBUTE);
}

/** Zaraz's modal setter throws when an already closed modal is set to false (live finding, 2026-10-01). */
export function closeDefaultModal(api: ZarazConsentApi): void {
  if (api.modal === true) api.modal = false;
}

/**
 * Relays the visitor's choice. Callers hide the banner before calling this, so an error thrown
 * by Zaraz while relaying can never leave the banner on screen.
 */
export function submitConsentChoice(api: ZarazConsentApi, allow: boolean): void {
  closeDefaultModal(api);
  api.setAll(allow);
  if (allow) api.sendQueuedEvents?.();
}

/**
 * Calls back once the Zaraz consent API is usable: right away when it already is, otherwise
 * on the `zarazConsentAPIReady` document event. Returns a function that cancels the wait.
 */
export function whenConsentApiReady(callback: (api: ZarazConsentApi) => void): () => void {
  const api = getConsentApi();
  if (api?.APIReady) {
    callback(api);
    return () => undefined;
  }
  const doc = browserDocument();
  if (!doc) return () => undefined;
  const onReady = () => {
    const readyApi = getConsentApi();
    if (readyApi) callback(readyApi);
  };
  doc.addEventListener(CONSENT_READY_EVENT, onReady, { once: true });
  return () => doc.removeEventListener(CONSENT_READY_EVENT, onReady);
}

/**
 * Watches for Zaraz opening its default modal, which only happens for an undecided visitor.
 * The modal is closed and `onUndecided` lets the site banner ask instead. After the watch
 * window the takeover is lifted unless the banner took over, so a visitor who had already
 * decided never has the default modal blocked. Returns a function that stops watching.
 */
export function watchDefaultModal(
  api: ZarazConsentApi,
  onUndecided: () => void,
  { intervalMs = CONSENT_WATCH_INTERVAL_MS, limitMs = CONSENT_WATCH_LIMIT_MS }: ConsentWatchOptions = {},
): () => void {
  setConsentTakeover(true);
  // The window is counted in ticks, not wall-clock time: a clock adjustment must not cut it short.
  const lastTick = Math.ceil(limitMs / intervalMs);
  let ticks = 0, tookOver = false;
  const timer = window.setInterval(() => {
    if (api.modal === true) {
      closeDefaultModal(api);
      tookOver = true;
      onUndecided();
    }
    if (++ticks < lastTick) return;
    window.clearInterval(timer);
    if (!tookOver) setConsentTakeover(false);
  }, intervalMs);
  return () => window.clearInterval(timer);
}

/**
 * True while the site is asking the consent question: the banner is on screen, or the takeover
 * watch is still deciding whether it must ask. Other first-screen offers wait their turn.
 */
export function isSiteConsentOpen(root: ConsentDocument | null = browserDocument()): boolean {
  if (!root) return false;
  try {
    return Boolean(root.documentElement?.hasAttribute(CONSENT_TAKEOVER_ATTRIBUTE) || root.querySelector(`[${CONSENT_BANNER_ATTRIBUTE}]`));
  } catch {
    return false;
  }
}

/**
 * True while the tag manager's own modal is on screen (shadow DOM `dialog[open]`). Only the
 * open state is read, never the decision. A fallback for the rare case where the modal appears
 * outside the takeover window.
 */
export function isConsentModalOpen(root: Pick<Document, "querySelector"> | null = browserDocument()): boolean {
  if (!root) return false;
  try {
    const host = root.querySelector(".cf_modal_container");
    return Boolean(host?.shadowRoot?.querySelector("dialog[open]") ?? host?.querySelector("dialog[open]"));
  } catch {
    return false;
  }
}

/** "분석 동의 다시 보기" (footer and privacy page): the only path to change or withdraw the choice. */
export function openConsentSettings(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(OPEN_CONSENT_EVENT));
}
