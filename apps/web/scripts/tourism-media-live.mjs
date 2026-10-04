// Read-only live verification of an actual official record. No routes, mocks, synthetic images or API writes.
// Run against local OR published server with real source access; each report records its target origin.
// E2E_BASE_URL=http://127.0.0.1:3100 node scripts/tourism-media-live.mjs
// Optional LIVE_EXISTING_PATH=/existing/current%3A51150%3A<verified-festival-id>/resources?types=12
// adds the existing-festival journey for the same Gangneung resource. Never infer a festival identifier.
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { chromium } from "playwright";

const base = process.env.E2E_BASE_URL ?? process.env.BASE_URL;
if (!base) throw Error("E2E_BASE_URL (or BASE_URL) required");
const origin = new URL(base).origin;
const output = resolve(process.env.MEDIA_LIVE_OUTPUT_DIR ?? "output/playwright/tourism-media-live");
mkdirSync(output, { recursive: true });
const ID = "2775508", TITLE = "순포습지", PROVINCE = "51", DISTRICT = "150", CODE = "51150";
// The image endpoint has seven additional photos; the verified common representative is an eighth distinct URL.
const expectedCount = Number(process.env.LIVE_EXPECTED_GALLERY_COUNT ?? 8);
assert.ok(Number.isSafeInteger(expectedCount) && expectedCount > 1);
const flows = [
  { name: "new", path: `/new/${CODE}/resources?types=12`, heading: "new-resource-detail-heading" },
  { name: "regions", path: `/regions?province=${PROVINCE}&district=${DISTRICT}&start=2026-01-01&end=2026-12-31&kind=12` },
];
if (process.env.LIVE_EXISTING_PATH) {
  const url = new URL(process.env.LIVE_EXISTING_PATH, origin);
  assert.equal(url.origin, origin, "existing sample must stay on the tested application");
  assert.match(url.pathname, /^\/existing\//);
  flows.unshift({ name: "existing", path: `${url.pathname}${url.search}`, heading: "resource-detail-heading" });
}
const report = { checkedAt: new Date().toISOString(), base, origin, headless: true, mockedResponses: 0,
  dataProvenance: "Actual application responses backed by official public tourism data; no API or image interception",
  record: { id: ID, title: TITLE, province: PROVINCE, district: DISTRICT, code: CODE },
  checks: [], samples: [], layouts: [], zoom: [], imageLoads: [], browserErrors: [], appWrites: [] };
// This isolated extension controls REAL Chromium tab zoom. CSS zoom and viewport resizing are not substitutes.
const extension = mkdtempSync(join(tmpdir(), "pickdday-media-zoom-"));
writeFileSync(join(extension, "manifest.json"), JSON.stringify({ manifest_version: 3, name: "Tourism media zoom verification", version: "1.0",
  permissions: ["tabs"], background: { service_worker: "background.js" } }));
writeFileSync(join(extension, "background.js"), "chrome.runtime.onInstalled.addListener(() => {});\n");
const context = await chromium.launchPersistentContext("", { channel: "chromium", headless: true,
  viewport: { width: 1440, height: 1000 }, locale: "ko-KR", args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`] });
async function getJson(path) {
  const response = await context.request.get(`${base}${path}`, { timeout: 90000 });
  assert.equal(response.status(), 200, `live ${path}: HTTP 200`);
  return response.json();
}
function validPhoto(photo) {
  assert.ok(photo && photo.url && ["Type1", "Type3"].includes(photo.license), "photo has a supported explicit license");
  const url = new URL(photo.url);
  assert.equal(url.protocol, "https:"); assert.equal(url.hostname, "tong.visitkorea.or.kr");
  assert.match(url.pathname, /^\/cms\/resource\//);
  assert.ok(photo.sourceUrl && /^https:\/\//.test(photo.sourceUrl), "photo has an attribution source");
}
async function loaded(locator, label) {
  await locator.waitFor({ state: "visible" });
  await locator.evaluate(img => new Promise((resolve, reject) => {
    if (img.complete && img.naturalWidth > 0) return resolve();
    const timer = setTimeout(() => reject(Error(`Live image did not load: ${img.currentSrc}`)), 45000);
    img.addEventListener("load", () => { clearTimeout(timer); img.naturalWidth > 0 ? resolve() : reject(Error("Zero-width live image")); }, { once: true });
    img.addEventListener("error", () => { clearTimeout(timer); reject(Error("Live image request failed")); }, { once: true });
  }));
  const image = await locator.evaluate(img => ({ src: img.currentSrc, naturalWidth: img.naturalWidth, naturalHeight: img.naturalHeight,
    width: img.getBoundingClientRect().width, height: img.getBoundingClientRect().height, objectFit: getComputedStyle(img).objectFit }));
  report.imageLoads.push({ label, ...image });
  return image;
}
async function fullPageShot(page, name) {
  // A full-page capture starts at the document top so the sticky header stays at the top of the delivered image.
  await page.evaluate(() => { window.scrollTo(0, 0); return new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))); });
  await page.screenshot({ path: join(output, `${name}.png`), fullPage: true });
}
try {
  const worker = context.serviceWorkers()[0] ?? await context.waitForEvent("serviceworker");
  const listData = await getJson(`/api/existing/resources?province=${PROVINCE}&district=${DISTRICT}&types=12`);
  assert.equal(listData.region.code, CODE);
  const block = listData.byType.find(value => value.kind === "12");
  assert.equal(block?.status, "complete"); assert.equal(block.total, block.items.length);
  const resource = block.items.find(item => item.id === ID);
  assert.ok(resource, "actual Gangneung list includes 순포습지 2775508");
  assert.equal(resource.title, TITLE); validPhoto(resource.photo);
  report.list = { status: block.status, count: block.total, photo: resource.photo, collectedAt: block.collectedAt };
  const detailData = await getJson(`/api/resources/detail?province=${PROVINCE}&district=${DISTRICT}&kind=12&id=${ID}`);
  assert.equal(detailData.status, "complete"); assert.equal(detailData.region.code, CODE);
  assert.equal(detailData.detail?.id, ID); assert.equal(detailData.detail?.kind, "12");
  const data = detailData.detail;
  assert.equal(data.galleryStatus, "complete"); assert.equal(data.infoStatus, "complete");
  assert.equal(data.photos.length, expectedCount, "real gallery count matches the verified public record");
  for (const photo of data.photos) { validPhoto(photo); assert.equal(photo.license, "Type3", "this actual record carries Type3 photos"); }
  assert.ok(data.overview.trim(), "actual overview is available");
  const hours = data.facts.find(fact => /시간/.test(fact.label));
  const parking = data.facts.find(fact => /주차/.test(fact.label));
  assert.ok(hours?.value && parking?.value, "actual operating hours and parking facts are present");
  report.detail = { status: detailData.status, galleryStatus: data.galleryStatus, infoStatus: data.infoStatus,
    photoCount: data.photos.length, photos: data.photos, facts: data.facts, overviewCharacters: data.overview.length,
    phonePresent: !!data.phone, websitePresent: !!data.website, collectedAt: detailData.source?.collectedAt };
  report.checks.push("actual-Gangneung-record-identity-licensed-gallery-hours-and-parking");

  const page = await context.newPage(); page.setDefaultTimeout(45000);
  page.on("pageerror", error => report.browserErrors.push(error.message));
  page.on("request", request => { const url = new URL(request.url()); if (url.origin === origin && url.pathname.startsWith("/api/") && request.method() !== "GET") report.appWrites.push(`${request.method()} ${url.pathname}`); });
  // The site consent banner (lib/analytics/consent.ts) is declined whenever it shows.
  await page.addLocatorHandler(page.locator("[data-consent-banner]").getByRole("button", { name: "거부", exact: true }), button => button.click());
  for (const flow of flows) {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(`${base}${flow.path}`);
    const list = flow.name === "regions" ? page.getByRole("region", { name: "조회 자료 목록", exact: true }) : page.getByRole("list", { name: "관광자원 목록", exact: true });
    const row = list.locator(`[data-resource-id="${ID}"]`);
    await row.waitFor(); await row.scrollIntoViewIfNeeded();
    await loaded(row.locator("img"), `${flow.name}: actual list representative photo`);
    await row.click();
    const detail = flow.name === "regions" ? page.getByRole("region", { name: "자료 상세와 근거 담기", exact: true }) : page.getByRole("complementary", { name: TITLE, exact: true });
    await detail.getByRole("heading", { name: TITLE, exact: true }).waitFor();
    if (flow.heading) await page.waitForFunction(id => document.activeElement?.id === id, flow.heading);
    const gallery = detail.locator("[data-resource-gallery]"), main = gallery.locator("img[data-resource-photo]");
    await gallery.getByRole("link", { name: "공공누리 제3유형", exact: true }).waitFor();
    await detail.getByText(hours.value, { exact: true }).waitFor();
    await detail.getByText(parking.value, { exact: true }).waitFor();
    // Every actual gallery photo is loaded once in the first flow. Later flows verify the same URLs and navigation.
    const count = flow === flows[0] ? data.photos.length : Math.min(2, data.photos.length);
    const displayed = [];
    for (let index = 0; index < count; index++) {
      const image = await loaded(main, `${flow.name}: actual detail photo ${index + 1}`);
      assert.equal(image.objectFit, "contain", "Type3 full frame stays visible");
      assert.ok(data.photos.some(photo => photo.url === image.src), "rendered photo belongs to this actual resource");
      assert.ok(!displayed.includes(image.src), "next reveals another actual photo"); displayed.push(image.src);
      if (index + 1 < count) await gallery.getByRole("button", { name: `${TITLE} 다음 사진`, exact: true }).click();
    }
    await gallery.getByRole("button", { name: `${TITLE} 사진 1 보기`, exact: true }).click();
    await loaded(main, `${flow.name}: representative restored`);
    for (const width of [390, 1440, 1920]) {
      await page.setViewportSize({ width, height: width === 390 ? 900 : 1000 });
      await detail.scrollIntoViewIfNeeded();
      const metrics = await page.evaluate(() => ({ viewport: innerWidth, scroll: document.documentElement.scrollWidth }));
      assert.ok(metrics.scroll <= metrics.viewport + 1, `${flow.name} ${width}: no horizontal page overflow`);
      report.layouts.push({ flow: flow.name, width, ...metrics });
      await fullPageShot(page, `${flow.name}-sunpo-wetland-${width}`);
      if (width === 1920 && flow.name !== "regions") {
        const info = detail.getByRole("region", { name: `${TITLE} 이용정보`, exact: true });
        await info.scrollIntoViewIfNeeded();
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        await info.screenshot({ path: join(output, `${flow.name}-sunpo-wetland-info-1920.png`) });
      }
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    const tab = (await worker.evaluate(() => chrome.tabs.query({}))).find(tab => tab.url?.startsWith(origin));
    assert.ok(tab, "isolated application tab for actual browser zoom");
    await worker.evaluate(id => chrome.tabs.setZoom(id, 2), tab.id);
    await page.waitForFunction(() => innerWidth === 720);
    const zoomFactor = await worker.evaluate(id => chrome.tabs.getZoom(id), tab.id);
    const zoomMetrics = await page.evaluate(() => ({ innerWidth, devicePixelRatio, cssZoom: getComputedStyle(document.documentElement).zoom,
      scrollWidth: document.documentElement.scrollWidth }));
    assert.equal(zoomFactor, 2); assert.equal(zoomMetrics.cssZoom, "1");
    assert.ok(zoomMetrics.scrollWidth <= zoomMetrics.innerWidth + 1, `${flow.name}: no horizontal overflow at real 200% tab zoom`);
    for (const fact of [hours, parking]) { const text = detail.getByText(fact.value, { exact: true }); await text.scrollIntoViewIfNeeded(); await text.waitFor({ state: "visible" }); }
    await main.scrollIntoViewIfNeeded();
    await loaded(main, `${flow.name}: real 200% visible photo`);
    const beforeZoomNavigation = await main.getAttribute("src");
    await gallery.getByRole("button", { name: `${TITLE} 다음 사진`, exact: true }).click();
    await main.scrollIntoViewIfNeeded();
    const zoomImage = await loaded(main, `${flow.name}: real 200% photo navigation`);
    assert.notEqual(zoomImage.src, beforeZoomNavigation, "gallery remains operable at real 200% tab zoom");
    report.zoom.push({ flow: flow.name, factor: zoomFactor, ...zoomMetrics });
    // Native tab zoom and Playwright fullPage clipping use different coordinate spaces. Capture the real viewport.
    const cdp = await context.newCDPSession(page);
    try {
      const capture = await cdp.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
      writeFileSync(join(output, `${flow.name}-sunpo-wetland-real-zoom-200.png`), Buffer.from(capture.data, "base64"));
    } finally { await cdp.detach(); }
    await worker.evaluate(id => chrome.tabs.setZoom(id, 1), tab.id);
    await page.waitForFunction(() => innerWidth === 1440);
    assert.equal(await row.getAttribute("aria-pressed"), "true", "photo navigation preserves actual resource selection");
    report.samples.push({ flow: flow.name, path: flow.path, title: TITLE, id: ID, displayedPhotoUrls: displayed });
    report.checks.push(`${flow.name}: real-list-image-detail-gallery-facts-and-390-1440-1920-reflow`,
      `${flow.name}: real-200-percent-tab-zoom-photo-facts-navigation-no-overflow`);
  }
  assert.deepEqual(report.browserErrors, []); assert.deepEqual(report.appWrites, []);
  report.status = "passed";
} catch (error) { report.status = "failed"; report.error = String(error.stack ?? error); throw error; }
finally { await context.close(); rmSync(extension, { recursive: true, force: true }); writeFileSync(join(output, "report.json"), `${JSON.stringify(report, null, 2)}\n`); console.log(JSON.stringify(report)); }
