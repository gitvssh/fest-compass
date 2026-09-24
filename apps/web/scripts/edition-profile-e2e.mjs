// pickDday edition visitor profile acceptance, headless: 임실N치즈축제 prior editions (2023, 2024) next to 2025 inside
// 과거 방문 흐름. Two selected editions show one ascending two-year comparison, one selected edition its single profile,
// and a festival without a reviewed profile shows no section.
//
// Data provenance is explicit per check:
//  - REAL LOCAL DATA: /api/existing/history passes through the local server untouched. Expected values are read here
//    directly from the three imported official snapshots (docs/research/imported/datalab-imsil-2023, -2024, -2025), never
//    through app code; the comparison (union order, rank change, percentage points) is recomputed here independently.
//  - HOST COMPOSITION CHANGE: expected text comes from the same answer's hostVisits numbers (their source values are
//    checked by visitor-context-e2e.mjs); only the displayed one-decimal arithmetic and wording are checked here.
//  - RESOURCES: by default, the live server list passes through untouched. Local full regression explicitly sets
//    VISITOR_PROFILE_RESOURCES=fixture (localhost only): a controlled list of the three reviewed place identities.
//  - No synthetic visitor values, request gates or aborted requests. Requests to other hosts are blocked and counted.
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

// ---- Independent oracle: the three imported official snapshots ----
const IMPORTED = new URL("../../../docs/research/imported/", import.meta.url);
const YEARS = [2023, 2024, 2025];
const GROUP_LABEL = { outside: "외지인", local: "현지인", all: "전체" };
const AGE_BANDS = ["0~9세", "10~19세", "20~29세", "30~39세", "40~49세", "50~59세", "60~69세", "70세 이상"];
const SEX = [["malePercent", "남성", "남"], ["femalePercent", "여성", "여"]];
function snapshotOracle(year) {
  const read = name => JSON.parse(readFileSync(new URL(`datalab-imsil-${year}/${name}`, IMPORTED), "utf8"));
  const manifest = read("manifest.json"), demoRows = read("original/demographics.json").list;
  const destRows = read("original/destinations.json").list, links = read("resource-links.json"), o = manifest.observation;
  assert.deepEqual([o.year, o.areaCode, o.regionCode, manifest.residenceVisible, links.year], [year, "52750340", "52750", false, year], `oracle ${year}: reviewed area, no residence`);
  assert.ok(demoRows.length === 8 && demoRows.every(r => r.FSTV_ID === "KCTF0061" && r.DISP_YN === "N"), `oracle ${year}: eight public percentage bands`);
  const demographics = [...demoRows].sort((a, b) => a.SORT_STR - b.SORT_STR).map(r => ({ ageBand: r.AGEG_DIV_NM, malePercent: r.M_TOU_NUM_RAT, femalePercent: r.W_TOU_NUM_RAT }));
  assert.deepEqual(demographics.map(d => d.ageBand), AGE_BANDS, `oracle ${year}: chronological bands`);
  assert.ok(Math.abs(demographics.reduce((s, d) => s + d.malePercent + d.femalePercent, 0) - 100) <= 0.8 + 1e-9, `oracle ${year}: shares add up to 100`);
  const linked = new Map(links.links.map(l => [l.destinationId, { id: l.resource.id, kind: l.resource.kind, title: l.resource.title }]));
  const ranks = Object.fromEntries(Object.entries(GROUP_LABEL).map(([group, label]) => [group, destRows.filter(r => r.DIV_NM === label).sort((a, b) => a.ROWNUM - b.ROWNUM)
    .map(r => ({ id: r.ITS_BRO_ID, rank: r.ROWNUM, name: r.ITS_BRO_NM, address: r.ADDR_ROAD_NM, category: r.KTO_CATE_SCLS_NM, resource: linked.get(r.ITS_BRO_ID) ?? null }))]));
  for (const [group, rows] of Object.entries(ranks)) assert.ok(rows.length > 0 && new Set(rows.map(r => r.id)).size === rows.length, `oracle ${year}: ${group} distinct places`);
  const counts = [...destRows.map(r => r.SRCH_CNT).filter(v => v >= 100), ...demoRows.flatMap(r => [r.M_TOT, r.W_TOT]).map(v => Math.trunc(v))].map(String);
  return { year, start: o.start, end: o.end, days: o.days, areaName: o.areaName, demographics, ranks, counts, links };
}
const ORACLE = Object.fromEntries(YEARS.map(y => [y, snapshotOracle(y)]));
assert.deepEqual(YEARS.map(y => [ORACLE[y].start, ORACLE[y].end, ORACLE[y].days]),
  [["2023-10-06", "2023-10-09", 4], ["2024-10-03", "2024-10-06", 4], ["2025-10-08", "2025-10-12", 5]], "oracle: original periods");
assert.ok(YEARS.every(y => ORACLE[y].areaName === "임실군 성수면"), "oracle: one reviewed area for every edition");
const nameOf = (year, id) => ORACLE[year].ranks.outside.find(r => r.id === id)?.name;
assert.ok(nameOf(2024, "173403") && nameOf(2025, "173403") && nameOf(2024, "173403") !== nameOf(2025, "173403"), "oracle: one place renamed in 2025, same ID");

