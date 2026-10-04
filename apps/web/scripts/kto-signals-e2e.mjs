// node scripts/kto-signals-e2e.mjs — headless checks of the two live KTO OpenAPI cards (30-day spot concentration forecast,
// related spots). The test server has no service key, so the real answer is the unavailable state; complete and empty
// states use 검증용 FIXTURE answers fulfilled for these two routes only.
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";
const base = process.env.E2E_BASE_URL;
if (!base) throw new Error("E2E_BASE_URL required");
const browser = await chromium.launch({ headless: true }), passed = [], errors = [], writes = [];
const visible = l => l.waitFor({ state: "visible" });
const NONSAN = { province: "44", district: "230", code: "44230", name: "충청남도 논산시", districtName: "논산시" };
const days = Array.from({ length: 30 }, (_, i) => new Date(Date.UTC(2026, 9, 5 + i)).toISOString().slice(0, 10));
const rate = (s, d) => Math.round((((s * 37 + d * 11) % 90) + 10) * 10) / 10;
const spots = Array.from({ length: 12 }, (_, s) => {
  const rates = days.map((_, d) => (s === 3 && d === 2 ? null : rate(s, d))), present = rates.filter(r => r !== null), max = Math.max(...present);
  return { name: `검증용 관광지 ${s + 1}`, rates, mean: present.reduce((n, r) => n + r, 0) / present.length, peak: { date: days[rates.indexOf(max)], rate: max } };
}).sort((a, b) => b.mean - a.mean);
const daily = days.map((_, d) => { const v = spots.map(s => s.rates[d]).filter(r => r !== null); return v.reduce((n, r) => n + r, 0) / v.length; });
const crowd = (status, extra = {}) => ({ key: JSON.stringify(["kto-crowd", "44", "230"]), request: { province: "44", district: "230" }, retrievedAt: "2026-10-05T01:00:00.000Z", region: NONSAN,
  status, basis: null, days: status === "complete" ? days : [], daily: status === "complete" ? daily : [], spots: status === "complete" ? spots : [],
  source: status === "complete" ? { title: "한국관광공사 관광지 집중률 방문자 추이 예측", url: "https://www.data.go.kr/data/15128555/openapi.do", collectedAt: "2026-10-05T01:00:00.000Z" } : null, ...extra });
const months = ["2026-08", "2026-07", "2026-06", "2026-05", "2026-04", "2026-03", "2026-02", "2026-01", "2025-12", "2025-11", "2025-10", "2025-09"];
const items = (center, n) => Array.from({ length: n }, (_, i) => ({ rank: i + 1, name: `${center} 연관 ${i + 1}`, category: ["관광지", "음식", "숙박"][i % 3], detail: ["기타관광", "한식", "호텔"][i % 3], place: i === 4 ? "공주시" : "논산시" }));
const related = (month, monthParam) => ({ key: JSON.stringify(["kto-related", "44", "230", monthParam]), request: { province: "44", district: "230", month: monthParam }, retrievedAt: "2026-10-05T01:00:00.000Z", region: NONSAN,
  status: "complete", basis: null, month, months, centers: [{ name: `검증용 중심 ${month}`, items: items("가", 14) }, { name: "검증용 둘째 중심", items: items("나", 4) }],
  source: { title: "한국관광공사 관광지별 연관 관광지 정보", url: "https://www.data.go.kr/data/15128560/openapi.do", collectedAt: "2026-10-05T01:00:00.000Z" } });

async function open(fixtures) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: "ko-KR" }), page = await context.newPage();
  page.on("pageerror", e => errors.push(e.message));
  page.on("request", r => { if (r.method() !== "GET" && new URL(r.url()).origin === new URL(base).origin) writes.push(r.url()); });
  const asked = [];
  if (fixtures) await context.route(u => u.pathname.startsWith("/api/signals/"), route => {
    const url = new URL(route.request().url()); asked.push(`${url.pathname}?${url.searchParams}`);
    const body = fixtures(url); return body ? route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) }) : route.continue();
  });
  return { context, page, asked };
}
const crowdCard = page => page.locator("section[aria-labelledby=crowd-heading]");
const relatedCard = page => page.locator("section[aria-labelledby=related-heading]");

