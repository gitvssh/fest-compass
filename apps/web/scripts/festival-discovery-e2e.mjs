// Festival discovery (type chips on the festival search, culture-tourism festival scale ranking), headless.
//
// Data provenance is explicit per check:
//  - REAL: /compare/scale renders the checked-in DataLab file; the expected order, values and shares below are
//    recomputed here from the same file with an independent implementation.
//  - REAL ARCHIVE: the reviewed archive record of 논산딸기축제 (/api/existing/festivals) is merged under its link.
//  - 검증용 FIXTURES: registered festivals of a type are synthetic and labelled "(가상)". They prove UI semantics only;
//    the server's type filter, paging and strictness are covered by lib/existing/festival-types.test.ts.
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

// ---- Expected ranking, recomputed from the DataLab file ----
const trend = JSON.parse(readFileSync(new URL("../data/datalab-festival-trend.json", import.meta.url), "utf8"));
function expected(year, sort) {
  const rows = trend.festivals.flatMap(f => f.years.filter(y => y.year === year).map(y => ({ id: f.id, name: f.name, ...y,
    outsideShare: y.outside / y.periodTotal, localShare: y.local / y.periodTotal, foreignShare: y.foreign / y.periodTotal })));
  const key = { mean: r => r.dailyMean, total: r => r.periodTotal, outside: r => r.outsideShare, local: r => r.localShare }[sort];
  rows.sort((a, b) => key(b) - key(a) || a.name.localeCompare(b.name, "ko-KR"));
  const absent = trend.festivals.filter(f => !f.years.some(y => y.year === year)).map(f => f.name).sort((a, b) => a.localeCompare(b, "ko-KR"));
  return { rows, absent };
}
const pct = s => { const p = s * 100; return p > 0 && p < 0.05 ? "<0.1%" : p > 0 && p < 0.95 ? `${p.toFixed(1)}%` : `${Math.round(p)}%`; };
const count = v => v.toLocaleString("ko-KR", { maximumFractionDigits: 0 });

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
    assert.equal(await page.getByRole("link", { name: "문화관광축제 방문 규모" }).getAttribute("href"), "/compare/scale");

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

// ---- Scenarios: culture-tourism festival scale ----
const ranked = (page, label) => page.getByRole("list", { name: label, exact: true });
async function rowNames(list) { return list.getByRole("listitem").evaluateAll(lis => lis.map(li => li.querySelector("a")?.textContent?.trim())); }

