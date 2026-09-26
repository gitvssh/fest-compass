// pickDday related material search acceptance (functional-spec §8), headless. Scenario: TS-FC-011.
//
// Data provenance is explicit per check:
//  - REAL ARCHIVE: archive festival lookups (/api/existing/festivals without a current: id), /api/existing/history,
//    /api/existing/monthly, /api/existing/schedule and /api/new/visits pass through the server untouched. Expected edition
//    years and region names are read here from apps/web/data, never from app code.
//  - 검증용 FIXTURES (UI semantics only, never presented as production provider results): currently registered festival
//    identities, tourism resource lists and resource introductions, map tiles. Titles/addresses carry "검증용"/"(가상)"; protocol
//    keys mirror lib/existing/request.ts and lib/new-festival/request.ts.
//  - 검증용 DuckDuckGo 도착지: every request to duckduckgo.com is intercepted and answered by a labelled local page. It proves
//    the link's navigation semantics (URL, referrer, opener) only; it never claims that DuckDuckGo returns any result.
//    The live provider is checked separately by the coordinator (a bot challenge was observed and is not bypassed).
// Ordering uses request gates (hold → assert → release); no sleeps decide ordering.
import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";
import { mockMapTiles } from "./map-test-tiles.mjs";

const base = process.env.E2E_BASE_URL ?? process.env.BASE_URL;
if (!base) throw new Error("E2E_BASE_URL (or BASE_URL) required");
const origin = new URL(base).origin;
const outDir = new URL("../output/playwright/", import.meta.url);
mkdirSync(outDir, { recursive: true });
const readData = name => JSON.parse(readFileSync(new URL(`../data/${name}`, import.meta.url), "utf8"));

// ---- Independent facts from the checked-in archive (no app import) ----
const editionsFile = readData("festival-editions.json"), catalogue = readData("region-catalogue.json");
function regionRef(code) {
  const r = catalogue.rows.find(x => `${x.provinceCode}${x.districtCode}` === code);
  assert.ok(r, `catalogue region ${code}`);
  return { province: r.provinceCode, district: r.districtCode, code, name: `${r.provinceName} ${r.districtName}`, districtName: r.districtName };
}
const NONSAN = regionRef("44230"), GONGJU = regionRef("44150"), SEOUL_JUNGGU = regionRef("11140");
assert.ok(catalogue.rows.filter(r => r.districtName === "중구").length > 1, "oracle: 중구 exists in several provinces (ambiguous district)");
const NONSAN_ID = "archive:nonsan-strawberry", FESTIVAL = "논산딸기축제";
const NONSAN_YEARS = [...new Set(editionsFile.editions.filter(e => e.origin === "archive" && e.festivalId === "nonsan-strawberry").map(e => e.year))].sort((a, b) => b - a);
assert.deepEqual(NONSAN_YEARS, [2025, 2024, 2023], "oracle: Nonsan archive edition years");
const ED = y => `nonsan-strawberry-${y}`;
const CURRENT_DATED = "current:44230:9900001", CURRENT_UNDATED = "current:44230:9900002", CURRENT_MISSING = "current:44230:9999999";
const ARCHIVE_MISSING = "archive:no-such-festival-e2e";
const path = (id, view) => `/existing/${encodeURIComponent(id)}/${view}`;
const kstYear = () => new Date(Date.now() + 9 * 3_600_000).toISOString().slice(0, 4);

const FESTIVAL_TOPICS = ["프로그램", "운영 결과", "보도자료"], REGION_TOPICS = ["관광사업", "축제 사례"], RESOURCE_TOPICS = ["행사", "축제"];
const MARKER = "검증마커"; // appears only in text typed by this test; must never leave the dialog except to DuckDuckGo
const CUSTOM = `${MARKER} 논산 & 딸기 #2025 + 체험 후기`;

// ---- 검증용 fixtures (synthetic) ----
const FIXTURE_AT = "2026-09-01T00:00:00.000Z";
const fixtureSource = { title: "검증용 가상 등록 정보", url: "https://example.invalid/fixture", checkedAt: null, publishedAt: null, collectedAt: FIXTURE_AT };
const festivalsKey = r => JSON.stringify(["festivals", r.id, r.q, r.province, r.district, r.start, r.end, r.page, r.total]);
const festivalsLookupRequest = id => { const y = kstYear(); return { q: "", province: null, district: null, start: `${y}-01-01`, end: `${y}-12-31`, page: 1, total: null, id }; };
const currentBlock = (items, lookup) => ({ status: items.length ? "complete" : "empty", error: null, collectedAt: FIXTURE_AT, mode: "lookup", range: null,
  page: 1, next: null, continuity: null, total: items.length, omitted: 0, lookup, items });
const currentFestival = (id, dated) => ({ id, source: "current", contentId: id.split(":")[2], name: FESTIVAL, region: NONSAN,
  start: dated ? "2026-04-10" : null, end: dated ? "2026-04-12" : null, datesVerified: dated, address: "검증용 가상 주소 · 현재 등록 항목",
  point: null, modifiedAt: null, linkedArchiveId: null, provenance: fixtureSource });
const CURRENT = { [CURRENT_DATED]: currentFestival(CURRENT_DATED, true), [CURRENT_UNDATED]: currentFestival(CURRENT_UNDATED, false) };