try {
  // Real answer without a service key: the cards say they cannot load and offer a retry; the resources list stays.
  {
    const { context, page } = await open(null);
    await page.goto(`${base}/new/44230/resources`);
    await visible(crowdCard(page).getByRole("heading", { name: "앞으로 30일 관광지 붐빔 예측", level: 3 }));
    await visible(crowdCard(page).getByRole("alert").filter({ hasText: "지금은 붐빔 예측을 불러올 수 없어요." }));
    await visible(crowdCard(page).getByRole("button", { name: "붐빔 예측 다시 불러오기", exact: true }));
    await visible(page.getByRole("heading", { name: "논산시 관광자원", level: 2 }));
    await visible(relatedCard(page).getByRole("alert").filter({ hasText: "지금은 함께 찾는 곳을 불러올 수 없어요." }));
    await visible(relatedCard(page).getByRole("button", { name: "함께 찾는 곳 다시 불러오기", exact: true }));
    for (const card of [crowdCard(page), relatedCard(page)]) assert.equal(await card.getByRole("button", { name: "다시 불러오기", exact: true }).count(), 0, "each card names its own retry");
    passed.push("unavailable-without-key-crowd-and-related");
    await context.close();
  }
  // Complete forecast: summaries, mean-ordered spots, show all, table, criteria; on the new and the existing resources views.
  {
    const { context, page } = await open(url => (url.pathname === "/api/signals/crowd" ? crowd("complete") : null));
    await page.goto(`${base}/new/44230/resources`);
    const card = crowdCard(page);
    await visible(card.getByText(`논산시 관광지 ${spots.length}곳 · 한국관광공사 예측 · 관광지마다 가장 붐비는 때 = 100`, { exact: true }));
    const best = daily.indexOf(Math.max(...daily)), wd = ["일", "월", "화", "수", "목", "금", "토"][new Date(`${days[best]}T00:00:00Z`).getUTCDay()];
    await visible(card.getByText(`${Number(days[best].slice(5, 7))}.${Number(days[best].slice(8))}(${wd}) · 평균 ${Math.round(daily[best])}`, { exact: true }));
    await visible(card.getByText(`${spots[0].name} · 평균 ${Math.round(spots[0].mean)}`, { exact: true }));
    const list = card.getByRole("list", { name: "관광지별 30일 붐빔 예측" });
    assert.equal(await list.getByRole("listitem").count(), 8);
    assert.deepEqual((await list.getByRole("listitem").allInnerTexts()).map(t => t.split("\n")[0].trim()), spots.slice(0, 8).map(s => s.name), "spots in 30-day mean order");
    await visible(list.getByRole("img", { name: new RegExp(`^${spots[0].name} 30일 예측\\. `) }));
    await card.getByRole("button", { name: `${spots.length}곳 모두 보기` }).click(); assert.equal(await list.getByRole("listitem").count(), spots.length);
    await card.getByRole("button", { name: "날짜별 수치 표 보기" }).click();
    const table = card.getByRole("region", { name: "논산시 관광지별 30일 붐빔 예측 표" });
    await visible(table.getByRole("cell", { name: "값 없음" }).first());
    assert.equal(await table.locator("tbody tr").count(), spots.length);
    await card.getByRole("button", { name: "기준" }).click();
    const dialog = page.getByRole("dialog", { name: "관광지 붐빔 예측의 기준" }); await visible(dialog);
    await visible(dialog.getByText(/관광지끼리 방문자 수를 견주는 값이 아니에요/)); await visible(dialog.getByText(/축제 방문객 수 예측도 아니에요/));
    assert.equal(await dialog.getByRole("link", { name: "한국관광공사 관광지 집중률 방문자 추이 예측 ↗" }).getAttribute("href"), "https://www.data.go.kr/data/15128555/openapi.do");
    await page.keyboard.press("Escape"); await dialog.waitFor({ state: "hidden" });
    passed.push("crowd-summary-order-show-all-table-criteria");
    await page.goto(`${base}/existing/archive:nonsan-strawberry/resources`);
    await visible(crowdCard(page).getByText(`${spots[0].name} · 평균 ${Math.round(spots[0].mean)}`, { exact: true }));
    await page.goto(`${base}/existing/archive:nonsan-strawberry/timing`);
    await visible(page.getByRole("heading", { name: "개최 시기", level: 2 }));
    assert.equal(await crowdCard(page).count(), 0, "the timing view keeps showing no forecast");
    passed.push("crowd-on-existing-resources-not-timing");
    await page.setViewportSize({ width: 390, height: 844 }); await page.goto(`${base}/new/44230/resources`);
    await visible(crowdCard(page).getByRole("list", { name: "관광지별 30일 붐빔 예측" }));
    await crowdCard(page).getByRole("button", { name: "날짜별 수치 표 보기" }).click();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 390);
    assert.ok(await crowdCard(page).getByRole("region", { name: "논산시 관광지별 30일 붐빔 예측 표" }).evaluate(e => e.scrollWidth > e.clientWidth), "wide table scrolls inside its own region");
    mkdirSync("output/playwright", { recursive: true }); await crowdCard(page).screenshot({ path: "output/playwright/kto-crowd-390.png" });
    passed.push("crowd-390px-no-overflow-table-own-scroll");
    await context.close();
  }
  // Empty forecast: a plain note, no chart.
  {
    const { context, page } = await open(url => (url.pathname === "/api/signals/crowd" ? crowd("empty") : null));
    await page.goto(`${base}/new/44230/resources`);
    await visible(crowdCard(page).getByText("이 지역은 한국관광공사 붐빔 예측이 아직 없어요.", { exact: true }));
    assert.equal(await crowdCard(page).getByRole("list").count(), 0);
    passed.push("crowd-empty-note");
    await context.close();
  }
  // Related spots: newest month, center choice, type filter, show all, another month, criteria; also on the existing resources view.
  {
    const { context, page, asked } = await open(url => (url.pathname === "/api/signals/related" ? related(url.searchParams.get("month") ?? "2026-08", url.searchParams.get("month")) : null));
    await page.goto(`${base}/new/44230/resources`);
    const card = relatedCard(page);
    await visible(card.getByText("논산시 중심 관광지를 찾은 뒤 내비게이션으로 이어서 찾은 곳 · 한국관광공사(티맵 자료) · 2026년 8월", { exact: true }));
    const list = () => card.getByRole("list").first();
    assert.equal(await list().getByRole("listitem").count(), 10);
    assert.match(await list().getByRole("listitem").first().innerText(), /^1위\s+가 연관 1\s+관광지\s+기타관광$/);
    assert.match(await list().getByRole("listitem").nth(4).innerText(), /공주시/, "a spot in another district shows its place");
    await card.getByRole("button", { name: "14곳 모두 보기" }).click(); assert.equal(await list().getByRole("listitem").count(), 14);
    await card.getByRole("group", { name: "유형" }).getByRole("button", { name: "음식 5", exact: true }).click();
    assert.equal(await list().getByRole("listitem").count(), 5);
    assert.ok((await list().getByRole("listitem").allInnerTexts()).every(t => t.includes("음식")));
    await card.getByLabel("중심 관광지").selectOption({ label: "검증용 둘째 중심 (4곳)" });
    assert.equal(await card.getByRole("group", { name: "유형" }).getByRole("button", { pressed: true }).innerText(), "전체 4");
    await card.getByLabel("기준 달").selectOption("2026-05"); await card.getByRole("button", { name: "달 보기" }).click();
    await visible(card.getByText(/· 2026년 5월$/));
    assert.ok(asked.some(a => a.includes("month=2026-05")), "the chosen month is requested");
    await card.getByRole("button", { name: "기준" }).click();
    const dialog = page.getByRole("dialog", { name: "함께 찾는 곳의 기준" }); await visible(dialog);
    await visible(dialog.getByText(/100m·1분 이상 실제로 이동한 경우만 세요/)); await page.keyboard.press("Escape");
    passed.push("related-month-center-type-show-all-criteria");
    await page.goto(`${base}/existing/archive:nonsan-strawberry/resources`);
    await visible(relatedCard(page).getByText(/· 2026년 8월$/));
    passed.push("related-on-existing-festival-resources");
    await page.setViewportSize({ width: 390, height: 844 }); await page.goto(`${base}/new/44230/resources`);
    await visible(relatedCard(page).getByRole("list").first());
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 390);
    await relatedCard(page).screenshot({ path: "output/playwright/kto-related-390.png" });
    passed.push("related-390px-no-overflow");
    await context.close();
  }
  assert.deepEqual(errors, []); assert.deepEqual(writes, []);
  console.log(JSON.stringify({ headless: true, passed, browserErrors: errors.length, clientWrites: writes.length }));
} finally { await browser.close(); }
