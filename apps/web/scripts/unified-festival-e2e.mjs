// Unified festival journey (any registered festival → the same three views), headless.
//
// Data provenance is explicit per check:
//  - REAL ARCHIVE: the reviewed archive block of /api/existing/festivals and, for the linked scenario,
//    /api/existing/history supplies unchanged archived values. The fixture current identity is remapped below;
//    real provider identity resolution is separately checked by server unit and public acceptance tests.
//  - 검증용 FIXTURES: registered festivals (incl. registration periods), district monthly/daily visits of
//    안동시·강릉시 and tourism resources are synthetic and labelled "검증용"/"(가상)". They prove UI semantics
//    only — never that the providers return such rows or values.
//  - LINKED (integration): a registered festival linked to archive:nonsan-strawberry must load the same archive
//    history inline under its own id. It needs the server's current-id history support; set
//    UNIFIED_SKIP_LINKED=1 only before that server change is integrated (the run then reports it as skipped).
import assert from "node:assert/strict";
import { mkdirSync, readFileSync } from "node:fs";
import { chromium } from "playwright";

const base = process.env.E2E_BASE_URL ?? process.env.BASE_URL;
if (!base) throw new Error("E2E_BASE_URL (or BASE_URL) required");
const origin = new URL(base).origin;
const skipLinked = process.env.UNIFIED_SKIP_LINKED === "1";

// ---- Regions from the checked-in catalogue (the same rows the app verifies against) ----
const catalogue = JSON.parse(readFileSync(new URL("../data/region-catalogue.json", import.meta.url), "utf8")).rows;
function regionRef(districtName) {
  const r = catalogue.find(x => x.districtName === districtName);
  assert.ok(r, districtName);
  return { province: r.provinceCode, district: r.districtCode, code: `${r.provinceCode}${r.districtCode}`, name: `${r.provinceName} ${r.districtName}`, districtName: r.districtName };
}
const ANDONG = regionRef("안동시"), GANGNEUNG = regionRef("강릉시"), NONSAN = regionRef("논산시");

// ---- Display helpers mirrored from components/existing/format.ts ----
const WD = ["일", "월", "화", "수", "목", "금", "토"];
const weekday = d => WD[new Date(`${d}T00:00:00Z`).getUTCDay()];
const fullDate = d => `${d.slice(0, 4)}.${Number(d.slice(5, 7))}.${Number(d.slice(8, 10))}(${weekday(d)})`;
const period = (s, e) => `${fullDate(s)} ~ ${fullDate(e)}`;
const raw = v => v.toLocaleString("ko-KR", { maximumFractionDigits: 3 });
const path = (id, view) => `/existing/${encodeURIComponent(id)}/${view}`;
const kstYear = () => new Date(Date.now() + 9 * 3_600_000).toISOString().slice(0, 4);

// ---- 검증용 fixtures ----
const FIXTURE_AT = "2026-09-01T00:00:00.000Z";
const fixtureSource = { title: "검증용 가상 등록 정보", url: "https://example.invalid/fixture", checkedAt: null, publishedAt: null, collectedAt: FIXTURE_AT };
const NONSAN_ID = "archive:nonsan-strawberry";
const current = (region, contentId, name, extra = {}) => ({ id: `current:${region.code}:${contentId}`, source: "current", contentId, name, region,
  start: null, end: null, datesVerified: false, address: "검증용 가상 주소", point: null, modifiedAt: null, linkedArchiveId: null, provenance: fixtureSource, ...extra });
const REG_2025 = { id: "reg-2025", start: "2025-09-12", end: "2025-09-14", collectedAt: "2025-08-20T01:00:00.000Z" };
const ANDONG_FEST = current(ANDONG, "9900301", "검증용 안동 가을축제 (가상)", { start: "2026-10-02", end: "2026-10-05", datesVerified: true, periods: [REG_2025] });
const GANGNEUNG_FEST = current(GANGNEUNG, "9900401", "검증용 강릉 해변축제 (가상)");
const LINKED = current(NONSAN, "9900201", "논산딸기축제", { start: "2027-03-26", end: "2027-03-29", datesVerified: true, linkedArchiveId: NONSAN_ID, address: "검증용 가상 주소 · 연결된 등록 항목" });
const SAME_NAME = current(NONSAN, "9900001", "논산딸기축제", { address: "검증용 가상 주소 · 연결 없는 동명 항목" });
const PAGE2 = current(ANDONG, "9900302", "검증용 안동 두번째 쪽 행사 (가상)");
const LOOKUP = new Map([ANDONG_FEST, GANGNEUNG_FEST, LINKED].map(f => [f.id, f]));