const res = (id, kind, title, point) => ({ id, kind, title, address: `검증용 가상 주소 ${id}`, point, modifiedAt: null });
const RA = res("9101", "12", "검증용 관광지 가 (가상)", { latitude: 36.2, longitude: 127.1 });
const RC = res("9103", "12", "검증용 관광지 라 (가상)", { latitude: 36.21, longitude: 127.11 });
const RB = res("9201", "14", "검증용 문화시설 다 (가상)", { latitude: 36.19, longitude: 127.18 });
const KIND_LABEL = { "12": "관광지", "14": "문화시설" };
const resourcesKey = r => JSON.stringify(["resources", r.province, r.district, r.types]);
function resourcesBody(p) {
  const province = p.get("province").trim(), district = p.get("district").trim(), code = province === district ? province : `${province}${district}`;
  const region = regionRef(code), types = ["12", "14"].filter(k => (p.get("types") ?? "12,14").split(",").map(s => s.trim()).includes(k));
  const items = { "12": code === NONSAN.code ? [RA, RC] : [res("9301", "12", `검증용 ${region.districtName} 관광지 (가상)`, null)], "14": code === NONSAN.code ? [RB] : [] };
  const request = { province, district, types };
  return { key: resourcesKey(request), request, retrievedAt: new Date().toISOString(), region,
    byType: types.map(kind => ({ status: items[kind].length ? "complete" : "empty", error: null, collectedAt: FIXTURE_AT, kind, label: KIND_LABEL[kind], total: items[kind].length, items: items[kind] })) };
}
const detailKey = r => JSON.stringify(["new-resource-detail", r.province, r.district, r.kind, r.id]);
function detailBody(p) {
  const request = { province: p.get("province").trim(), district: p.get("district").trim(), kind: p.get("kind").trim(), id: p.get("id").trim() };
  const code = request.province === request.district ? request.province : `${request.province}${request.district}`;
  return { key: detailKey(request), request, retrievedAt: new Date().toISOString(), region: regionRef(code), status: "empty", error: null, detail: null,
    source: { title: "검증용 소개 출처 (가상)", url: "https://www.data.go.kr/data/15101578/openapi.do", checkedAt: null, publishedAt: null, collectedAt: FIXTURE_AT } };
}

// ---- API routing: default provenance per endpoint, one-shot overrides and request gates ----
const calls = [], queue = [], fixtureErrors = [];
const fixtureJson = make => (route, p) => ({ kind: "fulfill", options: { json: make(p) } });
function festivals(route, p) {
  const id = p.get("id");
  if (!id?.startsWith("current:")) return { kind: "continue" }; // REAL ARCHIVE lookup
  const found = CURRENT[id] ? [CURRENT[id]] : [], request = festivalsLookupRequest(id);
  return { kind: "fulfill", options: { json: { key: festivalsKey(request), request, retrievedAt: new Date().toISOString(),
    archive: { status: "not-requested", error: null, collectedAt: null, items: [], freshness: null },
    current: currentBlock(found, found.length ? "verified" : "not-found") } } };
}
const DEFAULTS = { "existing/festivals": festivals, "existing/resources": fixtureJson(resourcesBody), "resources/detail": fixtureJson(detailBody) };
async function onApi(route) {
  const url = new URL(route.request().url()), endpoint = url.pathname.slice("/api/".length), p = url.searchParams;
  calls.push({ endpoint, params: Object.fromEntries(p) });
  const index = queue.findIndex(q => q.match(endpoint, p)), entry = index < 0 ? null : queue.splice(index, 1)[0];
  let respond = entry?.respond ?? DEFAULTS[endpoint] ?? (() => ({ kind: "continue" }));
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
function within(promise, label, ms = 20_000) {
  let timer;
  const timeout = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`timed out: ${label}`)), ms); });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}
function gate(match, label = "gated request") {
  let arrived, release, done;
  const hasArrived = new Promise(r => { arrived = r; }), released = new Promise(r => { release = r; }), finished = new Promise(r => { done = r; });
  queue.push({ match, gate: { arrived, released }, done });
  return { arrived: within(hasArrived, label), release: async respond => { release(respond ?? null); await within(finished, `${label} finished`); } };
}
const is = (endpoint, test = () => true) => (e, p) => e === endpoint && test(p);

// ---- 검증용 DuckDuckGo 도착지 (interception) and outbound-request ledger ----
const DDG_TITLE = "검증용 DuckDuckGo 도착지 (가로챈 시험 응답 · 실제 검색 결과 아님)";
const ddgRequests = [], ddgNavigations = [], outbound = [], popups = [], mainFrameUrls = [], externalEvidence = [];
const isDdg = u => u.hostname === "duckduckgo.com" || u.hostname.endsWith(".duckduckgo.com");
async function interceptDdg(route) {
  const request = route.request(), headers = request.headers();
  const record = { url: request.url(), method: request.method(), navigation: request.isNavigationRequest(), referer: headers.referer ?? null };
  ddgRequests.push(record);
  if (!record.navigation) return route.fulfill({ status: 204, body: "" });
  ddgNavigations.push(record);
  return route.fulfill({ status: 200, contentType: "text/html; charset=utf-8",
    body: `<!doctype html><html lang="ko"><meta charset="utf-8"><title>${DDG_TITLE}</title><body><p>${DDG_TITLE}</p></body></html>` });
}

// ---- Page helpers ----
const browser = await chromium.launch({ headless: true });
const errors = [], writes = [], passed = [];
async function openContext(options = {}) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: "ko-KR", ...options });
  await mockMapTiles(context);
  await context.route(u => u.origin === origin && (u.pathname.startsWith("/api/new/") || u.pathname.startsWith("/api/existing/") || u.pathname.startsWith("/api/resources/")), onApi);
  await context.route(u => isDdg(u), interceptDdg);
  context.on("request", r => { if (!isDdg(new URL(r.url()))) outbound.push({ url: r.url(), body: r.postData() ?? "" }); });
  context.on("page", p => popups.push(p));
  const page = await context.newPage();
  page.setDefaultTimeout(20_000);
  page.on("pageerror", e => errors.push(e.message));
  page.on("framenavigated", f => { if (f === page.mainFrame()) mainFrameUrls.push(f.url()); });
  page.on("request", r => { if (r.method() !== "GET" && new URL(r.url()).origin === origin) writes.push(`${r.method()} ${new URL(r.url()).pathname}`); });
  return { context, page };
}
const visible = l => l.waitFor({ state: "visible" });
const params = page => new URL(page.url()).searchParams;
const waitParam = (page, key, value) => page.waitForFunction(([k, v]) => new URL(location.href).searchParams.get(k) === v, [key, value]);
const waitFocusId = (page, id) => page.waitForFunction(i => document.activeElement?.id === i, id);
const flush = page => page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
const escapeRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const count = (text, part) => text.split(part).length - 1;
const norm = s => s.normalize("NFC").replace(/\s+/g, " ").trim();
const existingMenu = (page, label) => page.getByRole("navigation", { name: "축제 탐색 메뉴" }).getByRole("link", { name: label, exact: true });
const resourceList = page => page.getByRole("list", { name: "관광자원 목록" });
const rowButton = (page, r) => resourceList(page).getByRole("button", { name: new RegExp(`^\\d+\\. ${escapeRe(r.title)}`) });
const detail = (page, r) => page.getByRole("complementary", { name: r.title, exact: true });

