// 관광자원 네 유형(관광지·문화시설·음식점·숙박)과 공통 소개 — both festival journeys, headless.
// Design: docs/design/19-tourism-resources.md.
//
// Data provenance: 검증용 CONTROLLED FIXTURES only. Every tourism list (/api/existing/resources) and every shared
// introduction (/api/resources/detail) is synthetic, titled "검증용"/"(가상)". They prove UI semantics (type choice,
// independent loading, arrival, detail, comparison, layout) and never that the public provider returns such rows.
// Official-data verification is a separate step. Festival lookup, archive and calendar requests pass through untouched.
// The ~650-place list is a deterministic grid that exercises rendering, radius filtering and detail reachability at that
// size; it does not show that the provider returns complete lists for any region.
// Protocol keys mirror the server's canonical keys (lib/existing/request.ts, lib/new-festival/request.ts).
// Race ordering uses request gates (hold → release); no sleeps decide ordering.
import assert from "node:assert/strict";
import { mkdirSync, readFileSync } from "node:fs";
import { chromium } from "playwright";
import { mockMapTiles } from "./map-test-tiles.mjs";

const base = process.env.E2E_BASE_URL ?? process.env.BASE_URL;
if (!base) throw new Error("E2E_BASE_URL (or BASE_URL) required");
const origin = new URL(base).origin;
const catalogue = JSON.parse(readFileSync(new URL("../data/region-catalogue.json", import.meta.url), "utf8"));

function regionRef(code) {
  const r = catalogue.rows.find(x => `${x.provinceCode}${x.districtCode}` === code);
  assert.ok(r, `catalogue region ${code}`);
  return { province: r.provinceCode, district: r.districtCode, code, name: `${r.provinceName} ${r.districtName}`, districtName: r.districtName };
}
const NONSAN = regionRef("44230");
const OTHER_REGION = regionRef("44150"); // used only to answer with a region that is not the requested one
const FESTIVAL = "archive:nonsan-strawberry"; // real archive festival in Nonsan (region comes from the real lookup)
const existingUrl = (query = "") => `${base}/existing/${encodeURIComponent(FESTIVAL)}/resources${query}`;
const newUrl = (query = "") => `${base}/new/${NONSAN.code}/resources${query}`;

// ---- 검증용 fixtures (synthetic) ----
const LIST_AT = "2026-09-01T03:00:00.000Z", DETAIL_AT = "2026-09-15T03:00:00.000Z";
const KINDS = ["12", "14", "39", "32"], KIND_LABEL = { "12": "관광지", "14": "문화시설", "39": "음식점", "32": "숙박" };
const pt = (latitude, longitude) => ({ latitude, longitude });
const res = (id, kind, title, point, modifiedAt = null) => ({ id, kind, title, address: `검증용 가상 주소 ${id}`, point, modifiedAt });
const A12 = res("9111", "12", "검증용 관광지 가 (가상)", pt(36.2, 127.1));
const B12 = res("9112", "12", "검증용 관광지 나 · 좌표 없음 (가상)", null);
const C14 = res("9211", "14", "검증용 문화시설 다 (가상)", pt(36.19, 127.18));
const F39 = res("9311", "39", "검증용 음식점 라 (가상)", pt(36.205, 127.105), "20260902000000");
const E39 = res("9312", "39", "검증용 음식점 마 (가상)", pt(36.21, 127.12));
const G39 = res("9313", "39", "검증용 음식점 바 (가상)", pt(36.18, 127.09));
const LONG39 = res("9314", "39", `검증용음식점${"아주긴이름".repeat(14)} (가상)`, pt(36.22, 127.13));
const S32 = res("9411", "32", "검증용 숙박 사 (가상)", pt(36.195, 127.115));
const R32 = res("9412", "32", "검증용 숙박 아 · 좌표 없음 (가상)", null);
const Z32 = res("9413", "32", "검증용 숙박 자 (가상)", pt(36.23, 127.14));
const RESOURCES = { "12": [A12, B12], "14": [C14], "39": [F39, E39, G39, LONG39], "32": [S32, R32, Z32] };

// Expected distances are computed here from the fixture coordinates with the same spherical formula as
// lib/comparison/distance.ts, independently of the page.
const rad = deg => deg * Math.PI / 180;
function distanceKm(a, b) {
  const h = Math.sin(rad(b.latitude - a.latitude) / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(rad(b.longitude - a.longitude) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, h))));
}
const kmText = value => `${value < 10 ? value.toFixed(1) : Math.round(value)}km`;
// 650 restaurants on a 26 × 25 grid in 0.01° steps; zero-padded titles keep name order equal to grid order.
const BULK = Array.from({ length: 650 }, (_, i) => res(String(70001 + i), "39", `검증용 대량 음식점 ${String(i + 1).padStart(3, "0")} (가상)`,
  pt(Number((36.08 + Math.floor(i / 26) * 0.01).toFixed(4)), Number((126.98 + (i % 26) * 0.01).toFixed(4)))));
const BULK_ANCHOR = BULK[12 * 26 + 13], BULK_FAR = BULK[BULK.length - 1], BULK_RADIUS = 3;
const BULK_INSIDE = BULK.filter(r => distanceKm(BULK_ANCHOR.point, r.point) <= BULK_RADIUS);
assert.ok(BULK.every(r => Math.abs(distanceKm(BULK_ANCHOR.point, r.point) - BULK_RADIUS) > 0.05), "no bulk place sits on the radius boundary");
assert.ok(BULK_INSIDE.length > 1 && BULK_INSIDE.length < BULK.length && !BULK_INSIDE.includes(BULK_FAR), "radius keeps some places and hides the far one");

