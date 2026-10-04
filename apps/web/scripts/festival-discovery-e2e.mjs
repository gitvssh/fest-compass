// Festival discovery (type chips, registration-introduction marks, nationwide list) and the withdrawn DataLab pages, headless.
//
// Data provenance is explicit per check:
//  - REAL ARCHIVE: the reviewed archive record of 논산딸기축제 (/api/existing/festivals) is merged under its link.
//  - 검증용 FIXTURES: registered festivals of a type and their marks are synthetic and labelled "(가상)". They prove UI semantics only;
//    the server's type filter, paging, marks and strictness are covered by lib/existing/festival-types.test.ts.
//  - Pages built from DataLab website downloads were withdrawn (ADR-0003): their old addresses must redirect and nothing links to them.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { chromium } from "playwright";

const base = process.env.E2E_BASE_URL ?? process.env.BASE_URL;
if (!base) throw new Error("E2E_BASE_URL (or BASE_URL) required");
const origin = new URL(base).origin;

// ---- Regions from the checked-in catalogue ----
const catalogue = JSON.parse(readFileSync(new URL("../data/region-catalogue.json", import.meta.url), "utf8")).rows;
function regionRef(districtName) {
  const r = catalogue.find(x => x.districtName === districtName);
  assert.ok(r, districtName);
  return { province: r.provinceCode, district: r.districtCode, code: `${r.provinceCode}${r.districtCode}`, name: `${r.provinceName} ${r.districtName}`, districtName: r.districtName };
}
const ANDONG = regionRef("안동시"), NONSAN = regionRef("논산시");

// ---- 검증용 fixtures ----
const FIXTURE_AT = "2026-09-01T00:00:00.000Z";
const fixtureSource = { title: "검증용 가상 등록 정보", url: "https://example.invalid/fixture", checkedAt: null, publishedAt: null, collectedAt: FIXTURE_AT };
const NONSAN_ID = "archive:nonsan-strawberry", SPECIALTY = "EV010300", CULTURE = "EV010100", ECO = "EV010500";
const current = (region, contentId, name, type, extra = {}) => ({ id: `current:${region.code}:${contentId}`, source: "current", contentId, name, region,
  start: null, end: null, datesVerified: false, address: "검증용 가상 주소", point: null, modifiedAt: null, type, linkedArchiveId: null, provenance: fixtureSource, ...extra });
const two = n => String(n).padStart(2, "0");
// 검증용 marks as the server sends them (read from a registration's introduction): label + the words they came from.
const MARK = { experience: ["체험", "검증용 딸기 따기 체험"], family: ["어린이·가족", "검증용 키즈존"], free: ["무료", "입장료 무료"] };
const marksOf = (...kinds) => ({ checkedAt: FIXTURE_AT, items: kinds.map(kind => ({ kind, label: MARK[kind][0], evidence: MARK[kind][1] })) });
// Every third: experience+family / free / not read yet (null).
const SPECIALTIES = Array.from({ length: 45 }, (_, i) => current(ANDONG, `99006${two(i)}`, `검증용 특산물 축제 ${two(i + 1)} (가상)`, SPECIALTY,
  { start: `2026-${two(1 + (i % 12))}-10`, end: `2026-${two(1 + (i % 12))}-12`, datesVerified: true, marks: i % 3 === 0 ? marksOf("experience", "family") : i % 3 === 1 ? marksOf("free") : null }));
const LINKED = current(NONSAN, "9900501", "논산딸기축제", CULTURE, { start: "2027-03-26", end: "2027-03-29", datesVerified: true, linkedArchiveId: NONSAN_ID, marks: marksOf("experience") });
const MARKED = current(ANDONG, "9900701", "검증용 안동 체험 축제 (가상)", ECO, { start: "2026-10-20", end: "2026-10-22", datesVerified: true, marks: marksOf("experience", "free") });
const EXHIBIT = current(NONSAN, "9900502", "검증용 딸기 전시 (가상)", "EV030100");
const MARKET = current(NONSAN, "9900503", "검증용 딸기 장터 (가상)", SPECIALTY);
const block = (mode, items, extra = {}) => ({ status: items.length ? "complete" : "empty", error: null, collectedAt: FIXTURE_AT, mode, range: null,
  page: 1, next: null, continuity: null, total: items.length, omitted: 0, lookup: null, items, ...extra });