// Related search, located only by the accepted contract (names and labels), never by implementation structure.
const anyOpener = page => page.getByRole("button", { name: /관련 자료 검색$/ });
const opener = (page, target) => page.getByRole("button", { name: `${target} 관련 자료 검색`, exact: true });
const searchDialog = (page, target) => page.getByRole("dialog", { name: `${target} 관련 자료 검색`, exact: true });
const queryBox = dialog => dialog.getByLabel("검색어", { exact: true });
const topicGroup = dialog => dialog.getByRole("group", { name: "찾을 내용", exact: true });
const yearGroup = dialog => dialog.getByRole("group", { name: "연도", exact: true });
const searchLink = dialog => dialog.getByRole("link", { name: "DuckDuckGo에서 검색 ↗", exact: true });
const resetButton = dialog => dialog.getByRole("button", { name: "기본 검색어로", exact: true });
const closeButton = dialog => dialog.getByRole("button", { name: "닫기", exact: true });
const EMPTY_TEXT = "검색어를 입력해 주세요.", NOTE_TEXT = "새 탭에서 검색 결과가 열려요.";

async function noOpener(page, label) {
  assert.equal(await anyOpener(page).count(), 0, `${label}: no related search button`);
  assert.equal(await page.getByText("관련 자료 검색", { exact: true }).count(), 0, `${label}: no related search text`);
}
async function openerReady(page, target) {
  const button = opener(page, target);
  await visible(button);
  assert.equal(norm(await button.innerText()), "관련 자료 검색", "visible opener text");
  assert.equal(await button.count(), 1, `one opener for ${target}`);
  return button;
}
async function openSearch(page, target, { keyboard = false } = {}) {
  const button = await openerReady(page, target);
  if (keyboard) { await button.focus(); await page.keyboard.press("Enter"); } else await button.click();
  const dialog = searchDialog(page, target);
  await visible(dialog);
  await visible(dialog.getByRole("heading", { name: `${target} 관련 자료 검색`, exact: true }));
  return { button, dialog };
}
async function focusReturned(page, button, label) {
  const handle = await button.elementHandle();
  await within(page.waitForFunction(el => document.activeElement === el, handle), `${label}: focus back on opener`);
}
async function closeWith(page, { button, dialog }, how, label) {
  if (how === "Escape") await page.keyboard.press("Escape"); else await closeButton(dialog).click();
  await dialog.waitFor({ state: "hidden" });
  await focusReturned(page, button, label);
}
async function radios(group, names, label) {
  assert.equal(await group.getByRole("radio").count(), names.length, `${label}: radio count`);
  for (const n of names) await visible(group.getByRole("radio", { name: n, exact: true }));
}
async function checked(group, names) {
  const on = [];
  for (const n of names) if (await group.getByRole("radio", { name: n, exact: true }).isChecked()) on.push(n);
  assert.equal(on.length, 1, `exactly one checked of ${names}: ${on}`);
  return on[0];
}
async function pick(page, group, name) { await group.getByRole("radio", { name, exact: true }).check(); await flush(page); }
const query = async dialog => await queryBox(dialog).inputValue();
/** Fixed DuckDuckGo HTTPS host root carrying only `q`; returns the decoded q. */
async function linkQuery(dialog, label) {
  const link = searchLink(dialog);
  await visible(link);
  const raw = await link.getAttribute("href"), u = new URL(raw);
  assert.equal(u.protocol, "https:", `${label}: https`); assert.equal(u.host, "duckduckgo.com", `${label}: fixed host`);
  assert.equal(u.pathname, "/", `${label}: host root`); assert.equal(u.hash, "", `${label}: no fragment`);
  assert.equal(u.username + u.password + u.port, "", `${label}: no credentials/port`);
  assert.deepEqual([...u.searchParams.keys()], ["q"], `${label}: only q in ${raw}`);
  assert.equal(await link.getAttribute("target"), "_blank", `${label}: new tab`);
  const rel = (await link.getAttribute("rel") ?? "").split(/\s+/);
  assert.ok(rel.includes("noopener") && rel.includes("noreferrer"), `${label}: rel ${rel}`);
  assert.equal(await link.getAttribute("referrerpolicy"), "no-referrer", `${label}: referrerpolicy`);
  assert.equal(await link.getAttribute("ping"), null, `${label}: no ping`);
  const q = u.searchParams.get("q");
  assert.equal(norm(q), norm(await query(dialog)), `${label}: link carries the shown query`);
  return q;
}
/** Everything the dialog shows right now; `href` is null when no link is offered. */
async function readDialog(dialog, topics, years) {
  const hasYears = years.length > 0;
  return { query: await query(dialog), topic: await checked(topicGroup(dialog), ["전체", ...topics]),
    year: hasYears ? await checked(yearGroup(dialog), ["연도 전체", ...years.map(y => `${y}년`)]) : null,
    hasLink: await searchLink(dialog).count() > 0, hasReset: await resetButton(dialog).count() > 0 };
}
const FORBIDDEN = ["archive:", "current:", "nonsan-strawberry", "9900001", "9900002", "9101", "9103", "9201", "44230", "44150", "11140",
  "검증용 가상 주소", "36.2", "127.1", "https://", "undefined", "null", "NaN", "새 축제", MARKER];