// District daily values: 10000 + month·500 + day·100 (2025-09-20 missing). 강릉시 has no observations.
const MISSING = "2025-09-20";
const dailyValue = date => (date === MISSING ? null : 10000 + Number(date.slice(5, 7)) * 500 + Number(date.slice(8, 10)) * 100);
function daysOf(year) { const out = []; for (let t = Date.UTC(year, 0, 1); new Date(t).getUTCFullYear() === year; t += 86_400_000) out.push(new Date(t).toISOString().slice(0, 10)); return out; }
function monthlyBody(p) {
  const region = [ANDONG, GANGNEUNG].find(r => r.province === p.get("province") && r.district === p.get("district"));
  if (!region) throw new Error(`no monthly fixture for ${p}`);
  const requested = p.get("year") ? Number(p.get("year")) : null;
  const request = { province: region.province, district: region.district, year: requested };
  const freshness = { mode: "runtime", collectedAt: FIXTURE_AT, runtimeCollectedAt: FIXTURE_AT, refresh: { status: "ok", retryable: false } };
  const envelope = { key: JSON.stringify(["monthly", request.province, request.district, request.year]), request, retrievedAt: new Date().toISOString(), region, freshness,
    source: { title: "검증용 가상 방문 자료", url: "https://example.invalid/fixture", checkedAt: null, publishedAt: null, collectedAt: FIXTURE_AT } };
  if (region === GANGNEUNG) return { ...envelope, status: "empty", years: [], defaultYear: null, year: null, months: [], daily: [] };
  const years = [{ year: 2025, days: 365, observedDays: 364, complete: false }, { year: 2024, days: 366, observedDays: 366, complete: true }];
  const year = requested ?? 2024;
  if (!years.some(y => y.year === year)) return { ...envelope, status: "empty", years, defaultYear: 2024, year, months: [], daily: [] };
  const daily = daysOf(year).map(date => ({ date, weekday: new Date(`${date}T00:00:00Z`).getUTCDay(), value: dailyValue(date) }));
  const months = [...new Set(daily.map(d => d.date.slice(0, 7)))].map(month => {
    const list = daily.filter(d => d.date.startsWith(month)), seen = list.filter(d => d.value !== null), sum = seen.reduce((a, d) => a + d.value, 0);
    const complete = seen.length === list.length;
    return { month, days: list.length, observedDays: seen.length, missingDays: list.length - seen.length, zeroDays: 0, sum: complete ? sum : null,
      mean: complete ? sum / list.length : null, rounded: complete ? Math.round(sum / list.length) : null, status: complete ? "complete" : "partial" };
  });
  return { ...envelope, status: year === 2024 ? "complete" : "partial", years, defaultYear: 2024, year, months, daily };
}
function resourcesBody(p) {
  const region = [ANDONG, GANGNEUNG, NONSAN].find(r => r.province === p.get("province") && r.district === p.get("district"));
  const kinds = ["12", "14"].filter(k => (p.get("types") ?? "12,14").split(",").includes(k));
  const request = { province: region.province, district: region.district, types: kinds };
  return { key: JSON.stringify(["resources", request.province, request.district, request.types]), request, retrievedAt: new Date().toISOString(), region,
    byType: kinds.map(kind => ({ status: "complete", error: null, collectedAt: FIXTURE_AT, kind, label: kind === "12" ? "관광지" : "문화시설", total: 1,
      items: [{ id: `98${kind}`, kind, title: `검증용 ${region.districtName} ${kind === "12" ? "관광지" : "문화시설"} (가상)`, address: "검증용 주소", point: null, modifiedAt: null }] })) };
}
const currentBlock = (mode, items, extra = {}) => ({ status: items.length ? "complete" : "empty", error: null, collectedAt: FIXTURE_AT, mode, range: null,
  page: 1, next: null, continuity: null, total: items.length, omitted: 0, lookup: null, items, ...extra });
