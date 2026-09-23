// UC-FC-009 existing-festival journey acceptance (AC1–AC14), headless.
//
// Data provenance is explicit per check:
//  - REAL ARCHIVE: /api/existing/history and /api/existing/monthly pass through untouched (route.continue), and
//    holiday facts inside /api/existing/schedule come from the server's bundled calendar (route.fetch).
//  - 검증용 FIXTURES: currently registered festivals, tourism resources and registered events are synthetic,
//    named "(가상)"/"검증용", because the runner has no public-data key. They prove UI semantics only, never that
//    the production providers return such rows. A fixture that alters archive data (zero/missing/incompatible) is
//    confined to its own condition (before=2) and labelled below.
// Race ordering uses request gates (hold → release newer → release older); no sleeps decide ordering.
import assert from "node:assert/strict";
import { mkdirSync, readFileSync } from "node:fs";
import { chromium } from "playwright";
import { mockMapTiles } from "./map-test-tiles.mjs";

const base = process.env.E2E_BASE_URL ?? process.env.BASE_URL;
if (!base) throw new Error("E2E_BASE_URL (or BASE_URL) required");
const origin = new URL(base).origin;

// ---- Real bundled archive facts, read from the checked-in data (not from the app) ----
const editionsFile = JSON.parse(readFileSync(new URL("../data/festival-editions.json", import.meta.url), "utf8"));
const historyFile = JSON.parse(readFileSync(new URL("../data/region-history.json", import.meta.url), "utf8"));
const WONJU = editionsFile.editions.find(e => e.origin === "archive" && !e.start && !e.end);
assert.ok(WONJU, "the reviewed archive holds an undated edition");
/** Latest-collected complete value for a Nonsan date in the reviewed bundle. */
function archiveValue(date) {
  const hit = [...historyFile].sort((a, b) => b.collectedAt.localeCompare(a.collectedAt)).map(d => d.points.find(p => p.date === date)).find(Boolean);
  assert.ok(hit && hit.quality === "complete" && typeof hit.value === "number", `archive value for ${date}`);
  return hit.value;
}
const raw = v => v.toLocaleString("ko-KR", { maximumFractionDigits: 3 });
const whole = v => v.toLocaleString("ko-KR", { maximumFractionDigits: 0 });

// Acceptance values (UC-FC-009 AC3, data-visualization contract; independently recomputed from the bundle).
const E2025 = "2025년 · 3.27–3.30 · 목–일 4일", E2024 = "2024년 · 3.21–3.24 · 목–일 4일", E2023 = "2023년 · 3.8–3.12 · 수–일 5일";
const NONSAN = [
  { label: E2025, year: 2025, rows: 18, first: ["2025-03-20", "목"], last: ["2025-04-06", "일"], days: 4, rounded: "85,213",
    peak: "3.29(토) · 113,466.5명", calc: "계산 340,851명 ÷ 4일 = 85,212.75명/일 → 85,213명/일" },
  { label: E2024, year: 2024, rows: 18, first: ["2024-03-14", "목"], last: ["2024-03-31", "일"], days: 4, rounded: "90,413",
    peak: "3.23(토) · 126,164.5명", calc: "계산 361,651.5명 ÷ 4일 = 90,412.875명/일 → 90,413명/일" },
  { label: E2023, year: 2023, rows: 19, first: ["2023-03-01", "수"], last: ["2023-03-19", "일"], days: 5, rounded: "68,591",
    peak: "3.11(토) · 120,599.5명", calc: "계산 342,954.5명 ÷ 5일 = 68,590.9명/일 → 68,591명/일" },
];
const MONTHS_2025 = [43616, 42853, 51620, 47321, 53956, 47779, 44142, 49821, 45212, 55910, 48046, 42882];
const DAYS_2025 = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const NONSAN_ID = "archive:nonsan-strawberry", WONJU_ID = `archive:${WONJU.festivalId}`;
const SAME_NAME_ID = "current:44230:9900001"; // 검증용 current registration with the archive's exact name
const path = (id, view) => `/existing/${encodeURIComponent(id)}/${view}`;
const kstMonth = () => new Date(Date.now() + 9 * 3_600_000).toISOString().slice(0, 7);
const monthTitle = m => `${m.slice(0, 4)}년 ${Number(m.slice(5, 7))}월`;
const CANDIDATE_A = { start: "2026-09-28", end: "2026-10-03" }; // crosses a month boundary
// Canonical protocol keys, mirroring lib/existing/request.ts (festivalsKey/resourcesKey) so fixtures pass the UI's expectedKey check.
const festivalsLookupRequest = id => { const y = kstMonth().slice(0, 4); return { q: "", province: null, district: null, start: `${y}-01-01`, end: `${y}-12-31`, page: 1, total: null, id }; };
const festivalsKey = r => JSON.stringify(["festivals", r.id, r.q, r.province, r.district, r.start, r.end, r.page, r.total]);
const resourcesKey = r => JSON.stringify(["resources", r.province, r.district, r.types]);

// ---- 검증용 fixtures (synthetic, never presented as production results) ----
const FIXTURE_AT = "2026-09-01T00:00:00.000Z";
const regions = new Map(); // RegionRef by code, captured from real archive responses
const fixtureSource = { title: "검증용 가상 등록 정보", url: "https://example.invalid/fixture", checkedAt: null, publishedAt: null, collectedAt: FIXTURE_AT };
function regionFor(code) {
  const r = regions.get(code);
  if (!r) throw new Error(`region ${code} not captured from a real archive response yet`);
  return r;
}
function sameNameCurrent(dated) {
  return { id: SAME_NAME_ID, source: "current", contentId: "9900001", name: "논산딸기축제", region: regionFor("44230"),
    start: dated ? "2026-04-10" : null, end: dated ? "2026-04-12" : null, datesVerified: dated, address: "검증용 가상 주소 · 동명 현재 등록 항목",
    point: null, modifiedAt: null, linkedArchiveId: null, provenance: fixtureSource };
}
const currentBlock = (mode, items, extra = {}) => ({ status: items.length ? "complete" : "empty", error: null, collectedAt: FIXTURE_AT, mode, range: null,
  page: 1, next: null, continuity: null, total: items.length, omitted: 0, lookup: null, items, ...extra });
const RESOURCES = {
  "12": [
    { id: "9101", kind: "12", title: "검증용 관광지 가 (가상)", address: "검증용 주소 1", point: { latitude: 36.2, longitude: 127.1 }, modifiedAt: "20260901000000" },
    { id: "9102", kind: "12", title: "검증용 관광지 나 · 좌표 없음 (가상)", address: "검증용 주소 2", point: null, modifiedAt: null },
  ],
  "14": [{ id: "9201", kind: "14", title: "검증용 문화시설 다 (가상)", address: "검증용 주소 3", point: { latitude: 36.19, longitude: 127.18 }, modifiedAt: null }],
};
const TYPE_LABEL = { "12": "관광지", "14": "문화시설" };
const unavailableBlock = { status: "unavailable", error: { code: "source-unavailable", retryable: true }, collectedAt: null };
function resourcesBody(p, outcome) {
  const kinds = ["12", "14"].filter(k => (p.get("types") ?? "12,14").split(",").includes(k));
  const region = regionFor(`${p.get("province")}${p.get("district")}`);
  const request = { province: region.province, district: region.district, types: kinds };
  return { key: resourcesKey(request), request,
    retrievedAt: new Date().toISOString(), region,
    byType: kinds.map(kind => outcome === "unavailable" ? { ...unavailableBlock, kind, label: TYPE_LABEL[kind], total: null, items: [] }
      : { status: "complete", error: null, collectedAt: FIXTURE_AT, kind, label: TYPE_LABEL[kind], total: RESOURCES[kind].length, items: RESOURCES[kind] }) };
}
const event = (id, title, start, end, overlapDays) => ({ id, title, address: "검증용 가상 주소", start, end, datesKnown: overlapDays !== null,
  scheduleStatus: "registered", point: null, modifiedAt: null, overlapDays });