function checkQuery(q, { subject, region, year = null, topic = null, topics, forbid = [] }, label) {
  assert.ok(q.includes(subject), `${label}: subject ${subject} in ${q}`);
  assert.equal(count(q, region.name), 1, `${label}: full region name exactly once in ${q}`);
  assert.equal(count(q, region.districtName), 1, `${label}: district not duplicated in ${q}`);
  if (subject !== region.name) assert.ok(q.indexOf(subject) < q.indexOf(region.name), `${label}: subject before region in ${q}`);
  assert.deepEqual(q.match(/(?:19|20)\d{2}/g) ?? [], year ? [String(year)] : [], `${label}: year in ${q}`);
  for (const t of topics) assert.equal(q.includes(t), t === topic, `${label}: topic ${t} in ${q}`);
  for (const f of [...FORBIDDEN, ...forbid]) assert.ok(!q.includes(f), `${label}: ${f} must not be in ${q}`);
}
async function noPageOverflow(page, label) {
  const [scroll, inner] = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
  assert.ok(scroll <= inner, `${label}: page scrollWidth ${scroll} > ${inner}`);
}
async function dialogFits(dialog, label) {
  const fit = await dialog.evaluate(d => {
    const box = d.getBoundingClientRect(), over = [];
    for (const el of d.querySelectorAll("*")) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && (r.right > box.right + 0.5 || r.left < box.left - 0.5)) over.push(`${el.tagName.toLowerCase()} ${Math.round(r.left)}–${Math.round(r.right)}`);
    }
    // A one-line search input scrolls its editable text to reach a long query. Its outer box must fit
    // (checked above); that native caret scrolling is not a horizontally overflowing dialog.
    const scrollers = [d, ...d.querySelectorAll("*")].filter(el => !(el instanceof HTMLInputElement && el.type === "search")
      && el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflowX !== "visible").map(el => el.tagName.toLowerCase());
    return { left: box.left, right: box.right, inner: innerWidth, over, scrollers };
  });
  assert.ok(fit.left >= 0 && fit.right <= fit.inner, `${label}: dialog inside viewport ${JSON.stringify(fit)}`);
  assert.deepEqual(fit.over, [], `${label}: dialog content inside the dialog`);
  assert.deepEqual(fit.scrollers, [], `${label}: no horizontal scrolling inside the dialog`);
}
async function storageText(page) {
  return page.evaluate(() => JSON.stringify({ local: { ...localStorage }, session: Object.fromEntries(Object.entries(sessionStorage).filter(([k]) => !k.startsWith("__next"))) }));
}
async function storageKeys(page, context) {
  const s = await page.evaluate(() => ({ local: Object.keys(localStorage).sort(), session: Object.keys(sessionStorage).filter(k => !k.startsWith("__next")).sort() }));
  return { ...s, cookies: (await context.cookies()).map(c => c.name).sort() };
}
/**
 * Asserts that interacting with an open dialog created no app API request, no DuckDuckGo request and no request to any
 * other host. Same-origin framework prefetches and the synthetic map tiles are not search-created and are not counted.
 */
const foreign = o => { const u = new URL(o.url); return u.origin !== origin && u.hostname !== "tile.openstreetmap.org"; };
function quiet(label) {
  const apis = calls.length, ddg = ddgRequests.length, out = outbound.length;
  return () => {
    assert.equal(calls.length, apis, `${label}: no API request from the search dialog ${JSON.stringify(calls.slice(apis))}`);
    assert.equal(ddgRequests.length, ddg, `${label}: no DuckDuckGo request before a user click`);
    assert.deepEqual(outbound.slice(out).filter(foreign).map(o => o.url), [], `${label}: no request to another host`);
  };
}
/** Opens the external search by one user action and records the 검증용 destination. The source tab must not change. */
async function openExternal(context, page, dialog, trigger, label) {
  const sourceUrl = page.url(), shown = await query(dialog), before = { popups: popups.length, nav: ddgNavigations.length, apis: calls.length };
  const next = context.waitForEvent("page");
  await trigger();
  const popup = await within(next, `${label}: new tab`);
  await popup.waitForURL(u => isDdg(u), { timeout: 20_000 });
  await popup.waitForLoadState("domcontentloaded");
  const seen = await popup.evaluate(() => ({ url: location.href, referrer: document.referrer, opener: window.opener === null ? null : "present", title: document.title }));
  await flush(page);
  assert.equal(popups.length, before.popups + 1, `${label}: exactly one new tab`);
  assert.equal(ddgNavigations.length, before.nav + 1, `${label}: exactly one DuckDuckGo navigation`);
  const nav = ddgNavigations.at(-1), u = new URL(seen.url);
  assert.equal(seen.title, DDG_TITLE, `${label}: labelled test destination`);
  assert.equal(u.origin, "https://duckduckgo.com", label); assert.equal(u.pathname, "/", label);
  assert.deepEqual([...u.searchParams.keys()], ["q"], `${label}: only q`);
  assert.equal(norm(u.searchParams.get("q")), norm(shown), `${label}: the new tab searches the shown query`);
  assert.equal(seen.referrer, "", `${label}: document.referrer empty`);
  assert.equal(seen.opener, null, `${label}: window.opener null`);
  assert.equal(nav.referer, null, `${label}: no Referer header`);
  await popup.close();
  assert.equal(page.url(), sourceUrl, `${label}: source tab address unchanged`);
  assert.equal(await query(dialog), shown, `${label}: source dialog keeps the query`);
  assert.equal(calls.length, before.apis, `${label}: no app API request`);
  externalEvidence.push({ label, destination: "검증용 가로챈 DuckDuckGo 도착지 (실제 검색 결과 아님)", popupUrl: seen.url, q: u.searchParams.get("q"),
    documentReferrer: seen.referrer, windowOpener: seen.opener, refererHeader: nav.referer, sourceUrlUnchanged: page.url() === sourceUrl });
  return u.searchParams.get("q");
}

// ---- Scenarios · existing festival ----
async function verifiedOnly({ page }) {
  // Only a verified festival offers the search: none while the first lookup is pending or after it failed.
  const held = gate(is("existing/festivals", p => p.get("id") === NONSAN_ID), "Nonsan lookup");
  await page.goto(`${base}${path(NONSAN_ID, "visits")}`);
  await held.arrived;
  await visible(page.getByRole("heading", { level: 1, name: "축제 정보", exact: true }));
  await noOpener(page, "lookup pending");
  await held.release(() => ({ kind: "abort" }));
  const failed = page.getByRole("alert").filter({ hasText: "축제 정보를 불러오지 못했어요." }).first();
  await visible(failed);
  await noOpener(page, "lookup failed");
  await failed.getByRole("button", { name: "다시 불러오기", exact: true }).click();
  await visible(page.getByRole("heading", { level: 1, name: FESTIVAL, exact: true }));
  await openerReady(page, FESTIVAL);
  assert.equal(ddgRequests.length, 0, "nothing sent to DuckDuckGo on page load");
  assert.equal(await page.locator('link[href*="duckduckgo"], script[src*="duckduckgo"], iframe[src*="duckduckgo"]').count(), 0, "no prefetch/preconnect to the provider");
  passed.push("verified-festival-only-no-button-while-pending-or-failed");
}

