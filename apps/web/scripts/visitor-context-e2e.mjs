// pickDday visitor context acceptance, headless: the host-area visit composition of an archive festival and the
// district's yearly visit totals beside the new-festival monthly view (pilot: 임실).
//
// Data provenance is explicit per check:
//  - REAL LOCAL DATA: /api/existing/history and /api/new/visits pass through the local server untouched. Expected numbers
//    are fixed here from the reviewed contract and cross-checked against the imported original DataLab CSVs and the
//    checked-in daily archive (read directly, never through app code).
//  - 검증용 통제 응답: request gates only delay a real answer (hold → assert → release), and one request is aborted on
//    purpose to show failure recovery. No synthetic visit numbers are served or shown.
//  - Requests to other hosts are blocked (not needed for these views) and only counted.
import assert from "node:assert/strict";
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const base = process.env.E2E_BASE_URL ?? process.env.BASE_URL;
if (!base) throw new Error("E2E_BASE_URL (or BASE_URL) required");
const origin = new URL(base).origin;
const outDir = new URL("../output/playwright/", import.meta.url);
mkdirSync(outDir, { recursive: true });
const readData = name => JSON.parse(readFileSync(new URL(`../data/${name}`, import.meta.url), "utf8"));

// ---- Independent oracle ----
const originals = fileURLToPath(new URL("../../../docs/research/imported/hkjin-plan-03/original/data/", import.meta.url));
function originalCsv(suffix) {
  const found = readdirSync(originals, { recursive: true }).filter(p => String(p).replaceAll("\\", "/").normalize("NFC").endsWith(suffix.normalize("NFC")));
  assert.equal(found.length, 1, `oracle: one original ${suffix}`);
  return readFileSync(join(originals, String(found[0])), "utf8").replace(/^﻿/, "").trim().split(/\r?\n/).map(l => l.split(","));
}
const sourceNumber = s => { assert.match(s, /^(0|[1-9]\d*)(\.\d+)?(E[+-]?\d+)?$/, `oracle number ${s}`); return Number(s); };

const FESTIVAL = { 2025: { days: 5, local: 16688, outside: 127842, foreign: 126, total: 144656, daily: 28931.2 }, 2024: { days: 4, local: 14949, outside: 93573, foreign: 187, total: 108709 } };
const festivalRows = Object.fromEntries(originalCsv("_임실N치즈축제_연도별 방문자 추이.csv").slice(1).map(c => [c[1], {
  days: Number(c[2]), local: sourceNumber(c[3]), outside: sourceNumber(c[4]), foreign: sourceNumber(c[5]), total: sourceNumber(c[6]), daily: sourceNumber(c[7]) }]));
for (const [year, want] of Object.entries(FESTIVAL)) for (const [k, v] of Object.entries(want)) assert.equal(festivalRows[year][k], v, `oracle: festival ${year} ${k}`);
assert.equal(Number((FESTIVAL[2025].outside / FESTIVAL[2025].total * 100).toFixed(1)), 88.4, "oracle: 2025 outside share");

const annualRows = originalCsv("임실군_2018-2025_데이터랩_다운로드/20260830132526_방문자 수 추이.csv");
assert.deepEqual(annualRows[0], ["기준년월", "기초지자체", "방문자 구분", "방문자 수"], "oracle: annual header");
const ANNUAL = {};
for (const [year, name, kind, value] of annualRows.slice(1)) {
  assert.equal(name, "임실군");
  const key = { "현지인방문자(a)": "local", "외지인방문자(b)": "outside", "전체방문자(a+b)": "total" }[kind];
  assert.ok(key && !(ANNUAL[year]?.[key] >= 0), `oracle: one ${kind} row in ${year}`);
  (ANNUAL[year] ??= {})[key] = sourceNumber(value);
}
const ANNUAL_YEARS = Object.keys(ANNUAL).map(Number).sort();
assert.deepEqual(ANNUAL_YEARS, [2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025]);
assert.equal(ANNUAL[2018].outside, 4981442); assert.equal(ANNUAL[2025].outside, 9183132);
assert.equal(ANNUAL[2024].total, 12922259); assert.equal(ANNUAL[2024].local + ANNUAL[2024].outside, 12922258, "oracle: source total kept, not the sum");