function eventsFor(start, end) {
  if (start === CANDIDATE_A.start && end === CANDIDATE_A.end) {
    return [event("9401", "검증용 월경계 행사 (가상)", "2026-09-25", "2026-09-29", 2),
      event("9402", "검증용 10월 행사 (가상)", "2026-10-02", "2026-10-10", 2),
      event("9403", "검증용 일정 미확인 행사 (가상)", null, null, null)];
  }
  if (start === "2026-09-01" && end === "2026-09-30") return [event("9401", "검증용 월경계 행사 (가상)", "2026-09-25", "2026-09-29", 5)];
  return [];
}

// ---- API routing: default provenance per endpoint, one-shot overrides, and request gates ----
const calls = [], queue = [], fixtureErrors = [];
let fetchFailures = 0;
async function fetchReal(route) {
  try { return await route.fetch(); } catch { fetchFailures++; return null; }
}
const REAL = () => ({ kind: "continue" }), NETWORK_FAIL = () => ({ kind: "abort" });
const HTTP_503 = () => ({ kind: "fulfill", options: { status: 503, json: { error: { code: "source-unavailable", retryable: true } } } });
const resourcesWith = outcome => (route, p) => ({ kind: "fulfill", options: { json: resourcesBody(p, outcome) } });
function scheduleWith(outcome) {
  return async (route, p) => {
    const response = await fetchReal(route);
    if (!response) return { kind: "abort" };
    const body = await response.json(); // real days + holiday coverage from the bundled calendar
    if (!response.ok()) return { kind: "fulfill", options: { response, json: body } };
    const range = { start: p.get("start"), end: p.get("end") };
    if (outcome === "events-unavailable") {
      body.events = { ...unavailableBlock, range, items: [] };
      body.summary.events = { status: "unavailable", count: null, overlapping: null, cancelled: null, undated: null };
    } else {
      const items = eventsFor(range.start, range.end), status = items.length ? "complete" : "empty";
      body.events = { status, error: null, collectedAt: FIXTURE_AT, range, items };
      body.summary.events = { status, count: items.length, overlapping: items.filter(e => (e.overlapDays ?? 0) > 0).length, cancelled: 0,
        undated: items.filter(e => e.overlapDays === null).length };
    }
    return { kind: "fulfill", options: { response, json: body } };
  };
}
async function festivals(route, p) {
  const id = p.get("id");
  if (id?.startsWith("current:")) { // 검증용 server-side identity lookup result
    const found = id === SAME_NAME_ID ? [sameNameCurrent(true)] : [];
    const request = festivalsLookupRequest(id);
    return { kind: "fulfill", options: { json: { key: festivalsKey(request), request,
      retrievedAt: new Date().toISOString(), archive: { status: "not-requested", error: null, collectedAt: null, items: [], freshness: null },
      current: currentBlock("lookup", found, { lookup: found.length ? "verified" : "not-found" }) } } };
  }
  const response = await fetchReal(route);
  if (!response) return { kind: "abort" };
  const body = await response.json();
  for (const f of body.archive?.items ?? []) regions.set(f.region.code, f.region);
  if (response.ok() && !id && body.request?.q) body.current = currentBlock("keyword", /딸기/.test(body.request.q) ? [sameNameCurrent(false)] : []);
  return { kind: "fulfill", options: { response, json: body } }; // the archive block stays exactly as served
}
const DEFAULTS = { history: REAL, monthly: REAL, festivals, resources: resourcesWith("ok"), schedule: scheduleWith("fixture") };

async function onApi(route) {
  const url = new URL(route.request().url()), endpoint = url.pathname.slice("/api/existing/".length), p = url.searchParams;
  calls.push({ endpoint, params: Object.fromEntries(p) });
  const index = queue.findIndex(q => q.match(endpoint, p)), entry = index < 0 ? null : queue.splice(index, 1)[0];
  let respond = entry?.respond ?? DEFAULTS[endpoint] ?? REAL;
  if (entry?.gate) {
    entry.gate.arrived();
    respond = (await entry.gate.released) ?? respond;
  }
  let plan;
  try { plan = await respond(route, p); } catch (e) { fixtureErrors.push(`${endpoint}: ${e.message}`); plan = { kind: "abort" }; }
  try {
    if (plan.kind === "continue") await route.continue();
    else if (plan.kind === "abort") await route.abort("failed");
    else await route.fulfill(plan.options);
  } catch { /* the page superseded or left this request */ }
  entry?.done?.();
}
const once = (match, respond) => queue.push({ match, respond });
function within(promise, label, ms = 20_000) {
  let timer;
  const timeout = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`timed out: ${label}`)), ms); });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}
function gate(match) {
  let arrived, release, done;
  const hasArrived = new Promise(r => { arrived = r; }), released = new Promise(r => { release = r; }), finished = new Promise(r => { done = r; });
  queue.push({ match, gate: { arrived, released }, done });
  return { arrived: within(hasArrived, "gated request"), release: async respond => { release(respond ?? null); await finished; } };
}
const is = (endpoint, test = () => true) => (e, p) => e === endpoint && test(p);

// ---- Page helpers ----
const browser = await chromium.launch({ headless: true });
const errors = [], writes = [], passed = [];
async function openContext(options = {}) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: "ko-KR", ...options });
  await mockMapTiles(context);
  await context.route(u => u.pathname.startsWith("/api/existing/"), onApi);
  const page = await context.newPage();
  page.setDefaultTimeout(20_000);
  page.on("pageerror", e => errors.push(e.message));
  page.on("request", r => { if (r.method() !== "GET" && new URL(r.url()).origin === origin) writes.push(`${r.method()} ${new URL(r.url()).pathname}`); });
  return { context, page };
}
const visible = l => l.waitFor({ state: "visible" });
const params = page => new URL(page.url()).searchParams;
const waitParam = (page, key, value) => page.waitForFunction(([k, v]) => new URL(location.href).searchParams.get(k) === v, [key, value]);
const waitFocusId = (page, id) => page.waitForFunction(i => document.activeElement?.id === i, id);
const waitFocusText = (page, text) => page.waitForFunction(t => document.activeElement?.textContent?.trim() === t, text);
const flush = page => page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
async function includes(locator, expected, label = "") {
  const text = await locator.innerText();
  assert.ok(text.includes(expected), `${label} expected ${JSON.stringify(expected)} in ${JSON.stringify(text.slice(0, 400))}`);
}
async function excludes(locator, pattern, label = "") {
  const text = await locator.innerText();
  const found = typeof pattern === "string" ? text.includes(pattern) : pattern.test(text);
  assert.ok(!found, `${label} must not show ${pattern} in ${JSON.stringify(text.slice(0, 400))}`);
}
const rowsOf = region => region.locator("tbody tr").evaluateAll(trs => trs.map(tr => [...tr.children].map(c => c.textContent.trim())));
const menu = (page, label) => page.getByRole("navigation", { name: "축제 탐색 메뉴" }).getByRole("link", { name: label, exact: true });
const editionHeading = (page, label) => page.getByRole("heading", { level: 3, name: label, exact: true });
const editionCard = (page, label) => page.getByRole("listitem").filter({ has: editionHeading(page, label) });
const ddOf = (scope, term) => scope.locator("dt", { hasText: term }).locator("xpath=following-sibling::dd[1]");
const candidate = (page, id) => page.getByRole("article", { name: new RegExp(`^후보 ${id} · `) });
const resourceList = page => page.getByRole("list", { name: "관광자원 목록" });
const escapeRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const resourceButton = (page, title) => resourceList(page).getByRole("button", { name: new RegExp(escapeRe(title)) });
const pickerApply = page => page.locator("form:has(#edition-picker)").getByRole("button", { name: "적용", exact: true });
const typeButton = (page, label) => page.getByRole("group", { name: "자원 유형" }).getByRole("button", { name: label, exact: true });
/** No anchor: no anchor controls and no distance wording anywhere in the list. */
async function noAnchor(page) {
  assert.equal(await page.getByRole("button", { name: "기준점 해제", exact: true }).count(), 0, "no anchor controls before an explicit anchor");
  if (await resourceList(page).count()) await excludes(resourceList(page), /직선거리|거리 미확인/, "no distance before an anchor");
}
async function noPageOverflow(page, label) {
  const [scroll, inner] = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
  assert.ok(scroll <= inner, `${label}: page scrollWidth ${scroll} > ${inner}`);
}
async function noInternalWording(page, label) {
  await excludes(page.locator("main"), /source-unavailable|not-requested|region-list|withheld|incompatible|snapshot|sha256|TourAPI|\bAPI\b|fixture|600건|undefined|NaN/, label);
}
async function storageState(page, context) {
  const s = await page.evaluate(async () => ({
    local: Object.keys(localStorage).sort(),
    session: Object.keys(sessionStorage).filter(k => !k.startsWith("__next")).sort(), // framework navigation internals excluded
    idb: indexedDB.databases ? (await indexedDB.databases()).map(d => d.name).sort() : [],
  }));
  return { ...s, cookies: (await context.cookies()).map(c => c.name).sort() };
}