async function notFound({ page }) {
  // A confirmed-absent festival (REAL archive lookup / 검증용 current lookup) has no search.
  for (const id of [ARCHIVE_MISSING, CURRENT_MISSING]) {
    await page.goto(`${base}${path(id, "visits")}`);
    await visible(page.getByRole("heading", { level: 1, name: "선택한 축제를 찾지 못했어요", exact: true }));
    await noOpener(page, `not found ${id}`);
  }
  passed.push("not-found-festival-no-button");
}

const YEARS = NONSAN_YEARS.map(y => `${y}년`), ALL_YEARS = ["연도 전체", ...YEARS];
async function existingDialog({ page }) {
  // Defaults: 전체 · 연도 전체 while two default editions are compared; topic and year rebuild the query; reopen resets.
  await page.goto(`${base}${path(NONSAN_ID, "visits")}`);
  assert.equal(params(page).get("editions"), null, "no editions address → confirmed default editions (two)");
  const s = await openSearch(page, FESTIVAL, { keyboard: true });
  const done = quiet("existing dialog"), { dialog } = s;
  await radios(topicGroup(dialog), ["전체", ...FESTIVAL_TOPICS], "festival topics");
  await radios(yearGroup(dialog), ALL_YEARS, "festival years");
  const first = await readDialog(dialog, FESTIVAL_TOPICS, NONSAN_YEARS);
  assert.deepEqual([first.topic, first.year, first.hasLink, first.hasReset], ["전체", "연도 전체", true, false]);
  await visible(queryBox(dialog));
  await visible(dialog.getByText(NOTE_TEXT, { exact: true }));
  const facts = { subject: FESTIVAL, region: NONSAN, topics: FESTIVAL_TOPICS };
  checkQuery(first.query, facts, "default");
  await linkQuery(dialog, "default");

  await pick(page, topicGroup(dialog), "프로그램");
  checkQuery(await query(dialog), { ...facts, topic: "프로그램" }, "topic 프로그램");
  await pick(page, yearGroup(dialog), "2025년");
  checkQuery(await query(dialog), { ...facts, topic: "프로그램", year: 2025 }, "2025 · 프로그램");
  await pick(page, yearGroup(dialog), "2023년");
  checkQuery(await query(dialog), { ...facts, topic: "프로그램", year: 2023 }, "2023 · 프로그램");
  await pick(page, topicGroup(dialog), "보도자료");
  checkQuery(await query(dialog), { ...facts, topic: "보도자료", year: 2023 }, "2023 · 보도자료");
  await linkQuery(dialog, "2023 · 보도자료");
  assert.equal(await resetButton(dialog).count(), 0, "generated queries are not edits");
  await pick(page, topicGroup(dialog), "전체");
  await pick(page, yearGroup(dialog), "연도 전체");
  assert.equal(await query(dialog), first.query, "back to 전체 · 연도 전체 gives the default query");

  // An edit is overwritten by a later topic/year change.
  await queryBox(dialog).fill(`${MARKER} 직접 입력`);
  await visible(resetButton(dialog));
  await pick(page, topicGroup(dialog), "운영 결과");
  checkQuery(await query(dialog), { ...facts, topic: "운영 결과" }, "topic after edit");
  // Reopen resets topic, year and an edited query to the current context.
  await pick(page, yearGroup(dialog), "2024년");
  await queryBox(dialog).fill(`${MARKER} 닫기 전 입력`);
  done();
  await closeWith(page, s, "Escape", "Escape");
  const again = await openSearch(page, FESTIVAL);
  const reopened = await readDialog(again.dialog, FESTIVAL_TOPICS, NONSAN_YEARS);
  assert.deepEqual(reopened, first, "reopen resets to the current context");
  await closeWith(page, again, "button", "닫기");
  passed.push("existing-defaults-topics-years-rebuild-query", "existing-reopen-resets", "close-and-escape-return-focus", "full-region-name-once");
}

async function editionAddress({ page }) {
  // Only an applied single edition preselects its year; compare/unknown/mixed/duplicate addresses never invent one.
  const cases = [
    [`editions=${ED(2023)}`, "2023년", 2023],
    [`editions=${ED(2025)}`, "2025년", 2025],
    [`editions=${ED(2025)},${ED(2024)},${ED(2023)}`, "연도 전체", null],
    [`editions=nonsan-strawberry-2019`, "연도 전체", null],
    [`editions=${ED(2025)},nonsan-strawberry-2019`, "연도 전체", null],
    [`editions=${ED(2024)}&editions=${ED(2024)}`, "연도 전체", null],
    [`editions=${ED(2025)}&editions=${ED(2023)}`, "연도 전체", null],
  ];
  for (const [address, year, value] of cases) {
    await page.goto(`${base}${path(NONSAN_ID, "visits")}?${address}`);
    const s = await openSearch(page, FESTIVAL);
    await radios(yearGroup(s.dialog), ALL_YEARS, address);
    const now = await readDialog(s.dialog, FESTIVAL_TOPICS, NONSAN_YEARS);
    assert.equal(now.year, year, `${address}: default year`);
    assert.equal(now.topic, "전체", address);
    checkQuery(now.query, { subject: FESTIVAL, region: NONSAN, topics: FESTIVAL_TOPICS, year: value, forbid: ["2019"] }, address);
    await closeWith(page, s, "Escape", address);
  }
  // Applying one edition through the picker changes the next opening (context re-read on open).
  await page.goto(`${base}${path(NONSAN_ID, "visits")}?editions=${ED(2025)},${ED(2024)}`);
  await page.getByRole("checkbox", { name: /^2024년 · /, exact: false }).uncheck();
  await page.locator("form:has(#edition-picker)").getByRole("button", { name: "적용", exact: true }).click();
  await waitParam(page, "editions", ED(2025));
  const s = await openSearch(page, FESTIVAL);
  assert.equal((await readDialog(s.dialog, FESTIVAL_TOPICS, NONSAN_YEARS)).year, "2025년", "applied single edition after picker");
  await closeWith(page, s, "Escape", "picker");
  passed.push("single-edition-year-compare-all", "unknown-mixed-duplicate-editions-no-invented-year", "reopen-follows-applied-edition");
}