const LONG_INTRO = `검증용 소개 라 (가상). 이 문장 안의 <b>굵게</b> 표시는 글자 그대로 보여야 해요. ${"음식점의 가상 소개 문장입니다. ".repeat(24)}끝 문장이에요.`;
const INTRO = {
  [F39.id]: LONG_INTRO, [G39.id]: "검증용 소개 바 (가상). 먼저 고른 장소의 소개예요.", [LONG39.id]: "검증용 소개 긴 이름 (가상).",
  [S32.id]: "검증용 소개 사 (가상). 숙박 장소 소개예요.", [R32.id]: "검증용 소개 아 (가상). 다시 불러온 소개예요.",
  [Z32.id]: "검증용 소개 자 (가상). 나중에 고른 장소의 소개예요.",
}; // anything else (12/14 rows, E39) answers "empty" → the introduction block is omitted
const detailOutcome = new Map(); // id → "unavailable" while a scenario needs a provider failure
const resourcesKey = r => JSON.stringify(["resources", r.province, r.district, r.types]);
const detailKey = r => JSON.stringify(["new-resource-detail", r.province, r.district, r.kind, r.id]);
function resourcesBody(p, override = {}) {
  const province = p.get("province"), district = p.get("district");
  if (`${province}${district}` !== NONSAN.code) throw new Error(`no fixture region ${province}/${district}`);
  const types = KINDS.filter(k => p.get("types").split(",").includes(k)), request = { province, district, types };
  return { key: resourcesKey(request), request, retrievedAt: new Date().toISOString(), region: NONSAN,
    byType: types.map(kind => override[kind] === "unavailable"
      ? { status: "unavailable", error: { code: "source-unavailable", retryable: true }, collectedAt: null, kind, label: KIND_LABEL[kind], total: null, items: [] }
      : { status: "complete", error: null, collectedAt: LIST_AT, kind, label: KIND_LABEL[kind], total: RESOURCES[kind].length, items: RESOURCES[kind] }) };
}
function detailBody(p) {
  const request = { province: p.get("province"), district: p.get("district"), kind: p.get("kind"), id: p.get("id") };
  const base = { key: detailKey(request), request, retrievedAt: new Date().toISOString(), region: NONSAN };
  if (detailOutcome.get(request.id) === "unavailable") return { ...base, status: "unavailable", error: { code: "source-unavailable", retryable: true }, detail: null, source: null };
  const source = { title: "검증용 소개 출처 (가상)", url: "https://www.data.go.kr/data/15101578/openapi.do", checkedAt: null, publishedAt: null, collectedAt: DETAIL_AT };
  const text = INTRO[request.id];
  if (!text) return { ...base, status: "empty", error: null, detail: null, source };
  return { ...base, status: "complete", error: null, detail: { id: request.id, kind: request.kind, overview: text, truncated: false, modifiedAt: "20260910120000" }, source };
}

