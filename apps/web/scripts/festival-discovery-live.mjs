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
    const rows = page.getByRole("list", { name: "2025년 전국 일평균 순위", exact: true }).getByRole("listitem");
    const expected = trend.festivals.flatMap(f => f.years.filter(y => y.year === 2025).map(y => ({ name: f.name, mean: y.dailyMean })))
      .sort((a, b) => b.mean - a.mean || a.name.localeCompare(b.name, "ko-KR")).map(r => r.name);
    const names = () => rows.evaluateAll(lis => lis.map(li => li.querySelector("a")?.textContent?.trim()));
    assert.deepEqual(await names(), expected.slice(0, 20));
    await page.getByRole("button", { name: `${expected.length}곳 모두 보기`, exact: true }).click();
    assert.deepEqual(await names(), expected);
    await page.getByRole("group", { name: "순위 기준" }).getByRole("button", { name: "외지인 비율", exact: true }).click();
    await page.waitForURL(/sort=outside/);
    assert.ok((await page.getByRole("list", { name: "2025년 전국 외지인 비율 순위", exact: true }).getByRole("listitem").first().innerText()).includes("임실N치즈축제"));
    await page.getByRole("combobox", { name: "지역" }).selectOption("충남");
    await page.waitForURL(/province=/);
    observed.chungnam2025 = await page.getByRole("list", { name: "2025년 충남 외지인 비율 순위", exact: true }).getByRole("listitem").count();
    checks.push("scale-order-matches-file", "scale-show-all", "scale-sort-switch", "scale-province");
    await context.close();
  }
  if (process.env.LIVE_MARKS !== "0") {
    // Step 2: every festival nationwide, marks from registration introductions and the words behind them.
    const { context, page } = await open();
    await page.goto(`${base}/existing/search`);
    await chips(page).getByRole("button", { name: "전체", exact: true }).click();
    await page.waitForURL(/type=all/);
    await page.getByRole("heading", { level: 2, name: "모든 축제 검색 결과", exact: true }).waitFor();
    observed.allFestivals = await page.getByText(/^축제 \d+건/).textContent();
    const filter = page.getByRole("group", { name: "소개 글로 거르기" });
    await filter.waitFor();
    observed.markCounts = (await filter.getByRole("button").allInnerTexts()).map(t => t.replace(/\s+/g, " ").trim());
    await filter.getByRole("button", { name: /^체험/ }).click();
    await page.waitForURL(/mark=experience/);
    const line = await page.getByText(/^축제 \d+건 중 체험 \d+건/).textContent();
    observed.experience = line;
    assert.ok(/중 체험 [1-9]\d*건/.test(line ?? ""), `some festivals carry the experience mark (${line})`);
    const card = page.getByRole("list", { name: "찾은 축제" }).getByRole("link").first();
    assert.ok((await card.innerText()).includes("체험"), "a filtered card shows its mark");
    await card.click();
    await page.getByRole("heading", { level: 1 }).waitFor();
    const evidence = page.getByRole("button", { name: "소개 글 근거", exact: true });
    await evidence.waitFor({ timeout: 30_000 });
    await evidence.click();
    const dialog = page.getByRole("dialog", { name: "등록 소개 글에서 찾은 표시" });
    assert.ok((await dialog.innerText()).includes("실제 운영 여부는 주최 측 안내를 확인해 주세요."));
    observed.evidence = (await dialog.locator("li").first().innerText()).replace(/\s+/g, " ").slice(0, 80);
    checks.push("all-festivals-list", "mark-filter", "mark-evidence");
    await context.close();
  }
  {
    const { context, page } = await open({ width: 390, height: 844 });
    for (const path of ["/existing/search?type=EV010300", "/existing/search?type=all&mark=experience", "/compare/scale"]) {
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