const imsilEditions = Object.fromEntries(readData("festival-editions.json").editions.filter(e => e.festivalId === "imsil-cheese").map(e => [e.year, e]));
const WEEKDAY = ["일", "월", "화", "수", "목", "금", "토"];
const md = d => `${Number(d.slice(5, 7))}.${Number(d.slice(8, 10))}`, wd = d => WEEKDAY[new Date(`${d}T00:00:00Z`).getUTCDay()];
const editionText = (year, days) => { const e = imsilEditions[year]; return `${year}년 · ${md(e.start)}–${md(e.end)} · ${wd(e.start)}–${wd(e.end)} ${days}일`; };
assert.equal(editionText(2025, 5), "2025년 · 10.8–10.12 · 수–일 5일", "oracle: 2025 original festival dates");
const daily = readData("regional-history-expanded.json").datasets.find(d => d.region.code === "52750").points;
const yearDays = y => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 ? 366 : 365;
const COMPLETE_DAILY = [...new Set(daily.map(p => Number(p.date.slice(0, 4))))].filter(y => daily.filter(p => p.date.startsWith(`${y}-`) && p.value !== null).length === yearDays(y));
assert.deepEqual(COMPLETE_DAILY.filter(y => ANNUAL_YEARS.includes(y)).sort(), [2023, 2024, 2025], "oracle: annual years with complete daily data");

const n0 = v => v.toLocaleString("ko-KR"), n1 = v => v.toLocaleString("ko-KR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const HOST_KEYS = ["allYearsHref", "editions", "festivalName", "source"], EDITION_KEYS = ["days", "dailyMean", "editionId", "end", "foreign", "local", "outside", "outsideShare", "start", "total", "year"];
const ANNUAL_KEYS = ["regionCode", "source", "years"], INTERNAL = ["sha256", "docs/research", "\"raw\"", "evidence", "commit", "manifest", "/original/"];
const UNCONFIRMED = /성·연령|성별|연령대|거주지|검색순위|성수면/;

// ---- API gates on real answers ----
const queue = [], passed = [], errors = [], consoleErrors = [], writes = [], blocked = [];
let controlledFailures = 0;
function within(promise, label, ms = 20_000) {
  let timer;
  return Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`timed out: ${label}`)), ms); })]).finally(() => clearTimeout(timer));
}
/** Hold the next matching request; `release("abort")` fails it on purpose, `release()` lets the real answer through. */
function gate(match, label) {
  let arrived, release, done;
  const hasArrived = new Promise(r => { arrived = r; }), released = new Promise(r => { release = r; }), finished = new Promise(r => { done = r; });
  queue.push({ match, arrived, released, done });
  return { arrived: within(hasArrived, label), release: async plan => { release(plan ?? "continue"); await within(finished, `${label} finished`); } };
}
async function onApi(route) {
  const url = new URL(route.request().url()), endpoint = url.pathname.slice("/api/".length);
  const index = queue.findIndex(q => q.match(endpoint, url.searchParams)), entry = index < 0 ? null : queue.splice(index, 1)[0];
  let plan = "continue";
  if (entry) { entry.arrived(); plan = await entry.released; }
  try {
    if (plan === "abort") { controlledFailures += 1; await route.abort("failed"); } else await route.continue();
  } catch { /* superseded */ }
  entry?.done();
}
const is = (endpoint, test = () => true) => (e, p) => e === endpoint && test(p);

