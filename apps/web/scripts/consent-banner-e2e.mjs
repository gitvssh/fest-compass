// Analytics consent banner: takeover of the zone's default modal, the choice relay, reopening,
// the no-analytics case, and its ordering with the first-visit intro offer.
// Run against an already started app: E2E_BASE_URL=http://127.0.0.1:3100 node scripts/consent-banner-e2e.mjs
// Optional: CONSENT_AXE_SOURCE=/path/to/axe.min.js runs axe-core on the home page with the banner open.
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { chromium } from "playwright";

const base = process.env.E2E_BASE_URL ?? process.env.BASE_URL;
if (!base) throw Error("E2E_BASE_URL (or BASE_URL) required");
const output = resolve(process.env.CONSENT_OUTPUT_DIR ?? "output/playwright/consent-banner");
mkdirSync(output, { recursive: true });
const axeSource = process.env.CONSENT_AXE_SOURCE && existsSync(process.env.CONSENT_AXE_SOURCE) ? readFileSync(process.env.CONSENT_AXE_SOURCE, "utf8") : null;
const report = { checkedAt: new Date().toISOString(), base, headless: true, checks: [], layouts: [], axe: null, browserErrors: [], cspViolations: [] };
const check = (name, detail = {}) => { report.checks.push({ name, ...detail }); console.log(`ok - ${name}`); };

/**
 * Stands in for Cloudflare Zaraz as observed on pickday.damecasol.com (2026-10-04) and petrip
 * (2026-10-01): `zaraz.consent` appears with the `zarazConsentAPIReady` event, the default
 * modal (`.cf_modal_container` host with a shadow `dialog[open]`) opens for an undecided
 * visitor, `modal = false` on a closed modal throws, and the choice goes through `setAll`.
 * A choice is remembered with a cookie so a reload behaves like a decided visitor.
 */
const zarazStub = ({ readyAfterMs = 300, modalAfterMs = 1500 } = {}) => `(() => {
  const log = { setAll: [], sendQueuedEvents: 0, modalWrites: [], modalVisibleSamples: 0, modalOpenedAt: null, readyAt: null };
  let open = false, host = null;
  const render = () => {
    if (open && !host) {
      host = document.createElement("div");
      host.className = "cf_modal_container";
      host.attachShadow({ mode: "open" }).innerHTML = '<style>:host{position:fixed;inset:0;z-index:2147483647;display:grid;place-items:center;background:#00000061}dialog{position:static;width:480px;padding:24px;border:0;border-radius:6px;background:#fff;color:#000}</style>'
        + '<dialog class="cf_modal" open><h2>쿠키 설정</h2><p>analytics</p><button type="button" class="cf_button cf_button--accept">모두 수락</button></dialog>';
      document.body.appendChild(host);
      log.modalOpenedAt = performance.now();
    } else if (!open && host) { host.remove(); host = null; }
  };
  const consent = {
    get modal() { return open; },
    set modal(value) {
      if (!value && !open) throw new Error("Zaraz: the consent modal is not open");
      log.modalWrites.push(Boolean(value)); open = Boolean(value); render();
    },
    setAll(status) { log.setAll.push(status); document.cookie = "zaraz-consent=stub; path=/"; },
    sendQueuedEvents() { log.sendQueuedEvents += 1; },
    get() { return undefined; }, getAll() { return {}; }, set() {},
  };
  Object.defineProperty(consent, "APIReady", { value: false, writable: true, enumerable: false });
  window.zaraz = { track() {}, consent, showConsentModal() { open = true; render(); }, hideConsentModal() { open = false; render(); } };
  window.__zaraz = log;
  window.setInterval(() => {
    const dialog = host?.shadowRoot?.querySelector("dialog");
    const rect = dialog?.getBoundingClientRect();
    if (rect && rect.width > 0 && rect.height > 0 && getComputedStyle(host).display !== "none") log.modalVisibleSamples += 1;
  }, 50);
  window.addEventListener("DOMContentLoaded", () => setTimeout(() => {
    consent.APIReady = true;
    log.readyAt = performance.now();
    document.dispatchEvent(new Event("zarazConsentAPIReady"));
    if (!document.cookie.includes("zaraz-consent=")) setTimeout(() => { open = true; render(); }, ${modalAfterMs});
  }, ${readyAfterMs}));
})();`;