const unavailable = { status: "unavailable", error: { code: "source-unavailable", retryable: true }, collectedAt: null };

// ---- API routing ----
const calls = [], queue = [], fixtureErrors = [];
let realNonsan = null;
async function realArchive() {
  if (!realNonsan) {
    const r = await fetch(`${origin}/api/existing/festivals?${new URLSearchParams({ id: NONSAN_ID })}`, { headers: { accept: "application/json" } });
    realNonsan = (await r.json()).archive.items.find(f => f.id === NONSAN_ID);
    assert.ok(realNonsan, "real reviewed archive record of 논산딸기축제");
  }
  return realNonsan;
}
async function festivals(route, p) {
  const id = p.get("id");
  if (id?.startsWith("current:")) { // 검증용 server-side identity lookup
    const found = LOOKUP.get(id);
    const y = kstYear(), request = { q: "", province: null, district: null, start: `${y}-01-01`, end: `${y}-12-31`, page: 1, total: null, id };
    const archiveItems = found?.linkedArchiveId ? [await realArchive()] : [];
    return { kind: "fulfill", options: { json: { key: JSON.stringify(["festivals", id, "", null, null, request.start, request.end, 1, null]), request, retrievedAt: new Date().toISOString(),
      archive: { status: archiveItems.length ? "complete" : "not-requested", error: null, collectedAt: null, items: archiveItems, freshness: null },
      current: currentBlock("lookup", found ? [found] : [], { lookup: found ? "verified" : "not-found" }) } } };
  }
  if (/논산.?딸기/.test(p.get("q") ?? "") && Number(p.get("page") ?? 1) > 1) { // 검증용 further page: only its current block is read
    const request = { q: p.get("q"), province: null, district: null, page: Number(p.get("page")), total: Number(p.get("total")), id: null };
    return { kind: "fulfill", options: { json: { key: JSON.stringify(["festivals-fixture-page", request.q, request.page]), request, retrievedAt: new Date().toISOString(),
      archive: { status: "complete", error: null, collectedAt: null, items: [], freshness: null },
      current: currentBlock("keyword", [PAGE2], { page: 2, total: 3, continuity: "consistent" }) } } };
  }
  const response = await route.fetch();
  const body = await response.json(); // the archive block stays exactly as served
  const q = body.request?.q ?? "";
  if (response.ok() && /논산.?딸기/.test(q)) body.current = currentBlock("keyword", [LINKED, SAME_NAME], { next: { page: 2, total: 3 }, total: 3, continuity: "consistent" });
  return { kind: "fulfill", options: { response, json: body } };
}
const DEFAULTS = {
  festivals, monthly: (route, p) => ({ kind: "fulfill", options: { json: monthlyBody(p) } }),
  resources: (route, p) => ({ kind: "fulfill", options: { json: resourcesBody(p) } }),
  history: async (route, p) => {
    if (p.get("festival") !== LINKED.id) return {kind:"continue"};
    const query = new URLSearchParams(p); query.set("festival", NONSAN_ID);
    const response = await fetch(`${origin}/api/existing/history?${query}`);
    assert.equal(response.status,200);
    const body = await response.json(), key = JSON.parse(body.key);
    body.request.festival = LINKED.id; key[1] = LINKED.id; body.key = JSON.stringify(key);
    return {kind:"fulfill",options:{json:body}};
  }, schedule: () => ({ kind: "continue" }),
};
async function onApi(route) {
  const url = new URL(route.request().url()), endpoint = url.pathname.slice("/api/existing/".length), p = url.searchParams;
  calls.push({ endpoint, params: Object.fromEntries(p) });
  const index = queue.findIndex(q => q.match(endpoint, p)), entry = index < 0 ? null : queue.splice(index, 1)[0];
  if (entry?.gate) { entry.gate.arrived(); await entry.gate.released; }
  let plan;
  try { plan = await (entry?.respond ?? DEFAULTS[endpoint] ?? (() => ({ kind: "continue" })))(route, p); }
  catch (e) { fixtureErrors.push(`${endpoint}: ${e.message}`); plan = { kind: "abort" }; }
  try {
    if (plan.kind === "continue") await route.continue();
    else if (plan.kind === "abort") await route.abort("failed");
    else await route.fulfill(plan.options);
  } catch { /* superseded */ }
}
const once = (match, respond) => queue.push({ match, respond });
function gate(match) {
  let arrived, release;
  const hasArrived = new Promise(r => { arrived = r; }), released = new Promise(r => { release = r; });
  queue.push({ match, gate: { arrived, released } });
  return { arrived: hasArrived, release: () => release() };
}
const is = (endpoint, test = () => true) => (e, p) => e === endpoint && test(p);