const browser = await chromium.launch({ headless: true });
async function openContext(viewport = { width: 1440, height: 1000 }) {
  const context = await browser.newContext({ viewport, locale: "ko-KR" });
  await context.route(u => u.origin !== origin, route => { blocked.push(new URL(route.request().url()).host); return route.abort("blockedbyclient"); });
  await context.route(u => u.origin === origin && u.pathname.startsWith("/api/"), onApi);
  const page = await context.newPage();
  page.setDefaultTimeout(20_000);
  page.on("pageerror", e => errors.push(e.message));
  page.on("console", m => { if (m.type() === "error" && !/^Failed to load resource/.test(m.text())) consoleErrors.push(m.text()); });
  page.on("request", r => { if (r.method() !== "GET" && new URL(r.url()).origin === origin) writes.push(`${r.method()} ${new URL(r.url()).pathname}`); });
  return { context, page };
}
const served = (page, endpoint, test = () => true) => page.waitForResponse(r => {
  const u = new URL(r.url());
  return u.origin === origin && u.pathname === `/api/${endpoint}` && test(u.searchParams);
}).then(async r => { assert.equal(r.status(), 200, `${endpoint} status`); return r.json(); });
const visible = l => l.waitFor({ state: "visible" });
const flush = page => page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
const waitFocusId = (page, id) => page.waitForFunction(i => document.activeElement?.id === i, id);
const focusedId = page => page.evaluate(() => document.activeElement?.id ?? "");
const waitParam = (page, key, value) => page.waitForFunction(([k, v]) => new URL(location.href).searchParams.get(k) === v, [key, value]);
const escapeRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const ddOf = (scope, term) => scope.locator("dt").filter({ hasText: new RegExp(`^${escapeRe(term)}$`) }).locator("xpath=following-sibling::dd[1]");
const rowCells = async (table, header) => {
  const rowHeader = table.getByRole("rowheader", { name: header, exact: true });
  await visible(rowHeader);
  return (await rowHeader.locator("..").locator("th,td").allInnerTexts()).map(s => s.trim());
};
function projectionOnly(block, keys, label) {
  assert.deepEqual(Object.keys(block).sort(), [...keys].sort(), `${label}: only the projected fields`);
  if (block.source) assert.deepEqual(Object.keys(block.source).sort(), ["downloadedOn", "title", "url"], `${label}: public source only`);
  const text = JSON.stringify(block);
  for (const word of INTERNAL) assert.ok(!text.includes(word), `${label}: no internal ${word}`);
}
async function noPageOverflow(page, label) {
  const [scroll, inner] = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
  assert.ok(scroll <= inner, `${label}: page scrollWidth ${scroll} > ${inner}`);
}
async function keyboardDialog(page, opener, title, text) {
  await opener.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: title, exact: true });
  await visible(dialog);
  await visible(dialog.getByText(text));
  await page.keyboard.press("Escape");
  await dialog.waitFor({ state: "hidden" });
  await page.waitForFunction(el => el === document.activeElement, await opener.elementHandle());
  assert.equal(await opener.evaluate(el => el === document.activeElement), true, `${title}: focus back on its button after Esc`);
}

// ---- Existing festival: host-area composition ----
const IMSIL_ID = "archive:imsil-cheese", ed = y => `imsil-cheese-${y}`;
const visitsPath = (id, query = "") => `${base}/existing/${encodeURIComponent(id)}/visits${query}`;
const host = page => page.getByRole("region", { name: "축제가 열린 읍·면·동의 방문 구성", exact: true });
const hostItem = (page, year) => host(page).getByRole("listitem").filter({ hasText: new RegExp(`^${year}년 · `) });
const picker = (page, year) => page.getByRole("checkbox", { name: new RegExp(`^${year}년 · `) });
const editionsAre = years => p => (p.get("editions") ?? "").split(",").sort().join() === years.map(ed).sort().join();
async function pick(page, years) {
  // Uncheck first so the 3-edition limit never disables a wanted box.
  for (const y of [2023, 2024, 2025]) if (!years.includes(y) && await picker(page, y).isChecked()) await picker(page, y).click();
  for (const y of years) if (!await picker(page, y).isChecked()) await picker(page, y).click();
  await page.getByRole("button", { name: "적용", exact: true }).first().click();
}
async function hostYears(page) {
  const texts = await host(page).getByRole("listitem").allInnerTexts();
  return texts.map(t => Number(t.slice(0, 4))).sort();
}
function checkHostBody(body, years) {
  const hv = body.hostVisits;
  assert.ok(hv, "hostVisits present");
  projectionOnly(hv, HOST_KEYS, "hostVisits");
  assert.deepEqual(hv.editions.map(e => e.editionId).sort(), years.map(ed).sort(), "only the selected editions");
  for (const e of hv.editions) {
    projectionOnly(e, EDITION_KEYS, e.editionId);
    const src = festivalRows[e.year], orig = imsilEditions[e.year];
    assert.deepEqual([e.start, e.end, e.days, e.local, e.outside, e.foreign, e.total, e.dailyMean],
      [orig.start, orig.end, src.days, src.local, src.outside, src.foreign, src.total, src.daily], `${e.editionId}: original dates and source counts`);
    assert.ok(Math.abs(e.outsideShare - src.outside / src.total) < 1e-9, `${e.editionId}: share from counts`);
  }
  return hv;
}

