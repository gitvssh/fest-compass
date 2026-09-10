import assert from "node:assert/strict";
import { mkdirSync, readFileSync } from "node:fs";
import { chromium } from "playwright";
import { mockMapTiles } from "./map-test-tiles.mjs";
const base = process.env.E2E_BASE_URL;
if (!base) throw new Error("E2E_BASE_URL required");
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: "ko-KR" });
await mockMapTiles(context);
const page = await context.newPage(), errors = [], writes = [];
page.on("pageerror", e => errors.push(e.message));
page.on("request", r => { if (r.method() !== "GET" && new URL(r.url()).origin === new URL(base).origin) writes.push(r.url()); });
const key = "fest-compass.region-evidence.v1";
let delayNonsan = false;
// Only resource responses are deterministic fixtures. The server's real, bundled historical values are exercised.
await page.route("**/api/regions?*", async route => {
  try {
    const response = await route.fetch(), data = await response.json();
    if (!response.ok()) return route.fulfill({ response });
    if (delayNonsan && data.query.district === "230") await new Promise(done => setTimeout(done, 400));
    data.resources = { status: "complete", message: "자동 검증용 가상 자원 2건", total: 2, pages: 1, collectedAt: "2026-09-08T00:00:00Z", source: "https://www.data.go.kr/data/15101578/openapi.do", items: [
      { id: "9001", title: "검증용 관광지 (가상)", address: `${data.region.districtName} 검증용 주소`, longitude: 127.1, latitude: 36.2, start: null, end: null, modifiedAt: null },
      { id: "9002", title: "좌표 없는 검증 자료 (가상)", address: "좌표 확인 필요", longitude: null, latitude: null, start: null, end: null, modifiedAt: null },
    ] };
    await route.fulfill({ json: data });
  } catch { /* A superseded query is aborted by the client. */ }
});
const visible = l => l.waitFor({ state: "visible" });
try {
  await page.goto(`${base}/regions`);
  await visible(page.getByRole("button", { name: "제주특별자치도 선택", exact: true }));
  assert.equal(await page.getByRole("heading", { name: /방문 추세/ }).count(), 0);
  await page.getByRole("button", { name: "충청남도", exact: true }).click();
  await visible(page.getByRole("button", { name: "논산시", exact: true }));
  // The second-stage choices are above the fold after province selection.
  assert.ok((await page.getByRole("button", { name: "논산시", exact: true }).boundingBox()).y < 950);
  await page.getByRole("button", { name: "논산 2025년 3월 자료로 살펴보기 →", exact: true }).filter({ visible: true }).click();
  await visible(page.getByRole("heading", { name: "논산시 방문 추세", exact: true }));
  await visible(page.getByRole("button", { name: /좌표 없는 검증 자료/ }));
  assert.equal(await page.getByRole("button", { name: /지도에서 좌표 없는/ }).count(), 0);
  await page.getByRole("button", { name: "확대", exact: true }).click();
  assert.equal(await page.getByText(/공간 필터 적용 중/).count(), 0);
  await page.getByRole("button", { name: "이 영역의 자료 보기", exact: true }).click();
  await visible(page.getByText(/공간 필터 적용 중/));
  await page.getByRole("button", { name: /^1\. 검증용/ }).click();
  await visible(page.getByRole("heading", { name: "검증용 관광지 (가상)" }));
  await page.getByLabel("기획에 참고할 이유").fill("검증: 지역 자원 조사에 참고");
  await page.getByRole("button", { name: "선택 자료를 기획 근거에 담기", exact: true }).click();
  await visible(page.getByText(/기획 근거에 담았습니다/));
  await page.getByText("수치 표와 날짜별 출처 보기", { exact: true }).click();
  await page.getByRole("button", { name: "2025-03-27", exact: true }).click();
  await visible(page.getByText("52,671.5명 (통신 기반 추정)", { exact: true }));
  await page.getByRole("button", { name: "선택 자료를 기획 근거에 담기", exact: true }).click();
  await page.getByRole("button", { name: "선택 자료를 기획 근거에 담기", exact: true }).click();
  await visible(page.getByText(/같은 자료와 조회 조건을 이미 담았습니다/));
  await page.getByRole("button", { name: "방문 추세 기간 전체 담기", exact: true }).click();
  await visible(page.getByText(/기획 근거에 담았습니다/));
  assert.equal(await page.evaluate(k => JSON.parse(localStorage.getItem(k)).items.length, key), 3);
  assert.equal(await page.evaluate(k => JSON.parse(localStorage.getItem(k)).items[0].selection.mapBounds.length, key), 4);
  await page.getByRole("button", { name: "우리 지역으로 저장", exact: true }).click();
  await page.reload();
  await visible(page.getByRole("button", { name: "제주특별자치도 선택", exact: true }));
  await page.getByRole("button", { name: "우리 지역 바로가기", exact: true }).click();
  await visible(page.getByRole("heading", { name: "논산시 방문 추세", exact: true }));
  await page.getByRole("button", { name: "부여군", exact: true }).click();
  await visible(page.getByRole("heading", { name: "부여군 방문 추세", exact: true }));
  await visible(page.getByText("선택 지역·기간의 방문 이력이 미확보 상태입니다.", { exact: true }));
  assert.equal(await page.getByText("52,671.5명 (통신 기반 추정)", { exact: true }).count(), 0);
  delayNonsan = true;
  await page.getByRole("button", { name: "논산시", exact: true }).click();
  await page.getByRole("button", { name: "부여군", exact: true }).click();
  await visible(page.getByRole("heading", { name: "부여군 방문 추세", exact: true }));
  await page.waitForTimeout(600);
  assert.equal(await page.getByRole("heading", { name: "논산시 방문 추세", exact: true }).count(), 0);
  await page.goto(`${base}/evidence`);
  await visible(page.getByText("보관 근거 3개 / 최대 50개", { exact: true }));
  const pending = page.waitForEvent("download"); await page.getByRole("button", { name: "근거 파일 보관", exact: true }).click();
  const downloaded = await pending, exported = readFileSync(await downloaded.path(), "utf8");
  assert.equal(JSON.parse(exported).items.find(e => e.selection.dates?.length === 1).result.history.points[0].value, 52671.5);
  await page.getByLabel("근거 파일 가져오기", { exact: true }).setInputFiles({ name: "evidence.json", mimeType: "application/json", buffer: Buffer.from(exported) });
  await visible(page.getByText(/근거 0개를 추가했습니다/));
  await page.getByLabel("근거 파일 가져오기", { exact: true }).setInputFiles({ name: "broken.json", mimeType: "application/json", buffer: Buffer.from("{}") });
  await visible(page.getByText(/손상된 근거 파일/));
  assert.equal(await page.evaluate(k => JSON.parse(localStorage.getItem(k)).items.length, key), 3);
  await page.setViewportSize({ width: 390, height: 844 }); await page.goto(`${base}/regions`);
  await page.getByRole("combobox", { name: "시도 선택", exact: true }).selectOption("44");
  await page.getByRole("combobox", { name: "시군구 선택", exact: true }).selectOption("230");
  await visible(page.getByRole("heading", { name: "논산시 방문 추세", exact: true }));
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 390);
  mkdirSync("output/playwright", { recursive: true });
  await page.screenshot({ path: "output/playwright/regions-mobile.png", fullPage: true });
  await page.unroute("**/api/regions?*");
  await page.goto(`${base}/regions`);
  await page.getByRole("button", { name: "논산 2025년 3월 자료로 살펴보기 →", exact: true }).filter({ visible: true }).click();
  await visible(page.getByRole("heading", { name: "논산시 방문 추세", exact: true }));
  await visible(page.getByText(/공공데이터 연결이 준비되지 않았습니다/));
  assert.equal((await page.request.post(`${base}/api/regions`)).status(), 405);
  assert.equal((await page.request.get(`${base}/api/regions?province=44&district=230&start=2025-02-30&end=2025-03-31&kind=12`)).status(), 400);
  assert.deepEqual(errors, []); assert.deepEqual(writes, []);
  console.log(JSON.stringify({ headless: true, passed: ["national-entry", "visible-province-district-expansion", "coordinate-missing", "source-detail", "actual-52671.5", "snapshot-and-dedup", "export-import", "corrupt-import-preserves", "explicit-home-only", "different-region-clears", "out-of-order-request", "390px-no-overflow", "missing-key-keeps-history", "read-only-api"], browserErrors: errors.length, clientWrites: writes.length }));
} finally { await browser.close(); }