// ---- Scenarios ----
async function searchAndOpen({ page }) {
  // AC1 · AC10 (keyboard) · AC11: purpose choice → keyword search → archive and same-name current stay separate targets.
  await page.goto(`${base}/`);
  await page.getByRole("link", { name: "기존 축제 찾기 →", exact: true }).click();
  await page.waitForURL(/\/existing\/search$/);
  await page.getByLabel("축제 이름").focus();
  await page.keyboard.type("논산딸기");
  await page.keyboard.press("Enter");
  await waitParam(page, "q", "논산딸기");
  await waitFocusText(page, "‘논산딸기’ 검색 결과");
  const archiveLink = page.locator(`a[href="${path(NONSAN_ID, "visits")}"]`), currentLink = page.locator(`a[href="${path(SAME_NAME_ID, "visits")}"]`);
  await visible(archiveLink); await visible(currentLink);
  await includes(archiveLink, "논산딸기축제"); await includes(archiveLink, "충청남도 논산시"); await includes(archiveLink, "지난 개최 2025년 · 2024년 · 2023년");
  await includes(currentLink, "논산딸기축제"); await includes(currentLink, "검증용");
  await excludes(currentLink, "지난 개최", "same-name current result carries no archive editions");
  passed.push("AC1-purpose-entry-keyboard-search", "AC11-same-name-separate-results");
  await page.keyboard.press("Tab");
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute("href")), path(NONSAN_ID, "visits"));
  await page.keyboard.press("Enter");
  await page.waitForURL(u => u.pathname === path(NONSAN_ID, "visits"));
  await waitFocusText(page, "논산딸기축제");
  passed.push("AC10-keyboard-result-to-title-focus");
}

async function defaultVisits({ page }) {
  // AC1 · AC3 (REAL ARCHIVE): default latest comparable 2025·2024, no writing step.
  assert.equal(params(page).get("editions"), null);
  await visible(page.getByRole("heading", { level: 2, name: "논산시 외지인 방문 추이", exact: true }));
  await includes(page.locator("main header"), "충청남도 논산시 · 지난 개최 2025년 · 2024년 · 2023년");
  await visible(page.getByText(/^충청남도 논산시 전체 · 명\/일 · 통신 기반 추정/));
  await visible(editionHeading(page, E2025)); await visible(editionHeading(page, E2024));
  assert.equal(await editionHeading(page, E2023).count(), 0);
  assert.equal(await page.getByRole("checkbox", { name: E2025, exact: true }).isChecked(), true);
  assert.equal(await page.getByRole("checkbox", { name: E2024, exact: true }).isChecked(), true);
  assert.equal(await page.getByRole("checkbox", { name: E2023, exact: true }).isChecked(), false);
  for (const e of NONSAN.slice(0, 2)) {
    const card = editionCard(page, e.label);
    await includes(card, `${e.rounded}명/일`, e.label); await includes(card, e.peak, e.label); await includes(card, `${e.days}일`, e.label);
  }
  await visible(page.getByText(/^자료 수집 .+ · .+ 조회$/)); // real archive freshness: original collection time, then retrieval time
  assert.equal(await page.locator("main textarea").count(), 0, "no mandatory writing field");
  passed.push("AC1-default-2025-2024-no-writing");
}

async function sourceDialogHasCalculations(page, editions = NONSAN) {
  const opener = page.getByRole("button", { name: "출처·산식 보기", exact: true });
  await opener.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: "방문 자료 출처와 계산" });
  await visible(dialog);
  for (const e of editions) await includes(dialog, e.calc, "raw mean");
  await page.keyboard.press("Escape");
  await dialog.waitFor({ state: "hidden" });
  await waitFocusText(page, "출처·산식 보기");
}

async function threeEditions({ page }) {
  // AC3 (REAL ARCHIVE): separate charts, shared Y axis, 19/18/18 dated points, exact raw means and peaks.
  await page.getByRole("checkbox", { name: E2023, exact: true }).check();
  await pickerApply(page).click();
  await page.waitForFunction(() => (new URL(location.href).searchParams.get("editions") ?? "").split(",").length === 3);
  assert.deepEqual(params(page).get("editions").split(",").sort(), ["nonsan-strawberry-2023", "nonsan-strawberry-2024", "nonsan-strawberry-2025"]);
  for (const e of NONSAN) {
    await visible(editionHeading(page, e.label));
    await includes(editionCard(page, e.label), `${e.rounded}명/일`, e.label);
    await includes(editionCard(page, e.label), e.peak, e.label);
  }
  await visible(page.locator("#edition-picker").getByText("3/3개 선택", { exact: true }));
  const charts = page.getByRole("img", { name: /^\d{4}년 논산시 외지인 방문 추이, / });
  assert.equal(await charts.count(), 3);
  await visible(page.getByRole("img", { name: /^2025년 논산시 외지인 방문 추이, 3\.20\(목\)부터 4\.6\(일\)까지/ }));
  const ticks = await charts.evaluateAll(svgs => svgs.map(svg => [...svg.querySelectorAll('text[text-anchor="end"]')].map(t => t.textContent).filter(t => t === "0" || t.includes("만"))));
  assert.ok(ticks[0].length >= 2 && ticks.every(t => JSON.stringify(t) === JSON.stringify(ticks[0])), `shared Y axis ${JSON.stringify(ticks)}`);
  await page.getByRole("button", { name: "수치 표 보기", exact: true }).click();
  for (const e of NONSAN) {
    const rows = await rowsOf(page.getByRole("region", { name: `${e.year}년 일별 수치 표`, exact: true }));
    assert.equal(rows.length, e.rows, `${e.year} chart window rows`);
    assert.deepEqual(rows[0].slice(0, 2), e.first); assert.deepEqual(rows.at(-1).slice(0, 2), e.last);
    assert.equal(rows.filter(r => r[2] === "개최기간").length, e.days);
    assert.ok(rows.every(r => r[3] !== "—"), `${e.year} archive window has no missing day`);
  }
  // Closing from inside returns focus to the toggle (AC10).
  await page.getByRole("button", { name: "수치 표 보기 닫기", exact: true }).last().click();
  await waitFocusText(page, "수치 표 보기");
  await sourceDialogHasCalculations(page);
  passed.push("AC3-real-archive-means-peaks-19-18-18-shared-axis", "AC10-table-and-dialog-close-focus");
}