const browser = await chromium.launch({ headless: true });
async function fresh(viewport = { width: 1440, height: 900 }, init) {
  const context = await browser.newContext({ viewport, locale: "ko-KR" });
  if (init) await context.addInitScript(init);
  const page = await context.newPage();
  page.on("pageerror", (error) => report.browserErrors.push(String(error)));
  page.on("console", (message) => { if (/Content[- ]Security[- ]Policy/i.test(message.text())) report.cspViolations.push(message.text()); });
  return { context, page };
}
const banner = (page) => page.locator("[data-consent-banner]");
const offer = (page) => page.getByRole("complementary", { name: "pickDday가 처음이신가요?" });
const footerReopen = (page) => page.locator("footer").getByRole("button", { name: "분석 동의 다시 보기" });
const zarazLog = (page) => page.evaluate(() => window.__zaraz);
const takeover = (page) => page.evaluate(() => document.documentElement.hasAttribute("data-consent-takeover"));
const headingTop = (page) => page.evaluate(() => document.getElementById("purpose-heading")?.getBoundingClientRect().top);
const overflow = (page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
const inViewport = (box, viewport) => box && box.x >= 0 && box.y >= 0 && box.x + box.width <= viewport.width + 0.5 && box.y + box.height <= viewport.height + 0.5;

async function expectNoOfferWhileAsking(page, ms = 1500) {
  await page.waitForTimeout(ms);
  assert.equal(await offer(page).count(), 0, "the intro offer must wait while the consent question is on screen");
}

/**
 * The offer follows the banner by the quiet period: 2 s after the last 500 ms poll tick that saw the
 * banner, so 1.5–2.5 s after the actual close. Never sooner, never much later.
 */
async function expectOfferAfterQuiet(page, closedAt) {
  await offer(page).waitFor({ state: "visible", timeout: 6000 });
  const elapsed = Date.now() - closedAt;
  assert.ok(elapsed >= 1400 && elapsed <= 4500, `offer appeared ${elapsed}ms after the banner closed`);
  assert.equal(await banner(page).count(), 0);
  return elapsed;
}

try {
  // 1. First visit on a PC: the default modal is never seen, the site banner asks, nothing is blocked or moved.
  {
    const viewport = { width: 1440, height: 900 };
    const { context, page } = await fresh(viewport, zarazStub());
    await page.goto(base, { waitUntil: "networkidle" });
    const topBefore = await headingTop(page);
    await banner(page).waitFor({ state: "visible", timeout: 8000 });
    const log = await zarazLog(page);
    assert.equal(log.modalVisibleSamples, 0, "the default modal must never be visible");
    assert.deepEqual(log.modalWrites, [false], "the opened default modal is closed once");
    assert.equal(await takeover(page), true);
    assert.equal(await page.evaluate(() => document.activeElement?.tagName), "BODY", "the first-visit banner must not move focus");
    assert.equal(await headingTop(page), topBefore, "the banner must not shift the page");
    const text = await banner(page).textContent();
    assert.match(text, /방문 분석을 허용하시겠어요\?/);
    assert.match(text, /축제 이름·입력 내용은 보내지 않고/);
    assert.equal(await banner(page).getByRole("link", { name: "개인정보·분석 안내" }).getAttribute("href"), "/privacy");
    // The page behind stays usable: the first journey link is hit directly, not an overlay.
    const journey = page.getByRole("link", { name: "기존 축제 찾기 →" });
    const hit = await journey.evaluate((link) => { const r = link.getBoundingClientRect(); const el = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return link === el || link.contains(el); });
    assert.equal(hit, true, "nothing may cover the page");
    assert.equal(await page.evaluate(() => Boolean(document.querySelector("dialog[open]"))), false);
    await expectNoOfferWhileAsking(page, 2500);
    const box = await banner(page).boundingBox();
    assert.ok(inViewport(box, viewport));
    assert.equal(await overflow(page), 0);
    report.layouts.push({ viewport, banner: box, offerVisibleWithBanner: false });
    await page.screenshot({ path: join(output, "first-visit-1440.png") });
    check("first visit: default modal never visible, site banner asks without focus, overlay or layout shift", { modalOpenedAt: log.modalOpenedAt, readyAt: log.readyAt, banner: box });

    // Keyboard: the link and both buttons are reachable in order; 거부 works from the keyboard.
    await banner(page).getByRole("link").focus();
    await page.keyboard.press("Tab");
    assert.equal(await page.evaluate(() => document.activeElement?.textContent), "거부");
    await page.keyboard.press("Tab");
    assert.equal(await page.evaluate(() => document.activeElement?.textContent), "허용");
    await page.keyboard.press("Shift+Tab");
    const closedAt = Date.now();
    await page.keyboard.press("Enter");
    await banner(page).waitFor({ state: "hidden" });
    const afterDeny = await zarazLog(page);
    assert.deepEqual(afterDeny.setAll, [false]);
    assert.equal(afterDeny.sendQueuedEvents, 0);
    assert.deepEqual(afterDeny.modalWrites, [false], "a closed modal is not written again");
    assert.equal(await takeover(page), false);
    assert.equal(afterDeny.modalVisibleSamples, 0);
    const elapsed = await expectOfferAfterQuiet(page, closedAt);
    await page.screenshot({ path: join(output, "after-deny-offer-1440.png") });
    check("거부 closes the banner first, relays setAll(false) only, and the intro offer follows after the quiet period", { offerAfterMs: elapsed });

    // A decided visitor (the stub remembers the choice): no banner, the hide is lifted after the watch window,
    // and the intro offer waits for that window too.
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForTimeout(5000);
    assert.equal(await banner(page).count(), 0);
    assert.equal(await takeover(page), true, "still watching at 5 s");
    assert.equal(await offer(page).count(), 0, "the offer waits while the watch runs");
    await page.waitForFunction(() => !document.documentElement.hasAttribute("data-consent-takeover"), undefined, { timeout: 4000 });
    await offer(page).waitFor({ state: "visible", timeout: 5000 });
    assert.deepEqual((await zarazLog(page)).setAll, []);
    check("a decided visitor sees no banner; the default modal hide is lifted after the watch window and the offer follows");

    // Reopening from the footer: focus moves to the banner, the offer steps aside, 허용 flushes queued events.
    await footerReopen(page).scrollIntoViewIfNeeded();
    await footerReopen(page).click();
    await banner(page).waitFor({ state: "visible" });
    assert.equal(await page.evaluate(() => document.activeElement?.hasAttribute("data-consent-banner")), true, "reopening moves focus to the banner");
    await page.waitForTimeout(700);
    assert.equal(await offer(page).count(), 0, "the offer steps aside while the banner is open");
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: join(output, "reopen-footer-1440.png") });
    const reopenedAt = Date.now();
    await banner(page).getByRole("button", { name: "허용" }).click();
    await banner(page).waitFor({ state: "hidden" });
    const afterAllow = await zarazLog(page);
    assert.deepEqual(afterAllow.setAll, [true]);
    assert.equal(afterAllow.sendQueuedEvents, 1);
    assert.deepEqual(afterAllow.modalWrites, [], "no modal was open, so none is written");
    await expectOfferAfterQuiet(page, reopenedAt);
    check("footer reopen moves focus, hides the offer meanwhile, and 허용 relays setAll(true) plus queued events");
    await context.close();
  }

  // 2. The privacy page explains the banner and reopens it with its own control.
  {
    const { context, page } = await fresh(undefined, zarazStub());
    await page.goto(new URL("/privacy", base).href, { waitUntil: "networkidle" });
    const article = await page.locator("article").textContent();
    assert.match(article, /화면 아래 작은 안내에서/);
    assert.match(article, /분석 동의 다시 보기/);
    assert.doesNotMatch(article, /동의 창을 띄우고/);
    await page.waitForTimeout(2500);
    await banner(page).getByRole("button", { name: "거부" }).click();
    await banner(page).waitFor({ state: "hidden" });
    await page.locator("article").getByRole("button", { name: "분석 동의 다시 보기" }).click();
    await banner(page).waitFor({ state: "visible" });
    assert.equal(await page.evaluate(() => document.activeElement?.hasAttribute("data-consent-banner")), true);
    await page.screenshot({ path: join(output, "reopen-privacy-1440.png") });
    await banner(page).getByRole("button", { name: "허용" }).click();
    assert.deepEqual((await zarazLog(page)).setAll, [false, true]);
    check("the privacy page describes the banner and its control reopens it");
    await context.close();
  }

  // 3. Without the tag manager: no banner, the offer comes as before, and reopening explains that there is nothing to choose.
  {
    const { context, page } = await fresh();
    await page.goto(base, { waitUntil: "networkidle" });
    await page.waitForTimeout(1200);
    assert.equal(await banner(page).count(), 0);
    assert.equal(await takeover(page), false);
    await offer(page).waitFor({ state: "visible", timeout: 4000 });
    await footerReopen(page).click();
    await banner(page).waitFor({ state: "visible" });
    assert.match(await banner(page).textContent(), /이 주소에서는 방문 분석을 쓰지 않아 고를 것이 없습니다/);
    assert.equal(await banner(page).getByRole("button", { name: "허용" }).count(), 0);
    await page.waitForTimeout(700);
    assert.equal(await offer(page).count(), 0, "the offer steps aside for the banner");
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: join(output, "no-zaraz-1440.png") });
    const closedAt = Date.now();
    await banner(page).getByRole("button", { name: "닫기" }).click();
    await banner(page).waitFor({ state: "hidden" });
    await expectOfferAfterQuiet(page, closedAt);
    check("without Zaraz the banner only appears on request, says there is nothing to choose, and closes");
    await context.close();
  }

  // 4. A phone: the modal opens the instant the API is ready (as measured live); the banner fits and the offer waits.
  {
    const viewport = { width: 390, height: 844 };
    const { context, page } = await fresh(viewport, zarazStub({ modalAfterMs: 0 }));
    await page.goto(base, { waitUntil: "networkidle" });
    await banner(page).waitFor({ state: "visible", timeout: 8000 });
    const log = await zarazLog(page);
    assert.equal(log.modalVisibleSamples, 0);
    await expectNoOfferWhileAsking(page, 2500);
    const box = await banner(page).boundingBox();
    assert.ok(inViewport(box, viewport));
    assert.ok(box.height <= 240, `banner height ${box.height}`);
    assert.equal(await overflow(page), 0);
    report.layouts.push({ viewport, banner: box, offerVisibleWithBanner: false });
    await page.screenshot({ path: join(output, "first-visit-390.png") });
    const closedAt = Date.now();
    await banner(page).getByRole("button", { name: "거부" }).click();
    await expectOfferAfterQuiet(page, closedAt);
    const offerBox = await offer(page).boundingBox();
    assert.ok(inViewport(offerBox, viewport));
    await page.screenshot({ path: join(output, "after-deny-offer-390.png") });
    check("phone: banner fits without overflow, the offer waits and follows", { banner: box, offer: offerBox });
    await context.close();
  }

  // 5. Accessibility scan of the home page with the banner open (only when an axe-core source is provided).
  if (axeSource) {
    const { context, page } = await fresh(undefined, zarazStub());
    await page.goto(base, { waitUntil: "networkidle" });
    await banner(page).waitFor({ state: "visible", timeout: 8000 });
    // Colours are measured at rest: the banner's 300 ms fade-in would otherwise blend its text with the background.
    await banner(page).evaluate((element) => Promise.all(element.getAnimations({ subtree: true }).map((animation) => animation.finished)));
    await page.addScriptTag({ content: axeSource });
    const results = await page.evaluate(async () => {
      const run = await window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"] } });
      // A node belongs to this change when it sits inside the banner or is a "분석 동의 다시 보기" control.
      const consentRelated = (node) => {
        const element = node.element ?? document.querySelector(node.target[node.target.length - 1]);
        return Boolean(element?.closest?.("[data-consent-banner]")) || element?.textContent?.trim() === "분석 동의 다시 보기";
      };
      return { version: window.axe.version, violations: run.violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.map((n) => ({ target: n.target.map(String), summary: n.failureSummary, consentRelated: consentRelated(n) })) })) };
    });
    const bannerViolations = results.violations.map((v) => ({ ...v, nodes: v.nodes.filter((n) => n.consentRelated) })).filter((v) => v.nodes.length > 0);
    const otherViolations = results.violations.map((v) => ({ ...v, nodes: v.nodes.filter((n) => !n.consentRelated) })).filter((v) => v.nodes.length > 0);
    report.axe = { version: results.version, bannerViolations, otherViolations };
    assert.deepEqual(bannerViolations, [], "no axe violation may involve the consent banner or its controls");
    check(`axe-core ${results.version}: no violation involves the banner`, { otherViolationIds: otherViolations.map((v) => `${v.id}×${v.nodes.length}`) });
    await context.close();
  } else {
    report.axe = { skipped: "CONSENT_AXE_SOURCE not set" };
  }

  assert.deepEqual(report.cspViolations, []);
  assert.deepEqual(report.browserErrors, []);
} finally {
  writeFileSync(join(output, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
  await browser.close();
}
