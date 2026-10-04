// TS-FC-021 planning guide (design 24, bundle 1) and dialog/focus refinements, headless.
//
// Data provenance:
//  - REAL ARCHIVE: /api/existing/history, /api/existing/monthly and /api/new/visits pass through unchanged; the expected
//    before/after means are recomputed here from the checked-in bundle, never read from the app.
//  - 검증용 FIXTURES: tourism resources and registered events are synthetic ("(가상)"), because the runner has no
//    public-data key. Holiday facts inside /api/existing/schedule come from the server's bundled calendar.
// Run against a started app: E2E_BASE_URL=http://127.0.0.1:3100 node scripts/planning-guide-e2e.mjs
import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { chromium } from "playwright";
import { mockMapTiles } from "./map-test-tiles.mjs";

const base = process.env.E2E_BASE_URL ?? process.env.BASE_URL;
if (!base) throw new Error("E2E_BASE_URL (or BASE_URL) required");
const output = resolve(process.env.GUIDE_OUTPUT_DIR ?? "output/playwright/planning-guide");
mkdirSync(output, { recursive: true });
const report = { checkedAt: new Date().toISOString(), base, headless: true, checks: [], browserErrors: [] };
const check = (name, detail = {}) => { report.checks.push({ name, ...detail }); console.log(`ok - ${name}`); };