async function windowInvariance({ page }) {
  // AC14 (REAL ARCHIVE): an edition's own date window, the common padding and the 1–3 selection never change the
  // original-period means. The 2025 window deliberately cuts the festival's last two days off the chart.
  const card2025 = editionCard(page, E2025);
  await card2025.getByRole("button", { name: "표시 기간 바꾸기", exact: true }).click();
  await card2025.getByLabel("표시 시작일").fill("2025-03-25");
  await card2025.getByLabel("표시 종료일").fill("2025-03-28");
  await card2025.getByRole("button", { name: "적용", exact: true }).click();
  await waitParam(page, "windows", "nonsan-strawberry-2025:2025-03-25:2025-03-28");
  await visible(card2025.getByText("표시 2025.3.25(화) ~ 2025.3.28(금)", { exact: true }));
  await page.getByRole("button", { name: "수치 표 보기", exact: true }).click();
  const custom = await rowsOf(page.getByRole("region", { name: "2025년 일별 수치 표", exact: true }));
  assert.deepEqual(custom.map(r => r[0]), ["2025-03-25", "2025-03-26", "2025-03-27", "2025-03-28"]);
  assert.equal((await rowsOf(page.getByRole("region", { name: "2024년 일별 수치 표", exact: true }))).length, 18, "other editions keep their window");
  for (const e of NONSAN) await includes(editionCard(page, e.label), `${e.rounded}명/일`);
  await page.getByRole("button", { name: "수치 표 보기 닫기", exact: true }).last().click();
  await sourceDialogHasCalculations(page);
  await card2025.getByRole("button", { name: "기본 표시 기간으로", exact: true }).click();
  await page.waitForFunction(() => new URL(location.href).searchParams.get("windows") === null);
  await visible(page.getByRole("img", { name: /^2025년 논산시 외지인 방문 추이, 3\.20\(목\)부터 4\.6\(일\)까지/ }));

  await page.getByLabel("개최 전 표시").fill("3");
  await page.getByLabel("종료 후 표시").fill("1");
  await pickerApply(page).click();
  await waitParam(page, "before", "3"); await waitParam(page, "after", "1");
  await visible(page.getByRole("img", { name: /^2025년 논산시 외지인 방문 추이, 3\.24\(월\)부터 3\.31\(월\)까지/ }));
  await page.getByRole("button", { name: "수치 표 보기", exact: true }).click();
  for (const e of NONSAN) {
    const table = page.getByRole("region", { name: `${e.year}년 일별 수치 표`, exact: true });
    await visible(table);
    assert.equal((await rowsOf(table)).length, e.days + 4);
    await includes(editionCard(page, e.label), `${e.rounded}명/일`);
  }
  await page.getByRole("button", { name: "수치 표 보기 닫기", exact: true }).last().click();
  await sourceDialogHasCalculations(page);
  for (const label of [E2025, E2024]) await page.getByRole("checkbox", { name: label, exact: true }).uncheck();
  await pickerApply(page).click();
  await waitParam(page, "editions", "nonsan-strawberry-2023");
  await visible(editionHeading(page, E2023));
  assert.equal(await editionHeading(page, E2025).count(), 0);
  await includes(editionCard(page, E2023), "68,591명/일");
  await sourceDialogHasCalculations(page, NONSAN.slice(2));
  // Removing every edition is corrected in place; nothing is applied.
  await page.getByRole("checkbox", { name: E2023, exact: true }).uncheck();
  await pickerApply(page).click();
  await visible(page.getByRole("alert").filter({ hasText: "비교할 회차를 하나 이상 골라 주세요." }));
  assert.equal(params(page).get("editions"), "nonsan-strawberry-2023");
  await page.getByRole("checkbox", { name: E2023, exact: true }).check();
  passed.push("AC14-window-and-selection-keep-original-denominator");
}

async function resourcesAnchor({ page }) {
  // AC5 · AC6 · AC10 (검증용 resources): menu by keyboard, one type fails then recovers, no distance before an explicit anchor.
  once(is("resources", p => p.get("types") === "14"), resourcesWith("unavailable"));
  await page.locator("main h1").focus();
  for (let i = 0; i < 15 && await page.evaluate(() => document.activeElement?.textContent?.trim()) !== "주변 관광자원"; i++) await page.keyboard.press("Tab");
  await page.keyboard.press("Enter");
  await page.waitForURL(u => u.pathname === path(NONSAN_ID, "resources"));
  await waitFocusId(page, "resources-heading");
  await visible(page.getByRole("heading", { level: 2, name: "논산시 전체 주변 관광자원", exact: true }));
  await visible(page.getByText("현재 등록 관광지·문화시설", { exact: true }));
  const failed = page.getByRole("alert").filter({ hasText: "문화시설 목록을 불러오지 못했어요." });
  await visible(failed);
  await visible(page.getByText("관광지 2건", { exact: true }));
  await visible(resourceButton(page, "검증용 관광지 가 (가상)"));
  await visible(page.getByText(/^불러온 2건 · 좌표 있는 자원 1건/));
  await failed.getByRole("button", { name: "다시 불러오기" }).click();
  await visible(page.getByText("문화시설 1건", { exact: true }));
  await visible(page.getByText(/^조회 3건 · 좌표 있는 자원 2건/));
  assert.equal(await failed.count(), 0);
  passed.push("AC6-one-type-failure-keeps-other-and-retry-applies");

  const list = resourceList(page);
  await includes(resourceButton(page, "검증용 관광지 나 · 좌표 없음 (가상)"), "지도 위치 없음");
  await noAnchor(page);
  const markers = page.getByRole("button", { name: /^지도에서 \d+\. .+ 상세 보기$/ });
  await visible(markers.first());
  assert.equal(await markers.count(), 2, "only located resources get map markers");
  // Moving the map is not an anchor; only the explicit button applies the centre.
  await page.getByRole("group", { name: /관광자원 지도/ }).focus();
  await page.keyboard.press("ArrowRight");
  await flush(page);
  await noAnchor(page);
  await page.getByRole("button", { name: "지도 중심을 기준점으로", exact: true }).click();
  await visible(page.getByText(/지도에서 고른 위치 \(\d+\.\d{4}, \d+\.\d{4}\)/));
  await includes(resourceButton(page, "검증용 관광지 나 · 좌표 없음 (가상)"), "거리 미확인");
  await includes(resourceButton(page, "검증용 관광지 가 (가상)"), "기준점에서 직선거리 약");
  await page.getByRole("button", { name: "기준점 해제", exact: true }).click();
  await noAnchor(page);
  await includes(list, "검증용 문화시설 다 (가상)");

  await resourceButton(page, "검증용 관광지 가 (가상)").click();
  await waitFocusId(page, "resource-detail-heading");
  await page.getByRole("button", { name: "이 자원을 기준점으로", exact: true }).click();
  await includes(resourceButton(page, "검증용 관광지 가 (가상)"), "기준점에서 직선거리 약 0.0km");
  await includes(resourceButton(page, "검증용 관광지 나 · 좌표 없음 (가상)"), "거리 미확인");
  await page.getByLabel("반경").selectOption("1");
  await visible(page.getByText(/기준점 1km 안 1건 \(좌표 없는 자원은 거리 미확인으로 함께 표시\)/));
  await visible(resourceButton(page, "검증용 관광지 나 · 좌표 없음 (가상)"));
  assert.equal(await resourceButton(page, "검증용 문화시설 다 (가상)").count(), 0, "a located resource outside the radius is hidden");
  passed.push("AC5-unlocated-stay-listed-no-distance-before-anchor", "AC5-map-move-is-not-anchor-explicit-centre-applies");
}

