// pickDday single-edition visitor profile acceptance, headless: the 임실N치즈축제 2025 sex/age shares and destination
// search ranking inside 과거 방문 흐름 when 2025 alone is selected, the 2024 single profile when 2024 alone is selected,
// and the reviewed links into the current tourism resources view. Two-edition comparison: edition-profile-e2e.mjs.
//
// Data provenance is explicit per check:
//  - REAL LOCAL DATA: /api/existing/history passes through the local server untouched. Expected values are read here
//    directly from the imported official snapshots (docs/research/imported/datalab-imsil-2025 and -2024), never through app code.
//  - RESOURCES: by default, the live server list passes through untouched. Local full regression explicitly sets
//    VISITOR_PROFILE_RESOURCES=fixture: a controlled list of the three reviewed source identities, never live coverage.
//  - 검증용 통제 응답 (marked where used): request gates only hold a real answer; one resource request is aborted on
//    purpose (failure → retry), and one real resource answer has the linked place removed (absent place). No synthetic
//    visitor values are served or shown.
//  - Requests to other hosts are blocked (map tiles use the labelled test tiles) and only counted.
import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";
import { mockMapTiles } from "./map-test-tiles.mjs";

const base = process.env.E2E_BASE_URL ?? process.env.BASE_URL;
if (!base) throw new Error("E2E_BASE_URL (or BASE_URL) required");
const origin = new URL(base).origin;
const controlledResources = process.env.VISITOR_PROFILE_RESOURCES === "fixture";
if (controlledResources) assert.ok(["localhost", "127.0.0.1"].includes(new URL(base).hostname), "resource fixtures are local-only");
const outDir = new URL("../output/playwright/", import.meta.url);
mkdirSync(outDir, { recursive: true });

// ---- Independent oracle: the imported official snapshots ----
const SNAPSHOT = new URL("../../../docs/research/imported/datalab-imsil-2025/", import.meta.url);
const snapshot = name => JSON.parse(readFileSync(new URL(name, SNAPSHOT), "utf8"));
const manifest = snapshot("manifest.json"), demoRows = snapshot("original/demographics.json").list;
const destRows = snapshot("original/destinations.json").list, links = snapshot("resource-links.json");
assert.deepEqual([manifest.observation.year, manifest.observation.start, manifest.observation.end, manifest.observation.days, manifest.observation.regionCode],
  [2025, "2025-10-08", "2025-10-12", 5, "52750"], "oracle: 2025 festival period and region");
assert.equal(manifest.residenceVisible, false, "oracle: residence was not published for this festival");
assert.equal(demoRows.length, 8, "oracle: eight age bands");
assert.ok(demoRows.every(r => r.FSTV_ID === "KCTF0061" && r.DISP_YN === "N"), "oracle: one festival; N = public percentage display");
const DEMOGRAPHICS = [...demoRows].sort((a, b) => a.SORT_STR - b.SORT_STR).map(r => ({ ageBand: r.AGEG_DIV_NM, malePercent: r.M_TOU_NUM_RAT, femalePercent: r.W_TOU_NUM_RAT }));
assert.deepEqual(DEMOGRAPHICS.map(d => d.ageBand), ["0~9세", "10~19세", "20~29세", "30~39세", "40~49세", "50~59세", "60~69세", "70세 이상"], "oracle: chronological bands");
assert.equal(Math.round(DEMOGRAPHICS.reduce((s, d) => s + d.malePercent + d.femalePercent, 0) * 10) / 10, 100, "oracle: sixteen shares sum to 100.0");
const COUNT_PARTS = demoRows.flatMap(r => [r.M_TOT, r.W_TOT]).map(v => String(Math.trunc(v)));
const GROUP_LABEL = { outside: "외지인", local: "현지인", all: "전체" };
const LINKED = new Map(links.links.map(l => [l.destinationId, { id: l.resource.id, kind: l.resource.kind, title: l.resource.title }]));
assert.deepEqual([...LINKED.values()].map(r => r.id).sort(), ["2718832", "317571", "527279"], "oracle: three reviewed resource links");
const RANKS = Object.fromEntries(Object.entries(GROUP_LABEL).map(([group, label]) => [group, destRows.filter(r => r.DIV_NM === label).sort((a, b) => a.ROWNUM - b.ROWNUM)
  .map(r => ({ rank: r.ROWNUM, name: r.ITS_BRO_NM, address: r.ADDR_ROAD_NM, category: r.KTO_CATE_SCLS_NM, resource: LINKED.get(r.ITS_BRO_ID) ?? null }))]));
