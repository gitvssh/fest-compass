// Public acceptance of the festival type chips and the culture-tourism festival scale page, headless and read-only.
// Usage: LIVE_BASE_URL=https://pickday.damecasol.com node scripts/festival-discovery-live.mjs
// Real provider answers: counts are reported as observed, never asserted to a fixed number.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { chromium } from "playwright";

const base = process.env.LIVE_BASE_URL;
if (!base) throw new Error("LIVE_BASE_URL required");
const trend = JSON.parse(readFileSync(new URL("../data/datalab-festival-trend.json", import.meta.url), "utf8"));
const browser = await chromium.launch({ headless: true });
const errors = [], checks = [], observed = {};
async function open(viewport = { width: 1440, height: 1000 }) {
  const context = await browser.newContext({ viewport, locale: "ko-KR" }), page = await context.newPage();
  page.setDefaultTimeout(30_000);
  page.on("pageerror", e => errors.push(e.message));
  return { context, page };
}
const chips = page => page.getByRole("group", { name: "축제 유형" });
const overflow = page => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
try {
  {
    const { context, page } = await open();
    await page.goto(`${base}/existing/search`);
    await chips(page).getByRole("button", { name: /^지역특산물/ }).click();
    await page.waitForURL(/type=EV010300/);
    await page.getByRole("heading", { level: 2, name: "지역특산물축제 검색 결과", exact: true }).waitFor();
    const count = await page.getByText(/^축제 \d+건/).textContent();
    observed.specialty = count;
    assert.ok(/^축제 [1-9]\d*건/.test(count ?? ""), `registered specialty festivals listed (${count})`);
    assert.ok(await page.getByRole("list", { name: "찾은 축제" }).getByRole("listitem").count() > 0);
    checks.push("type-chip-national-list");

    await chips(page).getByRole("button", { name: /^문화관광/ }).click();
    await page.waitForURL(/type=EV010100/);
    await page.getByRole("heading", { level: 2, name: "문화관광축제 검색 결과", exact: true }).waitFor();
    observed.culture = await page.getByText(/^축제 \d+건/).textContent();
    const nonsan = page.getByRole("list", { name: "찾은 축제" }).getByRole("link").filter({ hasText: "논산딸기축제" });
    observed.nonsanLinked = await nonsan.count() ? (await nonsan.first().innerText()).includes("지난 개최") : null;
    checks.push("type-chip-culture-tourism");
    await context.close();
  }
  {
    const { context, page } = await open();
    await page.goto(`${base}/compare/scale`);
    await page.getByRole("heading", { level: 1, name: "문화관광축제 방문 규모", exact: true }).waitFor();
    const rows = page.getByRole("list", { name: "2025년 일평균 순위", exact: true }).getByRole("listitem");
    const expected = trend.festivals.flatMap(f => f.years.filter(y => y.year === 2025).map(y => ({ name: f.name, mean: y.dailyMean })))
      .sort((a, b) => b.mean - a.mean || a.name.localeCompare(b.name, "ko-KR")).map(r => r.name);
    assert.deepEqual(await rows.evaluateAll(lis => lis.map(li => li.querySelector("a")?.textContent?.trim())), expected);
    await page.getByRole("group", { name: "순위 기준" }).getByRole("button", { name: "외지인 비율", exact: true }).click();
    await page.waitForURL(/sort=outside/);
    assert.ok((await page.getByRole("list", { name: "2025년 외지인 비율 순위", exact: true }).getByRole("listitem").first().innerText()).includes("임실N치즈축제"));
    checks.push("scale-order-matches-file", "scale-sort-switch");
    await context.close();
  }
  {
    const { context, page } = await open({ width: 390, height: 844 });
    for (const path of ["/existing/search?type=EV010300", "/compare/scale"]) {
      await page.goto(`${base}${path}`);
      await page.waitForLoadState("networkidle");
      assert.ok(await overflow(page) <= 0, `${path}: no sideways scroll at 390px`);
    }
    checks.push("phone-no-overflow");
    await context.close();
  }
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ base, headless: true, checks, observed, browserErrors: errors.length }));
} finally {
  await browser.close();
}