async function contextRestore({ page }) {
  // AC2: address conditions (types incl. none) survive menu moves and reload; the temporary anchor survives in-tab only.
  await typeButton(page, "문화시설").click();
  await waitParam(page, "types", "12");
  await menu(page, "개최 시기").click(); await waitFocusId(page, "timing-heading");
  await menu(page, "주변 관광자원").click(); await waitFocusId(page, "resources-heading");
  assert.equal(params(page).get("types"), "12");
  await visible(page.locator("p", { hasText: /^기준점\s*검증용 관광지 가 \(가상\)$/ }));
  await visible(page.getByText(/기준점 1km 안 1건/));
  await menu(page, "과거 방문 흐름").click(); await waitFocusId(page, "visits-heading");
  assert.equal(params(page).get("editions"), "nonsan-strawberry-2023");
  assert.equal(params(page).get("before"), "3"); assert.equal(params(page).get("after"), "1");
  await visible(editionHeading(page, E2023));
  await menu(page, "주변 관광자원").click(); await waitFocusId(page, "resources-heading");
  await typeButton(page, "관광지").click();
  await waitParam(page, "types", "none");
  await visible(page.getByText("관광지 또는 문화시설을 골라 주세요.", { exact: true }));
  assert.equal(await resourceList(page).count(), 0);
  await page.reload();
  await visible(page.getByText("관광지 또는 문화시설을 골라 주세요.", { exact: true }));
  assert.equal(params(page).get("types"), "none");
  assert.equal(await typeButton(page, "관광지").getAttribute("aria-pressed"), "false");
  await typeButton(page, "관광지").click();
  await waitParam(page, "types", "12");
  await visible(resourceButton(page, "검증용 관광지 가 (가상)"));
  assert.equal(await typeButton(page, "문화시설").getAttribute("aria-pressed"), "false");
  await noAnchor(page); // the anchor was temporary
  passed.push("AC2-menu-restores-address-and-tab-context-reload-resets-temporary");
}

async function timing({ page }) {
  // AC7 · AC8 · AC12 · AC14: REAL monthly archive and holidays; 검증용 registered events.
  await menu(page, "개최 시기").click(); await waitFocusId(page, "timing-heading");
  const month = kstMonth();
  await waitParam(page, "month", month);
  assert.equal(params(page).get("year"), null, "the default observation year is not written as a decision");
  await visible(page.getByRole("heading", { name: `${monthTitle(month)} · 논산시 달력`, exact: true }));
  await visible(page.getByRole("heading", { name: "2025년 논산시 월별 외지인 방문", exact: true }));
  const options = await page.getByLabel("관측연도").locator("option").allTextContents();
  for (const y of ["2023년", "2024년", "2025년"]) assert.ok(options.includes(y), `${y} complete`);
  assert.ok(options.some(o => /^2026년 \(\d+\/365일 값 있음\)$/.test(o)), `2026 is marked incomplete: ${options}`);
  await page.getByRole("button", { name: "월별 수치 표 보기", exact: true }).click();
  const monthly = await rowsOf(page.getByRole("region", { name: "월별 일평균 수치 표", exact: true }));
  assert.deepEqual(monthly, MONTHS_2025.map((v, i) => [monthTitle(`2025-${String(i + 1).padStart(2, "0")}`), whole(v), `${DAYS_2025[i]}/${DAYS_2025[i]}일`, "0일"]));
  passed.push("AC7-real-2025-monthly-12-values-default-year");

  const byMonth = page.getByRole("group", { name: "일별 값을 볼 달" });
  await byMonth.getByRole("button", { name: "10월", exact: true }).click();
  await visible(page.getByText("2025년 10월 · 일평균 55,910명/일", { exact: true }));
  const october = await rowsOf(page.getByRole("region", { name: "2025년 10월 일별 수치 표", exact: true }));
  assert.equal(october.length, 31);
  assert.deepEqual(october[0], ["2025-10-01", "수", raw(archiveValue("2025-10-01"))]);

  // Candidate A crosses a month: one request for the whole range, and no count until it completes.
  const held = gate(is("schedule", p => p.get("start") === CANDIDATE_A.start));
  await page.getByLabel("시작일").fill(CANDIDATE_A.start);
  await page.getByLabel("종료일").fill(CANDIDATE_A.end);
  await page.getByRole("button", { name: "후보 기간 추가", exact: true }).click();
  await held.arrived;
  const a = candidate(page, "A");
  await visible(a.getByText("이 기간의 일정을 불러오고 있어요…", { exact: true }));
  await excludes(a, /등록 행사|\d+건/, "no count before the whole range completes");
  await held.release();
  await visible(ddOf(a, "등록 행사"));
  await includes(a, "후보 A · 2026.9.28(월) ~ 2026.10.3(토) · 6일");
  assert.equal(await ddOf(a, "토·일요일").innerText(), "1일");
  assert.equal(await ddOf(a, "공휴일").innerText(), "2026.10.3(토) 개천절", "real bundled holiday");
  await includes(ddOf(a, "등록 행사"), "기간과 겹치는 등록 행사 2건");
  await includes(ddOf(a, "등록 행사"), "일정 미확인 1건은 세지 않았어요");
  await includes(a, "후보와 2일 겹침");
  const candidateCalls = calls.filter(c => c.endpoint === "schedule" && c.params.start === CANDIDATE_A.start);
  assert.ok(candidateCalls.length >= 1 && candidateCalls.every(c => c.params.end === CANDIDATE_A.end), JSON.stringify(candidateCalls));
  await page.waitForFunction(() => document.activeElement?.getAttribute("data-candidate") === "A");
  passed.push("AC14-cross-month-candidate-whole-range-count-after-complete");

  await page.getByLabel("시작일").fill("2027-01-30");
  await page.getByLabel("종료일").fill("2027-02-03");
  await page.getByRole("button", { name: "후보 기간 추가", exact: true }).click();
  const b = candidate(page, "B");
  await visible(ddOf(b, "공휴일"));
  await includes(b, "후보 B · 2027.1.30(토) ~ 2027.2.3(수) · 5일");
  assert.equal(await ddOf(b, "공휴일").innerText(), "일부 날짜의 공휴일 정보를 불러올 수 없어요", "partially covered holidays are not 'none'");
  assert.equal(await ddOf(b, "토·일요일").innerText(), "2일");
  await includes(ddOf(b, "등록 행사"), "이 기간에 등록된 행사가 없어요");
  assert.equal(await page.getByRole("button", { name: "후보 기간 추가", exact: true }).isDisabled(), true);
  await visible(page.getByText("후보는 2개까지 비교할 수 있어요. 다른 기간을 보려면 후보 하나를 지워 주세요.", { exact: true }));
  passed.push("AC8-holiday-partial-not-none-and-candidate-cap-2");

  // AC12: the month link opens only that real past month; Back restores the observation choice and focus.
  await page.getByRole("button", { name: "2025년 10월 일정 보기", exact: true }).click();
  await waitParam(page, "month", "2025-10");
  await waitFocusId(page, "calendar-heading");
  await visible(page.getByRole("heading", { name: "2025년 10월 · 논산시 달력", exact: true }));
  await visible(page.getByRole("heading", { name: "2025년 논산시 월별 외지인 방문", exact: true }));
  assert.equal(params(page).get("year"), null);
  assert.equal(await page.getByRole("article", { name: /^후보 [AB] · / }).count(), 2);
  await page.goBack();
  await waitParam(page, "month", month);
  await waitFocusId(page, "observed-month-2025-10");
  assert.equal(await byMonth.getByRole("button", { name: "10월", exact: true }).getAttribute("aria-pressed"), "true");
  passed.push("AC12-real-yearmonth-link-back-restores-selection-focus");

  await page.getByRole("button", { name: "후보 B 지우기", exact: true }).click();
  await waitFocusId(page, "candidates-heading");
  await page.getByLabel("시작일").fill("2027-03-02");
  await page.getByLabel("종료일").fill("2027-03-05");
  await page.getByRole("button", { name: "후보 기간 추가", exact: true }).click();
  const c = candidate(page, "B");
  await visible(ddOf(c, "공휴일"));
  await includes(c, "후보 B · 2027.3.2(화) ~ 2027.3.5(금) · 4일");
  assert.equal(await ddOf(c, "공휴일").innerText(), "이 기간의 공휴일 정보를 불러올 수 없어요", "unsupported holiday year is not 'none'");
  passed.push("AC8-holiday-unsupported-range");

  await a.getByRole("button", { name: "달력에서 보기", exact: true }).click();
  await waitParam(page, "month", "2026-09");
  await waitFocusId(page, "calendar-heading");
  await visible(page.getByText("검증용 월경계 행사 (가상)").first());
  await page.getByLabel("관측연도").selectOption("2026");
  await page.getByRole("button", { name: "연도 보기", exact: true }).click();
  await waitParam(page, "year", "2026");
  await visible(page.getByRole("heading", { name: "2026년 논산시 월별 외지인 방문", exact: true }));
  // The heading reflects the applied year while its response is still loading. Read the table only after that
  // year's actual row is rendered; locator.evaluateAll alone would accept an empty, not-yet-mounted table.
  await visible(page.getByRole("region", { name: "월별 일평균 수치 표", exact: true }).getByRole("rowheader", { name: "2026년 8월", exact: true }));
  const rows2026 = await rowsOf(page.getByRole("region", { name: "월별 일평균 수치 표", exact: true }));
  const august = rows2026.find(r => r[0] === "2026년 8월");
  assert.ok(august && august[1] === "—" && august[2] !== "31/31일", `2026-08 incomplete: ${august}`);
  assert.notEqual(rows2026.find(r => r[0] === "2026년 1월")?.[1], "—");
  assert.equal(params(page).get("month"), "2026-09", "the observation year never moves the calendar");
  assert.equal(await page.getByRole("article", { name: /^후보 [AB] · / }).count(), 2);
  await excludes(page.locator("section[aria-labelledby=timing-heading]"), /최적|추천|점수|순위|예상 방문|예측/, "no forecast or score");
  passed.push("AC7-2026-incomplete-no-forecast");

  await menu(page, "과거 방문 흐름").click(); await waitFocusId(page, "visits-heading");
  await menu(page, "개최 시기").click(); await waitFocusId(page, "timing-heading");
  assert.equal(params(page).get("year"), "2026"); assert.equal(params(page).get("month"), "2026-09");
  assert.equal(await page.getByRole("article", { name: /^후보 [AB] · / }).count(), 2);
  await page.reload();
  await visible(page.getByRole("heading", { name: "2026년 논산시 월별 외지인 방문", exact: true }));
  await visible(page.getByRole("heading", { name: "2026년 9월 · 논산시 달력", exact: true }));
  assert.equal(await page.getByRole("article", { name: /^후보 [AB] · / }).count(), 0, "candidates are temporary");
  await noInternalWording(page, "timing");
  passed.push("AC2-timing-address-restore-candidates-reset-on-reload");
}

