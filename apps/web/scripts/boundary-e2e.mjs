import assert from "node:assert/strict";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";
import { mockMapTiles } from "./map-test-tiles.mjs";
const base = process.env.E2E_BASE_URL;
if (!base) throw new Error("E2E_BASE_URL required");
const regions = JSON.parse(readFileSync(new URL("../data/region-catalogue.json", import.meta.url))).rows;
const browser = await chromium.launch({ headless: true }), context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, locale: "ko-KR" });
await mockMapTiles(context);
const page = await context.newPage(), passed = [], errors = [], writes = [];
page.on("pageerror", error => errors.push(error.message));
page.on("request", r => { if (new URL(r.url()).origin === new URL(base).origin && !["GET", "HEAD"].includes(r.method()) && !new URL(r.url()).pathname.startsWith("/cdn-cgi/")) writes.push(r.url()); });
await context.route("**/api/regions?*", route => {
  const q = Object.fromEntries(new URL(route.request().url()).searchParams), region = regions.find(r => r.provinceCode === q.province && r.districtCode === q.district);
  return route.fulfill({ json: { query: q, region,
    resources: { status: "complete", total: 1, pages: 1, collectedAt: "2026-09-09T00:00:00Z", source: "https://www.data.go.kr/data/15101578/openapi.do", message: "가상 경계 UI 검증", items: [{ id: "801", title: "경계 검증 자원 (가상)", address: "가상 주소", longitude: q.province === "44" ? 127.1 : 126.98, latitude: q.province === "44" ? 36.2 : 37.57, start: null, end: null, modifiedAt: null }] },
    history: { status: "unavailable", message: "검증용 이력 없음", unit: "명", metric: "시군구 일별 외지인 방문", source: "https://www.data.go.kr/data/15101972/openapi.do", points: [] } } });
});
const button = name => page.getByRole("button", { name, exact: true });
const shapes = () => page.locator(".leaflet-region-boundaries-pane path[role=button]");
const reference = async () => page.getByText(/^푸른 영역: 공식 코드로 연결한/).waitFor();
async function region(p, d) {
  await button("전국").click();
  await button(`${regions.find(r => r.provinceCode === p).provinceName} 선택`).click();
  if (d) await page.getByRole("region", { name: "시군구 선택", exact: true }).getByRole("button", { name: regions.find(r => r.provinceCode === p && r.districtCode === d).districtName, exact: true }).click();
}
async function save() {
  await page.evaluate(() => localStorage.removeItem("fest-compass.region-evidence.v1"));
  await page.getByRole("region", { name: "조회 자료 목록" }).getByRole("button", { name: /^1\. 경계 검증 자원/ }).click();
  await button("선택 자료를 기획 근거에 담기").click();
  await page.getByText(/기획 근거에 담았습니다/).waitFor();
  return page.evaluate(() => JSON.parse(localStorage.getItem("fest-compass.region-evidence.v1")).items.at(-1));
}
try {
  mkdirSync("output/playwright", { recursive: true });
  await page.goto(`${base}/regions`);
  const reject = page.getByRole("button", { name: /^(Reject All|모두 거부|Reject all)$/ });
  if (await reject.isVisible().catch(() => false)) await reject.click();
  await reference(); assert.equal(await shapes().count(), 15); passed.push("national-15-dated-provinces");
  await page.screenshot({ path: "output/playwright/boundary-national-test.png", fullPage: true });
  await button("2025년 경계에서 서울특별시 선택").focus(); await page.keyboard.press("Enter");
  await reference(); assert.equal(await shapes().count(), 25);
  await button("2025년 경계에서 종로구 선택").focus(); await page.keyboard.press("Enter");
  await reference(); assert.equal(await shapes().count(), 1); passed.push("keyboard-province-district-query");
  await region("44", "230"); await reference();
  await button("선택 지역 경계에 맞추기").click();
  const first = await save(); assert.deepEqual(first.selection.boundary.codes, ["34060"]); assert.equal(first.selection.boundary.boundaryDate, "2025-06-30"); passed.push("displayed-boundary-evidence-preserved");
  await page.screenshot({ path: "output/playwright/boundary-desktop-test.png", fullPage: true });
  await button("2025년 참고 경계 숨기기").click(); assert.equal(await shapes().count(), 0);
  const hidden = await save(); assert.equal(hidden.selection.boundary, undefined); passed.push("hidden-boundary-not-attached");
  await button("2025년 참고 경계 보기").click(); await reference();
  await region("41", "110"); await reference(); assert.equal(await shapes().count(), 1);
  assert.equal((await save()).selection.boundary.codes.length, 4); passed.push("ordinary-city-aggregate-only-on-selection");
  await region("28", "125"); await page.getByText(/^이 조회 지역에 맞는 경계는 확인 중/).waitFor();
  assert.equal(await shapes().count(), 0); assert.equal((await save()).selection.boundary, undefined); passed.push("changed-district-has-list-without-old-boundary");
  await region("12"); await page.getByText(/^이 조회 지역에 맞는 경계는 확인 중/).waitFor(); assert.equal(await shapes().count(), 0); passed.push("merged-province-not-invented");
  await context.route("**/data/boundaries/**/province-44.json", route => route.fulfill({ status: 503, body: "test unavailable" }));
  await region("44", "230"); await page.getByText(/^경계 자료를 불러오지 못했습니다/).waitFor();
  assert.equal((await save()).selection.boundary, undefined); passed.push("boundary-failure-keeps-resource-list");
  await context.unroute("**/data/boundaries/**/province-44.json");
  // Hold a previous region's response; release it only after choosing another
  // province. An aborted/late response must not restore the previous polygon.
  let held;
  await context.route("**/data/boundaries/**/province-11.json", async route => { const response = await route.fetch(); await new Promise(resolve => { held = async () => { try { await route.fulfill({ response }); } catch {} resolve(); }; }); });
  await region("11"); await page.waitForFunction(() => document.querySelector('[data-boundary-scope="11"]'));
  for (let i = 0; i < 100 && !held; i++) await page.waitForTimeout(50);
  assert.ok(held); await region("44", "230"); await reference(); await held();
  assert.ok(await button("2025년 경계에서 논산시 선택").count()); assert.equal(await button("2025년 경계에서 종로구 선택").count(), 0); passed.push("late-region-response-discarded");
  await button("간단 지도").click(); assert.equal((await save()).selection.boundary, undefined); passed.push("simple-map-does-not-claim-boundary");
  await button("도로 지도").click(); await reference();
  await page.setViewportSize({ width: 390, height: 844 }); await button("선택 지역 경계에 맞추기").click();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 390);
  await page.screenshot({ path: "output/playwright/boundary-mobile-test.png", fullPage: true }); passed.push("390px-boundary-controls");
  assert.deepEqual(errors, []); assert.deepEqual(writes, []);
  writeFileSync("output/playwright/boundary-result.json", JSON.stringify({ headless: true, background: "synthetic tiles; no OSMF requests", passed, errors, writes }, null, 2));
  console.log(JSON.stringify({ passed, errors, writes }));
} catch (error) { await page.screenshot({ path: "output/playwright/boundary-failure.png", fullPage: true }); console.error(JSON.stringify({ passed, errors })); throw error; }
finally { await browser.close(); }
