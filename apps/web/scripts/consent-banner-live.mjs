// Public check of the analytics consent banner with the real Cloudflare Zaraz. Never intercepts responses.
// BASE_URL=https://pickday.damecasol.com node scripts/consent-banner-live.mjs
// Records whether the zone's default modal was ever visible, that the site banner asked instead, that 거부
// closes it and Zaraz keeps the choice (cookie names only), and that a reload asks nothing again.
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { chromium } from "playwright";

const base = process.env.BASE_URL ?? "https://pickday.damecasol.com";
const output = resolve(process.env.CONSENT_OUTPUT_DIR ?? "output/playwright/consent-banner-public");
mkdirSync(output, { recursive: true });
const report = { checkedAt: new Date().toISOString(), base, headless: true, interceptedResponses: 0, checks: [], browserErrors: [] };
const check = (name, detail = {}) => { report.checks.push({ name, ...detail }); console.log(`ok - ${name}`); };
const browser = await chromium.launch({ headless: true });
const banner = (page) => page.locator("[data-consent-banner]");
const offer = (page) => page.getByRole("complementary", { name: "pickDday가 처음이신가요?" });

// Samples the real default modal (shadow `dialog`) every 50 ms from inside the page; the host itself has no height.
const sampler = `window.__consentSamples = { visible: 0, total: 0, bannerAt: null, start: performance.now() };
  setInterval(() => {
    const s = window.__consentSamples; s.total += 1;
    const host = document.querySelector(".cf_modal_container");
    const dialog = host?.shadowRoot?.querySelector("dialog");
    const r = dialog?.getBoundingClientRect();
    if (r && r.width > 0 && r.height > 0 && getComputedStyle(host).display !== "none") s.visible += 1;
    if (s.bannerAt === null && document.querySelector("[data-consent-banner]")) s.bannerAt = Math.round(performance.now() - s.start);
  }, 50);`;

try {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport, locale: "ko-KR" });
    await context.addInitScript(sampler);
    const page = await context.newPage();
    page.on("pageerror", (error) => report.browserErrors.push(String(error)));
    page.on("console", (message) => { if (message.type() === "error" && /Content Security Policy/i.test(message.text())) report.browserErrors.push(message.text()); });
    await page.goto(base, { waitUntil: "networkidle" });
    await banner(page).waitFor({ state: "visible", timeout: 15000 });
    await page.waitForTimeout(4000);
    const samples = await page.evaluate(() => window.__consentSamples);
    assert.equal(samples.visible, 0, "the default modal must never be visible");
    assert.equal(await offer(page).count(), 0, "the intro offer waits for the banner");
    const consentApi = await page.evaluate(() => ({ ready: window.zaraz?.consent?.APIReady === true, modal: window.zaraz?.consent?.modal }));
    assert.equal(consentApi.ready, true);
    assert.equal(consentApi.modal, false, "the default modal flag is closed while the banner asks");
    await page.screenshot({ path: join(output, `first-visit-${viewport.width}.png`) });
    const before = (await context.cookies()).map((cookie) => cookie.name);
    await banner(page).getByRole("button", { name: "거부" }).click();
    await banner(page).waitFor({ state: "hidden" });
    await page.waitForTimeout(500);
    const after = (await context.cookies()).map((cookie) => cookie.name);
    assert.ok(after.includes("zaraz-consent"), `Zaraz must keep the choice (cookies: ${after.join(", ")})`);
    assert.equal(await page.evaluate(() => document.documentElement.hasAttribute("data-consent-takeover")), false);
    await offer(page).waitFor({ state: "visible", timeout: 6000 });
    await page.screenshot({ path: join(output, `after-deny-${viewport.width}.png`) });
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForTimeout(8000);
    const reloaded = await page.evaluate(() => window.__consentSamples);
    assert.equal(reloaded.visible, 0, "no default modal after the choice");
    assert.equal(await banner(page).count(), 0, "no banner after the choice");
    await page.locator("footer").getByRole("button", { name: "분석 동의 다시 보기" }).click();
    await banner(page).waitFor({ state: "visible" });
    assert.match(await banner(page).textContent(), /방문 분석을 허용하시겠어요\?/);
    check(`real Zaraz at ${viewport.width}px: default modal never visible, banner asks, 거부 is kept, reload asks nothing, footer reopens`, {
      bannerAfterMs: samples.bannerAt, samplesWhileWaiting: samples.total, cookiesBefore: before, cookiesAfter: after,
    });
    await context.close();
  }
  assert.deepEqual(report.browserErrors, []);
} finally {
  writeFileSync(join(output, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
  await browser.close();
}