async function races({ page }) {
  // AC9: the newer condition is released first, then the older one — success and failure variants.
  const older = gate(is("history", p => p.get("editions") === "nonsan-strawberry-2025,nonsan-strawberry-2024"));
  await page.goto(`${base}${path(NONSAN_ID, "visits")}?editions=nonsan-strawberry-2025,nonsan-strawberry-2024`);
  await older.arrived;
  await page.getByRole("checkbox", { name: E2025, exact: true }).uncheck();
  await page.getByRole("checkbox", { name: E2024, exact: true }).uncheck();
  await page.getByRole("checkbox", { name: E2023, exact: true }).check();
  const newer = gate(is("history", p => p.get("editions") === "nonsan-strawberry-2023"));
  await pickerApply(page).click();
  await newer.arrived;
  await newer.release(REAL);
  await visible(editionHeading(page, E2023));
  await older.release(REAL);
  await flush(page);
  assert.equal(await editionHeading(page, E2025).count(), 0);
  assert.equal(await editionHeading(page, E2024).count(), 0);
  assert.equal(params(page).get("editions"), "nonsan-strawberry-2023");
  await includes(editionCard(page, E2023), "68,591명/일");
  assert.equal(await page.getByRole("alert").filter({ hasText: "불러오지 못했어요" }).count(), 0);

  const olderMonth = gate(is("schedule", p => p.get("start") === "2026-11-01"));
  await page.goto(`${base}${path(NONSAN_ID, "timing")}?month=2026-11`);
  await olderMonth.arrived;
  const newerMonth = gate(is("schedule", p => p.get("start") === "2026-12-01"));
  await page.getByRole("button", { name: "다음 달, 2026년 12월 보기", exact: true }).click();
  await newerMonth.arrived;
  await newerMonth.release();
  await visible(page.getByRole("heading", { name: "2026년 12월 · 논산시 달력", exact: true }));
  await visible(page.getByText("이 기간에 등록된 행사가 없어요.", { exact: true }));
  await olderMonth.release(HTTP_503);
  await flush(page);
  assert.equal(params(page).get("month"), "2026-12");
  await visible(page.getByRole("heading", { name: "2026년 12월 · 논산시 달력", exact: true }));
  assert.equal(await page.getByRole("alert").filter({ hasText: /달력 정보를 불러오지 못했어요|행사 일정을 불러오지 못했어요/ }).count(), 0);
  passed.push("AC9-late-success-and-late-failure-never-override-latest");
}

