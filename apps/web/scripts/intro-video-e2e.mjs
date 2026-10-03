// Home introduction video: first-visit offer, return visits, player, shared link and consent ordering.
// Run against an already started app: E2E_BASE_URL=http://127.0.0.1:3100 node scripts/intro-video-e2e.mjs
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { chromium } from "playwright";

const base = process.env.E2E_BASE_URL ?? process.env.BASE_URL;
if (!base) throw Error("E2E_BASE_URL (or BASE_URL) required");
const output = resolve(process.env.INTRO_OUTPUT_DIR ?? "output/playwright/intro-video");
mkdirSync(output, { recursive: true });
const KEY = "fest-compass.intro-video.v1";
const report = { checkedAt: new Date().toISOString(), base, headless: true, checks: [], layouts: [], browserErrors: [] };
const check = (name, detail = {}) => { report.checks.push({ name, ...detail }); console.log(`ok - ${name}`); };

const browser = await chromium.launch({ headless: true });
async function fresh(viewport = { width: 1440, height: 900 }, init) {
  const context = await browser.newContext({ viewport, locale: "ko-KR" });
  if (init) await context.addInitScript(init);
  const page = await context.newPage();
  page.on("pageerror", (error) => report.browserErrors.push(String(error)));
  return { context, page };
}
const offer = (page) => page.getByRole("complementary", { name: "pickDday가 처음이신가요?" });
const trigger = (page) => page.getByRole("button", { name: /1분 소개 영상/ });
const dialog = (page) => page.getByRole("dialog", { name: /pickDday 1분 소개/ });
const stored = (page) => page.evaluate((key) => localStorage.getItem(key), KEY);