// ---- API routing: the real answer keeps its key and request; only the blocks are replaced ----
const calls = [], fixtureErrors = [];
let realNonsan = null;
async function realArchive() {
  if (!realNonsan) {
    const r = await fetch(`${origin}/api/existing/festivals?${new URLSearchParams({ id: NONSAN_ID })}`, { headers: { accept: "application/json" } });
    const body = await r.json();
    realNonsan = { item: body.archive.items.find(f => f.id === NONSAN_ID), freshness: body.archive.freshness };
    assert.ok(realNonsan.item, "real reviewed archive record of 논산딸기축제");
  }
  return realNonsan;
}
async function festivals(route, p) {
  const type = p.get("type"), q = p.get("q") ?? "", id = p.get("id");
  if (id === MARKED.id) { // 검증용 identity lookup with the introduction read just now
    const y = new Date(Date.now() + 9 * 3_600_000).toISOString().slice(0, 4), request = { q: "", province: null, district: null, start: `${y}-01-01`, end: `${y}-12-31`, page: 1, total: null, id, type: null };
    return { kind: "fulfill", options: { json: { key: JSON.stringify(["festivals", id, "", null, null, request.start, request.end, 1, null, null]), request, retrievedAt: new Date().toISOString(),
      archive: { status: "not-requested", error: null, collectedAt: null, items: [], freshness: null }, current: block("lookup", [MARKED], { lookup: "verified" }) } } };
  }
  if (!type && !q) return { kind: "continue" }; // REAL starting choices
  const response = await route.fetch(), body = await response.json();
  if (!response.ok()) return { kind: "fulfill", options: { response, json: body } };
  const range = { start: body.request.start, end: body.request.end }, archive = await realArchive();
  let items = [];
  if (type === SPECIALTY && !q) body.current = block("type-list", items = SPECIALTIES, { range });
  else if (type === "all" && !q) body.current = block("type-list", items = [LINKED, MARKED, ...SPECIALTIES], { range });
  else if (type === ECO && !q) body.current = block("type-list", items = [], { range });
  else if (/딸기/.test(q)) body.current = block("keyword", items = type === CULTURE ? [LINKED] : type ? [] : [LINKED, EXHIBIT, MARKET]);
  else throw new Error(`no fixture for ${p}`);
  const linked = items.some(i => i.linkedArchiveId === NONSAN_ID);
  body.archive = { status: linked ? "complete" : "empty", error: null, collectedAt: null, items: linked ? [archive.item] : [], freshness: linked ? archive.freshness : null };
  return { kind: "fulfill", options: { response, json: body } };
}
async function onApi(route) {
  const url = new URL(route.request().url()), endpoint = url.pathname.slice("/api/existing/".length), p = url.searchParams;
  calls.push({ endpoint, params: Object.fromEntries(p) });
  let plan;
  try { plan = endpoint === "festivals" ? await festivals(route, p) : { kind: "continue" }; }
  catch (e) { fixtureErrors.push(`${endpoint}: ${e.message}`); plan = { kind: "abort" }; }
  try {
    if (plan.kind === "continue") await route.continue();
    else if (plan.kind === "abort") await route.abort("failed");
    else await route.fulfill(plan.options);
  } catch { /* superseded */ }
}


// ---- Page helpers ----
const browser = await chromium.launch({ headless: true });
const errors = [], writes = [], passed = [];
async function openContext(viewport = { width: 1440, height: 1000 }) {
  const context = await browser.newContext({ viewport, locale: "ko-KR" });
  await context.route(u => u.pathname.startsWith("/api/existing/"), onApi);
  const page = await context.newPage();
  page.setDefaultTimeout(20_000);
  page.on("pageerror", e => errors.push(e.message));
  page.on("request", r => { if (r.method() !== "GET" && new URL(r.url()).origin === origin) writes.push(`${r.method()} ${new URL(r.url()).pathname}`); });
  return { context, page };
}
const visible = l => l.waitFor({ state: "visible" });
const params = page => Object.fromEntries(new URL(page.url()).searchParams);
const waitAddress = (page, expectedQuery) => page.waitForFunction(q => new URLSearchParams(location.search).toString() === q, new URLSearchParams(expectedQuery).toString());
const chips = page => page.getByRole("group", { name: "축제 유형" });
const chip = (page, name) => chips(page).getByRole("button", { name });
const results = page => page.getByRole("list", { name: "찾은 축제" });
const heading = page => page.getByRole("heading", { level: 2 }).filter({ hasText: /검색 결과$|바로 살펴볼 수 있는 축제/ });
const pressedChips = page => chips(page).locator("button[aria-pressed=true]").allInnerTexts();
const focusedText = page => page.evaluate(() => document.activeElement?.textContent?.trim() ?? "");
async function includes(locator, text, label = "") {
  const inner = await locator.innerText();
  assert.ok(inner.includes(text), `${label} expected ${JSON.stringify(text)} in ${JSON.stringify(inner.slice(0, 400))}`);
}
async function noPageOverflow(page, label) {
  const [scroll, inner] = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
  assert.ok(scroll <= inner, `${label}: page scrollWidth ${scroll} > ${inner}`);
}
async function noInternalWording(page, label) {
  const text = await page.locator("main").innerText();
  assert.ok(!/EV0\d{5}|lclsSystm|type-list|source-unavailable|not-requested|linkedArchive|TourAPI|\bAPI\b|fixture|undefined|NaN/.test(text), `${label}: internal wording on screen`);
}