async function scaleRanking() {
  const { context, page } = await openContext();
  try {
    await page.goto(`${base}/compare/scale`);
    await visible(page.getByRole("heading", { level: 1, name: "문화관광축제 방문 규모", exact: true }));
    const e25 = expected(2025, "mean");
    const leaders = page.getByRole("list", { name: "2025년 한눈에 보기" });
    await includes(leaders, `${e25.rows[0].name}\n하루 ${count(Math.round(e25.rows[0].dailyMean))}명`);
    const out25 = expected(2025, "outside").rows[0], local25 = expected(2025, "local").rows[0];
    await includes(leaders, `${out25.name}\n외지인 ${pct(out25.outsideShare)}`);
    await includes(leaders, `${local25.name}\n현지인 ${pct(local25.localShare)}`);
    assert.deepEqual([e25.rows[0].name, out25.name, local25.name], ["부평풍물대축제", "임실N치즈축제", "목포항구축제"], "file sanity");

    const list = ranked(page, "2025년 일평균 순위");
    assert.deepEqual(await rowNames(list), e25.rows.map(r => r.name), "daily-mean order of the file");
    const first = list.getByRole("listitem").first(), r0 = e25.rows[0];
    for (const text of ["1", `${r0.days}일`, `하루 ${count(Math.round(r0.dailyMean))}명`, `현지인 ${pct(r0.localShare)} · 외지인 ${pct(r0.outsideShare)} · 외국인 ${pct(r0.foreignShare)}`, "고르게"]) await includes(first, text, "first row");
    await visible(page.getByText(`2025년 자료 없음 · ${e25.absent.join(", ")}`, { exact: true }));
    assert.equal(await list.getByRole("link", { name: "임실N치즈축제", exact: true }).getAttribute("href"), "/compare/annual?festival=imsil-n-cheese");
    passed.push("scale-default-daily-mean", "scale-leaders", "scale-absent-years", "scale-row-link");

    // Share orders: 100% bars ordered by the group's share, address kept for sharing.
    const sort = page.getByRole("group", { name: "순위 기준" }), year = page.getByRole("group", { name: "연도" });
    await sort.getByRole("button", { name: "외지인 비율", exact: true }).click();
    await waitAddress(page, "sort=outside");
    const byOutside = ranked(page, "2025년 외지인 비율 순위");
    assert.deepEqual(await rowNames(byOutside), expected(2025, "outside").rows.map(r => r.name));
    await includes(byOutside.getByRole("listitem").first(), `${pct(out25.outsideShare)}`);
    await includes(byOutside.getByRole("listitem").first(), "외지인 중심");
    await year.getByRole("button", { name: "2024", exact: true }).click();
    await waitAddress(page, "year=2024&sort=outside");
    assert.equal(await ranked(page, "2024년 외지인 비율 순위").getByRole("listitem").count(), 26);
    assert.equal(await page.getByText(/자료 없음 ·/).count(), 0, "2024 holds every festival");
    await sort.getByRole("button", { name: "현지인 비율", exact: true }).click();
    const byLocal = ranked(page, "2024년 현지인 비율 순위"), e24 = expected(2024, "local");
    assert.deepEqual(await rowNames(byLocal), e24.rows.map(r => r.name));
    // 60% marks a side; below it on both sides reads as mixed.
    for (const r of e24.rows) {
      const row = byLocal.getByRole("listitem").filter({ has: page.getByRole("link", { name: r.name, exact: true }) });
      await includes(row, r.outsideShare >= 0.6 ? "외지인 중심" : r.localShare >= 0.6 ? "현지인 중심" : "고르게", r.name);
    }
    await sort.getByRole("button", { name: "기간 합계", exact: true }).click();
    await waitAddress(page, "year=2024&sort=total");
    const byTotal = ranked(page, "2024년 기간 합계 순위"), t24 = expected(2024, "total");
    assert.deepEqual(await rowNames(byTotal), t24.rows.map(r => r.name));
    await includes(byTotal.getByRole("listitem").first(), `${count(t24.rows[0].periodTotal)}명`);
    passed.push("scale-share-orders", "scale-year-switch", "scale-orientation-60", "scale-period-total");

    // Unknown address values fall back to the newest year and the daily mean.
    await page.goto(`${base}/compare/scale?year=2020&sort=views`);
    await visible(ranked(page, "2025년 일평균 순위"));
    assert.deepEqual(await page.locator("button[aria-pressed=true]").allInnerTexts(), ["2025", "일평균"]);
    passed.push("scale-address-fallback");

    // The criteria are one tap away and return focus.
    const criteria = page.getByRole("button", { name: "기준", exact: true });
    await criteria.click();
    const dialog = page.getByRole("dialog", { name: "방문 규모를 읽는 기준" });
    await includes(dialog, "60% 이상");
    await includes(dialog, "행사장 입장객이 아니에요");
    await page.keyboard.press("Escape");
    await dialog.waitFor({ state: "hidden" });
    await page.waitForFunction(() => document.activeElement?.textContent?.trim() === "기준");
    assert.equal(await page.getByRole("link", { name: "문화관광축제 찾기", exact: true }).getAttribute("href"), `/existing/search?type=${CULTURE}`);
    await noInternalWording(page, "scale");
    passed.push("scale-criteria-dialog", "scale-to-type-search");

    // Entrances: home, festival comparison and the yearly flow page.
    await page.goto(`${base}/`);
    assert.equal(await page.getByRole("link", { name: "축제 방문 규모 →", exact: true }).getAttribute("href"), "/compare/scale");
    await page.goto(`${base}/compare/annual`);
    assert.equal(await page.getByRole("link", { name: `${trend.festivals.length}곳 방문 규모 한눈에 보기`, exact: true }).getAttribute("href"), "/compare/scale");
    await page.goto(`${base}/compare`);
    assert.equal(await page.getByRole("link", { name: "축제 방문 규모", exact: true }).getAttribute("href"), "/compare/scale");
    passed.push("scale-entrances");
  } finally { await context.close(); }
}

async function scalePhone() {
  const { context, page } = await openContext({ width: 390, height: 844 });
  try {
    await page.goto(`${base}/compare/scale`);
    await visible(ranked(page, "2025년 일평균 순위"));
    const tops = await page.getByRole("group", { name: "연도" }).getByRole("button").evaluateAll(bs => bs.map(b => Math.round(b.getBoundingClientRect().top)));
    assert.equal(new Set(tops).size, 1, `six years in one row (${tops})`);
    await noPageOverflow(page, "scale 390");
    passed.push("scale-phone-no-overflow");
  } finally { await context.close(); }
}

// ---- Run ----
try {
  await typeChips();
  await typeWithNameAndRegion();
  await markFilter();
  await typePhone();
  await scaleRanking();
  await scalePhone();
  assert.deepEqual(writes, [], "no same-origin non-GET request");
  assert.deepEqual(errors, []);
  assert.deepEqual(fixtureErrors, []);
  console.log(JSON.stringify({ headless: true, real: ["DataLab culture-tourism festival file", "festivals archive block"], fixtures: "검증용 registrations by type", passed, browserErrors: errors.length, apiRequests: calls.length }));
} finally {
  await browser.close();
}