// ---- Real bundled archive facts (independent recomputation) ----
const historyFile = JSON.parse(readFileSync(new URL("../data/region-history.json", import.meta.url), "utf8"));
function archiveValue(date) {
  const hit = [...historyFile].sort((a, b) => b.collectedAt.localeCompare(a.collectedAt)).map(d => d.points.find(p => p.date === date)).find(Boolean);
  assert.ok(hit && hit.quality === "complete" && typeof hit.value === "number", `archive value for ${date}`);
  return hit.value;
}
const addDays = (day, n) => new Date(Date.parse(`${day}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const whole = v => v.toLocaleString("ko-KR", { maximumFractionDigits: 0 });
function sideMean(from, days) {
  const values = Array.from({ length: days }, (_, i) => archiveValue(addDays(from, i)));
  return whole(Math.round(values.reduce((a, b) => a + b, 0) / values.length));
}
const E2025 = { label: "2025년 · 3.27–3.30 · 목–일 4일", start: "2025-03-27", end: "2025-03-30", rounded: "85,213" };
const E2024 = { label: "2024년 · 3.21–3.24 · 목–일 4일", start: "2024-03-21", end: "2024-03-24", rounded: "90,413" };
for (const e of [E2025, E2024]) { e.before = sideMean(addDays(e.start, -7), 7); e.after = sideMean(addDays(e.end, 1), 7); }

const NONSAN_ID = "archive:nonsan-strawberry", NONSAN_CODE = "44230", LINKED_ID = "current:44230:525292";
const path = (id, view) => `/existing/${encodeURIComponent(id)}/${view}`;
const CANDIDATE = { start: "2026-10-01", end: "2026-10-04" };

// ---- 검증용 fixtures ----
const FIXTURE_AT = "2026-09-01T00:00:00.000Z";
const regions = new Map();
const RESOURCES = {
  "12": [{ id: "9101", kind: "12", title: "검증용 관광지 가 (가상)", address: "검증용 주소 1", point: { latitude: 36.2, longitude: 127.1 }, modifiedAt: "20260901000000" }],
  "14": [{ id: "9201", kind: "14", title: "검증용 문화시설 다 (가상)", address: "검증용 주소 3", point: { latitude: 36.19, longitude: 127.18 }, modifiedAt: null }],
};
const TYPE_LABEL = { "12": "관광지", "14": "문화시설" };
function resourcesBody(p) {
  const region = regions.get(`${p.get("province")}${p.get("district")}`);
  if (!region) throw new Error("region not captured from a real archive response yet");
  const kinds = ["12", "14"].filter(k => (p.get("types") ?? "12,14").split(",").includes(k));
  const request = { province: region.province, district: region.district, types: kinds };
  return { key: JSON.stringify(["resources", request.province, request.district, request.types]), request, retrievedAt: new Date().toISOString(), region,
    byType: kinds.map(kind => ({ status: "complete", error: null, collectedAt: FIXTURE_AT, kind, label: TYPE_LABEL[kind], total: RESOURCES[kind].length, items: RESOURCES[kind] })) };
}
const failOnce = new Set();
async function onApi(route) {
  const url = new URL(route.request().url()), p = url.searchParams, name = url.pathname;
  try {
    if (failOnce.has(name)) { failOnce.delete(name); return await route.fulfill({ status: 503, json: { error: { code: "source-unavailable", retryable: true } } }); }
    if (name === "/api/existing/resources") return await route.fulfill({ json: resourcesBody(p) });
    if (name === "/api/resources/detail") {
      const request = { province: p.get("province"), district: p.get("district"), kind: p.get("kind"), id: p.get("id") };
      return await route.fulfill({ json: { key: JSON.stringify(["new-resource-detail", request.province, request.district, request.kind, request.id]), request,
        retrievedAt: new Date().toISOString(), region: regions.get(`${request.province}${request.district}`) ?? null, status: "empty", error: null, detail: null, source: null } });
    }
    if (name === "/api/existing/schedule") {
      const response = await route.fetch(), body = await response.json();
      if (response.ok()) {
        const range = { start: p.get("start"), end: p.get("end") };
        body.events = { status: "empty", error: null, collectedAt: FIXTURE_AT, range, items: [] };
        body.summary.events = { status: "empty", count: 0, overlapping: 0, cancelled: 0, undated: 0 };
      }
      return await route.fulfill({ response, json: body });
    }
    if (name === "/api/existing/festivals" && p.get("id") === LINKED_ID) {
      // 검증용: the reviewed registration of the Nonsan archive record, with a located site.
      const region = regions.get(NONSAN_CODE), year = new Date(Date.now() + 9 * 3_600_000).getUTCFullYear();
      const request = { q: "", province: null, district: null, start: `${year}-01-01`, end: `${year}-12-31`, page: 1, total: null, id: LINKED_ID };
      const item = { id: LINKED_ID, source: "current", contentId: "525292", name: "논산딸기축제", region, start: null, end: null, datesVerified: false, address: "검증용 축제장 주소 (가상)",
        point: { latitude: 36.19545, longitude: 127.105591 }, modifiedAt: null, linkedArchiveId: NONSAN_ID,
        provenance: { title: "검증용 가상 등록 정보", url: "https://example.invalid/fixture", checkedAt: null, publishedAt: null, collectedAt: FIXTURE_AT } };
      return await route.fulfill({ json: { key: JSON.stringify(["festivals", request.id, request.q, request.province, request.district, request.start, request.end, request.page, request.total]), request,
        retrievedAt: new Date().toISOString(), archive: { status: "not-requested", error: null, collectedAt: null, items: [], freshness: null },
        current: { status: "complete", error: null, collectedAt: FIXTURE_AT, mode: "lookup", range: null, page: 1, next: null, continuity: null, total: 1, omitted: 0, lookup: "verified", items: [item] } } });
    }
    if (name === "/api/existing/festivals") {
      const response = await route.fetch(), body = await response.json();
      for (const f of body.archive?.items ?? []) regions.set(f.region.code, f.region);
      return await route.fulfill({ response, json: body });
    }
    return await route.continue();
  } catch { /* the page superseded or left this request */ }
}

// ---- Page helpers ----
const browser = await chromium.launch({ headless: true });
async function open(viewport = { width: 1440, height: 900 }) {
  const context = await browser.newContext({ viewport, locale: "ko-KR" });
  await context.addInitScript(() => { try { localStorage.setItem("fest-compass.intro-video.v1", "dismissed"); } catch { /* storage blocked */ } });
  await mockMapTiles(context);
  await context.route(u => u.pathname.startsWith("/api/existing/") || u.pathname.startsWith("/api/new/") || u.pathname.startsWith("/api/resources/"), onApi);
  const page = await context.newPage();
  page.setDefaultTimeout(20_000);
  page.on("pageerror", e => report.browserErrors.push(e.message));
  return { context, page };
}
const visible = l => l.waitFor({ state: "visible" });
const hidden = l => l.waitFor({ state: "hidden" });
const main = page => page.locator("main");
const waitFocusId = (page, id) => page.waitForFunction(i => document.activeElement?.id === i, id);
const tabs = (page, label = "축제 탐색 메뉴") => page.getByRole("navigation", { name: label });
const nextRow = page => page.getByRole("navigation", { name: "다음 할 일" });
// `has` takes a locator relative to each list item, so it is built from the page, not from the scope.
const editionItem = (scope, label) => scope.getByRole("listitem").filter({ has: (typeof scope.page === "function" ? scope.page() : scope).getByRole("heading", { name: label, exact: true }) });
async function includes(locator, expected, label = "") {
  const text = await locator.innerText();
  assert.ok(text.includes(expected), `${label} expected ${JSON.stringify(expected)} in ${JSON.stringify(text.slice(0, 500))}`);
}
async function excludes(locator, pattern, label = "") {
  const text = await locator.innerText();
  const found = typeof pattern === "string" ? text.includes(pattern) : pattern.test(text);
  assert.ok(!found, `${label} must not show ${pattern} in ${JSON.stringify(text.slice(0, 500))}`);
}
const DECIDING = /추천|적합한|최적|입장객 추정|수요|참가 규모|완료했|합격|적법|점수|source-unavailable|fixture|undefined|NaN|\bAPI\b/;
async function noOverflow(page, label) {
  const { sw, vw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, vw: document.documentElement.clientWidth }));
  assert.ok(sw <= vw, `${label}: page scrolls sideways (${sw} > ${vw})`);
}

async function home() {
  const { context, page } = await open();
  await page.goto(`${base}/`);
  const cards = page.locator("section[aria-labelledby='purpose-heading'] > ul > li");
  await includes(cards.nth(0), "얻는 것 · 방문 흐름·연계 후보·후보 기간을 한 장으로");
  await includes(cards.nth(1), "얻는 것 · 소재·장소·시기 후보를 한 장으로");
  const band = page.getByRole("link", { name: /축제 준비 전체 과정 보기/ });
  await visible(band);
  await band.click();
  await page.waitForURL(u => u.pathname === "/guide");
  check("G1-home-outcome-lines-and-process-band");
  await context.close();
}

async function existingStart() {
  const { context, page } = await open();
  await page.goto(`${base}/existing/search`);
  const map = page.getByRole("region", { name: "지난 회차를 돌아보고 다음 회차에 유지·변경할 점을 정리해요" });
  await visible(map);
  const steps = await map.getByRole("list", { name: "할 일" }).getByRole("listitem").allInnerTexts();
  assert.deepEqual(steps.map(s => s.split("\n")[0].trim()), ["방문 흐름 돌아보기", "연계 관광 찾기", "개최 시기 검토하기", "모아 보기"]);
  await includes(map, "처음이라면 이 순서로 · 순서는 자유");
  await includes(map, "판단은 담당자가 · 자료가 답하지 않아요");
  await includes(map, "끝에 얻는 것");
  assert.equal(await map.getByRole("button").count(), 0, "the map is read-only (no step to complete)");
  const first = page.getByRole("list", { name: "찾은 축제" }).getByRole("listitem").first();
  await visible(first);
  const box = await first.boundingBox();
  assert.ok(box && box.y < 900, `festival list stays in the first screen (y=${box?.y})`);
  check("G1-existing-start-flow-map-list-in-first-screen");
  await context.close();
}

async function existingJourney() {
  const { context, page } = await open();
  await page.goto(`${base}/existing/search`); // captures the real archive region for fixtures
  await page.goto(`${base}${path(NONSAN_ID, "visits")}`);
  await visible(page.getByRole("heading", { level: 2, name: "논산시 외지인 방문 추이" }));

  // G2: task tabs, plain links, no numbers or visited marks.
  const names = await tabs(page).getByRole("link").evaluateAll(links => links.map(a => [a.textContent.replace(/\s+/g, " ").trim(), a.getAttribute("aria-current")]));
  assert.deepEqual(names.map(([n]) => n), ["방문 흐름 돌아보기 · 과거 방문 흐름", "연계 관광 찾기 · 주변 관광자원", "개최 시기 검토하기 · 개최 시기", "모아 보기 · 한 장 요약"]);
  assert.deepEqual(names.map(([, c]) => c), ["page", null, null, null]);
  for (const [n] of names) assert.doesNotMatch(n, /\d|✓|완료/, "no step numbers or visited marks");

  // G3: one guide band, plain questions, no warning repeated in the subtitle.
  const guide = page.getByRole("region", { name: "방문 흐름 돌아보기 안내" });
  await includes(guide, "개최 기간과 앞뒤 방문을 견줘 기준을 잡아요");
  await includes(guide, "축제장 입장객 수 · 축제의 효과");
  assert.equal(await guide.getByRole("listitem").count(), 2, "two plain questions");
  assert.equal(await guide.locator("input, button").count(), 0, "questions are not controls");
  await excludes(page.locator("section[aria-labelledby='visits-heading'] > div").first(), "입장객", "subtitle keeps unit and basis only");

  // Before/after means on the charts' shared scale, recomputed from the bundle.
  for (const e of [E2025, E2024]) {
    const card = editionItem(page, e.label);
    await includes(card, `개최 전 7일`); await includes(card, `${e.before}명/일`, e.label);
    await includes(card, `${e.rounded}명/일`, e.label);
    await includes(card, `종료 후 7일`); await includes(card, `${e.after}명/일`, e.label);
  }
  check("G2-G3-tabs-guide-band-before-after-means", { E2025, E2024 });

  // Source dialog: shared header, Escape and backdrop close, focus back to the opener.
  const opener = page.getByRole("button", { name: "출처·산식 보기" });
  await opener.click();
  const dialog = page.getByRole("dialog", { name: "방문 자료 출처와 계산" });
  await visible(dialog);
  await includes(dialog, "개최 전·종료 후 일평균");
  // The close event (and the focus return it carries) is queued right after the dialog hides.
  const focusBack = () => opener.evaluate(el => new Promise((resolve, reject) => {
    const until = Date.now() + 2000;
    (function poll() { if (el === document.activeElement) resolve(true); else if (Date.now() > until) reject(new Error("focus did not return")); else requestAnimationFrame(poll); })();
  }));
  await page.keyboard.press("Escape"); await hidden(dialog);
  assert.equal(await focusBack(), true, "focus returns after Escape");
  await opener.click(); await visible(dialog);
  await page.mouse.click(8, 450); await hidden(dialog);
  assert.equal(await focusBack(), true, "focus returns after a backdrop click");
  await opener.click(); await visible(dialog);
  await dialog.getByRole("button", { name: "닫기", exact: true }).click(); await hidden(dialog);
  check("dialog-header-close-escape-backdrop-focus-return");

  // Focus language: 2px ring with a gap on controls, a glow inside text fields, the whole chip for a checkbox.
  await tabs(page).getByRole("link", { name: /연계 관광 찾기/ }).focus();
  await page.keyboard.press("Shift+Tab"); await page.keyboard.press("Tab");
  const ring = await page.evaluate(() => { const s = getComputedStyle(document.activeElement); return { w: s.outlineWidth, o: s.outlineOffset, style: s.outlineStyle }; });
  assert.deepEqual(ring, { w: "2px", o: "2px", style: "solid" });
  const field = page.locator("form:has(#edition-picker) input[inputmode=numeric]").first();
  await field.focus();
  const glow = await field.evaluate(el => ({ shadow: getComputedStyle(el).boxShadow, outline: getComputedStyle(el).outlineColor }));
  assert.match(glow.shadow, /rgba\(38, 103, 232, 0\.28\)/); assert.match(glow.outline, /rgba\(0, 0, 0, 0\)|transparent/);
  const box = page.locator("form:has(#edition-picker) input[type=checkbox]").first();
  await box.focus(); await page.keyboard.press("Shift+Tab"); await page.keyboard.press("Tab");
  const chip = await box.evaluate(el => ({ label: getComputedStyle(el.closest("label")).outlineWidth, own: getComputedStyle(el).outlineStyle }));
  assert.deepEqual(chip, { label: "2px", own: "none" });
  check("focus-ring-field-glow-chip-ring");

  // G2: the continue row leads to the next task and moves focus to its heading.
  const next = nextRow(page).getByRole("link", { name: /이어서\s*연계 관광 찾기/ });
  await next.click();
  await page.waitForURL(u => u.pathname === path(NONSAN_ID, "resources"));
  await waitFocusId(page, "resources-heading");
  await includes(page.getByRole("region", { name: "연계 관광 찾기 안내" }), "영업·예약 가능 여부 · 실제 이동 시간");
  // The festival site (reviewed registration) is marked on the map and becomes the distance anchor on request.
  await visible(page.locator(".rmap-venue"));
  await page.getByRole("button", { name: "축제장을 기준점으로", exact: true }).click();
  await visible(page.locator("p", { hasText: "기준점" }).filter({ hasText: "축제장 · 검증용 축제장 주소 (가상)" }));
  assert.equal(await page.getByRole("button", { name: "축제장을 기준점으로", exact: true }).count(), 0, "the site is the anchor now");
  await visible(page.getByText(/기준점에서 직선거리 약/).first());
  check("festival-site-badge-and-anchor");
  await page.getByRole("list", { name: "관광자원 목록" }).getByRole("button", { name: /검증용 관광지 가 \(가상\)/ }).click();
  await visible(page.getByRole("heading", { name: "검증용 관광지 가 (가상)" }).first());

  await tabs(page).getByRole("link", { name: /개최 시기 검토하기/ }).click();
  await waitFocusId(page, "timing-heading");
  await page.getByLabel("시작일").fill(CANDIDATE.start); await page.getByLabel("종료일").fill(CANDIDATE.end);
  await page.getByRole("button", { name: "후보 기간 추가" }).click();
  await visible(page.getByRole("article", { name: /^후보 A · / }));
  const toSummary = nextRow(page).getByRole("link", { name: /이어서\s*모아 보기/ });
  await toSummary.click();
  await page.waitForURL(u => u.pathname === path(NONSAN_ID, "summary"));
  await waitFocusId(page, "summary-heading");
  check("G2-continue-row-order-and-heading-focus");

  // G5: only what was chosen in this tab, with region, unit, basis and source.
  const sheet = page.locator("section.summary-sheet");
  await includes(sheet, "개인 검토 자료이며 공식 문서가 아니에요");
  for (const e of [E2025, E2024]) { const item = editionItem(sheet, e.label); await includes(item, `${e.before}명/일`); await includes(item, `${e.rounded}명/일`); }
  await includes(sheet, "충청남도 논산시 전체 외지인 방문 · 명/일 · 통신 기반 추정 · 축제장 입장객 수 아님");
  await includes(sheet, "검증용 관광지 가 (가상)");
  await includes(sheet, "후보 A · 2026.10.1(목) ~ 2026.10.4(일) · 4일");
  await visible(sheet.getByText("이 기간에 등록된 행사가 없어요", { exact: true })); // the candidate's own lookup
  await includes(sheet, "개천절");
  const checks = sheet.getByRole("region", { name: "다음에 확인할 일" }).getByRole("listitem");
  assert.equal(await checks.count(), 5);
  for (const kind of ["법령 근거", "담당 부서 확인", "기획 참고"]) await includes(sheet, kind);
  assert.equal(await sheet.locator("input[type=checkbox]").count(), 0, "no completion boxes");
  await excludes(main(page), DECIDING, "summary wording");
  const memo = sheet.getByRole("textbox", { name: "판단 메모" });
  await memo.fill("유지: 주말 공연\n변경: 셔틀 시간");
  await tabs(page).getByRole("link", { name: /연계 관광 찾기/ }).click(); await waitFocusId(page, "resources-heading");
  await tabs(page).getByRole("link", { name: /모아 보기/ }).click(); await waitFocusId(page, "summary-heading");
  assert.equal(await sheet.getByRole("textbox", { name: "판단 메모" }).inputValue(), "유지: 주말 공연\n변경: 셔틀 시간", "memo stays in this tab");
  await page.screenshot({ path: join(output, "existing-summary-1440.png"), fullPage: true });

  // Print: the sheet with its memo text; navigation, guide and buttons left out.
  await page.emulateMedia({ media: "print" });
  for (const gone of [tabs(page), nextRow(page), page.getByRole("button", { name: "인쇄하기" }), sheet.getByRole("textbox", { name: "판단 메모" })]) assert.equal(await gone.isVisible(), false);
  await includes(sheet, "pickDday · "); await includes(sheet, "출력");
  await includes(sheet, "유지: 주말 공연");
  await page.screenshot({ path: join(output, "existing-summary-print.png"), fullPage: true });
  await page.emulateMedia({ media: "screen" });
  check("G5-summary-chosen-only-sources-memo-print");

  // Reload: address conditions stay (editions), tab memory goes (place, candidate, memo) with a way back.
  await page.reload();
  await waitFocusId(page, "summary-heading").catch(() => {});
  await visible(editionItem(sheet, E2025.label));
  await includes(sheet, "아직 고른 장소가 없어요.");
  await visible(sheet.getByText("아직 후보 기간이 없어요.", { exact: true })); // waits for the festival's region
  assert.equal(await sheet.getByRole("textbox", { name: "판단 메모" }).inputValue(), "");
  await visible(sheet.getByRole("link", { name: /연계 관광 찾기/ }));
  check("G5-reload-keeps-address-drops-tab-memory");

  // A failed visits answer on the sheet stays local with a retry; the other parts still show.
  failOnce.add("/api/existing/history");
  await page.reload();
  const alert = sheet.getByRole("alert").filter({ hasText: "방문 자료를 불러오지 못했어요." });
  await visible(alert);
  await includes(sheet, "다음에 확인할 일");
  await alert.getByRole("button", { name: "다시 불러오기" }).click();
  await visible(editionItem(sheet, E2025.label));
  check("G4-summary-visits-failure-retry-others-stay");
  await context.close();

  // Direct entry by address in a fresh tab.
  const fresh = await open();
  await fresh.page.goto(`${base}${path(NONSAN_ID, "summary")}`);
  await visible(editionItem(fresh.page.locator("section.summary-sheet"), E2025.label));
  await visible(fresh.page.locator("section.summary-sheet").getByText("아직 후보 기간이 없어요.", { exact: true }));
  await nextRow(fresh.page).getByRole("link", { name: /이어서\s*축제 준비 전체 과정/ }).click();
  await fresh.page.waitForURL(u => u.pathname === "/guide");
  check("G5-direct-entry-and-continue-to-process");
  await fresh.context.close();
}

async function newJourney() {
  const { context, page } = await open();
  await page.goto(`${base}/new`);
  const map = page.getByRole("region", { name: "지역의 자원과 방문 흐름으로 소재·장소·시기 후보를 좁혀요" });
  await visible(map);
  const steps = await map.getByRole("list", { name: "할 일" }).getByRole("listitem").allInnerTexts();
  assert.deepEqual(steps.map(s => s.split("\n")[0].trim()), ["지역 자원 살펴보기", "방문 흐름 읽기", "개최 시기 검토하기", "모아 보기"]);
  await page.goto(`${base}/new/${NONSAN_CODE}/visits`);
  await visible(page.getByRole("heading", { level: 2, name: "논산시 방문 흐름" }));
  const names = await tabs(page, "새 축제 탐색 메뉴").getByRole("link").evaluateAll(links => links.map(a => a.textContent.replace(/\s+/g, " ").trim()));
  assert.deepEqual(names, ["지역 자원 살펴보기 · 지역 관광자원", "방문 흐름 읽기 · 지역 방문 흐름", "개최 시기 검토하기 · 개최 시기", "모아 보기 · 한 장 요약"]);
  await includes(page.getByRole("region", { name: "방문 흐름 읽기 안내" }), "축제·장소별 방문자 수 · 방문 목적");
  await nextRow(page).getByRole("link", { name: /이어서\s*개최 시기 검토하기/ }).click();
  await waitFocusId(page, "new-timing-heading");
  await page.getByLabel("시작일").fill(CANDIDATE.start); await page.getByLabel("종료일").fill(CANDIDATE.end);
  await page.getByRole("button", { name: "후보 기간 추가" }).click();
  await tabs(page, "새 축제 탐색 메뉴").getByRole("link", { name: /모아 보기/ }).click();
  await waitFocusId(page, "summary-heading");
  const sheet = page.locator("section.summary-sheet");
  await includes(sheet, "후보 A · 2026.10.1(목) ~ 2026.10.4(일) · 4일");
  await includes(sheet, "함께 보기에 넣은 장소가 없어요.");
  const visitsPart = sheet.getByRole("region", { name: "방문 흐름", exact: true });
  await page.waitForFunction(el => /가장 많은 달|월별 방문 자료가 없어요/.test(el.innerText), await visitsPart.elementHandle());
  if ((await visitsPart.innerText()).includes("가장 많은 달")) { await includes(visitsPart, "가장 적은 달"); await includes(visitsPart, "통신 기반 추정 · 지난 관측값"); }
  await excludes(main(page), DECIDING, "new summary wording");
  await page.screenshot({ path: join(output, "new-summary-1440.png"), fullPage: true });
  check("G1-G5-new-journey-map-tabs-summary");
  await context.close();
}

async function processGuide() {
  const { context, page } = await open();
  await page.goto(`${base}/guide`);
  await visible(page.getByRole("heading", { level: 1, name: "축제 준비 전체 과정" }));
  assert.equal(await main(page).locator("img").first().getAttribute("alt"), "", "decorative illustration");
  const rail = page.getByRole("navigation", { name: "단계 바로가기" }).getByRole("link");
  assert.equal(await rail.count(), 7);
  const phases = main(page).locator("li[id^=phase-]");
  assert.equal(await phases.count(), 7);
  for (let i = 0; i < 7; i++) {
    const card = phases.nth(i);
    assert.equal(await card.getAttribute("id"), `phase-${i + 1}`);
    await includes(card, "협의할 곳"); await includes(card, "원문");
    for (const a of await card.locator("a[target=_blank]").all()) {
      assert.match(await a.getAttribute("href"), /^https:\/\/[^/]+\.(go|or|re)\.kr\//);
      assert.equal(await a.getAttribute("rel"), "noreferrer");
    }
  }
  await excludes(main(page), /\d+\s*(억|만\s*원|원|일\s*전|주\s*전|일\s*이내|개월|명\s*이상)/, "no amounts or deadlines");
  await excludes(main(page), DECIDING, "guide wording");
  await rail.nth(4).click();
  await page.waitForFunction(() => location.hash === "#phase-5");
  const explore = phases.nth(0).getByRole("link", { name: "기존 축제 개선 · 방문 흐름 돌아보기" });
  assert.equal(await explore.getAttribute("href"), "/existing/search");
  await page.screenshot({ path: join(output, "guide-1440.png"), fullPage: true });
  check("G6-process-seven-phases-official-links-no-figures");
  await context.close();
}

async function narrowAndZoom() {
  for (const viewport of [{ width: 390, height: 844 }, { width: 720, height: 450 }]) {
    const { context, page } = await open(viewport);
    for (const target of ["/", "/existing/search", path(NONSAN_ID, "visits"), path(NONSAN_ID, "summary"), "/new", `/new/${NONSAN_CODE}/summary`, "/guide"]) {
      await page.goto(`${base}${target}`, { waitUntil: "networkidle" });
      await noOverflow(page, `${viewport.width}px ${target}`);
    }
    if (viewport.width === 390) {
      await page.goto(`${base}${path(NONSAN_ID, "visits")}`);
      await page.getByRole("button", { name: "논산딸기축제 관련 자료 검색" }).click();
      const sheet = page.getByRole("dialog", { name: "논산딸기축제 관련 자료 검색" });
      await visible(sheet);
      await page.waitForTimeout(250); // entry animation
      const box = await sheet.boundingBox();
      assert.ok(box && Math.abs(box.y + box.height - 844) <= 1 && box.width >= 389, `bottom sheet on a phone (${JSON.stringify(box)})`);
      await page.screenshot({ path: join(output, "related-search-390.png") });
      await page.keyboard.press("Escape");
      await page.goto(`${base}${path(NONSAN_ID, "summary")}`);
      await page.screenshot({ path: join(output, "existing-summary-390.png"), fullPage: true });
    }
    check(`G9-no-sideways-scroll-${viewport.width}px`);
    await context.close();
  }
}

try {
  await home();
  await existingStart();
  await existingJourney();
  await newJourney();
  await processGuide();
  await narrowAndZoom();
  assert.deepEqual(report.browserErrors, [], "no browser errors");
  check("no-browser-errors");
} finally {
  writeFileSync(join(output, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
  await browser.close();
}
console.log(`planning guide e2e: ${report.checks.length} checks passed`);