async function zeroMissingIncompatible({ page }) {
  // AC4 — 검증용 FIXTURE on the real response, for condition before=2 only:
  //   2024-03-19 (outside the period) := 0, 2024-03-22 (inside) := missing, 2025-03-28 (inside) := 0,
  //   2023 := a different visit definition. Summaries are made consistent with those points.
  const fixture = {};
  once(is("history", p => p.get("before") === "2"), async route => {
    const response = await fetchReal(route);
    if (!response) return { kind: "abort" };
    const body = await response.json();
    const set = (e, date, value) => {
      const point = e.points.find(x => x.date === date);
      if (!point) throw new Error(`fixture date ${date}`);
      point.value = value;
    };
    for (const e of body.editions) {
      if (e.editionId === "nonsan-strawberry-2024") {
        set(e, "2024-03-19", 0); set(e, "2024-03-22", null);
        e.summary = { status: "incomplete", denominator: 4, observedDays: 3, missingDates: ["2024-03-22"] };
      }
      if (e.editionId === "nonsan-strawberry-2025") {
        set(e, "2025-03-28", 0);
        const values = e.points.filter(x => x.inFestival).map(x => x.value), numerator = values.reduce((s, v) => s + v, 0);
        const mean = numerator / values.length, max = Math.max(...values);
        e.summary = { status: "available", numerator, denominator: values.length, mean, rounded: Math.round(mean),
          peak: { value: max, dates: e.points.filter(x => x.inFestival && x.value === max).map(x => x.date) } };
        fixture.rounded2025 = Math.round(mean);
      }
      if (e.editionId === "nonsan-strawberry-2023") {
        Object.assign(e, { state: "incompatible", withheld: { reason: "incompatible", message: "지역·지표 정의가 달라 같은 기준으로 비교하지 않아요" },
          window: null, windowSource: null, points: [], summary: { status: "incompatible" }, comparable: false, source: { edition: e.source.edition, visits: null } });
      }
    }
    const shown = body.editions.filter(e => e.state === "available").flatMap(e => e.points.map(x => x.value)).filter(v => typeof v === "number");
    body.sharedYMax = Math.max(...shown);
    body.maxWindowDays = Math.max(...body.editions.map(e => e.points.length));
    return { kind: "fulfill", options: { response, json: body } };
  });
  await page.goto(`${base}${path(NONSAN_ID, "visits")}?before=2&editions=nonsan-strawberry-2025,nonsan-strawberry-2024,nonsan-strawberry-2023`);
  const c2024 = editionCard(page, E2024), c2025 = editionCard(page, E2025), c2023 = editionCard(page, E2023);
  await visible(c2024.getByText("이 회차의 평균을 계산할 수 없어요.", { exact: true }));
  await includes(c2024, "개최 4일 중 3일만 값이 있어요. 값 없는 날: 3.22(금)");
  await includes(c2024, "선이 끊긴 날: 값 없음");
  await excludes(c2024, "명/일", "no partial mean");
  await includes(c2025, `${whole(fixture.rounded2025)}명/일`, "a real zero stays in the mean");
  await excludes(c2025, /평균을 계산할 수 없어요|선이 끊긴/);
  await includes(c2023, "지역·지표 정의가 달라 같은 기준으로 비교하지 않아요");
  await excludes(c2023, "명/일");
  assert.equal(await c2023.getByRole("img").count(), 0);
  await page.getByRole("button", { name: "수치 표 보기", exact: true }).click();
  const r2024 = await rowsOf(page.getByRole("region", { name: "2024년 일별 수치 표", exact: true }));
  assert.equal(r2024.find(r => r[0] === "2024-03-19")[3], "0");
  assert.equal(r2024.find(r => r[0] === "2024-03-22")[3], "—");
  assert.equal((await rowsOf(page.getByRole("region", { name: "2025년 일별 수치 표", exact: true }))).find(r => r[0] === "2025-03-28")[3], "0");
  assert.equal(await page.getByRole("region", { name: "2023년 일별 수치 표", exact: true }).count(), 0);
  await c2024.getByRole("button", { name: "회차 바꾸기", exact: true }).click();
  await waitFocusId(page, "edition-picker");
  await page.getByRole("button", { name: "출처·산식 보기", exact: true }).click();
  await includes(page.getByRole("dialog", { name: "방문 자료 출처와 계산" }), "표시 기간 2024.3.19(화) ~ 2024.3.31(일)");
  await page.keyboard.press("Escape");
  await visible(menu(page, "개최 시기"));
  await noInternalWording(page, "visits fixture");

  // 검증용 FIXTURE for condition before=1 only: 2023 := cancelled, as the server shapes it (points kept, none in
  // the festival period, no mean). No chart or average, but the reason and the raw daily table stay.
  once(is("history", p => p.get("before") === "1"), async route => {
    const response = await fetchReal(route);
    if (!response) return { kind: "abort" };
    const body = await response.json();
    for (const e of body.editions) {
      if (e.editionId !== "nonsan-strawberry-2023") continue;
      Object.assign(e, { status: "취소", state: "cancelled", withheld: { reason: "cancelled", message: "취소된 회차라 개최기간 평균을 만들지 않아요" },
        summary: { status: "cancelled" }, comparable: false, points: e.points.map(x => ({ ...x, inFestival: false })) });
    }
    const shown = body.editions.filter(e => e.state === "available").flatMap(e => e.points.map(x => x.value)).filter(v => typeof v === "number");
    body.sharedYMax = Math.max(...shown);
    return { kind: "fulfill", options: { response, json: body } };
  });
  await page.goto(`${base}${path(NONSAN_ID, "visits")}?before=1&editions=nonsan-strawberry-2025,nonsan-strawberry-2023`);
  const cancelled = editionCard(page, E2023);
  await visible(cancelled.getByText("취소된 회차라 개최기간 평균을 만들지 않아요", { exact: true }));
  await excludes(cancelled, "명/일");
  assert.equal(await cancelled.getByRole("img").count(), 0);
  await includes(editionCard(page, E2025), "85,213명/일");
  await page.getByRole("button", { name: "수치 표 보기", exact: true }).click();
  const r2023 = await rowsOf(page.getByRole("region", { name: "2023년 일별 수치 표", exact: true }));
  assert.equal(r2023.length, 5 + 1 + 7);
  assert.equal(r2023.filter(r => r[2] === "개최기간").length, 0);
  passed.push("AC4-zero-vs-missing-and-definition-difference(검증용)");
}

async function wonjuUndated({ page }) {
  // AC4 · AC11 (REAL ARCHIVE): the undated Wonju edition is a real target without dates, chart or mean.
  await page.goto(`${base}/existing/search?q=${encodeURIComponent("치악산")}`);
  const link = page.locator(`a[href="${path(WONJU_ID, "visits")}"]`);
  await visible(link);
  await includes(link, WONJU.name); await includes(link, `${WONJU.year}년(개최일 미확인)`);
  await link.click();
  await page.waitForURL(u => u.pathname === path(WONJU_ID, "visits"));
  await visible(page.getByRole("heading", { level: 1, name: WONJU.name, exact: true }));
  await visible(page.getByRole("heading", { level: 2, name: "원주시 외지인 방문 추이", exact: true }));
  await includes(page.locator("main header"), `원주시 · 지난 개최 ${WONJU.year}년(개최일 미확인)`);
  const card = editionCard(page, `${WONJU.year}년 · 개최일 미확인`);
  await visible(card);
  await includes(card, "개최일이 확인되지 않은 회차예요");
  await excludes(card, "명/일");
  assert.equal(await card.getByRole("img").count(), 0);
  assert.equal(await card.getByRole("button", { name: "표시 기간 바꾸기" }).count(), 0, "no chart window without dates");
  await visible(page.getByRole("link", { name: "개최 시기 보기", exact: true }));
  await menu(page, "개최 시기").click(); await waitFocusId(page, "timing-heading");
  await visible(page.getByRole("heading", { name: "원주시 월별 외지인 방문", exact: true }));
  await visible(page.getByText("이 기간의 방문 자료가 없어요.", { exact: true }));
  await excludes(page.locator("main"), "43,616", "never substituted by another region");
  await menu(page, "주변 관광자원").click(); await waitFocusId(page, "resources-heading");
  await visible(page.getByRole("heading", { level: 2, name: "원주시 전체 주변 관광자원", exact: true }));
  await visible(resourceButton(page, "검증용 관광지 가 (가상)"));
  passed.push("AC4-real-undated-wonju-no-chart-no-mean-no-substitution");
}

async function currentSameName({ page }) {
  // AC11 (검증용 current identity): same name, separate target, no archive editions attached.
  await page.goto(`${base}/existing/search?q=${encodeURIComponent("논산딸기")}`);
  await page.locator(`a[href="${path(SAME_NAME_ID, "visits")}"]`).click();
  await page.waitForURL(u => u.pathname === path(SAME_NAME_ID, "visits"));
  await visible(page.getByRole("heading", { level: 1, name: "논산딸기축제", exact: true }));
  await visible(page.getByText("충청남도 논산시 · 현재 등록 정보 · 등록 일정 2026.4.10(금) ~ 2026.4.12(일)", { exact: true }));
  await excludes(page.locator("main header"), "지난 개최 기록");
  await excludes(page.locator("main header"), "지난 개최");
  await visible(page.getByText("이 축제의 지난 개최 기록이 없어요.", { exact: true }));
  for (const e of NONSAN) assert.equal(await editionHeading(page, e.label).count(), 0);
  assert.equal(calls.filter(c => c.endpoint === "history" && (c.params.festival ?? "").startsWith("current")).length, 0, "no archive history requested for a current identity");
  await page.getByRole("button", { name: "등록 정보 출처", exact: true }).click();
  const source = page.getByRole("dialog", { name: "현재 등록 정보 출처" });
  await includes(source, "한국관광공사에 현재 등록된 축제·행사 정보예요.");
  await includes(source, "등록 주소: 검증용 가상 주소");
  await page.keyboard.press("Escape");
  await waitFocusText(page, "등록 정보 출처");
  await page.getByRole("link", { name: "주변 관광자원 보기", exact: true }).click();
  await visible(resourceButton(page, "검증용 관광지 가 (가상)"));
  passed.push("AC11-current-same-name-no-archive-join-resources-still-available");
}

