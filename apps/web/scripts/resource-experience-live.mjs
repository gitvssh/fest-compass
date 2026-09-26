// Official-source application responses, no interception. Root visual review accompanies these checks.
// Uses a task-local headless Chromium extension only to set and read the REAL tab zoom level.
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { chromium } from "playwright";

const base = process.env.E2E_BASE_URL;
if (!base) throw Error("E2E_BASE_URL required");
const output = resolve(process.env.LIVE_OUTPUT_DIR ?? "output/resource-experience-live");
mkdirSync(output, { recursive: true });
const extension = mkdtempSync(join(tmpdir(), "pickdday-zoom-"));
writeFileSync(join(extension, "manifest.json"), JSON.stringify({ manifest_version: 3, name: "Isolated zoom verification", version: "1.0", permissions: ["tabs"], background: { service_worker: "background.js" } }));
writeFileSync(join(extension, "background.js"), "chrome.runtime.onInstalled.addListener(() => {});\n");
const report = { checkedAt: new Date().toISOString(), base, headless: true, mockedResponses: 0, browserErrors: [], appWrites: [], samples: [], checks: [], zoom: [] };
const rgb = text => text.match(/[\d.]+/g).map(Number);
const luminance = channels => channels.slice(0, 3).map(c => c / 255).map(c => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4).reduce((s, c, i) => s + c * [0.2126, 0.7152, 0.0722][i], 0);
const contrast = (a, b) => { const l = [luminance(a), luminance(b)].sort((a, b) => b - a); return (l[0] + 0.05) / (l[1] + 0.05); };
const context = await chromium.launchPersistentContext("", { channel: "chromium", headless: true, viewport: { width: 1440, height: 1000 }, locale: "ko-KR", args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`] });
try {
  const worker = context.serviceWorkers()[0] ?? await context.waitForEvent("serviceworker");
  const page = await context.newPage(); page.setDefaultTimeout(30000);
  page.on("pageerror", e => report.browserErrors.push(e.message));
  page.on("request", r => { if (r.method() !== "GET" && new URL(r.url()).origin === new URL(base).origin && new URL(r.url()).pathname.startsWith("/api/")) report.appWrites.push(`${r.method()} ${new URL(r.url()).pathname}`); });
  await page.addLocatorHandler(page.getByRole("button", { name: "모두 거부", exact: true }), async b => b.click());
  const overflow = async label => assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), label);
  const shot = async name => {
    await page.evaluate(() => window.scrollTo(0, 0));
    if (name.endsWith("zoom-200")) {
      // Native tab zoom and Playwright fullPage clipping use different coordinate spaces.
      // Capture the real viewport with CDP; keep the zoom factor and CSS metrics in the report.
      if (!name.startsWith("home")) await page.locator(".rmap-root").evaluate(el => {
        const header = document.querySelector('header')?.getBoundingClientRect().height ?? 120;
        window.scrollTo(0, el.getBoundingClientRect().top + scrollY - header - 12);
      });
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      const session = await context.newCDPSession(page);
      try {
        const result = await session.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
        writeFileSync(join(output, `${name}.png`), Buffer.from(result.data, "base64"));
      } finally { await session.detach(); }
      return;
    }
    return page.screenshot({ path: join(output, `${name}.png`), fullPage: true });
  };
  const zoom = async (factor, label) => {
    const tab = (await worker.evaluate(() => chrome.tabs.query({}))).find(t => t.url?.startsWith(base));
    assert.ok(tab, "isolated application tab");
    await worker.evaluate(({ id, factor }) => chrome.tabs.setZoom(id, factor), { id: tab.id, factor });
    await page.waitForFunction(expected => innerWidth === expected, 1440 / factor);
    const value = await worker.evaluate(id => chrome.tabs.getZoom(id), tab.id);
    const metrics = await page.evaluate(() => ({ innerWidth, devicePixelRatio, cssZoom: getComputedStyle(document.documentElement).zoom }));
    assert.equal(value, factor); assert.equal(metrics.cssZoom, "1");
    report.zoom.push({ label, factor: value, ...metrics });
  };
  await page.goto(base);
  const purpose = page.locator('section[aria-labelledby="purpose-heading"]');
  for (const [name, href] of [["기존 축제 찾기 →", "/existing/search"], ["지역부터 살펴보기 →", "/new"]]) assert.equal(await purpose.getByRole("link", { name, exact: true }).getAttribute("href"), href);
  await page.waitForFunction(() => [...document.querySelectorAll('#purpose-heading + ul img')].length === 2 && [...document.querySelectorAll('#purpose-heading + ul img')].every(img => img.complete && img.naturalWidth > 0));
  const images = await purpose.locator("img").evaluateAll(imgs => imgs.map(img => ({ alt: img.alt, width: img.naturalWidth, src: new URL(img.currentSrc).pathname, renderedWidth: img.getBoundingClientRect().width })));
  assert.ok(images.every(i => i.alt === "" && i.width > 0 && i.src === "/_next/image")); report.images = images;
  await shot("home-desktop");
  for (const width of [640, 390, 320]) { await page.setViewportSize({ width, height: 900 }); await overflow(`home ${width}`); if (width === 390) await shot("home-mobile"); }
  await page.setViewportSize({ width: 1440, height: 1000 }); await zoom(2, "home"); await overflow("home zoom 200%"); await shot("home-zoom-200"); await zoom(1, "home reset");
  report.checks.push("two-optimized-decorative-images-and-purpose-links", "home-320-390-640-1440-and-real-200-percent-zoom");

  for (const sample of [
    { flow: "new", code: "51150", province: "51", district: "150", path: "/new/51150/resources?types=39,32", heading: "new-resource-detail-heading" },
    { flow: "existing", code: "50110", province: "50", district: "110", path: "/existing/current%3A50110%3A667418/resources?types=39,32", heading: "resource-detail-heading" },
  ]) {
    await page.goto(`${base}${sample.path}`);
    const rows = page.getByRole("list", { name: "관광자원 목록", exact: true }); await rows.waitFor();
    const blocks = [];
    for (const kind of ["39", "32"]) {
      const query = new URLSearchParams({ province: sample.province, district: sample.district, types: kind }).toString();
      const data = await page.evaluate(async q => { const r = await fetch(`/api/existing/resources?${q}`); if (!r.ok) throw Error(`resources HTTP ${r.status}`); return r.json(); }, query);
      assert.equal(data.region.code, sample.code); const b = data.byType.find(b => b.kind === kind); assert.ok(b && b.status === "complete"); assert.equal(b.total, b.items.length); blocks.push(b);
    }
    const expected = blocks.flatMap(b => b.items);
    await page.waitForFunction(n => document.querySelectorAll('[aria-label="관광자원 목록"] [data-resource-id]').length === n, expected.length);
    const ids = await rows.locator("[data-resource-id]").evaluateAll(els => els.map(e => e.dataset.resourceId));
    assert.deepEqual([...ids].sort(), expected.map(r => r.id).sort());
    report.samples.push({ flow: sample.flow, code: sample.code, counts: blocks.map(b => ({ kind: b.kind, total: b.total })) });
    const colors = await page.getByRole("group", { name: "자원 유형", exact: true }).getByRole("button", { name: "음식점", exact: true }).evaluate(b => {
      const s = getComputedStyle(b), pill = getComputedStyle(b.querySelector("span[id]"));
      return { text: s.color, background: s.backgroundColor, pillText: pill.color, pillBackground: pill.backgroundColor };
    });
    const background = rgb(colors.background), pill = rgb(colors.pillBackground), alpha = pill[3] ?? 1;
    const pillBackground = pill.slice(0, 3).map((c, i) => c * alpha + background[i] * (1 - alpha));
    const ratios = { button: contrast(rgb(colors.text), background), count: contrast(rgb(colors.pillText), pillBackground) };
    assert.ok(ratios.button >= 4.5 && ratios.count >= 4.5, `${sample.flow} selected type/count contrast`);
    report.samples.at(-1).selectedContrast = { ...colors, ratios };
    const group = page.locator(".rmap-group").first(); await group.waitFor();
    await page.waitForFunction(() => [...document.querySelectorAll('.rmap-canvas img.leaflet-tile')].some(i => i.complete && i.naturalWidth > 0));
    await shot(`${sample.flow}-resources-desktop`);
    await group.click();
    const chooser = page.getByRole("dialog", { name: /^가까운 장소 / }); await chooser.waitFor();
    const firstMember = chooser.locator(".rmap-item").first();
    const memberText = await firstMember.locator("span").first().innerText();
    const memberMatch = memberText.match(/^(\d+)\.\s+(.+)$/); assert.ok(memberMatch);
    const memberId = ids[Number(memberMatch[1]) - 1];
    assert.equal(expected.find(r => r.id === memberId)?.title, memberMatch[2]);
    await firstMember.click();
    await page.waitForFunction(id => document.activeElement?.id === id, sample.heading);
    assert.equal(await page.locator(`#${sample.heading}`).innerText(), memberMatch[2]);
    assert.equal(await rows.locator(`[data-resource-id="${memberId}"]`).getAttribute("aria-pressed"), "true");
    await page.getByRole("button", { name: "상세 닫기", exact: true }).click();
    await page.getByRole("button", { name: "가까운 장소 목록 닫기", exact: true }).click();
    await group.press("Space"); await chooser.waitFor(); await page.keyboard.press("Escape");
    await chooser.waitFor({ state: "detached" });
    assert.ok(await page.evaluate(() => document.activeElement?.classList.contains("rmap-group")));
    await group.click(); await chooser.waitFor(); await shot(`${sample.flow}-cluster-chooser`);
    await page.getByRole("button", { name: "가까운 장소 목록 닫기", exact: true }).click();
    report.checks.push(`${sample.flow}-dense-cluster-real-pointer-list-detail-identity-keyboard-escape`);
    const item = expected.find(r => r.id === memberId); assert.ok(item?.point);
    await rows.locator(`[data-resource-id="${item.id}"]`).click();
    await page.locator(`#${sample.heading}`).waitFor();
    assert.equal(await page.locator(`#${sample.heading}`).innerText(), item.title);
    await page.waitForFunction(id => document.activeElement?.id === id, sample.heading);
    for (const width of [390, 320]) { await page.setViewportSize({ width, height: 900 }); await overflow(`${sample.flow} ${width}`); if (width === 390) await shot(`${sample.flow}-detail-mobile`); }
    await page.setViewportSize({ width: 1440, height: 1000 }); await zoom(2, sample.flow); await overflow(`${sample.flow} zoom 200%`);
    await page.getByRole("group", { name: "보기 방식" }).getByRole("button", { name: "지도", exact: true }).click();
    try { await page.locator(".rmap-group").first().click(); }
    catch (error) {
      report.mapFailure = await page.evaluate(() => ({ text: document.querySelector('[data-resource-area=map]')?.textContent, markers: document.querySelectorAll('.rmap-marker').length, groups: document.querySelectorAll('.rmap-group').length, size: document.querySelector('.rmap-canvas')?.getBoundingClientRect().toJSON() }));
      await shot(`${sample.flow}-failed-zoom-200`); throw error;
    }
    await chooser.waitFor();
    await page.keyboard.press("Shift+Tab");
    assert.ok(await page.evaluate(() => document.activeElement !== document.body && !document.activeElement?.closest("[inert]")), `${sample.flow} zoom focus avoids covered map`);
    await page.getByRole("button", { name: "가까운 장소 목록 닫기", exact: true }).click();
    await page.locator(".rmap-group").first().click(); await chooser.waitFor();
    await chooser.locator(".rmap-item").first().click();
    await page.waitForFunction(id => document.activeElement?.id === id, sample.heading);
    await shot(`${sample.flow}-zoom-200`);
    await page.getByRole("button", { name: "상세 닫기", exact: true }).click();
    await page.waitForFunction(() => document.activeElement !== document.body && !document.activeElement?.closest("[inert]"));
    assert.equal(await page.evaluate(() => document.activeElement?.getAttribute("aria-label")), "가까운 장소 목록 닫기");
    await page.getByRole("button", { name: "가까운 장소 목록 닫기", exact: true }).click();
    await page.getByRole("group", { name: "보기 방식" }).getByRole("button", { name: "목록", exact: true }).click();
    await zoom(1, `${sample.flow} reset`);
    report.checks.push(`${sample.flow}-official-source-full-list-identity-detail-mobile-real-zoom`);
  }
  assert.deepEqual(report.browserErrors, []); assert.deepEqual(report.appWrites, []); report.status = "passed";
} finally {
  await context.close(); rmSync(extension, { recursive: true, force: true });
  writeFileSync(join(output, "report.json"), JSON.stringify(report, null, 2) + "\n");
}
console.log(JSON.stringify(report));