// ---- Scenarios: festival search by type ----
async function typeChips() {
  const { context, page } = await openContext();
  try {
    await page.goto(`${base}/existing/search`);
    await visible(heading(page).filter({ hasText: "바로 살펴볼 수 있는 축제" }));
    assert.deepEqual((await chips(page).getByRole("button").allInnerTexts()).map(s => s.replace(/\s+/g, " ").trim()),
      ["전체", "문화관광 · 문체부 지정", "문화예술", "지역특산물 · 먹거리", "전통역사", "생태자연", "기타 축제"]);
    assert.deepEqual(await pressedChips(page), [], "the starting choices are no type list");
    assert.equal(await page.getByRole("link", { name: /방문 규모/ }).count(), 0, "no link to the withdrawn ranking page");

    // A chip applies at once and keeps focus; the list is the type's whole national list in steps of 40.
    await chip(page, /^지역특산물/).click();
    await waitAddress(page, `type=${SPECIALTY}`);
    await visible(page.getByRole("heading", { level: 2, name: "지역특산물축제 검색 결과", exact: true }));
    assert.ok((await focusedText(page)).startsWith("지역특산물"), "focus stays on the chip");
    assert.ok(calls.some(c => c.endpoint === "festivals" && c.params.type === SPECIALTY && !c.params.q), "the search asks for the type");
    assert.deepEqual((await pressedChips(page)).map(s => s.replace(/\s+/g, " ").trim()), ["지역특산물 · 먹거리"]);
    await visible(page.getByText("축제 45건 중 40건 표시", { exact: true }));
    assert.equal(await results(page).getByRole("listitem").count(), 40);
    assert.equal(await results(page).getByText("지역특산물축제", { exact: true }).count(), 0, "a card does not repeat the chosen type");
    const more = page.getByRole("button", { name: "축제 더 보기 (5건 남음)", exact: true });
    await more.click();
    await visible(page.getByText("축제 45건", { exact: true }));
    assert.equal(await results(page).getByRole("listitem").count(), 45);
    assert.equal(await more.count(), 0);
    passed.push("type-chip-applies-keeps-focus", "type-list-reveal-in-steps", "type-badge-not-repeated");

    // One step from the chips to the answer (the list may start below the screen).
    await page.getByRole("button", { name: "지역특산물축제 45건 보기", exact: true }).click();
    await page.waitForFunction(() => document.activeElement?.textContent?.trim() === "지역특산물축제 검색 결과");
    passed.push("type-jump-to-results");

    // The source note names the type and where it comes from.
    await page.getByRole("button", { name: "검색 출처", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "현재 등록 축제 검색 출처" });
    await includes(dialog, "전국 지역특산물축제");
    await includes(dialog, "축제 유형은 한국관광공사가 등록 정보에 붙인 분류예요.");
    await page.keyboard.press("Escape");
    await dialog.waitFor({ state: "hidden" });
    await noInternalWording(page, "type list");

    // A pressed chip lifts its type: with no other condition, back to the starting choices.
    await chip(page, /^지역특산물/).click();
    await waitAddress(page, "");
    await visible(heading(page).filter({ hasText: "바로 살펴볼 수 있는 축제" }));
    assert.deepEqual(await pressedChips(page), []);
    passed.push("type-source-note", "type-chip-toggles-off");

    // A type with no registration this year: an honest empty answer.
    await chip(page, "생태자연").click();
    await waitAddress(page, `type=${ECO}`);
    await visible(page.getByText("검색어·지역·유형을 바꿔 다시 찾아보세요.", { exact: true }));
    await visible(chips(page).locator("..").getByText("생태자연축제 0건", { exact: true }));
    assert.equal(await page.getByRole("button", { name: /생태자연축제 \d+건 보기/ }).count(), 0, "nothing to jump to");
    passed.push("type-empty-answer");
  } finally { await context.close(); }
}