for (const group of Object.keys(GROUP_LABEL)) assert.equal(RANKS[group].length, 7, `oracle: ${group} has seven rows`);
const SEARCH_COUNTS = destRows.map(r => r.SRCH_CNT).filter(v => v >= 100).map(String);
const TITLE = { themepark: "임실치즈테마파크", sangiam: "상이암(임실)", sochungsa: "소충사" }, ID = { themepark: "2718832", sangiam: "317571", sochungsa: "527279" };
const point = id => links.links.find(l => l.resource.id === id).resource.point;
// Local regression has no provider key. Use only the three reviewed real place identities as a controlled list,
// explicitly distinct from the complete current provider list verified against production later.
function resourceFixture(p) {
  if (p.get("province") !== "52" || p.get("district") !== "750") return null;
  const types = (p.get("types") ?? "12,14").split(",");
  const request = { province: "52", district: "750", types };
  return { key: JSON.stringify(["resources", "52", "750", types]), request, retrievedAt: links.checkedAt,
    region: { province: "52", district: "750", code: "52750", name: "전북특별자치도 임실군", districtName: "임실군" },
    byType: types.map(kind => ({ kind, label: kind === "12" ? "관광지" : "문화시설", error: null, collectedAt: links.checkedAt,
      status: kind === "12" ? "complete" : "empty", total: kind === "12" ? links.links.length : 0,
      items: kind === "12" ? links.links.map(l => l.resource) : [] })) };
}
/** Local regression only: the shared introduction of a controlled place is answered as "no introduction" (block omitted). */
function introFixture(p) {
  if (p.get("province") !== "52" || p.get("district") !== "750") return null;
  const request = { province: "52", district: "750", kind: p.get("kind"), id: p.get("id") };
  return { key: JSON.stringify(["new-resource-detail", "52", "750", request.kind, request.id]), request, retrievedAt: links.checkedAt,
    region: { province: "52", district: "750", code: "52750", name: "전북특별자치도 임실군", districtName: "임실군" }, status: "empty", error: null, detail: null, source: null };
}
function km(a, b) {
  const rad = d => d * Math.PI / 180, dLat = rad(b.latitude - a.latitude), dLon = rad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}
assert.ok(km(point(ID.sangiam), point(ID.themepark)) > 5, "oracle: 상이암 and the theme park are more than 5km apart");
const pct = v => `${v.toFixed(1)}%`;
const DEMO_LABEL = `성·연령별 비율, 내국인 방문자 전체 중. ${DEMOGRAPHICS.map(d => `${d.ageBand} 남성 ${pct(d.malePercent)}, 여성 ${pct(d.femalePercent)}`).join("; ")}`;

// 2024 alone now gets its own single profile; its oracle is read from its own imported snapshot.
const SNAPSHOT_2024 = new URL("../../../docs/research/imported/datalab-imsil-2024/", import.meta.url);
const snapshot2024 = name => JSON.parse(readFileSync(new URL(name, SNAPSHOT_2024), "utf8"));
const manifest2024 = snapshot2024("manifest.json"), demoRows2024 = snapshot2024("original/demographics.json").list;
const destRows2024 = snapshot2024("original/destinations.json").list, links2024 = snapshot2024("resource-links.json");
assert.deepEqual([manifest2024.observation.year, manifest2024.observation.start, manifest2024.observation.end, manifest2024.observation.days, manifest2024.observation.regionCode, manifest2024.observation.areaName],
  [2024, "2024-10-03", "2024-10-06", 4, "52750", manifest.observation.areaName], "oracle: 2024 festival period, same area");
assert.ok(demoRows2024.length === 8 && demoRows2024.every(r => r.FSTV_ID === "KCTF0061" && r.DISP_YN === "N"), "oracle: 2024 eight public bands");
const DEMOGRAPHICS_2024 = [...demoRows2024].sort((a, b) => a.SORT_STR - b.SORT_STR).map(r => ({ ageBand: r.AGEG_DIV_NM, malePercent: r.M_TOU_NUM_RAT, femalePercent: r.W_TOU_NUM_RAT }));
const LINKED_2024 = new Map(links2024.links.map(l => [l.destinationId, { id: l.resource.id, kind: l.resource.kind, title: l.resource.title }]));
const RANKS_2024 = Object.fromEntries(Object.entries(GROUP_LABEL).map(([group, label]) => [group, destRows2024.filter(r => r.DIV_NM === label).sort((a, b) => a.ROWNUM - b.ROWNUM)
  .map(r => ({ rank: r.ROWNUM, name: r.ITS_BRO_NM, address: r.ADDR_ROAD_NM, category: r.KTO_CATE_SCLS_NM, resource: LINKED_2024.get(r.ITS_BRO_ID) ?? null }))]));
const EXPECT = {
  2025: { manifest, demographics: DEMOGRAPHICS, ranks: RANKS, counts: [...SEARCH_COUNTS, ...COUNT_PARTS] },
  2024: { manifest: manifest2024, demographics: DEMOGRAPHICS_2024, ranks: RANKS_2024,
    counts: [...destRows2024.map(r => r.SRCH_CNT).filter(v => v >= 100), ...demoRows2024.flatMap(r => [r.M_TOT, r.W_TOT]).map(v => Math.trunc(v))].map(String) },
};

const PROFILE_KEYS = ["areaName", "demographics", "destinationGroups", "editionId", "end", "source", "start", "year"];
const INTERNAL = ["sha256", "evidence", "docs/research", "/original/", "manifest", "SRCH_CNT", "M_TOT", "W_TOT", "DISP_YN", "\"raw\"", "count", "checkedAt"];
const UNWANTED_TEXT = /방문자 수|함께 방문|\d명|검증|sha256|evidence/;