async function existingFestival({ page }) {
  let body = served(page, "existing/history");
  await page.goto(visitsPath(IMSIL_ID, `?editions=${ed(2024)},${ed(2025)}`));
  const first = checkHostBody(await body, [2024, 2025]);
  await visible(host(page));
  await visible(host(page).getByText("임실N치즈축제 개최기간 · 명/일 · 통신 기반 추정", { exact: true }));
  const y25 = hostItem(page, 2025), y24 = hostItem(page, 2024);
  await visible(y25.getByText(editionText(2025, 5), { exact: true }));
  await visible(y24.getByText(editionText(2024, 4), { exact: true }));
  assert.equal(await ddOf(y25, "하루 평균").innerText(), "28,931.2명/일");
  assert.equal(await ddOf(y25, "외지인").innerText(), "25,568.4명/일 · 외지인 비율 88.4%");
  assert.equal(await ddOf(y25, "현지인").innerText(), `${n1(16688 / 5)}명/일`);
  assert.equal(await ddOf(y25, "외국인").innerText(), `${n1(126 / 5)}명/일`, "tiny foreign value keeps its label");
  assert.equal(await ddOf(y24, "하루 평균").innerText(), `${n1(108709 / 4)}명/일`);
  assert.equal(await ddOf(y24, "외지인").innerText(), `${n1(93573 / 4)}명/일 · 외지인 비율 ${(93573 / 108709 * 100).toFixed(1)}%`);
  // One absolute daily scale for every shown edition: the largest daily total fills the bar, others are proportional.
  const bar = year => host(page).getByRole("img", { name: new RegExp(`^${year}년 하루 평균 `) });
  assert.equal(await bar(2025).getAttribute("aria-label"), `2025년 하루 평균 28,931.2명: 현지인 ${n1(16688 / 5)}명, 외지인 25,568.4명, 외국인 ${n1(126 / 5)}명`);
  const filled = l => l.evaluate(el => [...el.children].reduce((s, c) => s + c.getBoundingClientRect().width, 0) / el.getBoundingClientRect().width);
  assert.ok(Math.abs(await filled(bar(2025)) - 1) < 0.01, "largest daily total spans the scale");
  assert.ok(Math.abs(await filled(bar(2024)) - (108709 / 4) / 28931.2) < 0.01, "2024 bar on the same absolute daily scale");
  await visible(host(page).getByText("0명/일", { exact: true }));

  await host(page).getByRole("button", { name: "기간 합계 표 보기", exact: true }).click();
  const table = host(page).getByRole("table", { name: "개최기간 방문 합계(명, 추정)" });
  assert.deepEqual((await rowCells(table, editionText(2025, 5))).slice(1), ["16,688", "127,842", "126", "144,656", "28,931.2"]);
  assert.deepEqual((await rowCells(table, editionText(2024, 4))).slice(1), ["14,949", "93,573", "187", "108,709", n1(27177.25)]);
  await keyboardDialog(page, host(page).getByRole("button", { name: "방문 구성 출처 보기", exact: true }), "방문 구성 출처와 계산", "내려받은 날 2026-08-29");
  assert.equal(await host(page).getByRole("link", { name: "모든 개최연도 보기", exact: true }).getAttribute("href"), "/compare/annual?festival=imsil-n-cheese");
  assert.doesNotMatch(await page.locator("main").innerText(), UNCONFIRMED, "no unconfirmed demographics, ranks or inferred town name");
  passed.push("festival-2025-2024-counts-daily-share-scale", "festival-table-source-keyboard-close");

  // A custom chart window changes only the district chart; the host rows keep the original festival dates.
  const card = page.getByRole("listitem").filter({ has: page.getByRole("heading", { name: editionText(2025, 5), exact: true }) });
  await card.getByRole("button", { name: "표시 기간 바꾸기", exact: true }).click();
  await card.getByLabel("표시 시작일").fill("2025-09-20");
  await card.getByLabel("표시 종료일").fill("2025-10-25");
  body = served(page, "existing/history", p => (p.get("windows") ?? "").includes(ed(2025)));
  await card.getByRole("button", { name: "적용", exact: true }).click();
  const windowed = checkHostBody(await body, [2024, 2025]);
  assert.deepEqual(windowed.editions, first.editions, "window change leaves host composition unchanged");
  await visible(page.getByText(`표시 2025.9.20(${wd("2025-09-20")}) ~ 2025.10.25(${wd("2025-10-25")})`, { exact: true }));
  await visible(hostItem(page, 2025).getByText(editionText(2025, 5), { exact: true }));
  passed.push("chart-window-does-not-change-festival-dates");

  // Selection change with a late earlier answer: the later selection wins, the earlier never replaces it.
  const older = gate(is("existing/history", editionsAre([2023])), "history 2023");
  await pick(page, [2023]);
  await older.arrived;
  assert.equal(await host(page).count(), 0, "no previous selection's composition while loading");
  body = served(page, "existing/history", editionsAre([2024]));
  await pick(page, [2024]);
  checkHostBody(await body, [2024]);
  await visible(hostItem(page, 2024));
  await older.release();
  await flush(page);
  assert.deepEqual(await hostYears(page), [2024], "late 2023 answer ignored");
  passed.push("selection-change-and-stale-answer-isolated");

  // 검증용 통제 실패: one aborted request, then recovery with the real answer.
  const failing = gate(is("existing/history", editionsAre([2023, 2025])), "history 2023+2025 failure");
  await pick(page, [2023, 2025]);
  await failing.arrived;
  await failing.release("abort");
  await visible(page.getByText("방문 자료를 불러오지 못했어요.", { exact: false }));
  assert.equal(await host(page).count(), 0, "failed selection shows no composition");
  body = served(page, "existing/history", editionsAre([2023, 2025]));
  await page.getByRole("button", { name: "다시 불러오기", exact: true }).click();
  checkHostBody(await body, [2023, 2025]);
  await visible(hostItem(page, 2023).getByText(editionText(2023, 4), { exact: true }));
  assert.deepEqual(await hostYears(page), [2023, 2025]);
  passed.push("controlled-failure-recovers-with-real-answer");

  for (const [id, heading] of [["archive:nonsan-strawberry", "논산시 외지인 방문 추이"], ["archive:baekje-gongju", "공주시 외지인 방문 추이"]]) {
    body = served(page, "existing/history");
    await page.goto(visitsPath(id));
    assert.equal((await body).hostVisits, null, `${id}: no host composition without a reviewed mapping`);
    await visible(page.getByRole("heading", { level: 2, name: heading, exact: true }));
    await flush(page);
    assert.equal(await host(page).count(), 0, `${id}: section omitted`);
    assert.equal(await page.getByRole("button", { name: "방문 구성 출처 보기" }).count(), 0);
  }
  passed.push("unmapped-nonsan-gongju-omitted");
}