async function otherViews({ page }) {
  // visits(2023) → timing with observation year 2024 and a candidate inside the 2025 edition → 연도 전체; back → 2023.
  await page.goto(`${base}${path(NONSAN_ID, "visits")}?editions=${ED(2023)}`);
  let s = await openSearch(page, FESTIVAL);
  assert.equal((await readDialog(s.dialog, FESTIVAL_TOPICS, NONSAN_YEARS)).year, "2023년");
  await closeWith(page, s, "Escape", "visits 2023");
  await existingMenu(page, "개최 시기").click();
  await waitFocusId(page, "timing-heading");
  await page.getByLabel("관측연도").selectOption("2024");
  await page.getByRole("button", { name: "연도 보기", exact: true }).click();
  await waitParam(page, "year", "2024");
  await page.getByLabel("시작일").fill("2025-03-27");
  await page.getByLabel("종료일").fill("2025-03-30");
  await page.getByRole("button", { name: "후보 기간 추가", exact: true }).click();
  await visible(page.getByRole("article", { name: /^후보 A · / }));
  s = await openSearch(page, FESTIVAL);
  await radios(yearGroup(s.dialog), ALL_YEARS, "timing years (edition years only)");
  const timing = await readDialog(s.dialog, FESTIVAL_TOPICS, NONSAN_YEARS);
  assert.equal(timing.year, "연도 전체", "observation year / month / candidate never become the edition year");
  checkQuery(timing.query, { subject: FESTIVAL, region: NONSAN, topics: FESTIVAL_TOPICS, forbid: ["2026"] }, "timing");
  await closeWith(page, s, "Escape", "timing");
  assert.equal(params(page).get("year"), "2024", "search does not touch the observation year");
  assert.equal(await page.getByRole("article", { name: /^후보 A · / }).count(), 1, "search does not touch candidates");
  await existingMenu(page, "주변 관광자원").click();
  await waitFocusId(page, "resources-heading");
  s = await openSearch(page, FESTIVAL);
  assert.equal((await readDialog(s.dialog, FESTIVAL_TOPICS, NONSAN_YEARS)).year, "연도 전체", "resources view");
  await closeWith(page, s, "Escape", "resources");
  await existingMenu(page, "과거 방문 흐름").click();
  await waitFocusId(page, "visits-heading");
  await waitParam(page, "editions", ED(2023));
  s = await openSearch(page, FESTIVAL);
  assert.equal((await readDialog(s.dialog, FESTIVAL_TOPICS, NONSAN_YEARS)).year, "2023년", "back on visits the applied edition returns");
  await closeWith(page, s, "Escape", "visits again");
  passed.push("timing-and-resources-exclude-observation-month-candidate-years");
}

async function editableAndExternal({ page, context }) {
  // Editable query encodes & # + and Korean; clear → no link; reset; the explicit click/Enter opens one labelled new tab.
  await page.goto(`${base}${path(NONSAN_ID, "visits")}?editions=${ED(2025)}`);
  const before = await storageKeys(page, context), editionsBefore = params(page).get("editions");
  const s = await openSearch(page, FESTIVAL), { dialog } = s;
  const initial = await readDialog(dialog, FESTIVAL_TOPICS, NONSAN_YEARS);
  const done = quiet("editing");
  await queryBox(dialog).fill(CUSTOM);
  await visible(resetButton(dialog));
  const raw = await searchLink(dialog).getAttribute("href");
  for (const encoded of ["%26", "%23", "%2B"]) assert.ok(raw.includes(encoded), `${encoded} encoded in ${raw}`);
  assert.equal(await linkQuery(dialog, "custom"), CUSTOM, "decoded q is exactly the typed query");
  for (const blank of ["", "   "]) {
    await queryBox(dialog).fill(blank);
    await visible(dialog.getByText(EMPTY_TEXT, { exact: true }));
    assert.equal(await searchLink(dialog).count(), 0, `blank ${JSON.stringify(blank)}: no outbound link`);
    assert.equal(await dialog.locator('a[href*="duckduckgo"]').count(), 0, "no hidden outbound link either");
    await queryBox(dialog).focus();
    await page.keyboard.press("Enter");
    await flush(page);
  }
  await resetButton(dialog).click();
  await flush(page);
  assert.deepEqual(await readDialog(dialog, FESTIVAL_TOPICS, NONSAN_YEARS), initial, "기본 검색어로 restores the default");
  assert.equal(await dialog.getByText(EMPTY_TEXT, { exact: true }).count(), 0);
  await queryBox(dialog).fill(CUSTOM);
  done(); // typing, clearing, Enter on an empty query and resetting sent nothing anywhere
  assert.equal(page.url().includes(encodeURIComponent(MARKER)) || page.url().includes(MARKER), false, "typed query not in the address");
  assert.equal(ddgRequests.length, 0, "no external request before the first explicit action");

  await openExternal(context, page, dialog, () => searchLink(dialog).click(), "link click (custom)");
  // A composing Enter (IME) must not open; the committed Enter opens exactly one tab (ordering proves the first did nothing).
  await queryBox(dialog).fill("논산딸기축제 체험 프로그램");
  await queryBox(dialog).focus();
  const popupsBefore = popups.length, navBefore = ddgNavigations.length;
  await queryBox(dialog).evaluate(el => {
    const ev = new KeyboardEvent("keydown", { key: "Enter", code: "Enter", isComposing: true, bubbles: true, cancelable: true });
    Object.defineProperty(ev, "keyCode", { get: () => 229 });
    el.dispatchEvent(ev);
  });
  await flush(page);
  await openExternal(context, page, dialog, () => page.keyboard.press("Enter"), "Enter in query");
  assert.equal(popups.length, popupsBefore + 1, "composing Enter opened nothing");
  assert.equal(ddgNavigations.length, navBefore + 1, "composing Enter navigated nothing");

  assert.equal(params(page).get("editions"), editionsBefore, "external tab leaves the edition selection");
  await visible(dialog);
  await closeWith(page, s, "button", "after external");
  assert.deepEqual(await storageKeys(page, context), before, "no new storage keys");
  assert.ok(!(await storageText(page)).includes(MARKER), "typed query not stored in the browser");
  passed.push("editable-query-encodes-amp-hash-plus-korean", "blank-query-no-link-and-reset", "external-only-on-explicit-click-or-enter",
    "ime-composing-enter-does-not-open", "new-tab-noopener-noreferrer-no-referrer", "source-tab-address-and-selection-kept");
}