// ---- Page helpers ----
const browser = await chromium.launch({ headless: true });
const errors = [], writes = [], passed = [], skipped = [];
async function openContext() {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: "ko-KR" });
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
async function includes(locator, expected, label = "") {
  const text = await locator.innerText();
  assert.ok(text.includes(expected), `${label} expected ${JSON.stringify(expected)} in ${JSON.stringify(text.slice(0, 500))}`);
}
async function excludes(locator, pattern, label = "") {
  const text = await locator.innerText();
  const found = typeof pattern === "string" ? text.includes(pattern) : pattern.test(text);
  assert.ok(!found, `${label} must not show ${pattern} in ${JSON.stringify(text.slice(0, 500))}`);
}
const menu = (page, label) => page.getByRole("navigation", { name: "축제 탐색 메뉴" }).getByRole("link", { name: label, exact: true });
const results = page => page.getByRole("list", { name: "찾은 축제" });
const link = (page, id) => page.locator(`a[href="${path(id, "visits")}"]`);
async function noInternalWording(page, label) {
  await excludes(page.locator("main"), /source-unavailable|not-requested|linkedArchive|whitelist|allowlist|snapshot|sha256|TourAPI|\bAPI\b|fixture|undefined|NaN/, label);
}
async function noPageOverflow(page, label) {
  const [scroll, inner] = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
  assert.ok(scroll <= inner, `${label}: page scrollWidth ${scroll} > ${inner}`);
}

// ---- Scenarios ----
async function startingChoices({ page }) {
  // No condition yet: the reviewed festivals are offered as starting choices (REAL ARCHIVE).
  await page.goto(`${base}/existing/search`);
  await visible(page.getByRole("heading", { level: 2, name: "바로 살펴볼 수 있는 축제", exact: true }));
  await visible(results(page).locator(`a[href="${path(NONSAN_ID, "visits")}"]`));
  await includes(link(page, NONSAN_ID), "지난 개최 2025년 · 2024년 · 2023년");
  await noInternalWording(page, "starting choices");
  passed.push("search-no-query-starting-choices");
}

async function mergedSearch({ page }) {
  // One card per festival: the linked registration replaces the reviewed record's card in place; the unlinked
  // same-name registration stays its own card; a further page appends without reordering.
  await page.getByLabel("축제 이름").fill("논산딸기");
  await page.keyboard.press("Enter");
  await waitParam(page, "q", "논산딸기");
  await waitFocusText(page, "‘논산딸기’ 검색 결과");
  await visible(link(page, LINKED.id));
  assert.equal(await link(page, NONSAN_ID).count(), 0, "the reviewed record is not a second card beside its linked registration");
  await includes(link(page, LINKED.id), "지난 개최 2025년 · 2024년 · 2023년");
  await includes(link(page, LINKED.id), `등록 일정 ${period(LINKED.start, LINKED.end)}`);
  await visible(link(page, SAME_NAME.id));
  await excludes(link(page, SAME_NAME.id), "지난 개최", "an unlinked same name never borrows past editions");
  await visible(page.getByText("축제 2건 표시", { exact: true }));
  const order = () => results(page).locator("a").evaluateAll(as => as.map(a => a.getAttribute("href")));
  const first = await order();
  assert.equal(first[0], path(LINKED.id, "visits"));
  await page.keyboard.press("Tab");
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute("href")), path(LINKED.id, "visits"), "first stop after the results heading is the first result");
  await page.getByRole("button", { name: "축제 더 보기", exact: true }).click();
  await visible(link(page, PAGE2.id));
  await visible(page.getByText("축제 3건", { exact: true }));
  assert.deepEqual((await order()).slice(0, first.length), first, "earlier results keep their places");
  await noInternalWording(page, "merged search");
  passed.push("search-linked-identity-single-card", "search-unlinked-same-name-separate", "search-paging-continuity", "search-keyboard-first-result");
}