const pct = v => `${v.toFixed(1)}%`;
const signed = v => `${v > 0 ? "+" : v < 0 ? "-" : ""}${Math.abs(v).toFixed(1)}`;
/** Published one-decimal shares as whole tenths, then the difference in percentage points. */
const pointChange = (before, after) => (Math.round(after * 10) - Math.round(before * 10)) / 10;
const rankText = r => (r === null ? "—" : `${r}위`);
const changeText = c => (c === null ? "—" : c > 0 ? `${c}위 상승` : c < 0 ? `${-c}위 하락` : "같음");
const sd = d => `${Number(d.slice(5, 7))}.${Number(d.slice(8, 10))}`;
const n1 = v => v.toLocaleString("ko-KR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const tenths = v => Math.round(Number(v.toFixed(1)) * 10);
const periodLine = ([a, b]) => [a, b].map(y => `${y}년 ${sd(ORACLE[y].start)}–${sd(ORACLE[y].end)} ${ORACLE[y].days}일`).join(" · ");

/** Union by exact place ID: the later year's order, then places only in the earlier year; latest name/address/link. */
function expectedRows(before, after, group) {
  const older = ORACLE[before].ranks[group], newer = ORACLE[after].ranks[group];
  const rows = newer.map(n => {
    const o = older.find(x => x.id === n.id);
    return { ...n, beforeRank: o?.rank ?? null, afterRank: n.rank, rankChange: o ? o.rank - n.rank : null };
  });
  for (const o of older) if (!newer.some(n => n.id === o.id)) rows.push({ ...o, beforeRank: o.rank, afterRank: null, rankChange: null });
  return rows;
}
const sample = expectedRows(2024, 2025, "outside");
assert.ok(sample.some(r => r.rankChange > 0) && sample.some(r => r.rankChange < 0) && sample.some(r => r.rankChange === 0), "oracle: 2024→2025 has up, down and same");
assert.ok(sample.some(r => r.beforeRank === null) && sample.some(r => r.afterRank === null), "oracle: 2024→2025 has a new and a dropped place");
assert.notDeepEqual(expectedRows(2024, 2025, "local").map(r => r.beforeRank), sample.map(r => r.beforeRank), "oracle: older ranks differ by group even when latest order is the same");

const REVIEWED = ORACLE[2025].links.links;
const TITLE = { themepark: "임실치즈테마파크", sangiam: "상이암(임실)", sochungsa: "소충사" }, ID = { themepark: "2718832", sangiam: "317571", sochungsa: "527279" };
assert.deepEqual(REVIEWED.map(l => l.resource.id).sort(), Object.values(ID).sort(), "oracle: three reviewed resource links");
function resourceFixture(p) {
  if (p.get("province") !== "52" || p.get("district") !== "750") return null;
  const types = (p.get("types") ?? "12,14").split(","), checkedAt = ORACLE[2025].links.checkedAt;
  return { key: JSON.stringify(["resources", "52", "750", types]), request: { province: "52", district: "750", types }, retrievedAt: checkedAt,
    region: { province: "52", district: "750", code: "52750", name: "전북특별자치도 임실군", districtName: "임실군" },
    byType: types.map(kind => ({ kind, label: kind === "12" ? "관광지" : "문화시설", error: null, collectedAt: checkedAt,
      status: kind === "12" ? "complete" : "empty", total: kind === "12" ? REVIEWED.length : 0, items: kind === "12" ? REVIEWED.map(l => l.resource) : [] })) };
}

const PROFILE_KEYS = ["areaName", "demographics", "destinationGroups", "editionId", "end", "source", "start", "year"];
const INTERNAL = ["sha256", "evidence", "docs/research", "/original/", "manifest", "SRCH_CNT", "M_TOT", "W_TOT", "DISP_YN", "\"raw\"", "count", "checkedAt"];
const INTERNAL_DOM = [...INTERNAL, "검증", "검토", "정책", "통제", "reviewed", "resolver", "fixture", "datalab-imsil"];
const UNWANTED_TEXT = /방문자 수|함께 방문|\d명|검증|sha256|evidence/;
const THREE_EDITIONS = /세 (개|회차)|최대 ?3|3개까지|3개 이상|셋째/;

// ---- Browser plumbing: history always passes through; resources pass through unless the local fixture is chosen ----
const passed = [], errors = [], consoleErrors = [], writes = [], platformWrites = [], blocked = [];
let controlledAnswers = 0;
async function onApi(route) {
  const url = new URL(route.request().url()), fixture = controlledResources && url.pathname === "/api/existing/resources" ? resourceFixture(url.searchParams) : null;
  try {
    if (fixture) { controlledAnswers += 1; await route.fulfill({ json: fixture }); } else await route.continue();
  } catch { /* the page superseded or left this request */ }
}
const browser = await chromium.launch({ headless: true });
async function openContext(viewport = { width: 1440, height: 1000 }) {
  const context = await browser.newContext({ viewport, locale: "ko-KR" });
  await context.route(u => u.origin !== origin, route => { blocked.push(new URL(route.request().url()).host); return route.abort("blockedbyclient"); });
  await mockMapTiles(context); // registered later, so it answers tile requests before the block above
  await context.route(u => u.origin === origin && u.pathname.startsWith("/api/"), onApi);
  const page = await context.newPage();
  // On the public origin, dismiss the existing analytics consent dialog through its ordinary refusal button.
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
async function insideViewport(locator, width, label) {
  const box = await locator.boundingBox();
  assert.ok(box && box.x >= 0 && box.x + box.width <= width + 0.5, `${label}: inside the ${width}px viewport`);
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
const visitsUrl = (years, id = IMSIL) => `${base}/existing/${encodeURIComponent(id)}/visits${years ? `?editions=${years.map(ed).join(",")}` : ""}`;
const comparison = (page, [a, b]) => page.getByRole("region", { name: `방문자 특성 · ${a}년과 ${b}년`, exact: true });
const single = (page, year) => page.getByRole("region", { name: `${year}년 방문자 특성`, exact: true });
const anyProfile = page => page.getByRole("region", { name: /방문자 특성/ });
const host = page => page.getByRole("region", { name: "축제가 열린 읍·면·동의 방문 구성", exact: true });
const hostChange = (page, [a, b]) => host(page).getByRole("region", { name: `${a}년과 ${b}년 비교`, exact: true });
const anyHostChange = page => host(page).getByRole("region", { name: /^\d{4}년과 \d{4}년 비교$/ });
const rankRegion = section => section.getByRole("region", { name: "축제 기간 목적지 검색순위", exact: true });
const groupButton = (section, label) => rankRegion(section).getByRole("group", { name: "검색한 사람 구분", exact: true }).getByRole("button", { name: label, exact: true });
const picker = (page, year) => page.getByRole("checkbox", { name: new RegExp(`^${year}년 · `) });
const editionsAre = years => p => (p.get("editions") ?? "").split(",").sort().join() === years.map(ed).sort().join();
const detail = page => page.locator("#resource-detail-heading");
async function pick(page, years) {
  for (const y of YEARS) if (!years.includes(y) && await picker(page, y).isChecked()) await picker(page, y).click();
  for (const y of years) if (!await picker(page, y).isChecked()) await picker(page, y).click();
  await page.getByRole("button", { name: "적용", exact: true }).first().click();
}
/** The linked-resource checks need the list holding the three reviewed places (live, or the local controlled list). */
function realList(body) {
  const block = body.byType?.find(b => b.kind === "12");
  if (block?.status !== "complete") throw new Error("The server's current 임실군 관광지 list is unavailable (tourism provider key or provider outage); linked-resource checks need the list.");
  for (const [key, id] of Object.entries(ID)) assert.equal(block.items.find(i => i.id === id)?.title, TITLE[key], `list holds ${TITLE[key]}`);
}

// ---- API checks: exact public projection per selected edition, ascending, nothing unselected ----
function checkEdition(vp, year) {
  const o = ORACLE[year];
  assert.deepEqual(Object.keys(vp).sort(), PROFILE_KEYS, `${year}: only the public fields`);
  assert.deepEqual([vp.editionId, vp.year, vp.start, vp.end, vp.areaName], [ed(year), year, o.start, o.end, o.areaName], `${year}: edition, original period, area`);
  assert.deepEqual(vp.demographics, o.demographics, `${year}: published shares in source order`);
  assert.deepEqual(vp.destinationGroups.map(g => g.group).sort(), ["all", "local", "outside"], `${year}: three rank groups`);
  for (const g of vp.destinationGroups) {
    assert.deepEqual(Object.keys(g).sort(), ["group", "items", "label"]);
    assert.equal(g.label, GROUP_LABEL[g.group]);
    for (const i of g.items) {
      assert.deepEqual(Object.keys(i).sort(), ["address", "category", "id", "name", "rank", "resource"]);
      if (i.resource) assert.deepEqual(Object.keys(i.resource).sort(), ["id", "kind", "title"]);
    }
    assert.deepEqual(g.items, o.ranks[g.group], `${year} ${g.group}: source rows and reviewed links only`);
  }
  assert.deepEqual(Object.keys(vp.source).sort(), ["collectedAt", "title", "url"]);
  assert.match(vp.source.url, /^https:\/\/datalab\.visitkorea\.or\.kr\//, `${year}: official public source page`);
}
function checkSelection(body, years) {
  const selection = body.visitorProfile;
  if (!years.length) { assert.equal(selection, null, "no reviewed profile: null"); return null; }
  assert.ok(selection, "visitorProfile present");
  assert.deepEqual(Object.keys(selection), ["editions"], "selection wrapper only");
  assert.deepEqual(selection.editions.map(e => e.year), years, "the selected editions only, ascending");
  selection.editions.forEach((vp, i) => checkEdition(vp, years[i]));
  const text = JSON.stringify(selection);
  for (const word of INTERNAL) assert.ok(!text.includes(word), `visitorProfile: no internal ${word}`);
  for (const n of years.flatMap(y => ORACLE[y].counts)) assert.doesNotMatch(text, new RegExp(`\\b${n}\\b`), `visitorProfile: no count ${n}`);
  return selection;
}

// ---- Screen checks ----
async function checkSectionBoundary(section, years, label) {
  const text = await section.innerText();
  assert.doesNotMatch(text, UNWANTED_TEXT, `${label}: no headcount, co-visit or internal wording`);
  assert.doesNotMatch(text, /거주지|사는 곳/, `${label}: no residence card`);
  assert.doesNotMatch(text, THREE_EDITIONS, `${label}: no three-edition explanation`);
  for (const n of years.flatMap(y => ORACLE[y].counts)) assert.doesNotMatch(text, new RegExp(`\\b${n}\\b`), `${label}: no count ${n} on screen`);
  assert.doesNotMatch(await rankRegion(section).innerText(), /방문/, `${label}: ranking never speaks of visits`);
  const html = await section.evaluate(el => el.outerHTML);
  for (const word of INTERNAL_DOM) assert.ok(!html.includes(word), `${label}: no internal ${word} in the DOM`);
  assert.equal(await section.locator("input, textarea, select, form").count(), 0, `${label}: nothing to fill in or record`);
}

async function checkBars(section, [a, b]) {
  const demo = section.getByRole("region", { name: "성·연령별 비율", exact: true });
  const pairs = AGE_BANDS.map((band, i) => ({ band, before: ORACLE[a].demographics[i], after: ORACLE[b].demographics[i] }));
  const max = Math.max(5, Math.ceil(Math.max(...pairs.flatMap(p => [p.before, p.after].flatMap(d => [d.malePercent, d.femalePercent]))) / 5) * 5);
  const chart = demo.getByRole("img");
  assert.equal(await chart.getAttribute("aria-label"), `성·연령별 비율, 내국인 방문자 전체 중, ${a}년과 ${b}년. ${pairs.map(p =>
    `${p.band} ${SEX.map(([key, label]) => `${label} ${a}년 ${pct(p.before[key])}, ${b}년 ${pct(p.after[key])}`).join(", ")}`).join("; ")}`, "chart label: both years, both sexes");
  await visible(demo.getByText(`연한 색 ${a}년 · 진한 색 ${b}년`, { exact: true }));
  const shown = await chart.innerText();
  assert.ok(shown.includes("0%") && shown.includes(`${max}%`), `one shared axis 0–${max}% for both years`);
  const positions = AGE_BANDS.map(band => shown.indexOf(band));
  assert.ok(positions.every((p, i) => p >= 0 && (i === 0 || p > positions[i - 1])), "bands in chronological order");
  const rows = await chart.evaluate(el => [...el.querySelectorAll("[data-bar]")].map(r => {
    const fill = r.querySelector(".h-full");
    return { key: r.dataset.bar, texts: [...r.children].map(c => c.textContent.trim()), ratio: fill.getBoundingClientRect().width / fill.parentElement.getBoundingClientRect().width, color: getComputedStyle(fill).backgroundColor };
  }));
  const want = pairs.flatMap(p => SEX.flatMap(([key, , short]) => [[a, p.before[key]], [b, p.after[key]]].map(([year, value]) => ({ key: `${key}-${year}`, texts: [`${short} ${year}`, "", pct(value)], value }))));
  assert.equal(rows.length, 32, "two year bars per sex in every band");
  rows.forEach((r, i) => {
    assert.equal(r.key, want[i].key, `bar ${i} order`);
    assert.deepEqual(r.texts, want[i].texts, `bar ${i}: year label and published value`);
    assert.ok(Math.abs(r.ratio - want[i].value / max) < 0.01, `bar ${i} on the shared scale`);
  });
  for (const [key] of SEX) {
    const colors = year => [...new Set(rows.filter(r => r.key === `${key}-${year}`).map(r => r.color))];
    assert.equal(colors(a).length, 1, `${key} ${a}: one color`);
    assert.equal(colors(b).length, 1, `${key} ${b}: one color`);
    assert.notEqual(colors(a)[0], colors(b)[0], `${key}: the two years are told apart`);
  }
  assert.doesNotMatch(await demo.innerText(), /%p|(^|\s)[+-]\d|\d위/, "chart shows both values, never a bare change");
}

async function checkRanks(section, [a, b]) {
  const ranks = rankRegion(section);
  assert.equal(await groupButton(section, "외지인").getAttribute("aria-pressed"), "true", "외지인 first");
  for (const group of ["outside", "local", "all", "outside"]) {
    const label = GROUP_LABEL[group];
    await groupButton(section, label).click();
    for (const other of Object.values(GROUP_LABEL)) assert.equal(await groupButton(section, other).getAttribute("aria-pressed"), String(other === label));
    const list = ranks.getByRole("list", { name: `${label} 목적지 검색순위 · ${a}년과 ${b}년`, exact: true });
    await visible(list);
    const want = expectedRows(a, b, group);
    const shown = await list.evaluate(el => [...el.children].map(li => ({
      ps: [...li.querySelectorAll(":scope > p")].map(p => p.textContent.trim()),
      terms: [...li.querySelectorAll("dt")].map(d => d.textContent.trim()), values: [...li.querySelectorAll("dd")].map(d => d.textContent.trim()),
      links: [...li.querySelectorAll("a")].map(x => ({ label: x.getAttribute("aria-label"), href: x.getAttribute("href"), target: x.dataset.rankLink })),
    })));
    assert.equal(shown.length, want.length, `${a}+${b} ${label}: union of both years`);
    shown.forEach((row, i) => {
      const w = want[i], at = `${a}+${b} ${label} row ${i + 1}`;
      assert.deepEqual(row.ps, [w.name, `${w.category} · ${w.address}`], `${at}: latest name and address`);
      assert.deepEqual(row.terms, [`${a}년`, `${b}년`, "변화"], `${at}: labelled columns`);
      assert.deepEqual(row.values, [rankText(w.beforeRank), rankText(w.afterRank), changeText(w.rankChange)], `${at}: both ranks and the change`);
      assert.equal(row.links.length, w.resource ? 1 : 0, `${at}: link only for a reviewed place`);
      if (w.resource) {
        assert.equal(row.links[0].label, `${w.resource.title} 관광자원에서 보기`);
        assert.equal(row.links[0].target, `${group}:${w.id}`);
        const href = new URL(row.links[0].href, base);
        assert.equal(href.pathname, `/existing/${encodeURIComponent(IMSIL)}/resources`);
        assert.equal(href.searchParams.get("resource"), `${w.resource.kind}:${w.resource.id}`);
        assert.equal(href.searchParams.get("types"), "12");
      }
    });
    const targets = await section.evaluate(el => [...el.querySelectorAll("[data-rank-link]")].map(x => x.dataset.rankLink));
    assert.deepEqual(targets, want.filter(w => w.resource).map(w => `${group}:${w.id}`), `${label}: one link per group and place`);
  }
}

async function checkTable(page, section, [a, b]) {
  const opener = section.getByRole("button", { name: "성·연령 비율 표 보기", exact: true }), handle = await opener.elementHandle();
  await opener.focus();
  await page.keyboard.press("Enter");
  const table = section.getByRole("table", { name: `성·연령별 비율(%, 내국인 방문자 전체 중) · 변화 = ${b}년 − ${a}년(%p)`, exact: true });
  await visible(table);
  assert.deepEqual((await table.getByRole("columnheader").allInnerTexts()).map(s => s.trim()),
    ["연령대", ...SEX.flatMap(([, label]) => [`${label} ${a}년(%)`, `${label} ${b}년(%)`, `${label} 변화(%p)`])], "labelled before/after/%p columns");
  for (const [i, band] of AGE_BANDS.entries()) {
    const x = ORACLE[a].demographics[i], y = ORACLE[b].demographics[i];
    assert.deepEqual(await rowCells(table, band), [band, ...SEX.flatMap(([key]) => [x[key].toFixed(1), y[key].toFixed(1), signed(pointChange(x[key], y[key]))])], `${band}: values and %p`);
  }
  await page.keyboard.press("Tab");
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute("aria-label")), "성·연령별 비율 비교 표", "keyboard reaches the table");
  await handle.focus();
  await page.keyboard.press("Enter");
  await table.waitFor({ state: "hidden" });
}

async function checkSource(page, section, [a, b]) {
  const oa = ORACLE[a], ob = ORACLE[b];
  await keyboardDialog(page, section.getByRole("button", { name: "방문자 특성 출처 보기", exact: true }), "방문자 특성 출처", "%p는 두 해 비율의 차이예요.", async dialog => {
    const text = await dialog.innerText();
    for (const s of [`${a}년(${a}.${sd(oa.start)}–${sd(oa.end)}, ${oa.days}일)과 ${b}년(${b}.${sd(ob.start)}–${sd(ob.end)}, ${ob.days}일)`, "축제장 입장객 수가 아니에요.",
      `${b}년 비율에서 ${a}년 비율을 뺐어요.`, "순위의 —는 그 해 공개된 순위에 없던 장소예요.", "음식점·숙박은 빠져 있어요."]) assert.ok(text.includes(s), `source dialog explains: ${s}`);
    const links = dialog.getByRole("link");
    assert.equal(await links.count(), 2, "one source per year");
    for (const [i, year] of [a, b].entries()) {
      assert.match(await links.nth(i).getAttribute("href"), /^https:\/\/datalab\.visitkorea\.or\.kr\//);
      assert.ok((await links.nth(i).locator("..").innerText()).startsWith(`${year}년 자료:`), `${year} source labelled`);
    }
    const html = await dialog.evaluate(el => el.outerHTML);
    for (const word of INTERNAL_DOM) assert.ok(!html.includes(word), `source dialog: no internal ${word}`);
  });
}

async function checkComparison(page, body, years) {
  const [a, b] = years, section = comparison(page, years);
  checkSelection(body, years);
  await visible(section);
  assert.equal(await anyProfile(page).count(), 1, "exactly one profile section");
  await visible(section.getByText(periodLine(years), { exact: true }));
  await visible(section.getByText(`${ORACLE[b].areaName} · 내국인 · 통신 기반 추정`, { exact: true }));
  await checkBars(section, years);
  await checkRanks(section, years);
  await checkTable(page, section, years);
  await checkSource(page, section, years);
  await checkSectionBoundary(section, years, `${a}+${b}`);
}

async function checkHostChange(page, body, [a, b]) {
  const [x, y] = [a, b].map(year => body.hostVisits?.editions.find(e => e.year === year));
  assert.ok(x && y, "host composition holds both editions");
  const region = hostChange(page, [a, b]);
  await visible(region);
  const dd = term => region.locator("dt").filter({ hasText: new RegExp(`^${term}$`) }).locator("xpath=following-sibling::dd[1]");
  const daily = (tenths(y.dailyMean) - tenths(x.dailyMean)) / 10, share = (tenths(y.outsideShare * 100) - tenths(x.outsideShare * 100)) / 10;
  const sign = v => (v > 0 ? "+" : v < 0 ? "-" : "");
  assert.equal((await dd("하루 평균").innerText()).trim(), `${a}년 ${n1(x.dailyMean)}명/일 → ${b}년 ${n1(y.dailyMean)}명/일 · ${sign(daily)}${n1(Math.abs(daily))}명/일`, "daily mean change from the shown values");
  assert.equal((await dd("외지인 비율").innerText()).trim(), `${a}년 ${pct(x.outsideShare * 100)} → ${b}년 ${pct(y.outsideShare * 100)} · ${sign(share)}${Math.abs(share).toFixed(1)}%p`, "outside share change in %p");
  const text = await region.innerText();
  assert.ok(text.includes("외국인을 포함한 방문 추정이에요."), "population includes foreign visitors");
  assert.doesNotMatch(text, /때문|효과|덕분|입장객 수가 (늘|줄)/, "no causal or admission claim");
  const items = host(page).getByRole("listitem");
  const shownYears = body.hostVisits.editions.map(e => e.year).sort();
  assert.equal(await items.count(), shownYears.length, "existing per-edition rows kept");
  assert.deepEqual((await items.allInnerTexts()).map(t => Number(t.slice(0, 4))).sort(), shownYears);
}

async function checkSingle(page, body, year) {
  const o = ORACLE[year], section = single(page, year);
  checkSelection(body, [year]);
  await visible(section);
  assert.equal(await anyProfile(page).count(), 1, "exactly one profile section");
  await visible(section.getByText(`${year}.${sd(o.start)}–${sd(o.end)} · ${o.areaName} · 내국인 · 통신 기반 추정`, { exact: true }));
  assert.equal(await section.getByRole("region", { name: "성·연령별 비율", exact: true }).getByRole("img").getAttribute("aria-label"),
    `성·연령별 비율, 내국인 방문자 전체 중. ${o.demographics.map(d => `${d.ageBand} 남성 ${pct(d.malePercent)}, 여성 ${pct(d.femalePercent)}`).join("; ")}`, `${year}: published shares`);
  const rows = rankRegion(section).getByRole("list", { name: "외지인 목적지 검색순위", exact: true }).getByRole("listitem");
  assert.equal(await rows.count(), o.ranks.outside.length, `${year}: 외지인 rows`);
  for (const [i, want] of o.ranks.outside.entries()) {
    await visible(rows.nth(i).getByText(`${want.rank}위`, { exact: true }));
    await visible(rows.nth(i).getByText(want.name, { exact: true }));
    assert.equal(await rows.nth(i).getByRole("link").count(), want.resource ? 1 : 0, `${year} ${want.name}: link only when reviewed`);
  }
  assert.equal(await anyHostChange(page).count(), 0, "one edition: no host change summary");
  await checkSectionBoundary(section, [year], `${year} single`);
}

// ---- 1. Initial controls, 2024+2025 comparison, chart window, query order, host change ----
async function initialComparison({ page }) {
  const years = [2024, 2025];
  let body = served(page, "existing/history");
  await page.goto(visitsUrl(null));
  const first = await body;
  assert.deepEqual(first.editions.map(e => e.editionId).sort(), years.map(ed), "default: the latest two editions");
  await visible(comparison(page, years));
  assert.deepEqual(await Promise.all(YEARS.map(y => picker(page, y).isChecked())), [false, true, true], "initial controls: 2024 and 2025 selected");
  assert.equal(await page.getByRole("checkbox", { name: /^\d{4}년 · /, checked: true }).count(), 2, "initial controls: at most two selected");
  assert.doesNotMatch(await page.locator("body").innerText(), THREE_EDITIONS, "no three-edition explanation");
  passed.push("initial-controls-latest-two-no-three-explanation");

  await checkComparison(page, first, years);
  passed.push("2024-2025-values-shared-axis-differences-rank-order-null-groups-table-source");
  await checkHostChange(page, first, years);
  const hostBox = await host(page).boundingBox(), profileBox = await comparison(page, years).boundingBox();
  assert.ok(hostBox && profileBox && hostBox.y < profileBox.y, "comparison follows the host composition");
  passed.push("host-change-shown-values-foreign-included-rows-kept");

  // A custom chart window changes nothing in the comparison.
  const card = page.getByRole("listitem").filter({ has: page.getByRole("heading", { name: /^2024년 · 10\.3–10\.6/ }) });
  await card.getByRole("button", { name: "표시 기간 바꾸기", exact: true }).click();
  await card.getByLabel("표시 시작일").fill("2024-09-15");
  await card.getByLabel("표시 종료일").fill("2024-10-20");
  body = served(page, "existing/history", p => (p.get("windows") ?? "").includes(ed(2024)));
  await card.getByRole("button", { name: "적용", exact: true }).click();
  const windowed = await body;
  assert.deepEqual(windowed.visitorProfile, first.visitorProfile, "window change leaves the comparison unchanged");
  await visible(comparison(page, years).getByText(periodLine(years), { exact: true }));
  passed.push("chart-window-independent");

  // Selected editions in either query order: one ascending comparison.
  body = served(page, "existing/history");
  await page.goto(`${base}/existing/${encodeURIComponent(IMSIL)}/visits?editions=${ed(2025)},${ed(2024)}`);
  checkSelection(await body, years);
  await visible(comparison(page, years));
  assert.equal(await anyProfile(page).count(), 1);
  passed.push("query-order-ascending");
}

// ---- 2. Links from the comparison: resource selection, back with conditions, group and focus ----
async function comparisonLinks({ page }) {
  const years = [2024, 2025], section = comparison(page, years), link = (title, list = rankRegion(section)) => list.getByRole("link", { name: `${title} 관광자원에서 보기`, exact: true });
  await page.goto(visitsUrl(years));
  await visible(section);
  let list = served(page, "existing/resources", p => p.get("types") === "12");
  await link(TITLE.themepark).click();
  realList(await list);
  await waitFocusId(page, "resource-detail-heading");
  assert.equal(await detail(page).innerText(), TITLE.themepark);
  await waitNoParam(page, "resource");
  await page.goBack();
  await visible(section);
  assert.equal(param(page, "editions"), years.map(ed).join(","), "back keeps the selected editions");
  await page.waitForFunction(() => document.activeElement?.getAttribute("data-rank-link") === "outside:2773331");
  passed.push("link-selects-resource-back-keeps-editions-and-focus");

  // Keyboard group change, then a place ranked only in 2025 keeps its link; back restores group and focus.
  const local = groupButton(section, "현지인");
  await local.focus();
  await page.keyboard.press("Space");
  assert.equal(await local.getAttribute("aria-pressed"), "true", "keyboard group change");
  list = served(page, "existing/resources", p => p.get("types") === "12");
  await link(TITLE.sochungsa).click();
  realList(await list);
  await waitFocusId(page, "resource-detail-heading");
  assert.equal(await detail(page).innerText(), TITLE.sochungsa);
  await page.goBack();
  await visible(section);
  assert.equal(await groupButton(section, "현지인").getAttribute("aria-pressed"), "true", "chosen group kept");
  await page.waitForFunction(() => document.activeElement?.getAttribute("data-rank-link") === "local:725050");
  passed.push("keyboard-group-new-place-link-back-keeps-group-and-focus");
}

// ---- 3. Other pairs, one earlier edition, other festival ----
async function otherSelections({ page }) {
  let body = served(page, "existing/history");
  await page.goto(visitsUrl([2023, 2024, 2025]));
  const three = await body;
  assert.equal(three.editions.length, 3, "all three history editions kept");
  await checkComparison(page, three, [2024, 2025]);
  await checkHostChange(page, three, [2024, 2025]);
  assert.equal(await page.getByRole("checkbox", { name: /^\d{4}년 · /, checked: true }).count(), 3);
  await visible(comparison(page, [2024, 2025]).getByText("최근 두 회차", { exact: true }));
  await comparison(page, [2024, 2025]).getByRole("link", { name: "비교할 회차 바꾸기", exact: true }).click();
  await page.waitForFunction(() => document.activeElement?.id === "edition-picker");
  passed.push("three-selected-history-kept-latest-two-compared-picker-focus");
  body = served(page, "existing/history");
  await page.goto(visitsUrl([2023, 2024]));
  let answer = await body;
  await checkComparison(page, answer, [2023, 2024]);
  await checkHostChange(page, answer, [2023, 2024]);
  await comparison(page, [2023, 2024]).screenshot({ path: new URL("edition-profile-2023-2024.png", outDir).pathname });
  passed.push("2023-2024-comparison");

  body = served(page, "existing/history", editionsAre([2023, 2025]));
  await pick(page, [2023, 2025]);
  answer = await body;
  await checkComparison(page, answer, [2023, 2025]);
  assert.equal(await comparison(page, [2023, 2024]).count(), 0, "earlier pair gone");
  assert.equal(param(page, "editions")?.split(",").sort().join(), [ed(2023), ed(2025)].join(), "address holds the selection");
  await checkHostChange(page, answer, [2023, 2025]);
  await comparison(page, [2023, 2025]).screenshot({ path: new URL("edition-profile-2023-2025.png", outDir).pathname });
  passed.push("2023-2025-comparison");

  body = served(page, "existing/history", editionsAre([2023]));
  await pick(page, [2023]);
  answer = await body;
  await checkSingle(page, answer, 2023);
  assert.equal(await single(page, 2025).count(), 0, "2025 absent");
  assert.equal(await page.getByRole("region", { name: /^방문자 특성 · / }).count(), 0, "no comparison for one edition");
  await single(page, 2023).screenshot({ path: new URL("edition-profile-2023-only.png", outDir).pathname });
  passed.push("2023-only-single-profile");

  body = served(page, "existing/history");
  await page.goto(visitsUrl(null, NONSAN));
  checkSelection(await body, []);
  await visible(page.getByRole("heading", { level: 2, name: "논산시 외지인 방문 추이", exact: true }));
  await flush(page);
  assert.equal(await anyProfile(page).count(), 0, "other festival: no profile section");
  passed.push("other-festival-no-section");
}

// ---- 4. 320 / 390 / desktop ----
async function layouts() {
  const years = [2024, 2025];
  for (const [width, height] of [[320, 740], [390, 844], [1440, 1000]]) {
    const { context, page } = await openContext({ width, height });
    await page.goto(visitsUrl(years));
    const section = comparison(page, years);
    await visible(section);
    await insideViewport(section.getByText(periodLine(years), { exact: true }), width, `${width} both periods and days`);
    const bars = await section.evaluate(el => [...el.querySelectorAll("[data-bar]")].map(r => {
      const boxes = [...r.children].map(c => c.getBoundingClientRect()), label = r.firstElementChild, value = r.lastElementChild;
      return { left: Math.min(...boxes.map(b => b.left)), right: Math.max(...boxes.map(b => b.right)), track: boxes[1].width,
        labelFits: label.scrollWidth <= label.clientWidth + 0.5, valueFits: value.scrollWidth <= value.clientWidth + 0.5, font: parseFloat(getComputedStyle(value).fontSize) };
    }));
    assert.equal(bars.length, 32, `${width}: every year bar rendered`);
    bars.forEach((b, i) => assert.ok(b.left >= 0 && b.right <= width && b.track >= 60 && b.labelFits && b.valueFits && b.font >= 12, `${width}: bar ${i} year label and value readable`));
    await insideViewport(rankRegion(section).getByRole("link", { name: `${TITLE.themepark} 관광자원에서 보기`, exact: true }), width, `${width} link`);
    await insideViewport(hostChange(page, years), width, `${width} host change`);
    await section.getByRole("button", { name: "성·연령 비율 표 보기", exact: true }).click();
    const scroller = section.getByRole("region", { name: "성·연령별 비율 비교 표", exact: true });
    await visible(scroller);
    await scroller.focus();
    for (let i = 0; i < 6; i += 1) await page.keyboard.press("ArrowRight");
    const overflow = await scroller.evaluate(el => el.scrollWidth > el.clientWidth);
    // Native keyboard scrolling can start on the next animation frame, after keyup has already returned.
    if (overflow) await page.waitForFunction(el => el.scrollLeft > 0, await scroller.elementHandle());
    await noPageOverflow(page, `${width} comparison`);
    await section.screenshot({ path: new URL(`edition-profile-2024-2025-${width}.png`, outDir).pathname });
    await hostChange(page, years).screenshot({ path: new URL(`edition-profile-host-change-${width}.png`, outDir).pathname });
    await context.close();
  }
  passed.push("320-390-1440-bars-values-periods-keyboard-table-no-page-overflow");
}

try {
  for (const flow of [initialComparison, comparisonLinks, otherSelections]) {
    const c = await openContext();
    await flow(c);
    await c.context.close();
  }
  await layouts();
  assert.deepEqual(writes, [], "no application non-GET request (Cloudflare measurement/consent recorded separately)");
  assert.deepEqual(errors, [], "no page errors");
  assert.deepEqual(consoleErrors, [], "no console errors");
  const summary = { headless: true, realLocalData: ["existing/history"], realCurrentResources: controlledResources ? [] : ["existing/resources"],
    resourceMode: controlledResources ? "검증용 통제: 검토한 세 장소의 식별자·주소·좌표만 이용한 목록" : "현재 공개 서비스의 실제 관광자원 목록",
    oracle: "docs/research/imported/datalab-imsil-2023, -2024, -2025 원본 응답에서 직접 계산", controlledResourceAnswers: controlledAnswers,
    syntheticVisitorData: false, passed, blockedOtherHosts: [...new Set(blocked)], browserErrors: errors.length, clientWrites: writes.length,
    platformWrites: platformWrites.length, platformBoundary: "Cloudflare measurement/consent transport; ordinary refusal button used when shown" };
  writeFileSync(new URL("edition-profile-e2e.json", outDir), `${JSON.stringify(summary, null, 2)}\n`);
  console.log(JSON.stringify(summary));
} finally {
  await browser.close();
}
