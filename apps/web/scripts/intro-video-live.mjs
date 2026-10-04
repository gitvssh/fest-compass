// Public check of the home introduction video with the real Zaraz consent flow (site banner since 2026-10-04). Never intercepts responses.
// BASE_URL=https://pickday.damecasol.com node scripts/intro-video-live.mjs
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { chromium } from "playwright";

const base = process.env.BASE_URL ?? "https://pickday.damecasol.com";
const output = resolve(process.env.INTRO_OUTPUT_DIR ?? "output/playwright/intro-video-public");
mkdirSync(output, { recursive: true });
const report = { checkedAt: new Date().toISOString(), base, headless: true, interceptedResponses: 0, checks: [], browserErrors: [] };
const check = (name, detail = {}) => { report.checks.push({ name, ...detail }); console.log(`ok - ${name}`); };
const browser = await chromium.launch({ headless: true });
const offerName = "pickDday가 처음이신가요?";

try {
  const video = await fetch(new URL("/media/intro/pickdday-intro.mp4", base), { headers: { Range: "bytes=0-1023" } });
  const vtt = await fetch(new URL("/media/intro/pickdday-intro.ko.vtt", base));
  assert.equal(video.status, 206);
  assert.equal(vtt.status, 200);
  check("public media answers range requests and serves captions", { video: video.status, videoType: video.headers.get("content-type"), vtt: vtt.status, vttType: vtt.headers.get("content-type") });

  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport, locale: "ko-KR" });
    const page = await context.newPage();
    page.on("pageerror", (error) => report.browserErrors.push(String(error)));
    page.on("console", (message) => { if (message.type() === "error" && /Content Security Policy|media|video/i.test(message.text())) report.browserErrors.push(message.text()); });
    await page.goto(base, { waitUntil: "networkidle" });
    // The site banner asks instead of the zone's default modal (lib/analytics/consent.ts); the offer waits for it.
    const consent = page.locator("[data-consent-banner]").getByRole("button", { name: "거부" });
    await consent.waitFor({ state: "visible", timeout: 15000 });
    await page.waitForTimeout(4000);
    assert.equal(await page.getByRole("complementary", { name: offerName }).count(), 0, "offer waits for the consent banner");
    await consent.click();
    const offer = page.getByRole("complementary", { name: offerName });
    await offer.waitFor({ state: "visible", timeout: 10000 });
    await page.waitForTimeout(500);
    await page.screenshot({ path: join(output, `first-visit-${viewport.width}.png`) });
    await offer.getByRole("button", { name: "영상 보기" }).click();
    const dialog = page.getByRole("dialog", { name: /pickDday 1분 소개/ });
    await dialog.waitFor({ state: "visible" });
    await page.waitForFunction(() => { const v = document.querySelector("dialog video"); return v && v.currentTime > 2; }, undefined, { timeout: 30000 });
    const media = await page.evaluate(() => { const v = document.querySelector("dialog video"); const t = v.textTracks[0]; return { currentTime: v.currentTime, duration: v.duration, width: v.videoWidth, height: v.videoHeight, captions: t?.mode, cues: t?.cues?.length ?? 0 }; });
    assert.ok(media.duration > 60 && media.width === 1920 && media.cues > 0 && media.captions === "showing");
    await page.screenshot({ path: join(output, `player-${viewport.width}.png`) });
    await page.keyboard.press("Escape");
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForTimeout(4000);
    assert.equal(await page.getByRole("complementary", { name: offerName }).count(), 0, "return visit has no offer");
    check(`first visit after real consent, playback with captions and return visit at ${viewport.width}px`, media);
    await context.close();
  }

  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "ko-KR" });
  const page = await context.newPage();
  await page.goto(new URL("/?intro=play", base).href, { waitUntil: "networkidle" });
  await page.getByRole("dialog", { name: /pickDday 1분 소개/ }).waitFor({ state: "visible", timeout: 15000 });
  assert.equal(new URL(page.url()).search, "");
  check("shared intro=play link opens the player on the public site");
  await context.close();
  assert.deepEqual(report.browserErrors, []);
} finally {
  writeFileSync(join(output, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
  await browser.close();
}