// ---- API routing: pass-through by default, one-shot controlled answers and request gates ----
const queue = [], passed = [], errors = [], consoleErrors = [], writes = [], platformWrites = [], blocked = [], fixtureErrors = [];
let controlledFailures = 0, controlledAnswers = 0;
function within(promise, label, ms = 30_000) {
  let timer;
  return Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`timed out: ${label}`)), ms); })]).finally(() => clearTimeout(timer));
}
const ABORT = () => ({ kind: "abort" });
/** Hold the next matching request; `release(ABORT)` fails it on purpose, `release()` lets the real answer through. */
function gate(match, label) {
  let arrived, release, done;
  const hasArrived = new Promise(r => { arrived = r; }), released = new Promise(r => { release = r; }), finished = new Promise(r => { done = r; });
  queue.push({ match, gate: { arrived, released }, done });
  return { arrived: within(hasArrived, label), release: async respond => { release(respond ?? null); await within(finished, `${label} finished`); } };
}
const once = (match, respond) => queue.push({ match, respond });
async function onApi(route) {
  const url = new URL(route.request().url()), endpoint = url.pathname.slice("/api/".length), p = url.searchParams;
  const index = queue.findIndex(q => q.match(endpoint, p)), entry = index < 0 ? null : queue.splice(index, 1)[0];
  let respond = entry?.respond ?? null;
  if (entry?.gate) { entry.gate.arrived(); respond = (await entry.gate.released) ?? respond; }
  let plan = { kind: "continue" };
  if (respond) try { plan = await respond(route, p); } catch (e) { fixtureErrors.push(`${endpoint}: ${e.message}`); plan = { kind: "abort" }; }
  try {
    if (plan.kind === "abort") { controlledFailures += 1; await route.abort("failed"); }
    else if (plan.kind === "fulfill") { controlledAnswers += 1; await route.fulfill(plan.options); }
    else if (controlledResources && endpoint === "existing/resources" && resourceFixture(p)) await route.fulfill({ json: resourceFixture(p) });
    else if (controlledResources && endpoint === "resources/detail" && introFixture(p)) await route.fulfill({ json: introFixture(p) });
    else await route.continue();
  } catch { /* the page superseded or left this request */ }
  entry?.done?.();
}
const is = (endpoint, test = () => true) => (e, p) => e === endpoint && test(p);
const typesOnly = kind => p => p.get("types") === kind;
/** 검증용 통제 응답: the real answer with one linked place removed, to show the "not in the current list" path. */
const withoutResource = id => async route => {
  const response = controlledResources ? null : await route.fetch();
  const body = response ? await response.json() : resourceFixture(new URL(route.request().url()).searchParams);
  if (response) assert.ok(response.ok(), "absent-place control needs a real list answer");
  const block = body.byType.find(b => b.kind === "12");
  assert.ok(block?.items.some(i => i.id === id), "absent-place control: the real list held the place before removal");
  block.items = block.items.filter(i => i.id !== id);
  if (typeof block.total === "number") block.total -= 1;
  return { kind: "fulfill", options: { ...(response ? { response } : {}), json: body } };
};

const browser = await chromium.launch({ headless: true });
async function openContext(viewport = { width: 1440, height: 1000 }) {
  const context = await browser.newContext({ viewport, locale: "ko-KR" });
  await context.route(u => u.origin !== origin, route => { blocked.push(new URL(route.request().url()).host); return route.abort("blockedbyclient"); });
  await mockMapTiles(context); // registered later, so it answers tile requests before the block above
  await context.route(u => u.origin === origin && u.pathname.startsWith("/api/"), onApi);
  const page = await context.newPage();
  // On the public origin, dismiss the existing analytics consent dialog through its ordinary refusal button.
  // No consent state is injected and the widget is not hidden or removed.
  await page.addLocatorHandler(page.getByRole("button", { name: "모두 거부", exact: true }), async button => button.click());
  page.setDefaultTimeout(30_000);
  page.on("pageerror", e => errors.push(e.message));
  page.on("console", m => { if (m.type() === "error" && !/^Failed to load resource/.test(m.text())) consoleErrors.push(m.text()); });
  page.on("request", r => {
    const u = new URL(r.url());
    if (r.method() !== "GET" && u.origin === origin) (u.pathname.startsWith("/cdn-cgi/zaraz/") ? platformWrites : writes).push(`${r.method()} ${u.pathname}`);
  });
  return { context, page };
}
const served = (page, endpoint, test = () => true) => page.waitForResponse(r => {
  const u = new URL(r.url());
  return u.origin === origin && u.pathname === `/api/${endpoint}` && test(u.searchParams);
}).then(async r => { assert.equal(r.status(), 200, `${endpoint} status`); return r.json(); });
const visible = l => l.waitFor({ state: "visible" });
const flush = page => page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
const waitFocusId = (page, id) => page.waitForFunction(i => document.activeElement?.id === i, id);
const waitNoParam = (page, key) => page.waitForFunction(k => !new URL(location.href).searchParams.has(k), key);
const param = (page, key) => new URL(page.url()).searchParams.get(key);
const rowCells = async (table, header) => {
  const rowHeader = table.getByRole("rowheader", { name: header, exact: true });
  await visible(rowHeader);
  return (await rowHeader.locator("..").locator("th,td").allInnerTexts()).map(s => s.trim());
};
async function noPageOverflow(page, label) {
  const [scroll, inner] = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
  assert.ok(scroll <= inner, `${label}: page scrollWidth ${scroll} > ${inner}`);
}
async function keyboardDialog(page, opener, title, text, whileOpen = async () => {}) {
  await opener.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: title, exact: true });
  await visible(dialog);
  await visible(dialog.getByText(text));
  await whileOpen(dialog);
  await page.keyboard.press("Escape");
  await dialog.waitFor({ state: "hidden" });
  await page.waitForFunction(el => el === document.activeElement, await opener.elementHandle());
}

