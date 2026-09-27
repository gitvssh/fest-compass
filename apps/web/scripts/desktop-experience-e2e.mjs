// PC research navigation and home hierarchy (design 21). No application/API mocking or writes.
// Run once per server mode with E2E_APP_MODE=public-readonly (default) or editor.
// This isolated headless Chromium extension sets REAL tab zoom; no CSS zoom/device emulation substitute.
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { chromium } from "playwright";

const base = process.env.E2E_BASE_URL;
if (!base) throw Error("E2E_BASE_URL required");
const mode = process.env.E2E_APP_MODE ?? "public-readonly";
assert.ok(["public-readonly", "editor"].includes(mode), "E2E_APP_MODE must match the running server mode");
const output = resolve(process.env.DESKTOP_OUTPUT_DIR ?? `output/playwright/desktop-experience-${mode}`);
mkdirSync(output, { recursive: true });
const extension = mkdtempSync(join(tmpdir(), "pickdday-desktop-zoom-"));
writeFileSync(join(extension, "manifest.json"), JSON.stringify({ manifest_version: 3, name: "Desktop reflow verification", version: "1.0", permissions: ["tabs"], background: { service_worker: "background.js" } }));
writeFileSync(join(extension, "background.js"), "chrome.runtime.onInstalled.addListener(() => {});\n");
const report = { checkedAt: new Date().toISOString(), base, mode, headless: true, mockedResponses: 0, checks: [], layouts: [], zoom: [], browserErrors: [], appWrites: [] };
const PRIMARY = [["기존 축제", "/existing/search"], ["새 축제", "/new"], ["관광지도", "/regions"], ["축제 비교", "/compare"]];
const TOOLS = [["담은 근거", "/evidence"], ["기획 후보", "/planning/options"], ["예산·준비", "/planning/budget"], ["기획안·출력", "/planning/proposal"], ["비용·결과", "/planning/outcomes"], ["내 작업공간", "/workspace"]];
const EDITOR = [["새로 만들기", "/festivals/new"], ["호출 로그", "/logs"]];
const availableTools = [...TOOLS, ...(mode === "editor" ? EDITOR : [])];
const PURPOSES = [["기존 축제 찾기 →", "/existing/search"], ["지역부터 살펴보기 →", "/new"]];
const context = await chromium.launchPersistentContext("", { channel: "chromium", headless: true, viewport: { width: 1440, height: 1000 }, locale: "ko-KR", args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`] });
try {
  const worker = context.serviceWorkers()[0] ?? await context.waitForEvent("serviceworker");
  const page = await context.newPage();
  page.setDefaultTimeout(20000);
  page.on("pageerror", error => report.browserErrors.push(error.message));
  page.on("request", request => {
    const url = new URL(request.url());
    if (url.origin === new URL(base).origin && url.pathname.startsWith("/api/") && request.method() !== "GET") report.appWrites.push(`${request.method()} ${url.pathname}`);
  });
  await page.addLocatorHandler(page.getByRole("button", { name: "모두 거부", exact: true }), button => button.click());
  const header = page.getByRole("banner"), nav = page.getByRole("navigation", { name: "주 메뉴", exact: true });
  const toolsButton = () => page.getByRole("button", { name: "기획 도구", exact: true });
  const menuButton = () => page.getByRole("button", { name: "메뉴", exact: true });
  const purpose = page.locator('section[aria-labelledby="purpose-heading"]');
  const visible = locator => locator.waitFor({ state: "visible" });
  const expanded = async (locator, value) => {
    await page.waitForFunction(([element, value]) => element?.getAttribute("aria-expanded") === String(value), [await locator.elementHandle(), value]);
  };
  const noOverflow = async label => {
    const size = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, viewport: innerWidth }));
    assert.ok(size.scroll <= size.viewport + 1, `${label}: sideways page overflow ${JSON.stringify(size)}`);
  };
  const shot = async name => {
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: join(output, `${name}.png`), fullPage: true });
  };
  const assertRoutes = async (scope, routes) => {
    for (const [label, href] of routes) {
      const link = scope.getByRole("link", { name: label, exact: true });
      await visible(link);
      assert.equal(await link.getAttribute("href"), href, `${label}: destination preserved`);
    }
  };
  const assertEditorBoundary = async () => {
    for (const [, href] of EDITOR) assert.equal(await header.locator(`a[href="${href}"]`).count(), mode === "editor" ? 1 : 0,
      `${mode}: ${href} is rendered only in editor mode`);
  };

  // Load once, then exercise real responsive changes. Reloading immediately after a resize cancels the freshly
  // requested srcset candidate while Next's cold image optimization is still in flight; that cancellation race is
  // unrelated to the layout contract. Every viewport still requires both images to finish and decode below.
  await page.setViewportSize({ width: 1366, height: 1000 });
  await page.goto(`${base}/`);
  for (const width of [1366, 1440, 1920]) {
    await page.setViewportSize({ width, height: 1000 });
    await visible(purpose.getByRole("heading", { level: 1 }));
    assert.equal(await toolsButton().getAttribute("aria-expanded"), "false");
    assert.equal(await nav.locator("a:visible").count(), 4, `${width}: exactly four visible primary links`);
    await assertRoutes(nav, PRIMARY);
    assert.equal(await header.getByRole("link", { name: "pickDday 홈", exact: true }).getAttribute("href"), "/");
    const boxes = await Promise.all([
      header.getByRole("link", { name: "pickDday 홈", exact: true }),
      ...PRIMARY.map(([name]) => nav.getByRole("link", { name, exact: true })), toolsButton(),
    ].map(locator => locator.boundingBox()));
    const centres = boxes.map(box => box.y + box.height / 2);
    assert.ok(Math.max(...centres) - Math.min(...centres) <= 2, `${width}: brand and primary controls share one header row`);
    const headerBox = await header.boundingBox();
    assert.ok(headerBox.height <= 80, `${width}: compact single-row header ${headerBox.height}px`);
    const cards = purpose.getByRole("listitem");
    assert.equal(await cards.count(), 2);
    // Each responsive width can request a cold optimized image on the production build.
    await page.waitForFunction(() => [...document.querySelectorAll('section[aria-labelledby="purpose-heading"] img')].every(img => img.complete && img.naturalWidth > 0), undefined, { timeout: 60000 }).catch(async error => {
      const images = await purpose.locator("img").evaluateAll(elements => elements.map(img => ({ src: img.currentSrc, complete: img.complete, naturalWidth: img.naturalWidth, rect: img.getBoundingClientRect().toJSON() })));
      await shot(`home-image-failure-${width}`);
      throw new Error(`Purpose images did not load at ${width}px: ${JSON.stringify(images)}`, { cause: error });
    });
    const images = await purpose.locator("img").evaluateAll(elements => elements.map(img => ({ width: img.getBoundingClientRect().width, height: img.getBoundingClientRect().height, source: decodeURIComponent(img.currentSrc), alt: img.alt })));
    assert.equal(images.length, 2);
    assert.ok(images.every(image => image.width >= 390 && image.height >= 260 && image.alt === ""), `${width}: larger decorative purpose art ${JSON.stringify(images)}`);
    assert.ok(images[0].source.includes("existing-festival-v2.png") && images[1].source.includes("new-festival-v2.png"), `${width}: distinct purpose assets`);
    for (const [name, href] of PURPOSES) {
      const action = purpose.getByRole("link", { name, exact: true });
      assert.equal(await action.getAttribute("href"), href);
      await action.click({ trial: true });
    }
    await noOverflow(`home ${width}`);
    report.layouts.push({ width, headerHeight: headerBox.height, imageSizes: images.map(({ width, height }) => ({ width, height })) });
    await shot(`home-${width}`);
  }
  report.checks.push("1366-1440-1920-single-row-header-four-primary-links-and-larger-distinct-purpose-art");

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`${base}/`);
  await toolsButton().focus(); await page.keyboard.press("Enter"); await expanded(toolsButton(), true);
  await assertRoutes(nav, availableTools); await assertEditorBoundary();
  const controlledId = await toolsButton().getAttribute("aria-controls");
  assert.ok(controlledId && await page.locator(`[id="${controlledId}"]`).isVisible(), "planning button identifies the open panel");
  await shot("planning-tools-open");
  await page.keyboard.press("Escape"); await expanded(toolsButton(), false);
  assert.equal(await toolsButton().evaluate(element => element === document.activeElement), true, "Escape returns focus to the planning trigger");
  await toolsButton().click(); await expanded(toolsButton(), true);
  await purpose.getByRole("heading", { level: 1 }).click(); await expanded(toolsButton(), false);
  await toolsButton().click(); await expanded(toolsButton(), true);
  await header.getByRole("link", { name: "pickDday 홈", exact: true }).focus();
  await expanded(toolsButton(), false);
  report.checks.push("planning-menu-keyboard-escape-focus-outside-click-and-focus-close");

  for (const [label, href] of availableTools) {
    await toolsButton().click(); await expanded(toolsButton(), true);
    await nav.getByRole("link", { name: label, exact: true }).click();
    await page.waitForURL(url => url.pathname === href);
    await expanded(toolsButton(), false);
    await toolsButton().click();
    assert.equal(await nav.getByRole("link", { name: label, exact: true }).getAttribute("aria-current"), "page", `${label}: current location stays clear inside tools`);
    await page.keyboard.press("Escape");
    await noOverflow(`tool ${href}`);
  }
  await page.goto(`${base}/planning/options`);
  assert.ok((await page.getByRole("main").boundingBox()).width >= 1280, "PC planning pages use the wider frame");
  report.checks.push("all-planning-tools-retain-real-destinations-current-location-and-close-on-route-change", `${mode}-editor-link-boundary`, "pc-planning-frame-width");

  await page.goto(`${base}/`);
  const references = page.locator("details").filter({ has: page.locator("summary", { hasText: /^참고 자료$/ }) });
  assert.equal(await references.count(), 1);
  assert.equal(await references.getAttribute("open"), null, "secondary research starts collapsed");
  assert.equal(await references.locator('a[href="/forecast"]').isVisible(), false);
  await references.locator("summary").click();
  await visible(references.locator('a[href="/forecast"]'));
  await visible(references.locator('a[href="/forecast/records"]'));
  await visible(references.getByRole("heading", { name: "공개 운영 기록 예시", exact: true }));
  const privacy = page.getByRole("contentinfo").getByRole("link", { name: "개인정보·분석", exact: true });
  assert.equal(await privacy.getAttribute("href"), "/privacy");
  await privacy.click(); await page.waitForURL(url => url.pathname === "/privacy");
  await visible(page.getByRole("main"));
  report.checks.push("reference-research-and-examples-remain-reachable-behind-summary", "privacy-remains-reachable-in-footer");

  for (const width of [320, 390]) {
    await page.goto(`${base}/`); await page.setViewportSize({ width, height: 900 });
    await page.waitForFunction(() => [...document.querySelectorAll('section[aria-labelledby="purpose-heading"] img')].every(img => img.complete && img.naturalWidth > 0));
    await visible(menuButton()); await expanded(menuButton(), false);
    await noOverflow(`home ${width}`);
    await menuButton().click(); await expanded(menuButton(), true); await assertRoutes(nav, PRIMARY);
    await toolsButton().click(); await expanded(toolsButton(), true); await assertRoutes(nav, availableTools);
    await noOverflow(`expanded menu ${width}`);
    await page.keyboard.press("Escape"); await expanded(toolsButton(), false);
    assert.equal(await toolsButton().evaluate(element => element === document.activeElement), true);
    await page.keyboard.press("Escape"); await expanded(menuButton(), false);
    assert.equal(await menuButton().evaluate(element => element === document.activeElement), true);
    await menuButton().click(); await nav.getByRole("link", { name: "새 축제", exact: true }).click();
    await page.waitForURL(url => url.pathname === "/new"); await expanded(menuButton(), false);
    await page.goto(`${base}/`); await shot(`home-${width}`);
  }
  report.checks.push("320-390-reflow-and-nested-menu-escape-focus-route-close");

  await page.setViewportSize({ width: 1440, height: 1000 }); await page.goto(`${base}/`);
  const tab = (await worker.evaluate(() => chrome.tabs.query({}))).find(tab => tab.url?.startsWith(base));
  assert.ok(tab, "isolated application tab for real page zoom");
  await worker.evaluate(id => chrome.tabs.setZoom(id, 2), tab.id);
  await page.waitForFunction(() => innerWidth === 720);
  const factor = await worker.evaluate(id => chrome.tabs.getZoom(id), tab.id);
  const zoomMetrics = await page.evaluate(() => ({ innerWidth, devicePixelRatio, cssZoom: getComputedStyle(document.documentElement).zoom }));
  assert.equal(factor, 2); assert.equal(zoomMetrics.cssZoom, "1");
  report.zoom.push({ factor, ...zoomMetrics });
  await visible(menuButton()); await noOverflow("home real 200% page zoom");
  await menuButton().click(); await assertRoutes(nav, PRIMARY);
  await toolsButton().click(); await assertRoutes(nav, availableTools); await noOverflow("planning menu real 200% page zoom");
  await page.keyboard.press("Escape"); await expanded(toolsButton(), false);
  await page.keyboard.press("Escape"); await expanded(menuButton(), false);
  for (const [name] of PURPOSES) await purpose.getByRole("link", { name, exact: true }).click({ trial: true });
  // Native tab zoom and fullPage clipping use different coordinate spaces; capture the real viewport with CDP.
  await page.evaluate(() => window.scrollTo(0, 0));
  const session = await context.newCDPSession(page);
  try {
    const capture = await session.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
    writeFileSync(join(output, "home-real-zoom-200.png"), Buffer.from(capture.data, "base64"));
  } finally { await session.detach(); }
  await worker.evaluate(id => chrome.tabs.setZoom(id, 1), tab.id);
  report.checks.push("real-200-percent-page-zoom-reflows-menu-and-keeps-purpose-actions-usable");
  assert.deepEqual(report.browserErrors, []); assert.deepEqual(report.appWrites, []);
  report.status = "passed";
} catch (error) {
  report.status = "failed"; report.error = String(error.stack ?? error); throw error;
} finally {
  writeFileSync(join(output, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
  await context.close(); rmSync(extension, { recursive: true, force: true });
  console.log(JSON.stringify(report));
}