async function sourceFailure({ page }) {
  // The registered-festival source fails alone: reviewed results stay, the failure has its own retry.
  once(is("festivals", p => p.get("q") === "논산 딸기"), async route => {
    const response = await route.fetch(), body = await response.json();
    body.current = { ...unavailable, mode: null, range: null, page: null, next: null, continuity: null, total: null, omitted: 0, lookup: null, items: [] };
    return { kind: "fulfill", options: { response, json: body } };
  });
  await page.goto(`${base}/existing/search?q=${encodeURIComponent("논산 딸기")}`);
  const alert = page.getByRole("alert").filter({ hasText: "현재 등록된 축제를 불러오지 못했어요." });
  await visible(alert);
  await visible(link(page, NONSAN_ID));
  await alert.getByRole("button", { name: "다시 불러오기" }).click();
  await visible(link(page, LINKED.id));
  await alert.waitFor({ state: "detached" });
  assert.equal(await link(page, NONSAN_ID).count(), 0);
  passed.push("search-isolated-source-failure-retry");
}

async function pendingLookup({ page }) {
  // While the festival is not verified yet: no no-history claim, no district request.
  const held = gate(is("festivals", p => p.get("id") === ANDONG_FEST.id));
  const before = calls.length;
  await page.goto(`${base}${path(ANDONG_FEST.id, "visits")}`);
  await held.arrived;
  await visible(page.getByText("축제 정보를 확인하고 있어요…", { exact: true }).first());
  await excludes(page.locator("main"), "지난 개최 기록이 없어요");
  assert.equal(calls.slice(before).filter(c => c.endpoint === "monthly").length, 0, "no district request before the festival is verified");
  held.release();
  await visible(page.getByRole("heading", { level: 2, name: "안동시 외지인 방문 흐름", exact: true }));
  passed.push("current-pending-no-false-no-history");
}

