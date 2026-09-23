import assert from "node:assert/strict";
import { mkdirSync, readFileSync } from "node:fs";
import { chromium } from "playwright";
import { mockMapTiles } from "./map-test-tiles.mjs";
const base = process.env.E2E_BASE_URL;
if (!base) throw new Error("E2E_BASE_URL required");
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: "ko-KR", acceptDownloads: true });
await mockMapTiles(context);
const page = await context.newPage(), errors = [], writes = [], apiCalls = [];
page.on("pageerror", e => errors.push(e.message));
page.on("request", r => { const url = new URL(r.url()); if (url.origin !== new URL(base).origin) return; if (r.method() !== "GET") writes.push(r.url()); if (url.pathname === "/api/regions") apiCalls.push(url.search); });
const SOURCE = "https://www.data.go.kr/data/15101578/openapi.do";
// Source identifiers are arbitrary text; this one would break a selector built from it.
const TRICKY_ID = '9102"]\\ [x=\'';
let delay = 0;
// Synthetic event fixtures (검증용) replace only the resource part; the server's real response shape and history remain.
function fixture(query) {
  const y = query.start.slice(0, 4), ev = (id, title, start, end, extra = {}) => ({ id, title, address: "검증용 주소", longitude: 127.1, latitude: 36.2, start, end, modifiedAt: "20260901123456", ...extra });
  if (query.district === "150") return { status: "unavailable", message: "검증용 조회 실패", items: [], total: null };
  if (query.district === "250") return { status: "empty", message: "검증용 결과 없음", items: [], total: 0 };
  if (query.district === "760") return { status: "complete", message: "검증용 전체 확인", items: [ev("9201", "부여 행사 (검증용)", `${y}-03-05`, `${y}-03-06`)], total: 1 };
  const items = query.start === "2024-01-01"
    ? [ev("9301", "지난 봄 행사 (검증용)", "2024-05-10", "2024-05-12"), ev("9302", "지난 여름 행사 (검증용)", "2024-08-01", "2024-08-02")]
    : [ev("9101", "딸기 축제 (검증용)", `${y}-01-28`, `${y}-02-20`), ev(TRICKY_ID, "봄꽃 행사 (검증용)", `${y}-03-30`, `${y}-04-02`),
      ev("9103", '=HYPERLINK("x") "따옴표"\n개행 (검증용)', `${y}-02-16`, `${y}-02-16`, { address: "", longitude: null, latitude: null, modifiedAt: null })];
  return { status: "complete", message: "검증용 전체 확인", items, total: items.length };
}
await page.route("**/api/regions?*", async route => {
  try {
    const response = await route.fetch(), data = await response.json();
    if (!response.ok()) return route.fulfill({ response });
    if (data.query.kind !== "15") return route.fulfill({ json: data });
    if (delay && data.query.district === "230") await new Promise(done => setTimeout(done, delay));
    data.resources = { ...fixture(data.query), pages: 1, collectedAt: "2026-09-08T00:00:00Z", source: SOURCE };
    await route.fulfill({ json: data });
  } catch { /* A superseded query is aborted by the client. */ }
});
const visible = l => l.waitFor({ state: "visible" });
const calendar = () => page.getByRole("region", { name: "행사 달력" }), list = () => page.getByRole("region", { name: "조회 자료 목록" });
const caption = text => page.getByText(text, { exact: true });
const month = (direction, label) => calendar().getByRole("button", { name: `${direction} 달, ${label} 보기`, exact: true });
const REGION_CSV = "조회된 전체 행사 3건 내려받기 (CSV)", NO_COUNT_CSV = "조회된 전체 행사 내려받기 (CSV)";
const csv = async button => { const pending = page.waitForEvent("download"); await button.click(); const d = await pending; return { name: d.suggestedFilename(), raw: readFileSync(await d.path(), "utf8") }; };
const RANGE = `${base}/regions?province=44&district=230&start=2026-02-15&end=2026-04-10&kind=15`;
const passed = [];
try {
  await page.goto(RANGE);
  await visible(caption("논산시 행사 달력 · 2026년 2월"));
  assert.equal(await month("이전", "2026년 1월").isDisabled(), true);
  assert.equal(await calendar().getByRole("button", { name: /^2026-02-(0\d|1[0-4]) / }).count(), 0);
  assert.ok(await calendar().getByRole("button", { name: /^2026-02-15 딸기 축제/ }).count() === 1);
  assert.equal(await list().getByRole("button", { name: /^\d+\. / }).count(), 3);
  await visible(calendar().getByText("조회 기간 2026-02-15 ~ 2026-04-10", { exact: true }));
  assert.equal(await page.getByText(/달을 넘겨도|4건 이상/).count(), 0);
  passed.push("first-event-month-and-out-of-range-days-empty");
  const calls = apiCalls.length;
  await month("다음", "2026년 3월").click(); await visible(caption("논산시 행사 달력 · 2026년 3월"));
  await calendar().getByRole("button", { name: /^2026-03-30 봄꽃 행사/ }).click();
  await visible(page.getByRole("heading", { name: "봄꽃 행사 (검증용)", exact: true }));
  assert.equal(await list().getByRole("button", { name: /봄꽃 행사/ }).getAttribute("aria-pressed"), "true");
  await month("다음", "2026년 4월").click(); await visible(caption("논산시 행사 달력 · 2026년 4월"));
  assert.equal(await calendar().getByRole("button", { name: /^2026-04-01 봄꽃 행사/ }).getAttribute("aria-pressed"), "true");
  assert.equal(await month("다음", "2026년 5월").isDisabled(), true);
  passed.push("calendar-list-detail-share-selection");
  await list().getByRole("button", { name: /딸기 축제/ }).click(); await visible(caption("논산시 행사 달력 · 2026년 2월"));
  assert.equal(await calendar().getByRole("button", { name: /^2026-02-15 딸기 축제/ }).getAttribute("aria-pressed"), "true");
  passed.push("list-selection-opens-event-month");
  assert.equal(apiCalls.length, calls); assert.equal(await list().getByRole("button", { name: /^\d+\. / }).count(), 3);
  assert.equal(new URL(page.url()).searchParams.get("month"), "2026-02");
  passed.push("month-change-no-request-no-range-change");
  const regionCsv = await csv(calendar().getByRole("button", { name: REGION_CSV, exact: true }));
  assert.equal(regionCsv.name, "fest-compass-events_44-230_2026-02-15_2026-04-10.csv");
  assert.ok(regionCsv.raw.startsWith("﻿"));
  assert.equal(regionCsv.raw.split("\r\n").filter(l => l.startsWith('"행사"')).length, 3);
  assert.ok(regionCsv.raw.includes('"2026-01-28","2026-02-20"'));
  assert.ok(regionCsv.raw.includes(`"'=HYPERLINK(""x"") ""따옴표""\n개행 (검증용)"`));
  for (const hidden of ["페이지", "9101", "예상"]) assert.equal(regionCsv.raw.includes(hidden), false, hidden);
  passed.push("region-csv-original-schedule-formula-safe");
  await month("다음", "2026년 3월").click(); await calendar().getByRole("button", { name: /^2026-03-30 봄꽃 행사/ }).click();
  await page.getByRole("link", { name: "이 지역·과거 축제 비교 →", exact: true }).click();
  await visible(page.getByRole("heading", { name: "주변·과거 축제 비교", exact: true }));
  await page.goBack(); await visible(caption("논산시 행사 달력 · 2026년 3월"));
  await visible(list().getByRole("button", { name: /봄꽃 행사/ }));
  assert.equal(await list().getByRole("button", { name: /봄꽃 행사/ }).getAttribute("aria-pressed"), "true");
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute("data-resource-id")), TRICKY_ID);
  passed.push("back-restores-condition-month-selection-focus");
  await page.reload(); await visible(caption("논산시 행사 달력 · 2026년 3월"));
  assert.equal(await calendar().locator('[aria-pressed="true"]').count(), 0);
  assert.equal(await list().locator('[aria-pressed="true"]').count(), 0);
  passed.push("reload-keeps-condition-month-clears-selection");
  await month("다음", "2026년 4월").click();
  await page.getByRole("button", { name: "자료 조회", exact: true }).click(); await visible(caption("논산시 행사 달력 · 2026년 4월"));
  passed.push("chosen-month-kept-after-requery");
  await page.goto(`${base}/regions?province=44&district=230&start=2024-01-01&end=2024-12-31&kind=15`);
  await visible(caption("논산시 행사 달력 · 2024년 5월"));
  passed.push("past-range-opens-first-event-month");
  await page.goto(`${base}/regions?province=44&district=250&start=2026-02-15&end=2026-04-10&kind=15`);
  await visible(calendar().getByText("이 기간에 등록된 행사가 없어요", { exact: true })); await visible(caption("계룡시 행사 달력 · 2026년 2월"));
  const emptyCsv = await csv(calendar().getByRole("button", { name: NO_COUNT_CSV, exact: true }));
  assert.ok(emptyCsv.raw.includes('"등록 결과 없음"')); assert.equal(emptyCsv.raw.includes('"0"'), false);
  passed.push("empty-result-state-row-not-zero");
  await page.goto(`${base}/regions?province=44&district=150&start=2026-02-15&end=2026-04-10&kind=15`);
  await visible(calendar().getByText(/행사 일정을 불러오지 못했어요/));
  assert.equal(await calendar().locator("table").count(), 0);
  assert.equal(await calendar().getByRole("button", { name: NO_COUNT_CSV, exact: true }).isDisabled(), true);
  passed.push("unavailable-no-calendar-no-csv");
  delay = 800; await page.goto(RANGE); await page.getByRole("button", { name: "부여군", exact: true }).click();
  await visible(caption("부여군 행사 달력 · 2026년 3월")); await page.waitForTimeout(1000);
  assert.equal(await page.getByText(/논산시 행사 달력/).count(), 0); delay = 0;
  passed.push("late-response-rejected");
  await page.goto(`${base}/compare`);
  assert.equal(await page.getByRole("link", { name: "연도별 방문 보기", exact: true }).getAttribute("href"), "/compare/annual");
  delay = 700; await page.getByRole("button", { name: "논산·공주·부여 등록 행사 조회", exact: true }).click();
  const compareCsvButton = page.getByRole("button", { name: "목록의 행사 내려받기 (CSV)", exact: true });
  assert.equal(await compareCsvButton.isDisabled(), true); await visible(page.getByText("모든 지역을 불러온 뒤 내려받을 수 있어요", { exact: true }));
  await visible(page.getByText("불러오지 못한 지역은 파일에 따로 표시돼요", { exact: true })); delay = 0;
  const compareCsv = await csv(compareCsvButton);
  assert.match(compareCsv.name, /^fest-compass-events_44-230_44-150_44-760_\d{4}-01-01_\d{4}-12-31\.csv$/);
  assert.equal(compareCsv.raw.split("\r\n").filter(l => l.startsWith('"행사"')).length, 4);
  assert.match(compareCsv.raw, /"지역 조회 상태","","충청남도 공주시".*"불러오지 못함"/);
  passed.push("compare-csv-waits-and-keeps-failed-region");
  await page.getByLabel("축제·지역 이름").fill("딸기"); await page.getByRole("button", { name: "등록 행사 조회", exact: true }).click();
  // Clicking waits until the button is enabled, which happens only after every region finished.
  await visible(page.getByRole("heading", { name: /현재 조회한 등록 행사 · 1건/ }));
  const filteredCsv = await csv(compareCsvButton);
  assert.equal(filteredCsv.raw.split("\r\n").filter(l => l.startsWith('"행사"')).length, 1);
  assert.ok(filteredCsv.raw.includes("이름: 딸기")); assert.match(filteredCsv.raw, /"충청남도 부여군".*"조건에 맞는 행사 없음"/);
  passed.push("compare-csv-follows-applied-filter");
  for (const [path, label] of [["/", "홈"], ["/regions", "관광지도"], ["/compare?province=44&district=230&mode=current", "축제 비교"], ["/planning/options", "기획 후보"], ["/privacy", "개인정보·분석"]]) {
    await page.goto(`${base}${path}`);
    const current = page.getByRole("navigation", { name: "주 메뉴" }).locator('[aria-current="page"]');
    assert.equal(await current.count(), 1, path); assert.equal(await current.textContent(), label);
  }
  await page.goto(`${base}/`);
  for (let i = 0; i < 20 && await page.evaluate(() => document.activeElement?.textContent) !== "관광지도"; i++) await page.keyboard.press("Tab");
  await page.keyboard.press("Enter"); await page.waitForURL(/\/regions$/);
  passed.push("menu-current-page-and-keyboard");
  await page.setViewportSize({ width: 390, height: 844 }); await page.goto(RANGE); await visible(caption("논산시 행사 달력 · 2026년 2월"));
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 390);
  const prev = month("이전", "2026년 1월"), next = month("다음", "2026년 3월"), shown = calendar().getByText("2026년 2월", { exact: true });
  assert.equal(await prev.textContent(), "이전 달"); assert.equal(await next.textContent(), "다음 달");
  const [p, s, n] = await Promise.all([prev, shown, next].map(l => l.boundingBox()));
  assert.ok(Math.abs(p.y - s.y) < s.height && Math.abs(n.y - s.y) < s.height, "month header stays on one row");
  assert.ok(p.x + p.width <= s.x && s.x + s.width <= n.x && n.x + n.width <= 390, "month header fits 390px");
  const sizes = await calendar().locator("table button").evaluateAll(els => els.map(e => [e.getBoundingClientRect().height, getComputedStyle(e).fontSize]));
  assert.ok(sizes.length > 0 && sizes.every(([h, f]) => h >= 24 && f === "12px"), JSON.stringify(sizes));
  await calendar().getByRole("button", { name: "전체 행사 목록", exact: true }).click();
  assert.equal(await page.evaluate(() => document.activeElement?.textContent), "논산시 · 축제·행사");
  assert.equal(await list().getByRole("button", { name: /^\d+\. / }).count(), 3);
  mkdirSync("output/playwright", { recursive: true }); await calendar().screenshot({ path: "output/playwright/schedule-calendar-mobile.png" });
  passed.push("390px-month-header-24px-events-list-jump");
  assert.deepEqual(errors, []); assert.deepEqual(writes, []);
  console.log(JSON.stringify({ headless: true, fixtures: "synthetic-events", passed, browserErrors: errors.length, clientWrites: writes.length }));
} finally { await browser.close(); }
