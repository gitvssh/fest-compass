// Public acceptance of the festival type chips, introduction marks and the withdrawn DataLab pages, headless and read-only.
// Usage: LIVE_BASE_URL=https://pickday.damecasol.com node scripts/festival-discovery-live.mjs
// Real provider answers: counts are reported as observed, never asserted to a fixed number.
import assert from "node:assert/strict";
import { chromium } from "playwright";

const base = process.env.LIVE_BASE_URL;
if (!base) throw new Error("LIVE_BASE_URL required");
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
    // Pages built from DataLab website downloads are withdrawn (ADR-0003): old addresses land on festival comparison.
    const { context, page } = await open();
    for (const old of ["/compare/annual", "/compare/scale"]) {
      await page.goto(`${base}${old}`);
      assert.equal(new URL(page.url()).pathname, "/compare", `${old} redirects`);
    }
    assert.equal(await page.getByRole("link", { name: "연도별 방문 보기", exact: true }).count(), 0);
    checks.push("withdrawn-datalab-pages-redirect");
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
    for (const path of ["/existing/search?type=EV010300", "/existing/search?type=all&mark=experience"]) {
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