async function currentVisits({ page }) {
  // Any registered festival: district visits of its verified region, registration dates only as registration.
  await visible(page.getByRole("heading", { level: 1, name: ANDONG_FEST.name, exact: true }));
  await includes(page.locator("section[aria-labelledby='visits-heading']"), "경상북도 안동시 전체 · 명/일 · 통신 기반 추정 · 축제장 입장객 수 아님");
  await excludes(page.locator("main"), "지난 개최 기록이 없어요");
  const registered = page.getByRole("region", { name: "등록 일정", exact: true });
  await includes(registered, period(REG_2025.start, REG_2025.end));
  await includes(registered, period(ANDONG_FEST.start, ANDONG_FEST.end));
  assert.equal(await registered.getByRole("button", {name:"2026년 10월 방문 보기", exact:true}).count(),0);
  // First visit opens the latest observed month of the default observation year (fixture: 2024 complete).
  await waitParam(page, "month", "2024-12");
  await visible(page.getByRole("heading", { name: "2024년 안동시 월별 외지인 방문", exact: true }));
  await visible(page.getByRole("img", { name: "2024년 12월 안동시 일별 외지인 방문 선그래프" }));
  await excludes(page.locator("main"), "개최기간", "a chosen month is never labelled a festival period");
  await excludes(page.locator("main"), "음영: 한국관광공사 등록 일정", "no registration shading in a month without registered dates");
  // Registration shortcut → that actual month, gap kept, focus on the daily chart.
  await registered.getByRole("button", { name: "2025년 9월 방문 보기", exact: true }).click();
  await waitParam(page, "month", "2025-09");
  assert.equal(params(page).get("year"), "2025");
  await waitFocusId(page, "daily-heading");
  const chart = page.getByRole("img", { name: "2025년 9월 안동시 일별 외지인 방문 선그래프" });
  await visible(chart);
  const desc = await chart.evaluate(svg => svg.querySelector("desc")?.textContent ?? "");
  assert.ok(desc.includes(`가장 많은 날 9.30(${weekday("2025-09-30")}) ${raw(dailyValue("2025-09-30"))}명`), desc);
  assert.ok(!desc.includes("음영"), "observed district chart does not imply a confirmed festival period");
  await visible(page.getByText("선이 끊긴 날: 값 없음", { exact: true }));
  const table = page.getByRole("region", { name: "2025년 9월 일별 수치 표", exact: true });
  await visible(table);
  const rows = await table.locator("tbody tr").evaluateAll(trs => trs.map(tr => [...tr.children].map(c => c.textContent.trim())));
  assert.deepEqual(rows.find(r => r[0] === MISSING), [MISSING, weekday(MISSING), "—"]);
  assert.deepEqual(rows.find(r => r[0] === "2025-09-13"), ["2025-09-13", weekday("2025-09-13"), raw(dailyValue("2025-09-13"))]);
  await excludes(page.locator("main"), /개최기간 일평균|개최기간/, "no festival-period mean from registration dates");
  assert.ok(calls.some(c => c.endpoint === "monthly" && c.params.province === ANDONG.province && c.params.district === ANDONG.district && c.params.year === "2025"));
  assert.equal(calls.filter(c => c.endpoint === "history" && c.params.festival === ANDONG_FEST.id).length, 0, "no archive history for an unlinked registration");
  await noInternalWording(page, "current visits");
  passed.push("current-visits-district-monthly-daily", "current-registration-shortcut", "current-daily-gap-and-table");

  // Views keep their own conditions: the timing view does not take the visits month, and visits comes back as left.
  await menu(page, "개최 시기").click(); await waitFocusId(page, "timing-heading");
  assert.notEqual(params(page).get("month"), "2025-09", "visits month never overwrites the timing calendar");
  assert.equal(params(page).get("year"), null, "visits observation year never overwrites the timing view");
  await menu(page, "과거 방문 흐름").click(); await waitFocusId(page, "visits-heading");
  await waitParam(page, "month", "2025-09");
  assert.equal(params(page).get("year"), "2025");
  // Closing the month is kept too (no re-default).
  await page.getByRole("group", { name: "일별 값을 볼 달" }).getByRole("button", { name: "9월", exact: true }).click();
  await page.waitForFunction(() => !new URL(location.href).searchParams.has("month"));
  assert.equal(await page.getByRole("heading", { name: /일별 외지인 방문$/ }).count(), 0);
  await menu(page, "주변 관광자원").click(); await waitFocusId(page, "resources-heading");
  await menu(page, "과거 방문 흐름").click(); await waitFocusId(page, "visits-heading");
  await page.waitForFunction(() => new URL(location.href).searchParams.get("year") === "2025" && !new URL(location.href).searchParams.has("month"));
  // Explicit calendar link → timing view on that month.
  await page.getByRole("group", { name: "일별 값을 볼 달" }).getByRole("button", { name: "3월", exact: true }).click();
  await page.getByRole("button", { name: "2025년 3월 일정 보기", exact: true }).click();
  await page.waitForURL(u => u.pathname === path(ANDONG_FEST.id, "timing") && u.searchParams.get("month") === "2025-03");
  passed.push("current-visits-dedicated-conditions-memory", "current-visits-calendar-link");
}