try {
  // 1. Media is served for streaming.
  {
    const range = await fetch(new URL("/media/intro/pickdday-intro.mp4", base), { headers: { Range: "bytes=0-1023" } });
    assert.equal(range.status, 206);
    assert.match(range.headers.get("content-type") ?? "", /video\/mp4/);
    const vtt = await fetch(new URL("/media/intro/pickdday-intro.ko.vtt", base));
    assert.equal(vtt.status, 200);
    assert.ok((await vtt.text()).startsWith("WEBVTT"));
    check("video answers range requests and captions are served", { videoStatus: range.status, videoType: range.headers.get("content-type"), vttType: vtt.headers.get("content-type") });
  }

  // 2. First visit: entry point at once, offer later, nothing steals focus, the video is not downloaded yet.
  {
    const { context, page } = await fresh();
    const videoRequests = [];
    page.on("request", (request) => { if (request.url().includes("pickdday-intro.mp4")) videoRequests.push(request.url()); });
    await page.goto(base, { waitUntil: "networkidle" });
    await assert.doesNotReject(trigger(page).waitFor({ state: "visible", timeout: 2000 }));
    await offer(page).waitFor({ state: "visible", timeout: 8000 });
    await page.waitForTimeout(500);
    const focused = await page.evaluate(() => document.activeElement?.tagName);
    assert.notEqual(focused, "BUTTON", "the offer must not move focus");
    assert.equal(videoRequests.length, 0, "the video must not load before playback");
    assert.equal(await stored(page), null);
    await page.screenshot({ path: join(output, "first-visit-1440.png") });
    check("first visit shows the entry point and a non-blocking offer without loading the video", { focused, videoRequests: videoRequests.length });

    // Closing remembers the choice; a reload shows only the permanent entry point.
    await offer(page).getByRole("button", { name: "닫기" }).click();
    await offer(page).waitFor({ state: "hidden" });
    assert.equal(await stored(page), "dismissed");
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForTimeout(3000);
    assert.equal(await offer(page).count(), 0);
    await trigger(page).waitFor({ state: "visible" });
    check("dismissing hides the offer on return visits and keeps the entry point");
    await context.close();
  }

  // 3. Playing from the offer opens an accessible player; Escape closes it and focus returns.
  {
    const { context, page } = await fresh();
    await page.goto(base, { waitUntil: "networkidle" });
    await offer(page).getByRole("button", { name: /영상 보기/ }).click();
    await dialog(page).waitFor({ state: "visible" });
    assert.equal(await stored(page), "played");
    const media = await page.evaluate(() => {
      const video = document.querySelector("dialog video");
      const track = video?.querySelector("track");
      return { src: video?.querySelector("source")?.getAttribute("src"), controls: video?.controls, track: track?.getAttribute("srclang"), isDefault: track?.default, poster: video?.getAttribute("poster") };
    });
    assert.deepEqual([media.src, media.controls, media.track, media.isDefault], ["/media/intro/pickdday-intro.mp4", true, "ko", true]);
    assert.equal(await offer(page).count(), 0);
    await page.getByText("영상 내용 글로 보기").click();
    assert.ok(await page.getByText("감이 아닌 근거로, 축제의 날을 고르다. pickDday.").isVisible());
    await page.screenshot({ path: join(output, "player-1440.png") });
    await page.keyboard.press("Escape");
    await dialog(page).waitFor({ state: "hidden" });
    const paused = await page.evaluate(() => document.querySelector("dialog video")?.paused);
    const returned = await page.evaluate(() => document.activeElement?.textContent ?? "");
    assert.equal(paused, true);
    assert.match(returned, /1분 소개 영상/);
    check("player opens with captions and transcript, Escape pauses and returns focus", media);

    // The end screen leads straight into the two journeys.
    await trigger(page).click();
    await dialog(page).waitFor({ state: "visible" });
    // Play through the real end of the file rather than faking the event.
    await page.waitForFunction(() => { const v = document.querySelector("dialog video"); return v && !v.paused && v.readyState >= 1 && Number.isFinite(v.duration); });
    await page.evaluate(() => { const v = document.querySelector("dialog video"); v.muted = true; v.currentTime = v.duration - 0.4; });
    await dialog(page).getByRole("link", { name: "기존 축제 찾기 →" }).click();
    await page.waitForURL(/\/existing\/search$/);
    check("end screen links to the existing-festival journey");
    await context.close();
  }

  // 4. A shared link opens the player directly, also for return visitors, and cleans the address.
  {
    const { context, page } = await fresh(undefined, `localStorage.setItem(${JSON.stringify(KEY)}, "dismissed")`);
    await page.goto(new URL("/?intro=play&utm_source=qr", base).href, { waitUntil: "networkidle" });
    await dialog(page).waitFor({ state: "visible" });
    assert.equal(new URL(page.url()).search, "?utm_source=qr");
    check("intro=play opens the player and leaves other query values", { url: page.url() });
    await context.close();
  }

  // 5. The offer waits while the consent modal is open.
  {
    const consent = `
      // Like the real tag manager, the modal arrives a moment after the page has loaded.
      window.addEventListener("DOMContentLoaded", () => setTimeout(() => {
        const host = document.createElement("div");
        host.className = "cf_modal_container";
        host.attachShadow({ mode: "open" }).innerHTML = "<dialog open>consent</dialog>";
        document.body.appendChild(host);
        window.__closeConsent = () => host.remove();
      }, 1000));`;
    const { context, page } = await fresh(undefined, consent);
    await page.goto(base, { waitUntil: "networkidle" });
    await page.waitForTimeout(4000);
    assert.equal(await offer(page).count(), 0, "offer must wait for the consent modal");
    await page.evaluate(() => window.__closeConsent());
    await offer(page).waitFor({ state: "visible", timeout: 8000 });
    check("offer waits for a late consent modal and appears only after it closes");
    await context.close();
  }

  // 6. Layout: no horizontal overflow, offer and player fit narrow and wide screens.
  for (const viewport of [{ width: 390, height: 844 }, { width: 1920, height: 1080 }]) {
    const { context, page } = await fresh(viewport);
    await page.goto(base, { waitUntil: "networkidle" });
    await offer(page).waitFor({ state: "visible", timeout: 8000 });
    await page.waitForTimeout(500);
    const card = await offer(page).boundingBox();
    // On phones the offer is one compact row and must stay out of most of the first screen.
    if (viewport.width < 640) assert.ok(card && card.height <= 80, `compact offer height ${card?.height}`);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert.equal(overflow, 0);
    assert.ok(card && card.x >= 0 && card.x + card.width <= viewport.width);
    await page.screenshot({ path: join(output, `first-visit-${viewport.width}.png`) });
    await offer(page).getByRole("button", { name: /영상 보기/ }).click();
    const box = await dialog(page).boundingBox();
    assert.ok(box && box.x >= 0 && box.x + box.width <= viewport.width);
    await page.screenshot({ path: join(output, `player-${viewport.width}.png`) });
    report.layouts.push({ viewport, overflow, card, dialog: box });
    check(`layout fits at ${viewport.width}px`);
    await context.close();
  }

  assert.deepEqual(report.browserErrors, []);
} finally {
  writeFileSync(join(output, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
  await browser.close();
}