// ---- Page model ----
const IMSIL = "archive:imsil-cheese", NONSAN = "archive:nonsan-strawberry", ed = y => `imsil-cheese-${y}`;
// Single-profile regression: 2025 alone by default (two selected editions show the comparison instead).
const visitsUrl = (years = [2025], id = IMSIL) => `${base}/existing/${encodeURIComponent(id)}/visits${years ? `?editions=${years.map(ed).join(",")}` : ""}`;
const resourcesUrl = (query, id = IMSIL) => `${base}/existing/${encodeURIComponent(id)}/resources${query}`;
const profile = (page, year = 2025) => page.getByRole("region", { name: `${year}년 방문자 특성`, exact: true });
const anyComparison = page => page.getByRole("region", { name: /^방문자 특성 · \d{4}년과 \d{4}년$/ });
const demoRegion = page => profile(page).getByRole("region", { name: "성·연령별 비율", exact: true });
const rankRegion = page => profile(page).getByRole("region", { name: "축제 기간 목적지 검색순위", exact: true });
const groupButton = (page, label) => rankRegion(page).getByRole("group", { name: "검색한 사람 구분", exact: true }).getByRole("button", { name: label, exact: true });
const rankList = (page, label) => rankRegion(page).getByRole("list", { name: `${label} 목적지 검색순위`, exact: true });
const rankLink = (page, title) => rankRegion(page).getByRole("link", { name: `${title} 관광자원에서 보기`, exact: true });
const host = page => page.getByRole("region", { name: "축제가 열린 읍·면·동의 방문 구성", exact: true });
const picker = (page, year) => page.getByRole("checkbox", { name: new RegExp(`^${year}년 · `) });
const editionsAre = years => p => (p.get("editions") ?? "").split(",").sort().join() === years.map(ed).sort().join();
const detail = page => page.locator("#resource-detail-heading");
const resourceButton = (page, id) => page.getByRole("list", { name: "관광자원 목록", exact: true }).locator(`[data-resource-id="${id}"]`);
const menu = (page, label) => page.getByRole("navigation", { name: "축제 탐색 메뉴" }).getByRole("link", { name: label, exact: true });
const PENDING = "고른 장소를 목록에서 찾고 있어요…", RETRY_HINT = "목록을 다시 불러오면 고른 장소를 열어 드려요.";
const MISSING = "고른 장소를 지금 등록된 관광정보 목록에서 찾지 못했어요. 아래 목록에서 살펴봐 주세요.";
async function pick(page, years) {
  for (const y of [2023, 2024, 2025]) if (!years.includes(y) && await picker(page, y).isChecked()) await picker(page, y).click();
  for (const y of years) if (!await picker(page, y).isChecked()) await picker(page, y).click();
  await page.getByRole("button", { name: "적용", exact: true }).first().click();
}
async function noTargetMessages(page) {
  for (const text of [PENDING, RETRY_HINT, MISSING]) assert.equal(await page.getByText(text, { exact: true }).count(), 0, `no "${text}"`);
}