async function emptyAndFailure() {
  const { context, page } = await openContext();
  try {
    // A district without observations: short empty state, resources/timing still reachable.
    await page.goto(`${base}${path(GANGNEUNG_FEST.id, "visits")}`);
    await visible(page.getByRole("heading", { level: 2, name: "강릉시 외지인 방문 흐름", exact: true }));
    await visible(page.getByText("강릉시의 외지인 방문 자료가 아직 없어요.", { exact: true }));
    assert.equal(await page.getByRole("region", { name: "등록 일정", exact: true }).count(), 0, "no registration dates are invented");
    await page.getByRole("link", { name: "주변 관광자원 보기", exact: true }).click();
    await visible(page.getByText("검증용 강릉시 관광지 (가상)").first());
    passed.push("current-visits-empty-state-independent-links");

    // District request fails alone: header, registration dates and links stay; retry recovers.
    once(is("monthly", p => p.get("district") === ANDONG.district), () => ({ kind: "fulfill", options: { status: 503, json: { error: { code: "source-unavailable", retryable: true } } } }));
    await page.goto(`${base}${path(ANDONG_FEST.id, "visits")}`);
    const failed = page.getByRole("alert").filter({ hasText: "월별 방문 자료를 불러오지 못했어요." });
    await visible(failed);
    await visible(page.getByRole("heading", { level: 1, name: ANDONG_FEST.name, exact: true }));
    await visible(page.getByRole("region", { name: "등록 일정", exact: true }));
    await visible(page.getByRole("link", { name: "개최 시기 보기", exact: true }));
    await failed.getByRole("button", { name: "다시 불러오기" }).click();
    await visible(page.getByRole("heading", { name: "2024년 안동시 월별 외지인 방문", exact: true }));
    await noInternalWording(page, "failure recovered");
    passed.push("current-visits-isolated-failure-retry");

    await page.setViewportSize({ width: 390, height: 844 });
    await visible(page.getByRole("img", { name: /일별 외지인 방문 선그래프$/ }));
    await noPageOverflow(page, "current visits 390px");
    mkdirSync("output/playwright", { recursive: true });
    await page.screenshot({ path: "output/playwright/unified-festival-visits-mobile.png", fullPage: true });
    passed.push("current-visits-390px-no-page-overflow");
  } finally { await context.close(); }
}

async function linkedInline() {
  // LINKED (integration): the reviewed archive history inline, under the registration's own name, path and id.
  if (skipLinked) { skipped.push("linked-archive-inline (UNIFIED_SKIP_LINKED=1)"); return; }
  const { context, page } = await openContext();
  try {
    await page.goto(`${base}${path(LINKED.id, "visits")}`);
    await visible(page.getByRole("heading", { level: 1, name: "논산딸기축제", exact: true }));
    await includes(page.locator("main header"), `충청남도 논산시 · 현재 등록 정보 · 등록 일정 ${period(LINKED.start, LINKED.end)} · 지난 개최 2025년 · 2024년 · 2023년`);
    await visible(page.getByRole("heading", { level: 2, name: "논산시 외지인 방문 추이", exact: true }));
    await visible(page.getByRole("heading", { level: 3, name: "2025년 · 3.27–3.30 · 목–일 4일", exact: true }));
    assert.equal(new URL(page.url()).pathname, path(LINKED.id, "visits"), "no separate journey to the archive address");
    assert.ok(calls.some(c => c.endpoint === "history" && c.params.festival === LINKED.id), "history is requested with the registration's own id");
    await menu(page, "주변 관광자원").click();
    await page.waitForURL(u => u.pathname === path(LINKED.id, "resources"));
    passed.push("linked-archive-inline-same-identity");
  } finally { await context.close(); }
}

// ---- Run ----
const main = await openContext();
try {
  await startingChoices(main);
  await mergedSearch(main);
  await sourceFailure(main);
  await pendingLookup(main);
  await currentVisits(main);
  await emptyAndFailure();
  await linkedInline();
  assert.deepEqual(writes, [], "no same-origin non-GET request");
  assert.deepEqual(errors, []);
  assert.deepEqual(fixtureErrors, []);
  assert.equal(queue.length, 0, `unused overrides: ${queue.length}`);
  console.log(JSON.stringify({ headless: true, realArchive: ["festivals archive block", skipLinked ? null : "history (linked)"].filter(Boolean),
    fixtures: "검증용 registrations/periods, 안동시·강릉시 monthly/daily, resources", passed, skipped, browserErrors: errors.length, apiRequests: calls.length }));
} finally {
  await browser.close();
}