async function typeWithNameAndRegion() {
  const { context, page } = await openContext();
  try {
    await page.goto(`${base}/existing/search`);
    await visible(chips(page));
    // The typed name (not yet searched) goes with the chip.
    await page.getByLabel("축제 이름").fill("딸기");
    await chip(page, /^문화관광/).click();
    await waitAddress(page, `q=딸기&type=${CULTURE}`);
    await visible(page.getByRole("heading", { level: 2, name: "‘딸기’ · 문화관광축제 검색 결과", exact: true }));
    const linked = results(page).locator(`a[href="/existing/${encodeURIComponent(LINKED.id)}/visits"]`);
    await includes(linked, "지난 개최 2025년 · 2024년 · 2023년", "the linked record joins under its registration");
    assert.equal(await results(page).getByRole("listitem").count(), 1);
    passed.push("type-with-name");

    // Lifting the type keeps the name; a mixed list shows each registration's kind and "전체" reads as no type condition.
    await chip(page, /^문화관광/).click();
    await waitAddress(page, "q=딸기");
    await visible(page.getByRole("heading", { level: 2, name: "‘딸기’ 검색 결과", exact: true }));
    for (const [name, badge] of [["논산딸기축제", "문화관광축제"], ["검증용 딸기 전시 (가상)", "전시회"], ["검증용 딸기 장터 (가상)", "지역특산물축제"]]) {
      await includes(results(page).getByRole("link").filter({ hasText: name }), badge, name);
    }
    assert.deepEqual(await pressedChips(page), ["전체"]);
    passed.push("type-clear-keeps-name", "type-badges-in-mixed-list");

    // A half-chosen region blocks the chip like the search button does.
    await page.getByLabel("시도 (선택)").selectOption({ label: "충청남도" });
    await chip(page, "문화예술").click();
    await visible(page.getByRole("alert").filter({ hasText: "시군구까지 골라 주세요." }));
    assert.deepEqual(params(page), { q: "딸기" }, "no search with a half-chosen region");
    passed.push("type-region-validation");

    // Deep links: a valid type opens pressed; an unknown one is ignored.
    await page.goto(`${base}/existing/search?type=${ECO}`);
    await visible(page.getByRole("heading", { level: 2, name: "생태자연축제 검색 결과", exact: true }));
    assert.deepEqual(await pressedChips(page), ["생태자연"]);
    await page.goto(`${base}/existing/search?type=food`);
    await visible(heading(page).filter({ hasText: "바로 살펴볼 수 있는 축제" }));
    assert.deepEqual(await pressedChips(page), []);
    passed.push("type-deep-links");
  } finally { await context.close(); }
}