// ---- New festival: district yearly totals ----
const annualSection = page => page.getByRole("region", { name: "임실군 연도별 방문 합계", exact: true });
const anyAnnual = page => page.getByRole("heading", { name: /연도별 방문 합계$/ });
const yearGroup = page => annualSection(page).getByRole("group", { name: "월별로 볼 연도", exact: true });
const yearButton = (page, y) => yearGroup(page).getByRole("button", { name: `${y}년`, exact: true });
const monthly = (page, y) => page.getByRole("heading", { name: `${y}년 월별 일평균`, exact: true });
function checkAnnualBody(body) {
  const a = body.annual;
  assert.ok(a, "annual present");
  projectionOnly(a, ANNUAL_KEYS, "annual");
  assert.equal(a.regionCode, "52750");
  assert.deepEqual(a.years.map(y => [y.year, y.local, y.outside, y.total]), ANNUAL_YEARS.map(y => [y, ANNUAL[y].local, ANNUAL[y].outside, ANNUAL[y].total]), "annual equals original source values");
  return a;
}
async function pressed(group) { return group.getByRole("button", { pressed: true }).allInnerTexts(); }

async function newFestival({ page }) {
  let body = served(page, "new/visits");
  await page.goto(`${base}/new/52750/visits`);
  const firstAnswer = await body;
  const annual = checkAnnualBody(firstAnswer);
  const defaultYear = firstAnswer.year;
  await visible(monthly(page, defaultYear));
  await visible(annualSection(page).getByText("2018–2025 · 임실군 전체 외지인 · 연간 합계(명) · 통신 기반 추정", { exact: true }));
  assert.doesNotMatch(await page.getByText(/^전북특별자치도 임실군 전체 외지인 방문 · /).innerText(), /명\/일/, "screen intro carries no single unit");
  const chartName = await annualSection(page).getByRole("img").getAttribute("aria-label");
  for (const y of ANNUAL_YEARS) assert.ok(chartName.includes(`${y}년 ${n0(ANNUAL[y].outside)}명`), `chart names ${y}`);
  await visible(annualSection(page).getByText(`파란 막대 ${defaultYear}년: 위 월별 그래프 연도`, { exact: true }));
  assert.deepEqual((await yearGroup(page).getByRole("button").allInnerTexts()).sort(), ["2023년", "2024년", "2025년"], "buttons only for years with complete daily data");
  assert.deepEqual(await pressed(yearGroup(page)), [`${defaultYear}년`]);

  await annualSection(page).getByRole("button", { name: "연도별 수치 표 보기", exact: true }).click();
  const table = annualSection(page).getByRole("table", { name: "연도별 방문 합계(명, 추정)" });
  await visible(table.getByRole("columnheader", { name: "내국인 전체", exact: true }));
  for (const y of ANNUAL_YEARS) assert.deepEqual(await rowCells(table, String(y)), [String(y), n0(ANNUAL[y].outside), n0(ANNUAL[y].local), n0(ANNUAL[y].total)], `table ${y}`);
  assert.deepEqual(await rowCells(table, "2024"), ["2024", "8,875,772", "4,046,486", "12,922,259"]);
  await keyboardDialog(page, annualSection(page).getByRole("button", { name: "연간 추세 출처 보기", exact: true }), "연도별 방문 합계 출처", "내려받은 날 2026-08-30");
  assert.doesNotMatch(await page.locator("main").innerText(), UNCONFIRMED);
  passed.push("annual-2018-2025-source-values-total-kept-table-source");

  // Each year button applies that year, clears the chosen month and focuses the monthly heading after its answer.
  const monthGroup = () => page.getByRole("group", { name: "일별 값을 볼 달", exact: true });
  for (const y of [2024, 2023, 2025]) {
    await monthGroup().getByRole("button").first().click();
    assert.equal((await pressed(monthGroup())).length, 1, "a month is chosen before switching");
    const held = y === defaultYear ? null : gate(is("new/visits", p => p.get("year") === String(y) && p.get("district") === "750"), `visits ${y}`);
    await yearButton(page, y).click();
    if (held) {
      await held.arrived;
      await waitParam(page, "year", String(y));
      assert.notEqual(await focusedId(page), "new-monthly-heading", `${y}: focus waits for the answer`);
      assert.equal(await page.evaluate(() => document.activeElement?.textContent), `${y}년`, `${y}: focus stays on the chosen year while loading`);
      assert.deepEqual(await pressed(yearGroup(page)), [`${y}년`], "chosen year pressed while loading");
      body = served(page, "new/visits", p => p.get("year") === String(y));
      await held.release();
      checkAnnualBody(await body);
    }
    await waitFocusId(page, "new-monthly-heading");
    await visible(monthly(page, y));
    assert.equal(new URL(page.url()).searchParams.get("year"), String(y));
    assert.deepEqual(await pressed(monthGroup()), [], `${y}: chosen month reset`);
    await visible(annualSection(page).getByText(`파란 막대 ${y}년: 위 월별 그래프 연도`, { exact: true }));
  }
  passed.push("annual-buttons-2023-2025-apply-year-reset-month-focus-after-answer");

  // A year without daily data keeps the yearly totals and says only the monthly/weekday data is missing.
  body = served(page, "new/visits", p => p.get("year") === "2019");
  await page.goto(`${base}/new/52750/visits?year=2019`);
  checkAnnualBody(await body);
  await visible(page.getByText("2019년 월·요일별 방문 자료가 없어요.", { exact: true }));
  await visible(annualSection(page));
  assert.equal(await page.getByRole("heading", { name: /월별 일평균$/ }).count(), 0);
  assert.equal(await page.getByText(/월별 그래프 연도/).count(), 0, "2019 is not labelled as the viewed graph");
  assert.deepEqual(await pressed(yearGroup(page)), []);
  await yearButton(page, 2025).click();
  await waitFocusId(page, "new-monthly-heading");
  await visible(monthly(page, 2025));
  passed.push("year-2019-keeps-annual-only");

  // Region change while this region's year answer is late: the other region never shows 임실 totals or moves focus.
  const late = gate(is("new/visits", p => p.get("year") === "2023" && p.get("district") === "750"), "Imsil 2023 late");
  await yearButton(page, 2023).click();
  await late.arrived;
  body = served(page, "new/visits", p => p.get("district") === "230");
  await page.getByRole("button", { name: "지역 바꾸기", exact: true }).click();
  const change = page.locator("#new-region-change");
  await change.getByRole("combobox", { name: /^시도/ }).selectOption({ label: "충청남도" });
  await change.getByRole("combobox", { name: /^시군구/ }).selectOption({ label: "논산시" });
  await change.getByRole("button", { name: "이 지역 보기", exact: true }).click();
  const nonsan = await body;
  assert.equal(nonsan.annual, null, "Nonsan has no yearly totals");
  await visible(monthly(page, 2023));
  await late.release();
  await flush(page);
  assert.equal(new URL(page.url()).pathname, "/new/44230/visits");
  assert.equal(await anyAnnual(page).count(), 0, "no 임실 totals under 논산");
  assert.notEqual(await focusedId(page), "new-monthly-heading", "late answer does not move focus");
  assert.match(await page.getByText(/^충청남도 논산시 전체 외지인 방문 · /).innerText(), /일평균 명\/일/, "unchanged intro without totals");
  passed.push("region-change-and-late-year-answer-isolated", "unsupported-region-no-annual");
  return annual;
}