async function mobile({ page }) {
  // AC10: 390px, no page-level horizontal overflow on every journey view.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${base}/existing/search?q=${encodeURIComponent("논산딸기")}`);
  await visible(page.locator(`a[href="${path(NONSAN_ID, "visits")}"]`));
  await noPageOverflow(page, "search");
  await page.goto(`${base}${path(NONSAN_ID, "visits")}?editions=nonsan-strawberry-2025,nonsan-strawberry-2024,nonsan-strawberry-2023`);
  await visible(editionHeading(page, E2023));
  await page.getByRole("button", { name: "수치 표 보기", exact: true }).click();
  await visible(page.getByRole("region", { name: "2023년 일별 수치 표", exact: true }));
  await noPageOverflow(page, "visits");
  await menu(page, "주변 관광자원").click();
  await visible(resourceButton(page, "검증용 관광지 가 (가상)"));
  await noPageOverflow(page, "resources list");
  await page.getByRole("group", { name: "보기 방식" }).getByRole("button", { name: "지도", exact: true }).click();
  await visible(page.getByRole("group", { name: /관광자원 지도/ }));
  await noPageOverflow(page, "resources map");
  await menu(page, "개최 시기").click();
  await visible(page.getByRole("heading", { name: "2025년 논산시 월별 외지인 방문", exact: true }));
  await page.getByRole("button", { name: "월별 수치 표 보기", exact: true }).click();
  await page.getByRole("group", { name: "일별 값을 볼 달" }).getByRole("button", { name: "10월", exact: true }).click();
  await page.getByLabel("시작일").fill(CANDIDATE_A.start);
  await page.getByLabel("종료일").fill(CANDIDATE_A.end);
  await page.getByRole("button", { name: "후보 기간 추가", exact: true }).click();
  await visible(ddOf(candidate(page, "A"), "등록 행사"));
  await includes(ddOf(candidate(page, "A"), "등록 행사"), "기간과 겹치는 등록 행사 2건");
  await noPageOverflow(page, "timing");
  mkdirSync("output/playwright", { recursive: true });
  await page.screenshot({ path: "output/playwright/existing-journey-mobile.png", fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  passed.push("AC10-390px-no-page-overflow");
}

async function staleAndChangedFailure() {
  // AC13 · AC6: same-condition refresh failures keep the earlier result with its time and a retry; a changed
  // condition that fails shows no earlier data. A fake clock expires the tab's 10-minute result memory.
  const { context, page } = await openContext();
  await context.clock.install();
  await page.goto(`${base}${path(NONSAN_ID, "visits")}`);
  await visible(editionHeading(page, E2025));
  await includes(editionCard(page, E2025), "85,213명/일");
  await menu(page, "개최 시기").click(); await waitFocusId(page, "timing-heading");
  await page.getByLabel("시작일").fill(CANDIDATE_A.start);
  await page.getByLabel("종료일").fill(CANDIDATE_A.end);
  await page.getByRole("button", { name: "후보 기간 추가", exact: true }).click();
  await visible(ddOf(candidate(page, "A"), "등록 행사"));
  await includes(ddOf(candidate(page, "A"), "등록 행사"), "기간과 겹치는 등록 행사 2건");
  await menu(page, "주변 관광자원").click();
  await visible(page.getByText(/^조회 3건 · 좌표 있는 자원 2건/));
  await context.clock.fastForward("11:00");

  once(is("history"), NETWORK_FAIL);
  await menu(page, "과거 방문 흐름").click(); await waitFocusId(page, "visits-heading");
  const stale = page.getByRole("alert").filter({ hasText: /새 자료를 불러오지 못했어요\. .+에 조회한 결과를 보여드리고 있어요\./ });
  await visible(stale);
  await includes(editionCard(page, E2025), "85,213명/일", "same-condition earlier result stays");
  await stale.getByRole("button", { name: "다시 불러오기" }).click();
  await stale.waitFor({ state: "detached" });
  await includes(editionCard(page, E2025), "85,213명/일");
  once(is("history", p => p.get("editions") === "nonsan-strawberry-2023"), NETWORK_FAIL);
  for (const label of [E2025, E2024]) await page.getByRole("checkbox", { name: label, exact: true }).uncheck();
  await page.getByRole("checkbox", { name: E2023, exact: true }).check();
  await pickerApply(page).click();
  const failed = page.getByRole("alert").filter({ hasText: "방문 자료를 불러오지 못했어요." });
  await visible(failed);
  for (const e of NONSAN) assert.equal(await editionHeading(page, e.label).count(), 0, "a failed new condition shows no earlier condition's data");
  await failed.getByRole("button", { name: "다시 불러오기" }).click();
  await visible(editionHeading(page, E2023));
  passed.push("AC13-history-same-condition-network-failure-keeps-earlier", "AC13-changed-condition-failure-hides-earlier");

  once(is("schedule", p => p.get("start") === CANDIDATE_A.start), scheduleWith("events-unavailable"));
  once(is("schedule", p => p.get("start") !== CANDIDATE_A.start), scheduleWith("events-unavailable"));
  await menu(page, "개최 시기").click(); await waitFocusId(page, "timing-heading");
  const a = candidate(page, "A");
  await visible(a.getByText(/새 일정을 불러오지 못했어요\. .+ 기준이에요\./));
  await includes(ddOf(a, "등록 행사"), "기간과 겹치는 등록 행사 2건", "earlier full-range count kept and labelled");
  await visible(page.getByRole("alert").filter({ hasText: /새 행사 일정을 불러오지 못했어요\. .+ 기준 일정이에요\./ }));
  passed.push("AC13-schedule-block-failure-keeps-earlier-events");

  once(is("resources", p => p.get("types") === "12"), resourcesWith("unavailable"));
  once(is("resources", p => p.get("types") === "14"), NETWORK_FAIL);
  await menu(page, "주변 관광자원").click(); await waitFocusId(page, "resources-heading");
  const staleAttractions = page.getByRole("alert").filter({ hasText: /관광지 새 목록을 불러오지 못했어요\./ });
  await visible(staleAttractions);
  await visible(page.getByRole("alert").filter({ hasText: /문화시설 새 목록을 불러오지 못했어요\./ }));
  assert.equal(await resourceList(page).getByRole("button").count(), 3, "earlier lists of the same condition stay");
  await staleAttractions.getByRole("button", { name: "다시 불러오기" }).click();
  await staleAttractions.waitFor({ state: "detached" });
  passed.push("AC13-resources-block-and-network-failure-keep-earlier");
  await noInternalWording(page, "resources stale");
  return { context, page };
}

// ---- Run ----
const main = await openContext();
try {
  const { page, context } = main;
  await searchAndOpen(main);
  const before = await storageState(page, context);
  await defaultVisits(main);
  await threeEditions(main);
  await windowInvariance(main);
  await resourcesAnchor(main);
  await contextRestore(main);
  await timing(main);
  await races(main);
  await zeroMissingIncompatible(main);
  await wonjuUndated(main);
  await currentSameName(main);
  await mobile(main);
  const second = await staleAndChangedFailure();
  // AC2 · AC10: the whole journey stores no decision and sends no write request.
  assert.deepEqual(await storageState(page, context), before, "no persisted decisions in the main tab");
  assert.deepEqual((await storageState(second.page, second.context)).local, [], "no persisted decisions in the second tab");
  assert.deepEqual(writes, [], "no same-origin non-GET request");
  assert.deepEqual(errors, []);
  assert.deepEqual(fixtureErrors, []);
  assert.equal(queue.length, 0, `unused overrides: ${queue.length}`);
  passed.push("AC2-no-writes-no-storage");
  console.log(JSON.stringify({ headless: true, realArchive: ["history", "monthly", "holidays"], fixtures: "검증용 current/resources/events + before=2 history",
    passed, browserErrors: errors.length, clientWrites: writes.length, apiRequests: calls.length, ignoredFetchFailures: fetchFailures }));
} finally {
  await browser.close();
}