async function markFilter() {
  const { context, page } = await openContext();
  try {
    // "전체" with nothing else: every festival type nationwide.
    await page.goto(`${base}/existing/search`);
    await chip(page, "전체").click();
    await waitAddress(page, "type=all");
    await visible(page.getByRole("heading", { level: 2, name: "모든 축제 검색 결과", exact: true }));
    assert.deepEqual(await pressedChips(page), ["전체"]);
    const filter = page.getByRole("group", { name: "소개 글로 거르기" });
    const counts = (await filter.getByRole("button").allInnerTexts()).map(s => s.replace(/\s+/g, " ").trim());
    assert.deepEqual(counts, ["체험 17", "어린이·가족 15", "무료 16"], "how many listed festivals carry each mark");
    await visible(page.getByText("소개 글 확인 전 15건", { exact: true }));
    passed.push("all-festivals-national-list", "mark-counts");

    // Marks filter on the page (no new search), AND across marks; cards show their marks; focus stays.
    const before = calls.filter(c => c.endpoint === "festivals").length;
    await filter.getByRole("button", { name: /^체험/ }).click();
    await waitAddress(page, "mark=experience&type=all");
    await visible(page.getByText("축제 47건 중 체험 17건", { exact: true }));
    assert.ok((await focusedText(page)).startsWith("체험"), "focus stays on the mark chip");
    await filter.getByRole("button", { name: /^어린이·가족/ }).click();
    await waitAddress(page, "mark=experience,family&type=all");
    await visible(page.getByText("축제 47건 중 체험·어린이·가족 15건", { exact: true }));
    await visible(page.getByText("소개 글을 아직 확인하지 못한 15건은 빠져요", { exact: true }));
    assert.equal(calls.filter(c => c.endpoint === "festivals").length, before, "filtering asks the server nothing");
    for (const card of await results(page).getByRole("link").all()) { await includes(card, "체험"); await includes(card, "어린이·가족"); }
    passed.push("mark-filter-on-page", "mark-filter-and", "mark-unchecked-left-out");

    // Nothing left: say so and offer to lift the marks.
    await filter.getByRole("button", { name: /^무료/ }).click();
    await visible(page.getByText("체험·어린이·가족·무료 표시가 있는 축제가 이 목록에는 없어요.", { exact: true }));
    await page.getByRole("button", { name: "거르기 지우기", exact: true }).click();
    await waitAddress(page, "type=all");
    assert.equal(await results(page).getByRole("listitem").count(), 40, "the whole list again (first 40)");
    // The address keeps the marks.
    await page.goto(`${base}/existing/search?type=all&mark=free`);
    await visible(page.getByText("축제 47건 중 무료 16건", { exact: true }));
    assert.deepEqual(await page.getByRole("group", { name: "소개 글로 거르기" }).locator("button[aria-pressed=true]").allInnerTexts().then(a => a.map(s => s.replace(/\s+/g, " ").trim())), ["무료 16"]);
    passed.push("mark-filter-empty-and-clear", "mark-filter-address");

    // A festival's header shows its marks and the words they were read from.
    await page.goto(`${base}/existing/${encodeURIComponent(MARKED.id)}/visits`);
    await visible(page.getByRole("heading", { level: 1, name: MARKED.name, exact: true }));
    const header = page.locator("main header");
    await includes(header, "체험"); await includes(header, "무료");
    await page.getByRole("button", { name: "소개 글 근거", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "등록 소개 글에서 찾은 표시" });
    await includes(dialog, "“검증용 딸기 따기 체험”");
    await includes(dialog, "“입장료 무료”");
    await includes(dialog, "실제 운영 여부는 주최 측 안내를 확인해 주세요.");
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => document.activeElement?.textContent?.trim() === "소개 글 근거");
    await noInternalWording(page, "marks");
    passed.push("mark-header-evidence");
  } finally { await context.close(); }
}

async function typePhone() {
  const { context, page } = await openContext({ width: 390, height: 844 });
  try {
    await page.goto(`${base}/existing/search`);
    await chip(page, /^지역특산물/).click();
    await waitAddress(page, `type=${SPECIALTY}`);
    const jump = page.getByRole("button", { name: "지역특산물축제 45건 보기", exact: true });
    await visible(jump);
    const box = await jump.boundingBox();
    assert.ok(box && box.y + box.height <= 844, `the step to the answer is on screen next to the chips (y=${box?.y})`);
    await noPageOverflow(page, "search 390");
    passed.push("type-phone-feedback-no-overflow");
  } finally { await context.close(); }
}

// ---- Scenario: pages built from DataLab website downloads are withdrawn (ADR-0003) ----
async function withdrawnPages() {
  const { context, page } = await openContext();
  try {
    for (const old of ["/compare/annual", "/compare/scale", "/compare/annual?festival=imsil-n-cheese", "/compare/scale?year=2024&sort=outside"]) {
      const response = await page.goto(`${base}${old}`);
      assert.equal(new URL(page.url()).pathname, "/compare", `${old} lands on festival comparison`);
      assert.ok(response?.ok(), `${old} answers`);
      assert.ok(response?.request().redirectedFrom(), `${old} is a redirect`);
    }
    await visible(page.getByRole("heading", { level: 1, name: "주변·과거 축제 비교", exact: true }));
    for (const name of ["연도별 방문 보기", "축제 방문 규모"]) assert.equal(await page.getByRole("link", { name, exact: true }).count(), 0, name);
    await page.goto(`${base}/`);
    assert.equal(await page.getByRole("link", { name: "축제 방문 규모 →", exact: true }).count(), 0);
    const sitemap = await (await page.request.get(`${base}/sitemap.xml`)).text();
    assert.ok(!/compare\/(annual|scale)/.test(sitemap), "the sitemap no longer lists them");
    passed.push("withdrawn-datalab-pages-redirect", "withdrawn-datalab-pages-unlinked");
  } finally { await context.close(); }
}

// ---- Run ----
try {
  await typeChips();
  await typeWithNameAndRegion();
  await markFilter();
  await typePhone();
  await withdrawnPages();
  assert.deepEqual(writes, [], "no same-origin non-GET request");
  assert.deepEqual(errors, []);
  assert.deepEqual(fixtureErrors, []);
  console.log(JSON.stringify({ headless: true, real: ["festivals archive block"], fixtures: "검증용 registrations by type", passed, browserErrors: errors.length, apiRequests: calls.length }));
} finally {
  await browser.close();
}