// ---- 320 / 390 / desktop ----
async function layouts() {
  for (const [width, height] of [[320, 740], [390, 844], [1440, 1000]]) {
    const { context, page } = await openContext({ width, height });
    await page.goto(visitsPath(IMSIL_ID, `?editions=${ed(2024)},${ed(2025)}`));
    await visible(host(page));
    await host(page).getByRole("button", { name: "기간 합계 표 보기", exact: true }).click();
    await noPageOverflow(page, `${width} festival composition`);
    await host(page).screenshot({ path: new URL(`visitor-context-host-${width}.png`, outDir).pathname });
    await page.goto(`${base}/new/52750/visits?year=2025`);
    await visible(annualSection(page));
    await annualSection(page).getByRole("button", { name: "연도별 수치 표 보기", exact: true }).click();
    await noPageOverflow(page, `${width} annual totals`);
    await annualSection(page).screenshot({ path: new URL(`visitor-context-annual-${width}.png`, outDir).pathname });
    await context.close();
  }
  passed.push("320-390-desktop-no-page-overflow");
}

try {
  const a = await openContext();
  await existingFestival(a);
  await a.context.close();
  const b = await openContext();
  await newFestival(b);
  await b.context.close();
  await layouts();
  assert.equal(queue.length, 0, `unused gates: ${queue.length}`);
  assert.deepEqual(writes, [], "no same-origin non-GET request");
  assert.deepEqual(errors, [], "no page errors");
  assert.deepEqual(consoleErrors, [], "no console errors");
  assert.equal(controlledFailures, 1, "exactly one controlled failure");
  const summary = { headless: true, realLocalData: ["existing/history", "new/visits"], controlled: "request gates on real answers; one aborted request (검증용 통제 실패)",
    syntheticData: false, passed, blockedOtherHosts: [...new Set(blocked)], browserErrors: errors.length, clientWrites: writes.length };
  writeFileSync(new URL("visitor-context-e2e.json", outDir), `${JSON.stringify(summary, null, 2)}\n`);
  console.log(JSON.stringify(summary));
} finally {
  await browser.close();
}