async function currentFestivals({ page }) {
  // 검증용 current identities: dated → only its confirmed start year; undated → no year; both use the full region name.
  await page.goto(`${base}${path(CURRENT_DATED, "visits")}`);
  await visible(page.getByText(/현재 등록 정보 · 등록 일정/));
  let s = await openSearch(page, FESTIVAL);
  await radios(yearGroup(s.dialog), ["연도 전체", "2026년"], "current dated years");
  const dated = await readDialog(s.dialog, FESTIVAL_TOPICS, [2026]);
  assert.equal(dated.year, "연도 전체", "current: no applied edition, all years by default");
  checkQuery(dated.query, { subject: FESTIVAL, region: NONSAN, topics: FESTIVAL_TOPICS }, "current dated");
  await pick(page, yearGroup(s.dialog), "2026년");
  checkQuery(await query(s.dialog), { subject: FESTIVAL, region: NONSAN, topics: FESTIVAL_TOPICS, year: 2026 }, "current 2026");
  await closeWith(page, s, "Escape", "current dated");
  await page.goto(`${base}${path(CURRENT_UNDATED, "visits")}`);
  await visible(page.getByText(/현재 등록 정보 · 등록 일정 미확인/));
  s = await openSearch(page, FESTIVAL);
  assert.equal(await s.dialog.getByRole("radio", { name: /^\d{4}년$/ }).count(), 0, "undated current: no year choice");
  checkQuery(await query(s.dialog), { subject: FESTIVAL, region: NONSAN, topics: FESTIVAL_TOPICS }, "current undated");
  await closeWith(page, s, "button", "current undated");
  passed.push("current-festival-confirmed-start-year-only");
}

// ---- Scenarios · new festival ----
async function newRegionAndResources({ page, context }) {
  await page.goto(`${base}/new/${NONSAN.code}/resources`);
  await visible(page.getByRole("heading", { level: 1, name: NONSAN.name, exact: true }));
  let s = await openSearch(page, NONSAN.name, { keyboard: true });
  let done = quiet("region dialog");
  await radios(topicGroup(s.dialog), ["전체", ...REGION_TOPICS], "region topics");
  assert.equal(await yearGroup(s.dialog).count(), 0, "region: no year field");
  assert.equal(await s.dialog.getByRole("radio", { name: /년$/ }).count(), 0, "region: no year radio");
  const regionFacts = { subject: NONSAN.name, region: NONSAN, topics: REGION_TOPICS };
  checkQuery(await query(s.dialog), regionFacts, "region default");
  await linkQuery(s.dialog, "region default");
  await pick(page, topicGroup(s.dialog), "관광사업");
  checkQuery(await query(s.dialog), { ...regionFacts, topic: "관광사업" }, "region 관광사업");
  await pick(page, topicGroup(s.dialog), "축제 사례");
  checkQuery(await query(s.dialog), { ...regionFacts, topic: "축제 사례" }, "region 축제 사례");
  await queryBox(s.dialog).fill(`${MARKER} 지역 입력`);
  done();
  await closeWith(page, s, "Escape", "region");

  // Resource detail: its own search named by the resource title.
  await rowButton(page, RA).click();
  await visible(detail(page, RA));
  await openerReady(page, NONSAN.name);
  s = await openSearch(page, RA.title);
  done = quiet("resource dialog");
  await radios(topicGroup(s.dialog), ["전체", ...RESOURCE_TOPICS], "resource topics");
  assert.equal(await yearGroup(s.dialog).count(), 0, "resource: no year field");
  const resourceFacts = r => ({ subject: r.title, region: NONSAN, topics: RESOURCE_TOPICS, forbid: [r.address, r.id, RA.title === r.title ? RC.title : RA.title] });
  checkQuery(await query(s.dialog), resourceFacts(RA), "resource default");
  await pick(page, topicGroup(s.dialog), "행사");
  checkQuery(await query(s.dialog), { ...resourceFacts(RA), topic: "행사" }, "resource 행사");
  await pick(page, topicGroup(s.dialog), "축제");
  checkQuery(await query(s.dialog), { ...resourceFacts(RA), topic: "축제" }, "resource 축제");
  done();
  const pressed = await rowButton(page, RA).getAttribute("aria-pressed");
  await openExternal(context, page, s.dialog, () => searchLink(s.dialog).click(), "resource link click");
  await visible(detail(page, RA));
  assert.equal(await rowButton(page, RA).getAttribute("aria-pressed"), pressed, "external tab leaves the resource selection");
  await queryBox(s.dialog).fill(`${MARKER} 자원 입력`);
  await closeWith(page, s, "button", "resource");

  // Another resource discards the previous search.
  await rowButton(page, RC).click();
  await visible(detail(page, RC));
  assert.equal(await opener(page, RA.title).count(), 0, "previous resource search is gone");
  s = await openSearch(page, RC.title);
  const other = await readDialog(s.dialog, RESOURCE_TOPICS, []);
  assert.equal(other.topic, "전체");
  checkQuery(other.query, resourceFacts(RC), "other resource");
  await closeWith(page, s, "Escape", "other resource");

  // Region change discards the previous region's search and detail.
  await page.getByRole("button", { name: "지역 바꾸기", exact: true }).click();
  const picker = page.locator("#new-region-change");
  await picker.getByRole("combobox", { name: /^시도/ }).selectOption({ label: "충청남도" });
  await picker.getByRole("combobox", { name: /^시군구/ }).selectOption({ label: GONGJU.districtName });
  await picker.getByRole("button", { name: "이 지역 보기", exact: true }).click();
  await page.waitForURL(u => u.pathname === `/new/${GONGJU.code}/resources`);
  await visible(page.getByRole("heading", { level: 1, name: GONGJU.name, exact: true }));
  assert.equal(await opener(page, NONSAN.name).count(), 0, "previous region search is gone");
  assert.equal(await opener(page, RC.title).count(), 0, "previous resource search is gone");
  s = await openSearch(page, GONGJU.name);
  const gongju = await readDialog(s.dialog, REGION_TOPICS, []);
  assert.equal(gongju.topic, "전체");
  checkQuery(gongju.query, { subject: GONGJU.name, region: GONGJU, topics: REGION_TOPICS, forbid: ["논산"] }, "Gongju");
  await closeWith(page, s, "Escape", "Gongju");

  // Ambiguous district: always the full region name, once.
  await page.goto(`${base}/new/${SEOUL_JUNGGU.code}/resources`);
  await visible(page.getByRole("heading", { level: 1, name: SEOUL_JUNGGU.name, exact: true }));
  s = await openSearch(page, SEOUL_JUNGGU.name);
  checkQuery(await query(s.dialog), { subject: SEOUL_JUNGGU.name, region: SEOUL_JUNGGU, topics: REGION_TOPICS }, "서울 중구");
  await closeWith(page, s, "Escape", "서울 중구");
  passed.push("new-region-no-year-region-topics", "resource-detail-named-search-resource-topics", "resource-change-discards-search",
    "region-change-discards-search", "ambiguous-region-full-name");
}