function checkProfile(body, year = 2025) {
  const selection = body.visitorProfile, want = EXPECT[year];
  assert.ok(selection, "visitorProfile present");
  assert.deepEqual(Object.keys(selection), ["editions"], "selection wrapper only");
  assert.equal(selection.editions.length, 1, "one selected edition: one single profile");
  const vp = selection.editions[0];
  assert.deepEqual(Object.keys(vp).sort(), PROFILE_KEYS, "visitorProfile: only the public fields");
  assert.deepEqual([vp.editionId, vp.year, vp.start, vp.end, vp.areaName], [ed(year), year, want.manifest.observation.start, want.manifest.observation.end, want.manifest.observation.areaName]);
  assert.deepEqual(vp.demographics, want.demographics, "official shares, source order, no counts");
  for (const row of vp.demographics) assert.deepEqual(Object.keys(row).sort(), ["ageBand", "femalePercent", "malePercent"]);
  assert.deepEqual(vp.destinationGroups.map(g => g.group).sort(), ["all", "local", "outside"], "three rank groups, no residence block");
  for (const g of vp.destinationGroups) {
    assert.deepEqual(Object.keys(g).sort(), ["group", "items", "label"]);
    assert.equal(g.label, GROUP_LABEL[g.group]);
    assert.equal(new Set(g.items.map(i => i.id)).size, g.items.length, `${g.group}: distinct destinations, same-address places never merged`);
    for (const i of g.items) {
      assert.deepEqual(Object.keys(i).sort(), ["address", "category", "id", "name", "rank", "resource"]);
      if (i.resource) assert.deepEqual(Object.keys(i.resource).sort(), ["id", "kind", "title"]);
    }
    assert.deepEqual(g.items.map(({ rank, name, address, category, resource }) => ({ rank, name, address, category, resource })), want.ranks[g.group], `${g.group}: source rows and reviewed links only`);
  }
  assert.deepEqual(Object.keys(vp.source).sort(), ["collectedAt", "title", "url"]);
  assert.match(vp.source.url, /^https:\/\/datalab\.visitkorea\.or\.kr\//, "official public source page");
  const text = JSON.stringify(selection);
  for (const word of INTERNAL) assert.ok(!text.includes(word), `visitorProfile: no internal ${word}`);
  for (const n of want.counts) assert.doesNotMatch(text, new RegExp(`\\b${n}\\b`), `visitorProfile: no count ${n}`);
  return vp;
}
async function checkSectionText(page) {
  const text = await profile(page).innerText();
  assert.doesNotMatch(text, UNWANTED_TEXT, "no headcount, co-visit or internal wording");
  for (const n of [...SEARCH_COUNTS, ...COUNT_PARTS]) assert.ok(!text.includes(n), `no count ${n} on screen`);
  assert.doesNotMatch(await rankRegion(page).innerText(), /방문/, "ranking block never speaks of visits");
  assert.doesNotMatch(text, /거주지|사는 곳/, "no residence card");
}
/** The linked-resource success checks rely on the server's live tourism list (REAL CURRENT RESOURCES). */
function realList(body) {
  const block = body.byType?.find(b => b.kind === "12");
  if (block?.status !== "complete") throw new Error("The server's current 임실군 관광지 list is unavailable (tourism provider key or provider outage); linked-resource checks need the real list.");
  for (const [key, id] of Object.entries(ID)) assert.equal(block.items.find(i => i.id === id)?.title, TITLE[key], `real list holds ${TITLE[key]}`);
  return block;
}

// ---- 1. Profile content, gating, windows and late answers ----
async function profileContent({ page }) {
  let body = served(page, "existing/history");
  await page.goto(visitsUrl());
  const firstBody = await body, first = checkProfile(firstBody);
  assert.ok(firstBody.hostVisits, "existing host composition kept");
  await visible(profile(page));
  await visible(host(page));
  assert.equal(await anyComparison(page).count(), 0, "one selected edition: no comparison");
  assert.equal(await host(page).evaluate((el, next) => !!(el.compareDocumentPosition(next) & Node.DOCUMENT_POSITION_FOLLOWING), await profile(page).elementHandle()), true, "profile follows the host composition");
  await visible(profile(page).getByText("2025.10.8–10.12 · 임실군 성수면 · 내국인 · 통신 기반 추정", { exact: true }));

  // Sex/age: exact published shares, chronological bands, one shared scale for all sixteen bars.
  await visible(demoRegion(page).getByText("내국인 방문자 전체 중 비율(%)", { exact: true }));
  const chart = demoRegion(page).getByRole("img");
  assert.equal(await chart.getAttribute("aria-label"), DEMO_LABEL);
  const shown = await chart.innerText();
  const positions = DEMOGRAPHICS.map(d => shown.indexOf(d.ageBand));
  assert.ok(positions.every((p, i) => p >= 0 && (i === 0 || p > positions[i - 1])), "bands in chronological order");
  for (const d of DEMOGRAPHICS) for (const v of [d.malePercent, d.femalePercent]) assert.ok(shown.includes(pct(v)), `text value ${pct(v)}`);
  const ratios = await chart.evaluate(el => [...el.querySelectorAll("span.h-full")].map(b => b.getBoundingClientRect().width / b.parentElement.getBoundingClientRect().width));
  const values = DEMOGRAPHICS.flatMap(d => [d.malePercent, d.femalePercent]);
  assert.equal(ratios.length, 16, "two bars per band");
  const unit = ratios[values.indexOf(Math.max(...values))] / Math.max(...values);
  assert.ok(unit > 0 && Math.max(...ratios) <= 1.0001, "bars fit their track");
  ratios.forEach((r, i) => assert.ok(Math.abs(r - values[i] * unit) < 0.01, `bar ${i} on the shared scale`));
  await profile(page).getByRole("button", { name: "성·연령 비율 표 보기", exact: true }).click();
  const table = profile(page).getByRole("table", { name: "성·연령별 비율(%, 내국인 방문자 전체 중)" });
  for (const d of DEMOGRAPHICS) assert.deepEqual(await rowCells(table, d.ageBand), [d.ageBand, d.malePercent.toFixed(1), d.femalePercent.toFixed(1)]);
  passed.push("demographics-official-shares-chronological-shared-scale-table");

  // Ranking: 외지인 by default, seven rows per group, links only on the three reviewed places.
  assert.equal(await groupButton(page, "외지인").getAttribute("aria-pressed"), "true", "외지인 default");
  for (const [group, label] of [["outside", "외지인"], ["local", "현지인"], ["all", "전체"]]) {
    await groupButton(page, label).click();
    for (const other of Object.values(GROUP_LABEL)) assert.equal(await groupButton(page, other).getAttribute("aria-pressed"), String(other === label));
    const rows = rankList(page, label).getByRole("listitem");
    assert.equal(await rows.count(), 7, `${label}: seven rows`);
    for (const [i, want] of RANKS[group].entries()) {
      const row = rows.nth(i);
      await visible(row.getByText(`${want.rank}위`, { exact: true }));
      await visible(row.getByText(want.name, { exact: true }));
      await visible(row.getByText(`${want.category} · ${want.address}`, { exact: true }));
      const link = row.getByRole("link");
      assert.equal(await link.count(), want.resource ? 1 : 0, `${label} ${want.name}: link only when reviewed`);
      if (want.resource) {
        assert.equal(await link.getAttribute("aria-label"), `${want.resource.title} 관광자원에서 보기`);
        const href = new URL(await link.getAttribute("href"), base);
        assert.equal(href.pathname, `/existing/${encodeURIComponent(IMSIL)}/resources`);
        assert.equal(href.searchParams.get("resource"), `${want.resource.kind}:${want.resource.id}`);
        assert.equal(href.searchParams.get("types"), "12", "fresh tab: only the resource's own type is requested");
      }
    }
  }
  await groupButton(page, "외지인").click();
  passed.push("rank-groups-7-each-links-only-reviewed-three");

  await keyboardDialog(page, profile(page).getByRole("button", { name: "방문자 특성 출처 보기", exact: true }), "방문자 특성 출처", "음식점·숙박은 빠져 있어요.",
    async dialog => { assert.equal(await dialog.getByRole("link").getAttribute("href"), first.source.url, "official source page link"); });
  await checkSectionText(page);
  passed.push("source-dialog-keyboard-no-count-no-internal-no-residence");

  // A custom chart window changes nothing in the profile.
  const card = page.getByRole("listitem").filter({ has: page.getByRole("heading", { name: /^2025년 · 10\.8–10\.12/ }) });
  await card.getByRole("button", { name: "표시 기간 바꾸기", exact: true }).click();
  await card.getByLabel("표시 시작일").fill("2025-09-20");
  await card.getByLabel("표시 종료일").fill("2025-10-25");
  body = served(page, "existing/history", p => (p.get("windows") ?? "").includes(ed(2025)));
  await card.getByRole("button", { name: "적용", exact: true }).click();
  assert.deepEqual(checkProfile(await body), first, "window change leaves the profile unchanged");
  await visible(profile(page).getByText("2025.10.8–10.12 · 임실군 성수면 · 내국인 · 통신 기반 추정", { exact: true }));
  passed.push("chart-window-independent");

  // 2024 only: the 2024 single profile replaces 2025 (never shown while the answer is loading); host composition kept.
  const only2024 = gate(is("existing/history", editionsAre([2024])), "history 2024");
  await pick(page, [2024]);
  await only2024.arrived;
  assert.equal(await profile(page).count(), 0, "earlier profile hidden while the new selection loads");
  assert.equal(await profile(page, 2024).count(), 0, "no profile before its answer arrives");
  body = served(page, "existing/history", editionsAre([2024]));
  await only2024.release();
  const b2024 = await body;
  const p2024 = checkProfile(b2024, 2024);
  assert.deepEqual(b2024.hostVisits?.editions.map(e => e.editionId), [ed(2024)], "2024 host composition unchanged");
  await visible(host(page));
  await visible(profile(page, 2024));
  await visible(profile(page, 2024).getByText(`2024.10.3–10.6 · ${p2024.areaName} · 내국인 · 통신 기반 추정`, { exact: true }));
  assert.equal(await profile(page, 2024).getByRole("region", { name: "성·연령별 비율", exact: true }).getByRole("img").getAttribute("aria-label"),
    `성·연령별 비율, 내국인 방문자 전체 중. ${DEMOGRAPHICS_2024.map(d => `${d.ageBand} 남성 ${pct(d.malePercent)}, 여성 ${pct(d.femalePercent)}`).join("; ")}`, "2024 published shares");
  const list2024 = profile(page, 2024).getByRole("list", { name: "외지인 목적지 검색순위", exact: true }).getByRole("listitem");
  assert.equal(await list2024.count(), RANKS_2024.outside.length, "2024 외지인 rows");
  for (const [i, want] of RANKS_2024.outside.entries()) await visible(list2024.nth(i).getByText(want.name, { exact: true }));
  await flush(page);
  assert.equal(await profile(page).count(), 0, "2025 profile absent");
  assert.equal(await anyComparison(page).count(), 0, "no comparison for one edition");
  passed.push("2024-only-single-2024-profile-2025-absent");

  // Late earlier answer that includes 2025 arrives after the user moved back to 2024 only: ignored.
  const late = gate(is("existing/history", editionsAre([2023, 2025])), "history 2023+2025 late");
  await pick(page, [2023, 2025]);
  await late.arrived;
  await pick(page, [2024]);
  await page.waitForFunction(e => new URL(location.href).searchParams.get("editions") === e, ed(2024));
  await visible(host(page));
  await late.release();
  await flush(page);
  assert.equal(await profile(page).count(), 0, "late 2025 answer never shows the profile");
  assert.equal(await anyComparison(page).count(), 0, "late answer never shows a comparison");
  await visible(profile(page, 2024));
  await pick(page, [2025]);
  // This condition was already loaded at the start. Returning may use the valid client cache and issue no request.
  await visible(profile(page));
  assert.equal(await demoRegion(page).getByRole("img").getAttribute("aria-label"), DEMO_LABEL);
  passed.push("late-old-answer-ignored");

  body = served(page, "existing/history");
  await page.goto(visitsUrl(null, NONSAN));
  assert.equal((await body).visitorProfile, null, "other festival/region: null");
  await visible(page.getByRole("heading", { level: 2, name: "논산시 외지인 방문 추이", exact: true }));
  await flush(page);
  assert.equal(await profile(page).count(), 0);
  assert.equal(await page.getByRole("region", { name: /방문자 특성/ }).count(), 0, "no profile section at all");
  passed.push("other-festival-null");
}

// ---- 2. Links into current resources: selection, back/forward, remembered state, radius ----
async function destinationLinks({ page }) {
  await page.goto(visitsUrl());
  await visible(profile(page));
  let list = served(page, "existing/resources", typesOnly("12"));
  await rankLink(page, TITLE.themepark).click();
  realList(await list);
  await waitFocusId(page, "resource-detail-heading");
  assert.equal(await detail(page).innerText(), TITLE.themepark);
  await waitNoParam(page, "resource");
  assert.equal(param(page, "types"), "12");
  assert.equal(await resourceButton(page, ID.themepark).getAttribute("aria-pressed"), "true");
  await noTargetMessages(page);
  passed.push("link-selects-real-resource-focus-detail-param-removed");

  // Back returns to the visits view with its conditions and the followed link focused; forward has no one-shot target.
  await page.goBack();
  await visible(profile(page));
  assert.equal(param(page, "editions"), ed(2025));
  await page.waitForFunction(() => document.activeElement?.getAttribute("data-rank-link")?.startsWith("outside:"));
  await page.goForward();
  await visible(detail(page));
  assert.equal(new URL(page.url()).pathname, `/existing/${encodeURIComponent(IMSIL)}/resources`);
  assert.equal(param(page, "resource"), null, "forward never brings the target back");
  passed.push("back-preserves-conditions-focus-forward-no-target");

  // Remembered selection 상이암 + its center with a 1km radius; then an explicit link to the theme park wins.
  await resourceButton(page, ID.sangiam).click();
  await waitFocusId(page, "resource-detail-heading");
  await page.getByRole("button", { name: "이 자원을 기준점으로", exact: true }).click();
  await page.getByLabel("반경").selectOption("1");
  await resourceButton(page, ID.themepark).waitFor({ state: "detached" });
  await menu(page, "과거 방문 흐름").click();
  await visible(profile(page));
  assert.equal(param(page, "editions"), ed(2025), "menu restores the visit conditions");
  await groupButton(page, "현지인").click();
  list = served(page, "existing/resources", typesOnly("12")); // a fresh list answer, even with a remembered one
  await rankList(page, "현지인").getByRole("link", { name: `${TITLE.themepark} 관광자원에서 보기`, exact: true }).click();
  realList(await list);
  await waitFocusId(page, "resource-detail-heading");
  assert.equal(await detail(page).innerText(), TITLE.themepark, "explicit link beats the remembered selection");
  assert.equal(await resourceButton(page, ID.sangiam).getAttribute("aria-pressed"), "false");
  assert.equal(await page.getByLabel("반경").inputValue(), "", "inherited radius lifted to show the chosen place");
  assert.match(await page.locator("p", { has: page.locator("strong", { hasText: "기준점" }) }).innerText(), new RegExp(TITLE.sangiam.replace(/[()]/g, "\\$&")), "center kept, not invented");
  await visible(resourceButton(page, ID.themepark));
  await waitNoParam(page, "resource");
  passed.push("explicit-link-overrides-memory-lifts-radius-keeps-center");

  await page.goBack();
  await visible(profile(page));
  assert.equal(await groupButton(page, "현지인").getAttribute("aria-pressed"), "true", "chosen group kept");
  await page.waitForFunction(() => document.activeElement?.getAttribute("data-rank-link")?.startsWith("local:"));
  passed.push("back-keeps-group-and-focus");

  // The menu path still works and never reselects anything by itself.
  await menu(page, "주변 관광자원").click();
  await waitFocusId(page, "resources-heading");
  assert.equal(param(page, "resource"), null);
  await noTargetMessages(page);
  await menu(page, "개최 시기").click();
  await visible(page.getByRole("heading", { level: 2 }).first());
  passed.push("three-menus-unchanged");
}

// ---- 3. Pending target: failure and retry, user type change, absent place, malformed and other festival ----
async function pendingTargets({ page }) {
  // 검증용 통제 실패: the list request is aborted; the target waits and resolves after 다시 불러오기.
  await page.goto(visitsUrl());
  await visible(profile(page));
  const failing = gate(is("existing/resources", typesOnly("12")), "resources failure");
  await rankLink(page, TITLE.sochungsa).click();
  await failing.arrived;
  await failing.release(ABORT);
  await visible(page.getByText(RETRY_HINT, { exact: true }));
  await waitNoParam(page, "resource");
  assert.equal(await detail(page).count(), 0);
  let list = served(page, "existing/resources", typesOnly("12"));
  await page.getByRole("button", { name: "다시 불러오기", exact: true }).click();
  realList(await list);
  await waitFocusId(page, "resource-detail-heading");
  assert.equal(await detail(page).innerText(), TITLE.sochungsa);
  await noTargetMessages(page);
  passed.push("controlled-failure-keeps-target-retry-selects");

  // A type change while the target waits cancels it: the late answer never selects afterwards.
  await page.goto(visitsUrl());
  await visible(profile(page));
  const held = gate(is("existing/resources", typesOnly("12")), "resources held");
  await rankLink(page, TITLE.sangiam).click();
  await held.arrived;
  await visible(page.getByText(PENDING, { exact: true }));
  await page.getByRole("button", { name: "문화시설", exact: true }).click();
  await page.getByText(PENDING, { exact: true }).waitFor({ state: "detached" });
  await held.release();
  await visible(resourceButton(page, ID.sangiam));
  await flush(page);
  assert.equal(await detail(page).count(), 0, "user type change is not overridden");
  assert.equal(param(page, "types"), null, "both types as the user chose");
  assert.equal(param(page, "resource"), null);
  passed.push("user-type-change-cancels-pending-target");

  // 검증용 통제 응답: a complete real answer without the linked place → one short message, list kept.
  await page.goto(visitsUrl());
  await visible(profile(page));
  once(is("existing/resources", typesOnly("12")), withoutResource(ID.themepark));
  await rankLink(page, TITLE.themepark).click();
  await visible(page.getByText(MISSING, { exact: true }));
  await visible(resourceButton(page, ID.sangiam));
  assert.equal(await resourceButton(page, ID.themepark).count(), 0);
  assert.equal(await detail(page).count(), 0);
  await waitNoParam(page, "resource");
  await page.reload();
  await visible(resourceButton(page, ID.themepark));
  await flush(page);
  assert.equal(await detail(page).count(), 0, "reload never reselects");
  await noTargetMessages(page);
  passed.push("absent-place-message-list-kept-reload-clean");

  // Malformed or repeated targets are ignored: no selection, no message, address cleaned, same page.
  for (const query of ["?types=12&resource=12:abc", `?types=12&resource=12:${ID.themepark}&resource=12:${ID.themepark}`, `?types=12&resource=15:${ID.themepark}`,
    "?types=12&resource=12%3A1%2F..%2Fx", "?types=12&resource=https%3A%2F%2Fexample.com%2F"]) {
    list = served(page, "existing/resources", typesOnly("12"));
    await page.goto(resourcesUrl(query));
    realList(await list);
    await waitNoParam(page, "resource");
    await visible(resourceButton(page, ID.themepark));
    await flush(page);
    assert.equal(new URL(page.url()).pathname, `/existing/${encodeURIComponent(IMSIL)}/resources`, `${query}: no navigation`);
    assert.equal(param(page, "types"), "12", `${query}: other conditions kept`);
    assert.equal(await detail(page).count(), 0, `${query}: no automatic selection`);
    await noTargetMessages(page);
  }
  passed.push("malformed-duplicate-target-ignored");

  // A direct address whose types lack the target's type adds it once and selects.
  list = served(page, "existing/resources", typesOnly("12"));
  await page.goto(resourcesUrl(`?types=14&resource=12:${ID.sangiam}`));
  realList(await list);
  await waitFocusId(page, "resource-detail-heading");
  assert.equal(await detail(page).innerText(), TITLE.sangiam);
  assert.equal(param(page, "types"), null, "관광지 added next to 문화시설");
  assert.equal(param(page, "resource"), null);
  passed.push("direct-address-adds-type-once");

  // Another festival's list never selects this festival's place.
  list = served(page, "existing/resources", typesOnly("12"));
  await page.goto(resourcesUrl(`?types=12&resource=12:${ID.themepark}`, NONSAN));
  const nonsan = await list;
  assert.ok(!nonsan.byType.some(b => b.items?.some(i => i.id === ID.themepark)), "oracle: not in the Nonsan list");
  if (nonsan.byType[0]?.status === "complete") await visible(page.getByText(MISSING, { exact: true }));
  assert.equal(await detail(page).count(), 0);
  await waitNoParam(page, "resource");
  passed.push("other-festival-never-selects");
}

// ---- 4. 320 / 390 / desktop ----
async function layouts() {
  for (const [width, height] of [[320, 740], [390, 844], [1440, 1000]]) {
    const { context, page } = await openContext({ width, height });
    await page.goto(visitsUrl());
    await visible(profile(page));
    await profile(page).getByRole("button", { name: "성·연령 비율 표 보기", exact: true }).click();
    await visible(rankLink(page, TITLE.themepark));
    await noPageOverflow(page, `${width} visitor profile`);
    const box = await rankLink(page, TITLE.themepark).boundingBox();
    assert.ok(box && box.x >= 0 && box.x + box.width <= width, `${width}: link inside the viewport`);
    await profile(page).screenshot({ path: new URL(`visitor-profile-${width}.png`, outDir).pathname });
    await context.close();
  }
  passed.push("320-390-1440-no-page-overflow");
}

try {
  for (const flow of [profileContent, destinationLinks, pendingTargets]) {
    const c = await openContext();
    await flow(c);
    await c.context.close();
  }
  await layouts();
  assert.equal(queue.length, 0, `unused gates: ${queue.length}`);
  assert.deepEqual(fixtureErrors, [], "controlled answers built");
  assert.deepEqual(writes, [], "no application non-GET request (Cloudflare measurement/consent recorded separately)");
  assert.deepEqual(errors, [], "no page errors");
  assert.deepEqual(consoleErrors, [], "no console errors");
  assert.equal(controlledFailures, 1, "exactly one controlled failure");
  assert.equal(controlledAnswers, 1, "exactly one controlled answer");
  const summary = { headless: true, realLocalData: ["existing/history"], realCurrentResources: controlledResources ? [] : ["existing/resources"],
    resourceMode: controlledResources ? "검증용 통제: 검토한 세 장소의 식별자·주소·좌표만 이용한 목록" : "현재 공개 서비스의 실제 관광자원 목록",
    controlled: "request gates on real answers; one aborted resource request and one real resource answer without the linked place (검증용 통제)",
    syntheticVisitorData: false, passed, blockedOtherHosts: [...new Set(blocked)], browserErrors: errors.length, clientWrites: writes.length,
    platformWrites: platformWrites.length, platformBoundary: "Cloudflare measurement/consent transport; ordinary refusal button used when shown" };
  writeFileSync(new URL("visitor-profile-e2e.json", outDir), `${JSON.stringify(summary, null, 2)}\n`);
  console.log(JSON.stringify(summary));
} finally {
  await browser.close();
}