// ---- API routing: controlled tourism data, everything else untouched; one-shot overrides and request gates ----
const calls = [], queue = [], fixtureErrors = [];
const fixtureJson = make => (route, p) => ({ kind: "fulfill", options: { json: make(p) } });
const listWith = override => fixtureJson(p => resourcesBody(p, override));
const DEFAULTS = { "existing/resources": listWith(), "resources/detail": fixtureJson(detailBody) };
async function onApi(route) {
  const url = new URL(route.request().url()), endpoint = url.pathname.slice("/api/".length), p = url.searchParams;
  calls.push({ endpoint, params: Object.fromEntries(p) });
  const index = queue.findIndex(q => q.match(endpoint, p)), entry = index < 0 ? null : queue.splice(index, 1)[0];
  let respond = entry?.respond ?? DEFAULTS[endpoint] ?? (() => ({ kind: "continue" }));
  if (entry?.gate) { entry.gate.arrived(); respond = (await entry.gate.released) ?? respond; }
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
function gate(match, label) {
  let arrived, release, done;
  const hasArrived = new Promise(r => { arrived = r; }), released = new Promise(r => { release = r; }), finished = new Promise(r => { done = r; });
  queue.push({ match, gate: { arrived, released }, done });
  return { arrived: within(hasArrived, label), release: async respond => { release(respond ?? null); await within(finished, `${label} finished`); } };
}
const is = (endpoint, test = () => true) => (e, p) => e === endpoint && test(p);
const listOf = kind => is("existing/resources", p => p.get("types") === kind);
const introOf = r => is("resources/detail", p => p.get("id") === r.id && p.get("kind") === r.kind);
const listTypes = (from = 0) => calls.slice(from).filter(c => c.endpoint === "existing/resources").map(c => c.params.types);

// ---- Page helpers ----
const browser = await chromium.launch({ headless: true });
const errors = [], writes = [], passed = [];
async function openContext(viewport = { width: 1440, height: 1000 }) {
  const context = await browser.newContext({ viewport, locale: "ko-KR" });
  await mockMapTiles(context);
  await context.route(u => u.origin === origin && u.pathname.startsWith("/api/"), onApi);
  const page = await context.newPage();
  page.setDefaultTimeout(20_000);
  page.on("pageerror", e => errors.push(e.message));
  page.on("request", r => { if (r.method() !== "GET" && new URL(r.url()).origin === origin) writes.push(`${r.method()} ${new URL(r.url()).pathname}`); });
  return { context, page };
}
const visible = l => l.waitFor({ state: "visible" });
const typesParam = page => new URL(page.url()).searchParams.get("types");
const waitTypes = (page, value) => page.waitForFunction(v => new URL(location.href).searchParams.get("types") === v, value);
const waitFocusId = (page, id) => page.waitForFunction(i => document.activeElement?.id === i, id);
const waitFocusAttr = (page, attr, value) => page.waitForFunction(([a, v]) => document.activeElement?.getAttribute(a) === v, [attr, value]);
const flush = page => page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
const escapeRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
async function includes(locator, expected, label = "") {
  const text = await locator.innerText();
  assert.ok(text.includes(expected), `${label} expected ${JSON.stringify(expected)} in ${JSON.stringify(text.slice(0, 400))}`);
}
async function excludes(locator, pattern, label = "") {
  const text = await locator.innerText();
  const found = typeof pattern === "string" ? text.includes(pattern) : pattern.test(text);
  assert.ok(!found, `${label} must not show ${pattern} in ${JSON.stringify(text.slice(0, 400))}`);
}
async function noPageOverflow(page, label) {
  const [scroll, inner] = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
  assert.ok(scroll <= inner, `${label}: page scrollWidth ${scroll} > ${inner}`);
}
const FLOW = {
  existing: { section: "resources-heading", detailHeading: "resource-detail-heading", hiddenDetail: "지금 고른 유형 목록에는 보이지 않는 자원이에요.", url: existingUrl,
    distanceTerm: "기준점에서", distanceText: value => `직선거리 약 ${kmText(value)}` },
  new: { section: "new-resources-heading", detailHeading: "new-resource-detail-heading", hiddenDetail: "지금 목록 조건에서는 보이지 않는 자원이에요.", url: newUrl,
    distanceTerm: "기준점", distanceText: value => `기준점에서 직선거리 약 ${kmText(value)}` },
};
const section = (page, flow) => page.locator(`section[aria-labelledby="${FLOW[flow].section}"]`);
const typeGroup = page => page.getByRole("group", { name: "자원 유형" });
const typeButton = (page, kind) => typeGroup(page).getByRole("button", { name: KIND_LABEL[kind], exact: true });
const pressed = page => typeGroup(page).getByRole("button").evaluateAll(bs => bs.map(b => b.getAttribute("aria-pressed") === "true"));
const resourceList = page => page.getByRole("list", { name: "관광자원 목록" });
const rowButton = (page, r) => resourceList(page).getByRole("button", { name: new RegExp(`^\\d+\\. ${escapeRe(r.title)}`) });
const listToggle = (page, r, action) => resourceList(page).getByRole("button", { name: `${r.title} ${action}`, exact: true });
const detail = (page, r) => page.getByRole("complementary", { name: r.title, exact: true });
const intro = (page, r) => detail(page, r).getByRole("region", { name: `${r.title} 소개`, exact: true });
const ddOf = (scope, term) => scope.locator("dt").filter({ hasText: new RegExp(`^${escapeRe(term)}$`) }).locator("xpath=following-sibling::dd[1]");
const compare = page => page.getByRole("region", { name: /^함께 보기 \d\/2$/ });
const compareCard = (page, r) => compare(page).getByRole("article", { name: r.title, exact: true });
const anchorLabel = (page, r) => page.locator("p", { hasText: new RegExp(`^기준점\\s*${escapeRe(r.title)}$`) });
const countText = (page, kind) => page.getByText(`${KIND_LABEL[kind]} ${RESOURCES[kind].length}건`, { exact: true });
async function settled(page, kinds) { for (const k of kinds) await visible(countText(page, k)); await flush(page); }
async function openDetail(page, flow, r) {
  await rowButton(page, r).click();
  await waitFocusId(page, FLOW[flow].detailHeading);
  await visible(detail(page, r));
}
async function introSettled(page, r) {
  await detail(page, r).getByText("소개를 불러오고 있어요…").waitFor({ state: "detached" });
  await flush(page);
}
async function noInternalWording(page, flow, label) {
  await excludes(section(page, flow), /source-unavailable|not-found|type-mismatch|region-mismatch|contentTypeId|areaBasedList|detailCommon|TourAPI|\bAPI\b|fixture|undefined|NaN/, label);
  // Only registered facts: no invented business hours, menus, rooms, availability, booking or recommendation.
  await excludes(section(page, flow), /영업 중|영업시간|대표 메뉴|메뉴판|객실 요금|잔여 객실|예약 가능|예약하기|추천/, `${label} (no invented facts)`);
}

// ---- Scenarios ----
async function typeChoice(flow) {
  // Default is 관광지·문화시설 only; 음식점·숙박 are peers in the same group; the address keeps explicit sets.
  const { context, page } = await openContext();
  let mark = calls.length;
  await page.goto(FLOW[flow].url());
  await settled(page, ["12", "14"]);
  assert.deepEqual(await typeGroup(page).getByRole("button").allInnerTexts(), ["관광지", "문화시설", "음식점", "숙박"], `${flow}: peer order`);
  assert.deepEqual(await pressed(page), [true, true, false, false], `${flow}: default choice`);
  assert.deepEqual([...new Set(listTypes(mark))].sort(), ["12", "14"], `${flow}: default asks only 12 and 14`);
  assert.equal(typesParam(page), null, `${flow}: default address has no types`);
  await visible(rowButton(page, A12));
  assert.equal(await rowButton(page, F39).count(), 0, `${flow}: no restaurant before it is chosen`);

  await typeButton(page, "39").click();
  await waitTypes(page, "12,14,39");
  await settled(page, ["39"]);
  await visible(rowButton(page, F39));
  await typeButton(page, "32").click();
  await waitTypes(page, "12,14,39,32"); // all four stay explicit
  await settled(page, ["32"]);
  assert.deepEqual(await pressed(page), [true, true, true, true]);
  await includes(rowButton(page, S32), "숙박 · ", `${flow}: lodging row kind label`);
  await includes(rowButton(page, F39), "음식점 · ", `${flow}: restaurant row kind label`);
  passed.push(`${flow}-default-12-14-only-no-39-32-requests`, `${flow}-toggle-four-peers-all-four-explicit-address`);

  // A non-default pair of the same size as the default stays in the address, also across a reload.
  await typeButton(page, "12").click(); await waitTypes(page, "14,39,32");
  await typeButton(page, "14").click(); await waitTypes(page, "39,32");
  assert.equal(await rowButton(page, A12).count(), 0);
  mark = calls.length;
  await page.reload();
  await settled(page, ["39", "32"]);
  assert.equal(typesParam(page), "39,32", `${flow}: reload keeps 39,32`);
  assert.deepEqual(await pressed(page), [false, false, true, true]);
  assert.deepEqual([...new Set(listTypes(mark))].sort(), ["32", "39"], `${flow}: reload asks only the chosen kinds`);
  passed.push(`${flow}-non-default-pair-kept-across-reload`);

  // None, then invalid / duplicate / legacy addresses.
  await typeButton(page, "39").click(); await waitTypes(page, "32");
  await typeButton(page, "32").click(); await waitTypes(page, "none");
  await visible(page.getByText("볼 유형을 하나 이상 골라 주세요.", { exact: true }));
  assert.equal(await resourceList(page).count(), 0, `${flow}: none chosen shows no list`);
  await page.reload();
  await visible(page.getByText("볼 유형을 하나 이상 골라 주세요.", { exact: true }));
  assert.deepEqual(await pressed(page), [false, false, false, false], `${flow}: none survives reload`);
  for (const [query, expected] of [["?types=abc", [true, true, false, false]], ["?types=12,99", [true, true, false, false]], ["?types=", [true, true, false, false]],
    ["?types=12,14", [true, true, false, false]], ["?types=32,12,32", [true, false, false, true]], ["?types=12,14,39,32", [true, true, true, true]], ["?types=14", [false, true, false, false]]]) {
    await page.goto(FLOW[flow].url(query));
    await visible(typeGroup(page));
    await page.waitForFunction(n => document.querySelectorAll('[aria-pressed="true"]').length >= n, expected.filter(Boolean).length);
    assert.deepEqual(await pressed(page), expected, `${flow} ${query}`);
  }
  await settled(page, ["14"]);
  await typeButton(page, "12").click();
  await page.waitForFunction(() => new URL(location.href).searchParams.get("types") === null); // back to exactly the default set
  passed.push(`${flow}-none-invalid-duplicate-legacy-addresses`);

  if (flow === "new") { // durable year/month stay beside the type choice
    await page.goto(newUrl("?types=39&year=2025"));
    await settled(page, ["39"]);
    await typeButton(page, "32").click();
    await waitTypes(page, "39,32");
    assert.equal(new URL(page.url()).searchParams.get("year"), "2025", "year kept on type change");
    passed.push("new-type-change-keeps-year");
  } else { // menu move and back restores the explicit set
    await page.goto(existingUrl("?types=12,14,39,32"));
    await settled(page, ["12", "14", "39", "32"]);
    const nav = page.getByRole("navigation", { name: "축제 탐색 메뉴" });
    await nav.getByRole("link", { name: "개최 시기", exact: true }).click();
    await page.waitForURL(u => u.pathname.endsWith("/timing"));
    await nav.getByRole("link", { name: "주변 관광자원", exact: true }).click();
    await page.waitForURL(u => u.pathname.endsWith("/resources"));
    await waitTypes(page, "12,14,39,32");
    await settled(page, ["39", "32"]);
    passed.push("existing-menu-return-keeps-four-kinds");
  }
  await context.close();
}

async function independentLoading(flow) {
  // One kind failing and another held never blocks or clears the rest; retry repeats only that kind.
  const { context, page } = await openContext();
  once(listOf("39"), listWith({ "39": "unavailable" }));
  const held = gate(listOf("32"), `${flow} lodging list`);
  await page.goto(FLOW[flow].url("?types=12,14,39,32"));
  await held.arrived;
  await settled(page, ["12", "14"]);
  await visible(rowButton(page, A12));
  const failed = page.getByRole("alert").filter({ hasText: "음식점 목록을 불러오지 못했어요." });
  await visible(failed);
  await visible(page.getByText("숙박 목록을 불러오고 있어요…", { exact: true }));
  await excludes(section(page, flow), /음식점 0건|음식점: 조회한 등록 결과가 없어요/, `${flow}: a failed kind is not zero`);
  await visible(page.getByText(/^불러온 3건 · /));
  await held.release();
  await settled(page, ["32"]);
  await visible(rowButton(page, S32));
  await visible(failed);
  const mark = calls.length;
  await failed.getByRole("button", { name: "다시 불러오기", exact: true }).click();
  await settled(page, ["39"]);
  await visible(page.getByText(/^조회 10건 · /));
  assert.deepEqual(listTypes(mark), ["39"], `${flow}: retry asks only the failed kind`);
  await visible(rowButton(page, A12));
  passed.push(`${flow}-independent-kind-failure-delay-and-retry`);

  // Restaurant and lodging introductions: plain text, own source time, fold; absence omits the block; failure retries in place.
  await openDetail(page, flow, F39);
  await introSettled(page, F39);
  assert.equal(await ddOf(detail(page, F39), "유형").innerText(), "음식점");
  assert.equal(await ddOf(detail(page, F39), "주소").innerText(), F39.address);
  assert.equal(await ddOf(detail(page, F39), "목록 원천 수정일").innerText(), "2026-09-02", `${flow}: list date labelled as the list's`);
  await visible(intro(page, F39));
  await includes(intro(page, F39), "<b>굵게</b>", `${flow}: markup-looking text stays literal`);
  assert.equal(await intro(page, F39).locator("b").count(), 0, `${flow}: no element injected from the introduction`);
  await excludes(intro(page, F39), LONG_INTRO.slice(-30).trim(), `${flow}: long introduction folded`);
  await page.getByRole("button", { name: `${F39.title} 소개 더 보기`, exact: true }).click();
  await includes(intro(page, F39), LONG_INTRO.slice(-30).trim());
  await page.getByRole("button", { name: `${F39.title} 소개 접기`, exact: true }).click();
  await page.getByRole("button", { name: `${F39.title} 소개 출처 보기`, exact: true }).click();
  const introSource = page.getByRole("dialog", { name: `${F39.title} 소개 출처`, exact: true });
  await visible(introSource);
  assert.match(await introSource.innerText(), /소개 수집 2026\. 9\. 15\./, `${flow}: introduction collection time`);
  await excludes(introSource, /2026\. 9\. 1\. /, `${flow}: introduction source never shows the list time`);
  await page.keyboard.press("Escape");
  await introSource.waitFor({ state: "hidden" });
  passed.push(`${flow}-restaurant-intro-plain-text-fold-own-source`);

  await openDetail(page, flow, E39);
  await introSettled(page, E39);
  assert.equal(await intro(page, E39).count(), 0, `${flow}: empty introduction omitted`);
  assert.equal(await detail(page, E39).getByRole("alert").count(), 0, `${flow}: absence is not a failure`);
  assert.equal(await detail(page, E39).getByRole("heading", { name: "소개", exact: true }).count(), 0, `${flow}: no empty introduction heading`);

  await openDetail(page, flow, S32);
  await introSettled(page, S32);
  assert.equal(await ddOf(detail(page, S32), "유형").innerText(), "숙박");
  await includes(intro(page, S32), INTRO[S32.id]);

  detailOutcome.set(R32.id, "unavailable");
  await openDetail(page, flow, R32);
  await introSettled(page, R32);
  const introFailed = detail(page, R32).getByRole("alert").filter({ hasText: "소개를 불러오지 못했어요." });
  await visible(introFailed);
  assert.equal(await ddOf(detail(page, R32), "지도 위치").innerText(), "없음 · 거리를 계산할 수 없어요");
  await visible(rowButton(page, A12)); // the list stays usable
  detailOutcome.delete(R32.id);
  await introFailed.getByRole("button", { name: `${R32.title} 소개 다시 불러오기`, exact: true }).click();
  await visible(intro(page, R32));
  await includes(intro(page, R32), "다시 불러온 소개예요");
  await detail(page, R32).getByRole("button", { name: "상세 닫기", exact: true }).click();
  await waitFocusAttr(page, "data-resource-id", R32.id);
  passed.push(`${flow}-lodging-intro-empty-omitted-failure-retry-close-focus`);

  if (flow === "existing") {
    assert.equal(await section(page, flow).getByRole("button", { name: /함께 보기/ }).count(), 0, "existing flow has no comparison");
    assert.equal(await compare(page).count(), 0, "existing flow has no comparison area");
    passed.push("existing-no-compare");
  }
  await noInternalWording(page, flow, `${flow} resources`);
  await context.close();
}

async function regionGuard(flow) {
  // A matching key never makes another district's answer usable. Failure stays recoverable and a failed retry
  // must not revive that cached foreign row; another chosen kind remains available throughout.
  const { context, page } = await openContext();
  const foreign = res("99391", "39", "검증용 다른 지역 음식점 (가상)", pt(36.46, 127.12));
  const held = gate(listOf("39"), `${flow} other-region answer`);
  await page.goto(FLOW[flow].url("?types=12,39"));
  await held.arrived;
  await settled(page, ["12"]);
  await visible(page.getByText("음식점 목록을 불러오고 있어요…", { exact: true }));
  await held.release(fixtureJson(p => {
    const body = resourcesBody(p);
    return { ...body, region: OTHER_REGION, byType: body.byType.map(b => ({ ...b, total: 1, items: [foreign] })) };
  }));
  await page.getByText("음식점 목록을 불러오고 있어요…", { exact: true }).waitFor({ state: "detached" });
  const failed = page.getByRole("alert").filter({ hasText: "음식점 목록을 불러오지 못했어요." });
  await visible(failed);
  await flush(page);
  assert.equal(await countText(page, "39").count(), 0, `${flow}: no count from another region's answer`);
  assert.equal(await rowButton(page, F39).count(), 0, `${flow}: no row from another region's answer`);
  assert.equal(await rowButton(page, foreign).count(), 0, `${flow}: the foreign row is never shown`);
  assert.equal(await page.getByText("음식점 1건", { exact: true }).count(), 0, `${flow}: the foreign count is never shown`);
  await visible(page.getByText(/^불러온 2건 · /));
  await visible(rowButton(page, A12));

  const mark = calls.length, retryFailed = gate(listOf("39"), `${flow} failed retry after foreign answer`);
  await failed.getByRole("button", { name: "다시 불러오기", exact: true }).click();
  await retryFailed.arrived;
  await retryFailed.release(listWith({ "39": "unavailable" }));
  await visible(failed);
  await flush(page);
  assert.equal(await rowButton(page, foreign).count(), 0, `${flow}: failed refresh never revives a cached foreign row`);
  assert.equal(await page.getByText("음식점 1건", { exact: true }).count(), 0, `${flow}: failed refresh never revives a foreign count`);
  await visible(rowButton(page, A12));

  const malformed = gate(listOf("39"), `${flow} response without type blocks`);
  await failed.getByRole("button", { name: "다시 불러오기", exact: true }).click();
  await malformed.arrived;
  await malformed.release(fixtureJson(p => ({ ...resourcesBody(p), byType: null })));
  await visible(failed);
  await visible(rowButton(page, A12));

  const recovered = gate(listOf("39"), `${flow} correct-region retry`);
  await failed.getByRole("button", { name: "다시 불러오기", exact: true }).click();
  await recovered.arrived;
  await recovered.release();
  await settled(page, ["12", "39"]);
  await failed.waitFor({ state: "detached" });
  await visible(rowButton(page, F39));
  await visible(rowButton(page, A12));
  assert.equal(await rowButton(page, foreign).count(), 0, `${flow}: successful recovery never mixes the foreign row`);
  assert.deepEqual(listTypes(mark), ["39", "39", "39"], `${flow}: recovery only re-requests the failed kind`);
  passed.push(`${flow}-other-region-answer-hidden-retryable-never-reused-and-recovers`);
  await context.close();
}

async function allTypesOff(flow) {
  // Turning every type off keeps the open detail, its introduction, the anchor and the known straight-line distance.
  const { context, page } = await openContext();
  await page.goto(FLOW[flow].url("?types=12,39"));
  await settled(page, ["12", "39"]);
  await openDetail(page, flow, A12);
  await detail(page, A12).getByRole("button", { name: "이 자원을 기준점으로", exact: true }).click();
  await visible(anchorLabel(page, A12));
  await openDetail(page, flow, F39);
  await introSettled(page, F39);
  const distance = ddOf(detail(page, F39), FLOW[flow].distanceTerm), expected = FLOW[flow].distanceText(distanceKm(A12.point, F39.point));
  assert.equal(await distance.innerText(), expected, `${flow}: distance while listed`);
  const related = detail(page, F39).getByRole("button", { name: `${F39.title} 관련 자료 검색`, exact: true });
  assert.equal(await related.count(), flow === "new" ? 1 : 0, `${flow}: related search only in the new journey`);

  await typeButton(page, "12").click(); await waitTypes(page, "39");
  await typeButton(page, "39").click(); await waitTypes(page, "none");
  await visible(page.getByText("볼 유형을 하나 이상 골라 주세요.", { exact: true }));
  assert.equal(await resourceList(page).count(), 0, `${flow}: no list with every type off`);
  await visible(detail(page, F39).getByText(FLOW[flow].hiddenDetail, { exact: true }));
  assert.equal(await distance.innerText(), expected, `${flow}: all types off keeps the known distance`);
  await visible(intro(page, F39));
  await visible(anchorLabel(page, A12));

  await typeButton(page, "39").click(); await waitTypes(page, "39");
  await settled(page, ["39"]);
  await detail(page, F39).getByText(FLOW[flow].hiddenDetail, { exact: true }).waitFor({ state: "detached" });
  assert.equal(await rowButton(page, F39).getAttribute("aria-pressed"), "true", `${flow}: the kept detail is the listed one again`);
  assert.equal(await distance.innerText(), expected);
  passed.push(`${flow}-all-types-off-keeps-detail-intro-anchor-and-distance`);
  await context.close();
}

async function largeList(flow) {
  // One kind with 650 places: every row and marker renders, the radius filter follows the fixture geometry,
  // and a detail opens from the end of the list and from a marker.
  const saved = RESOURCES["39"];
  RESOURCES["39"] = BULK;
  const { context, page } = await openContext();
  try {
    const rows = resourceList(page).locator("[data-resource-id]");
    const markerCount = n => page.waitForFunction(count => document.querySelectorAll(".map-resource").length === count, n);
    await page.goto(FLOW[flow].url("?types=39"));
    await settled(page, ["39"]);
    assert.equal(await rows.count(), BULK.length, `${flow}: every place listed`);
    await visible(page.getByText(new RegExp(`^조회 ${BULK.length}건 · (좌표|지도 위치) 있는 자원 ${BULK.length}건`)));
    await markerCount(BULK.length);

    await openDetail(page, flow, BULK_ANCHOR);
    await detail(page, BULK_ANCHOR).getByRole("button", { name: "이 자원을 기준점으로", exact: true }).click();
    await visible(anchorLabel(page, BULK_ANCHOR));
    await openDetail(page, flow, BULK_FAR); // the last row, reached by scrolling inside the list
    const farDistance = ddOf(detail(page, BULK_FAR), FLOW[flow].distanceTerm), farText = FLOW[flow].distanceText(distanceKm(BULK_ANCHOR.point, BULK_FAR.point));
    assert.equal(await farDistance.innerText(), farText, `${flow}: far place distance`);

    await page.getByLabel("반경").selectOption(String(BULK_RADIUS));
    await visible(page.getByText(new RegExp(`기준점 ${BULK_RADIUS}km 안 ${BULK_INSIDE.length}건`)));
    await markerCount(BULK_INSIDE.length);
    assert.equal(await rows.count(), BULK_INSIDE.length, `${flow}: rows inside the radius`);
    assert.equal(await rowButton(page, BULK_FAR).count(), 0, `${flow}: the far place leaves the list`);
    await visible(detail(page, BULK_FAR));
    assert.equal(await farDistance.innerText(), farText, `${flow}: the radius keeps the open detail and its distance`);
    if (flow === "new") await visible(detail(page, BULK_FAR).getByText(FLOW.new.hiddenDetail, { exact: true }));

    // Marker numbers follow the filtered name order. Neighbouring markers may overlap at this zoom, so the
    // marker's own click action is dispatched directly instead of relying on hit-testing.
    const target = BULK_INSIDE[BULK_INSIDE.length - 1], number = BULK_INSIDE.indexOf(target) + 1;
    await page.getByRole("button", { name: `지도에서 ${number}. ${target.title} 상세 보기`, exact: true }).dispatchEvent("click");
    await waitFocusId(page, FLOW[flow].detailHeading);
    await visible(detail(page, target));
    assert.equal(await ddOf(detail(page, target), FLOW[flow].distanceTerm).innerText(), FLOW[flow].distanceText(distanceKm(BULK_ANCHOR.point, target.point)));
    assert.equal(await rowButton(page, target).getAttribute("aria-pressed"), "true", `${flow}: marker and row are the same place`);
    passed.push(`${flow}-650-places-list-map-radius-and-detail`);
  } finally {
    RESOURCES["39"] = saved;
    await context.close();
  }
}

async function rapidSelection(flow) {
  // The earlier resource's late introduction never replaces the current one, in either arrival order.
  const { context, page } = await openContext();
  await page.goto(FLOW[flow].url("?types=39,32"));
  await settled(page, ["39", "32"]);
  const older = gate(introOf(G39), `${flow} older intro`), newer = gate(introOf(Z32), `${flow} newer intro`);
  await rowButton(page, G39).click();
  await older.arrived;
  await rowButton(page, Z32).click();
  await newer.arrived;
  await waitFocusId(page, FLOW[flow].detailHeading);
  await older.release(); // older answer first, while the newer one is still pending
  await flush(page);
  assert.equal(await detail(page, G39).count(), 0, `${flow}: only the current detail`);
  await visible(detail(page, Z32).getByText("소개를 불러오고 있어요…", { exact: true }));
  await excludes(detail(page, Z32), INTRO[G39.id], `${flow}: older text never shown under the newer name`);
  await newer.release();
  await visible(intro(page, Z32));
  await includes(intro(page, Z32), INTRO[Z32.id]);
  await excludes(detail(page, Z32), INTRO[G39.id]);

  // Reverse order: the newer answer first, the older one afterwards.
  const older2 = gate(introOf(S32), `${flow} older intro 2`), newer2 = gate(introOf(F39), `${flow} newer intro 2`);
  await rowButton(page, S32).click();
  await older2.arrived;
  await rowButton(page, F39).click();
  await newer2.arrived;
  await newer2.release();
  await visible(intro(page, F39));
  await older2.release();
  await flush(page);
  assert.equal(await detail(page, S32).count(), 0);
  await includes(intro(page, F39), "검증용 소개 라 (가상)");
  await excludes(detail(page, F39), INTRO[S32.id], `${flow}: late older answer never overlays`);
  passed.push(`${flow}-rapid-selection-late-intro-never-overlays`);
  await context.close();
}

async function arrival() {
  // Existing journey one-shot `resource=<kind>:<id>` for restaurant and lodging; old 관광지 links keep working.
  const { context, page } = await openContext();
  const held = gate(listOf("39"), "arrival restaurant list");
  await page.goto(existingUrl(`?resource=39:${F39.id}`));
  await held.arrived;
  await visible(page.getByText("고른 장소를 목록에서 찾고 있어요…", { exact: true }));
  assert.equal(await detail(page, F39).count(), 0, "no detail before the full list answer");
  await held.release();
  await waitFocusId(page, "resource-detail-heading");
  await visible(detail(page, F39));
  await waitTypes(page, "12,14,39");
  assert.equal(new URL(page.url()).searchParams.get("resource"), null, "arrival key consumed");
  passed.push("existing-arrival-restaurant-adds-kind-once-waits-full-list-focus");

  // Filters keep the open detail and the anchor.
  await detail(page, F39).getByRole("button", { name: "이 자원을 기준점으로", exact: true }).click();
  await visible(anchorLabel(page, F39));
  await typeButton(page, "39").click();
  await page.waitForFunction(() => new URL(location.href).searchParams.get("types") === null);
  await visible(detail(page, F39).getByText(FLOW.existing.hiddenDetail, { exact: true }));
  await visible(anchorLabel(page, F39));
  await typeButton(page, "39").click();
  await waitTypes(page, "12,14,39");
  await settled(page, ["39"]);
  await detail(page, F39).getByText(FLOW.existing.hiddenDetail, { exact: true }).waitFor({ state: "detached" });
  await page.reload(); // the consumed arrival never reopens; the address keeps the added kind
  await settled(page, ["39"]);
  assert.equal(await detail(page, F39).count(), 0, "reload does not reselect the consumed arrival");
  passed.push("existing-filter-keeps-detail-and-anchor-reload-does-not-reselect");

  // Lodging arrival whose list fails first: waits for retry, then opens.
  once(listOf("32"), listWith({ "32": "unavailable" }));
  await page.goto(existingUrl(`?types=12&resource=32:${S32.id}`));
  const failed = page.getByRole("alert").filter({ hasText: "숙박 목록을 불러오지 못했어요." });
  await visible(failed);
  await visible(page.getByText("목록을 다시 불러오면 고른 장소를 열어 드려요.", { exact: true }));
  assert.equal(await detail(page, S32).count(), 0);
  await waitTypes(page, "12,32");
  await failed.getByRole("button", { name: "다시 불러오기", exact: true }).click();
  await waitFocusId(page, "resource-detail-heading");
  await visible(detail(page, S32));
  await visible(intro(page, S32));
  passed.push("existing-arrival-lodging-failure-then-retry-opens");

  // Missing id, invalid kind and legacy 관광지 link.
  await page.goto(existingUrl("?types=39&resource=39:9399"));
  await visible(page.getByText(/고른 장소를 지금 등록된 관광정보 목록에서 찾지 못했어요/));
  assert.equal(typesParam(page), "39");
  await page.goto(existingUrl(`?types=39&resource=15:${F39.id}`));
  await settled(page, ["39"]);
  await page.waitForFunction(() => !new URL(location.href).searchParams.has("resource"));
  assert.equal(await page.locator("#resource-detail-heading").count(), 0, "an unsupported kind never selects");
  assert.equal(typesParam(page), "39", "other conditions kept");
  await page.goto(existingUrl(`?types=12&resource=12:${A12.id}`));
  await waitFocusId(page, "resource-detail-heading");
  await visible(detail(page, A12));
  assert.equal(typesParam(page), "12");
  assert.equal(await intro(page, A12).count(), 0, "empty introduction omitted for a 관광지 too");
  passed.push("existing-arrival-missing-invalid-and-legacy-link");
  await context.close();
}

async function compareIndependently() {
  // New journey: detail, anchor and 함께 보기 (max 2) are separate; filters keep all three.
  const { context, page } = await openContext();
  await page.goto(newUrl("?types=12,14,39,32"));
  await settled(page, ["12", "14", "39", "32"]);
  await openDetail(page, "new", G39);
  await introSettled(page, G39);
  for (const r of [F39, S32]) {
    const t = listToggle(page, r, "함께 보기에 추가"); await t.focus(); await page.keyboard.press("Enter");
    await visible(listToggle(page, r, "함께 보기에서 빼기"));
  }
  await visible(page.getByRole("heading", { name: "함께 보기 2/2", exact: true }));
  await visible(detail(page, G39)); // comparing never replaces the open detail
  assert.equal(await page.getByRole("button", { name: "기준점 해제", exact: true }).count(), 0, "comparing never sets an anchor");
  assert.equal(await ddOf(compareCard(page, F39), "유형").innerText(), "음식점");
  assert.equal(await ddOf(compareCard(page, S32), "유형").innerText(), "숙박");
  await includes(ddOf(compareCard(page, F39), "소개"), "검증용 소개 라 (가상)");
  await includes(ddOf(compareCard(page, S32), "소개"), INTRO[S32.id]);
  await listToggle(page, E39, "함께 보기에 추가").click();
  await visible(compare(page).getByRole("alert").filter({ hasText: "함께 보기는 2곳까지예요. 한 곳을 빼고 추가해 주세요." }));
  await waitFocusId(page, "new-compare-heading");
  assert.equal(await compare(page).getByRole("article").count(), 2);

  await detail(page, G39).getByRole("button", { name: "이 자원을 기준점으로", exact: true }).click();
  await visible(anchorLabel(page, G39));
  await visible(page.getByRole("heading", { name: "함께 보기 2/2", exact: true }));
  await typeButton(page, "39").click();
  await waitTypes(page, "12,14,32");
  assert.equal(await rowButton(page, F39).count(), 0);
  await visible(detail(page, G39).getByText(FLOW.new.hiddenDetail, { exact: true }));
  await visible(compareCard(page, F39).getByText("지금 목록 조건에서는 보이지 않아요.", { exact: true }));
  await visible(anchorLabel(page, G39));
  await compare(page).getByRole("button", { name: `${F39.title} 함께 보기에서 빼기`, exact: true }).click();
  await waitFocusId(page, "new-compare-heading");
  await visible(page.getByRole("heading", { name: "함께 보기 1/2", exact: true }));
  await typeButton(page, "39").click();
  await waitTypes(page, "12,14,39,32");
  await settled(page, ["39"]);
  await visible(listToggle(page, F39, "함께 보기에 추가"));
  await visible(detail(page, G39));
  passed.push("new-compare-detail-anchor-independent-filter-keeps-all");
  await noInternalWording(page, "new", "new compare");
  await context.close();
}

async function layouts() {
  // 320 / 390 / 1440: four type buttons, long title rows, detail and (new) comparison without page overflow; focus moves to the detail.
  mkdirSync("output/playwright", { recursive: true });
  for (const width of [320, 390, 1440]) {
    const { context, page } = await openContext({ width, height: 900 });
    for (const flow of ["existing", "new"]) {
      await page.goto(FLOW[flow].url("?types=12,14,39,32"));
      await settled(page, ["12", "14", "39", "32"]);
      await noPageOverflow(page, `${flow} ${width} list`);
      await openDetail(page, flow, LONG39);
      await introSettled(page, LONG39);
      await noPageOverflow(page, `${flow} ${width} long-title detail`);
      if (flow === "new") {
        for (const r of [LONG39, S32]) { const t = listToggle(page, r, "함께 보기에 추가"); await t.focus(); await page.keyboard.press("Enter"); }
        await visible(page.getByRole("heading", { name: "함께 보기 2/2", exact: true }));
        await noPageOverflow(page, `${flow} ${width} compare`);
      }
      await detail(page, LONG39).getByRole("button", { name: "상세 닫기", exact: true }).click();
      await waitFocusAttr(page, "data-resource-id", LONG39.id);
      if (width === 320) await page.screenshot({ path: `output/playwright/tourism-resources-${flow}-320.png`, fullPage: true });
    }
    await context.close();
  }
  passed.push("layout-320-390-1440-no-overflow-focus-to-detail-and-back");
}

// ---- Run ----
try {
  for (const flow of ["existing", "new"]) {
    await typeChoice(flow);
    await independentLoading(flow);
    await rapidSelection(flow);
    await regionGuard(flow);
    await allTypesOff(flow);
    await largeList(flow);
  }
  await arrival();
  await compareIndependently();
  await layouts();
  assert.equal(calls.filter(c => c.endpoint === "new/resource-detail").length, 0, "both journeys use the shared introduction address");
  assert.deepEqual(writes, [], "no same-origin non-GET request");
  assert.deepEqual(errors, []);
  assert.deepEqual(fixtureErrors, []);
  assert.equal(queue.length, 0, `unused overrides: ${queue.length}`);
  console.log(JSON.stringify({ headless: true, data: "검증용 controlled fixtures for tourism lists and introductions (not official-data verification)",
    passed, browserErrors: errors.length, clientWrites: writes.length, apiRequests: calls.length }));
} finally {
  await browser.close();
}