// ---- Keyboard and layout at 320 / 390 / desktop ----
async function keyboardInDialog(page, dialog, label) {
  const handles = { dialog: await dialog.elementHandle(), query: await queryBox(dialog).elementHandle(), link: await searchLink(dialog).elementHandle(),
    close: await closeButton(dialog).elementHandle(), topics: await topicGroup(dialog).elementHandle() };
  const seen = new Set();
  for (let i = 0; i < 24 && seen.size < 4; i++) {
    await page.keyboard.press("Tab");
    const at = await page.evaluate(h => {
      const a = document.activeElement;
      return { outside: !!a && a !== document.body && !h.dialog.contains(a), query: a === h.query, link: a === h.link, close: a === h.close,
        topic: h.topics.contains(a) && a instanceof HTMLInputElement && a.type === "radio" };
    }, handles);
    assert.equal(at.outside, false, `${label}: focus stays in the modal dialog`);
    for (const k of ["query", "link", "close", "topic"]) if (at[k]) seen.add(k);
  }
  assert.deepEqual([...seen].sort(), ["close", "link", "query", "topic"], `${label}: every control reachable by Tab`);
  // Arrow keys move within the native radio group and rebuild the query.
  await topicGroup(dialog).getByRole("radio", { name: "전체", exact: true }).focus();
  await page.keyboard.press("ArrowDown");
  await flush(page);
  assert.notEqual(await checked(topicGroup(dialog), ["전체", ...FESTIVAL_TOPICS]), "전체", `${label}: arrow changes topic`);
}

async function layouts({ page }) {
  for (const [width, height] of [[320, 740], [390, 844], [1440, 1000]]) {
    await page.setViewportSize({ width, height });
    await page.goto(`${base}${path(NONSAN_ID, "visits")}?editions=${ED(2025)}`);
    await visible(opener(page, FESTIVAL));
    await noPageOverflow(page, `${width} festival page`);
    const box = await opener(page, FESTIVAL).boundingBox();
    assert.ok(box && box.x >= 0 && box.x + box.width <= width, `${width}: opener inside the viewport`);
    let s = await openSearch(page, FESTIVAL);
    await dialogFits(s.dialog, `${width} festival dialog`);
    await noPageOverflow(page, `${width} festival dialog open`);
    if (width === 1440) await keyboardInDialog(page, s.dialog, "desktop");
    else if (width === 390) await keyboardInDialog(page, s.dialog, "390");
    await queryBox(s.dialog).fill(`${"관련자료긴검색어".repeat(12)} ${MARKER}`);
    await dialogFits(s.dialog, `${width} long query`);
    await page.screenshot({ path: new URL(`related-search-festival-${width}.png`, outDir).pathname, fullPage: false });
    await queryBox(s.dialog).fill("");
    await visible(s.dialog.getByText(EMPTY_TEXT, { exact: true }));
    await dialogFits(s.dialog, `${width} empty query`);
    await closeWith(page, s, "Escape", `${width} festival`);

    await page.goto(`${base}/new/${NONSAN.code}/resources`);
    await rowButton(page, RA).click();
    await visible(detail(page, RA));
    await noPageOverflow(page, `${width} resources page`);
    s = await openSearch(page, RA.title);
    await dialogFits(s.dialog, `${width} resource dialog`);
    await noPageOverflow(page, `${width} resource dialog open`);
    await page.screenshot({ path: new URL(`related-search-resource-${width}.png`, outDir).pathname, fullPage: false });
    await closeWith(page, s, "Escape", `${width} resource`);
  }
  passed.push("320-390-desktop-no-page-or-dialog-overflow", "keyboard-tab-cycle-and-arrow-topics");
}

// ---- Run ----
const main = await openContext();
try {
  await verifiedOnly(main);
  await notFound(main);
  await existingDialog(main);
  await editionAddress(main);
  await otherViews(main);
  await editableAndExternal(main);
  await currentFestivals(main);
  await newRegionAndResources(main);
  await layouts(main);

  // Nothing typed ever left the dialog except toward DuckDuckGo after an explicit action; nothing was written.
  const leaks = outbound.filter(o => [MARKER, encodeURIComponent(MARKER)].some(m => o.url.includes(m) || o.body.includes(m)));
  assert.deepEqual(leaks.map(o => o.url), [], "typed query never sent to the app, analytics or any non-DuckDuckGo host");
  assert.deepEqual(mainFrameUrls.filter(u => u.includes(MARKER) || u.includes(encodeURIComponent(MARKER))), [], "typed query never in the app address");
  assert.equal(ddgNavigations.length, externalEvidence.length, "every DuckDuckGo navigation came from an explicit user action");
  assert.ok(ddgRequests.every(r => r.navigation), `no background DuckDuckGo request: ${JSON.stringify(ddgRequests.filter(r => !r.navigation))}`);
  assert.deepEqual(writes, [], "no same-origin non-GET request");
  assert.deepEqual(errors, []);
  assert.deepEqual(fixtureErrors, []);
  assert.equal(queue.length, 0, `unused overrides: ${queue.length}`);
  passed.push("no-writes-no-leak-of-typed-query");

  const summary = { headless: true, scenario: "TS-FC-011", realArchive: ["archive festival lookup", "history", "monthly", "schedule", "new/visits"],
    fixtures: "검증용 current identities, resources, resource introductions, map tiles, 가로챈 DuckDuckGo 도착지",
    providerResultsVerified: false, passed, external: externalEvidence, browserErrors: errors.length, clientWrites: writes.length, apiRequests: calls.length };
  writeFileSync(new URL("related-search-e2e.json", outDir), `${JSON.stringify(summary, null, 2)}\n`);
  console.log(JSON.stringify({ ...summary, external: externalEvidence.length }));
} finally {
  await browser.close();
}
