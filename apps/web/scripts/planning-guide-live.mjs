// Public check of the planning guide (TS-FC-021) with the real Zaraz consent flow (site banner since 2026-10-04) and real data. Never intercepts responses.
// BASE_URL=https://pickday.damecasol.com node scripts/planning-guide-live.mjs
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { chromium } from "playwright";

const base = process.env.BASE_URL ?? "https://pickday.damecasol.com";
const output = resolve(process.env.GUIDE_OUTPUT_DIR ?? "output/playwright/planning-guide-public");
mkdirSync(output, { recursive: true });
const report = { checkedAt: new Date().toISOString(), base, headless: true, interceptedResponses: 0, checks: [], browserErrors: [] };
const check = (name, detail = {}) => { report.checks.push({ name, ...detail }); console.log(`ok - ${name}`); };
const browser = await chromium.launch({ headless: true });
const NONSAN = "/existing/archive%3Anonsan-strawberry";

async function open(viewport = { width: 1440, height: 900 }) {
  const context = await browser.newContext({ viewport, locale: "ko-KR" });
  await context.addInitScript(() => { try { localStorage.setItem("fest-compass.intro-video.v1", "dismissed"); } catch { /* storage blocked */ } });
  const page = await context.newPage();
  page.setDefaultTimeout(30_000);
  page.on("pageerror", error => report.browserErrors.push(String(error)));
  return { context, page };
}
async function consent(page) {
  // The site banner asks instead of the zone default modal (lib/analytics/consent.ts); decline it when it shows.
  const reject = page.locator("[data-consent-banner]").getByRole("button", { name: "거부", exact: true });
  if (await reject.isVisible({ timeout: 8000 }).catch(() => false)) await reject.click();
}
const text = locator => locator.innerText();

try {
  const { context, page } = await open();
  await page.goto(`${base}/`, { waitUntil: "networkidle" });
  await consent(page);
  assert.match(await text(page.locator("main")), /얻는 것 · 방문 흐름·연계 후보·후보 기간을 한 장으로/);
  await page.getByRole("link", { name: /축제 준비 전체 과정 보기/ }).click();
  await page.waitForURL(u => u.pathname === "/guide");
  await page.waitForLoadState("networkidle"); // measure the laid-out page, not one still loading its styles
  assert.equal(await page.locator("main li[id^=phase-]").count(), 7);
  // Every card starts each part at the same height: the question boxes line up across all seven cards.
  const parts = await page.locator("main li[id^=phase-]").evaluateAll(cards => cards.map(c => [...c.children].slice(0, 5).map(k => Math.round(k.getBoundingClientRect().top - c.getBoundingClientRect().top)).join(",")));
  assert.equal(new Set(parts).size, 1, `aligned card parts ${JSON.stringify(parts)}`);
  await page.screenshot({ path: join(output, "guide-1440.png"), fullPage: true });
  check("home outcome lines and the seven-phase process page with aligned card parts", { parts: parts[0] });

  await page.goto(`${base}${NONSAN}/visits`, { waitUntil: "networkidle" });
  const tabs = await page.getByRole("navigation", { name: "축제 탐색 메뉴" }).getByRole("link").evaluateAll(links => links.map(a => a.textContent.replace(/\s+/g, " ").trim()));
  assert.deepEqual(tabs, ["방문 흐름 돌아보기 · 과거 방문 흐름", "연계 관광 찾기 · 주변 관광자원", "개최 시기 검토하기 · 개최 시기", "모아 보기 · 한 장 요약"]);
  const card = page.getByRole("listitem").filter({ has: page.getByRole("heading", { name: "2025년 · 3.27–3.30 · 목–일 4일", exact: true }) });
  const values = await text(card);
  for (const v of ["개최 전 7일", "50,823명/일", "85,213명/일", "종료 후 7일", "43,485명/일"]) assert.ok(values.includes(v), `${v} on the 2025 card`);
  await page.screenshot({ path: join(output, "visits-1440.png") });
  check("task tabs and real before/during/after means on the public archive", { tabs });

  // Overlay first: one chart lined up on the first festival day; a line hides and shows; separate charts on request.
  const overlay = page.getByRole("img", { name: "논산시 외지인 방문 추이 · 회차 겹쳐 보기", exact: true });
  await overlay.waitFor();
  const desc = () => overlay.evaluate(svg => svg.querySelector("desc")?.textContent ?? "");
  assert.match(await desc(), /2025년 3\.27\(목\)~3\.30\(일\), 2024년 3\.21\(목\)~3\.24\(일\)/);
  await page.getByRole("checkbox", { name: /^2024년 · .* 선 보이기$/ }).uncheck();
  assert.doesNotMatch(await desc(), /2024년/);
  await page.getByRole("checkbox", { name: /^2024년 · .* 선 보이기$/ }).check();
  await page.locator("section[aria-label='회차 겹쳐 보기']").screenshot({ path: join(output, "visits-overlay-1440.png") });
  await page.getByRole("group", { name: "그래프 보기 방식" }).getByRole("button", { name: "따로 보기", exact: true }).click();
  assert.equal(await page.getByRole("img", { name: /^\d{4}년 논산시 외지인 방문 추이, / }).count(), 2);
  await page.getByRole("group", { name: "그래프 보기 방식" }).getByRole("button", { name: "겹쳐 보기", exact: true }).click();
  check("visits overlay chart by default, line toggle and separate charts on request");

  // Hover a day of the overlay: the card beside the pointer carries both editions' values.
  const plot = await overlay.boundingBox(), column = await overlay.locator("text", { hasText: /^D\+2$/ }).boundingBox();
  await page.mouse.move(column.x + column.width / 2, plot.y + 120);
  const tip = page.locator("[data-chart-tooltip]");
  await tip.waitFor();
  const tipText = await tip.innerText();
  for (const t of ["2025년 3.29(토)", "113,466.5명", "2024년 3.23(토)"]) assert.ok(tipText.includes(t), `tooltip ${t} in ${tipText}`);
  check("overlay tooltip beside the pointer with both editions' values");

  await page.getByRole("navigation", { name: "다음 할 일" }).getByRole("link", { name: /이어서\s*연계 관광 찾기/ }).click();
  await page.waitForURL(u => u.pathname.endsWith("/resources"));
  // The reviewed registration's current location is the festival site; it becomes the anchor only on request.
  await page.locator(".rmap-venue").waitFor();
  assert.match(await page.locator("main").innerText(), /충청남도 논산시 관촉동 · 한국관광공사 현재 등록 위치/);
  await page.getByRole("button", { name: "축제장을 기준점으로", exact: true }).click();
  await page.locator("p", { hasText: "기준점" }).filter({ hasText: "축제장 · 충청남도 논산시 관촉동" }).waitFor();
  await page.screenshot({ path: join(output, "resources-site-1440.png") });
  check("festival site marked from the reviewed registration and used as the anchor on request");
  await page.getByRole("navigation", { name: "축제 탐색 메뉴" }).getByRole("link", { name: /모아 보기/ }).click();
  await page.waitForURL(u => u.pathname.endsWith("/summary"));
  const sheet = page.locator("section.summary-sheet");
  await sheet.getByText("85,213", { exact: false }).first().waitFor();
  assert.match(await text(sheet), /개인 검토 자료이며 공식 문서가 아니에요/);
  assert.match(await text(sheet), /축제장 입장객 수 아님/);
  await page.screenshot({ path: join(output, "summary-1440.png"), fullPage: true });
  check("summary gathers the compared editions with their basis and source");
  await context.close();

  const phone = await open({ width: 390, height: 844 });
  for (const target of ["/", "/existing/search", `${NONSAN}/visits`, `${NONSAN}/summary`, "/new", "/guide"]) {
    await phone.page.goto(`${base}${target}`, { waitUntil: "networkidle" });
    await consent(phone.page);
    const { sw, vw } = await phone.page.evaluate(() => ({ sw: document.documentElement.scrollWidth, vw: document.documentElement.clientWidth }));
    assert.ok(sw <= vw, `${target} scrolls sideways (${sw} > ${vw})`);
  }
  await phone.page.goto(`${base}${NONSAN}/visits`, { waitUntil: "networkidle" });
  await phone.page.getByRole("button", { name: "논산딸기축제 관련 자료 검색" }).click();
  const dialog = phone.page.getByRole("dialog", { name: "논산딸기축제 관련 자료 검색" });
  await dialog.waitFor({ state: "visible" });
  await phone.page.waitForTimeout(300);
  const box = await dialog.boundingBox();
  assert.ok(box && Math.abs(box.y + box.height - 844) <= 1, "bottom sheet on a phone");
  await phone.page.screenshot({ path: join(output, "related-search-390.png") });
  check("no sideways scroll at 390px and a bottom-sheet dialog");
  await phone.context.close();

  assert.deepEqual(report.browserErrors, []);
  check("no browser errors");
} finally {
  writeFileSync(join(output, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
  await browser.close();
}
