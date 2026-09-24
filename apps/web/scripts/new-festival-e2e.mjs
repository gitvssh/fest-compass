// UC-FC-010 pickDday new-festival journey acceptance (AC1–AC14), headless. Scenario: TS-FC-010.
//
// Data provenance is explicit per check:
//  - REAL ARCHIVE: /api/new/visits is fetched from the server unchanged (route.fetch → fulfilled with the same body) and
//    every expected month/weekday value is recomputed here from apps/web/data (latest-collected row per date), never
//    from app code. Holiday facts inside /api/existing/schedule come from the server's bundled calendar (route.fetch).
//  - 검증용 FIXTURES (UI semantics only, never presented as production provider results): tourism resources, resource
//    introductions, registered events, map tiles, one zero/missing variant of the Imsil 2023 visits response, and one
//    duplicate-holiday-label variant of one candidate schedule. Titles/sources carry "검증용"/"(가상)"; protocol keys are the
//    server's canonical keys (lib/existing/request.ts, lib/new-festival/request.ts) and never contain fixture words.
// Race ordering uses request gates (hold → release newer → release older); no sleeps decide ordering.
import assert from "node:assert/strict";
import { mkdirSync, readFileSync } from "node:fs";
import { chromium } from "playwright";
import { mockMapTiles } from "./map-test-tiles.mjs";

const base = process.env.E2E_BASE_URL ?? process.env.BASE_URL;
if (!base) throw new Error("E2E_BASE_URL (or BASE_URL) required");
const origin = new URL(base).origin;
const readData = name => JSON.parse(readFileSync(new URL(`../data/${name}`, import.meta.url), "utf8"));

// ---- Independent oracle over the checked-in archive (no app import) ----
const historyFile = readData("region-history.json"), expandedFile = readData("regional-history-expanded.json");
const calendarFile = readData("nonsan-calendar.json"), catalogue = readData("region-catalogue.json");
const WD = ["일", "월", "화", "수", "목", "금", "토"], MON_FIRST = [1, 2, 3, 4, 5, 6, 0];
const valid = v => typeof v === "number" && Number.isFinite(v) && v >= 0;
const weekdayOf = date => new Date(`${date}T00:00:00Z`).getUTCDay();
function datesOf(start, end) {
  const out = [];
  for (let t = Date.parse(`${start}T00:00:00Z`); t <= Date.parse(`${end}T00:00:00Z`); t += 86_400_000) out.push(new Date(t).toISOString().slice(0, 10));
  return out;
}
/** Latest-collected row per date for one region; an explicit latest `missing` stays missing (null). */
function archiveDaily(code, year) {
  const snaps = [...historyFile, ...expandedFile.datasets].filter(s => s.region.code === code).sort((a, b) => a.collectedAt.localeCompare(b.collectedAt));
  const pick = new Map();
  for (const s of snaps) for (const p of s.points) pick.set(p.date, p.quality === "complete" && valid(p.value) ? p.value : null);
  return datesOf(`${year}-01-01`, `${year}-12-31`).map(date => ({ date, value: pick.has(date) ? pick.get(date) : null }));
}
function monthsOf(daily, year) {
  return Array.from({ length: 12 }, (_, i) => {
    const month = `${year}-${String(i + 1).padStart(2, "0")}`, own = daily.filter(d => d.date.startsWith(`${month}-`)), values = own.map(d => d.value).filter(valid);
    const complete = values.length === own.length, sum = complete ? values.reduce((s, v) => s + v, 0) : null, mean = sum === null ? null : sum / own.length;
    return { month, days: own.length, observedDays: values.length, missingDays: own.length - values.length, zeroDays: values.filter(v => v === 0).length,
      sum, mean, rounded: mean === null ? null : Math.round(mean), status: complete ? "complete" : values.length ? "partial" : "none" };
  });
}
/** Weekday w mean = Σ V(d) of weekday w ÷ N(w) calendar days; all seven withheld unless the whole year is observed. */
function weekdaysOf(daily) {
  const yearComplete = daily.every(d => valid(d.value));
  const items = MON_FIRST.map(w => {
    const own = daily.filter(d => weekdayOf(d.date) === w), values = own.map(d => d.value).filter(valid);
    const sum = yearComplete ? values.reduce((s, v) => s + v, 0) : null, mean = sum === null ? null : sum / own.length, max = yearComplete ? Math.max(...values) : null;
    return { weekday: w, label: WD[w], days: own.length, observedDays: values.length, missingDays: own.length - values.length, zeroDays: values.filter(v => v === 0).length,
      missingDates: own.filter(d => !valid(d.value)).map(d => d.date), sum, mean, rounded: mean === null ? null : Math.round(mean),
      peak: max === null ? null : { value: max, dates: own.filter(d => d.value === max).map(d => d.date) },
      coverage: values.length === own.length ? "complete" : values.length ? "partial" : "none" };
  });
  return { status: yearComplete ? "complete" : items.some(i => i.observedDays > 0) ? "incomplete-year" : "none", yearComplete, items };
}

// Acceptance values (TS-FC-010 §독립 대조값; also reproduced by an independent Python check). Asserted against the oracle first.
const NONSAN_2025_MONTHS = [43616, 42853, 51620, 47321, 53956, 47779, 44142, 49821, 45212, 55910, 48046, 42882];
const NONSAN_2025_WEEKDAYS = [ // Monday → Sunday: [label, N(w), Σ V(d), displayed mean]
  ["월", 52, 2309744.5, 44418], ["화", 52, 2223602.5, 42762], ["수", 53, 2189110, 41304], ["목", 52, 2116257.5, 40697],
  ["금", 52, 2269018.5, 43635], ["토", 52, 3273445, 62951], ["일", 52, 3069832.5, 59035]];
const NONSAN_2026_MONTHS_1_7 = [40265, 50691, 52380, 44264, 52776, 46984, 46042];
const N2025 = archiveDaily("44230", 2025), N2026 = archiveDaily("44230", 2026);
{
  assert.equal(N2025.filter(d => valid(d.value)).length, 365, "oracle: Nonsan 2025 fully observed");
  assert.deepEqual(monthsOf(N2025, 2025).map(m => m.rounded), NONSAN_2025_MONTHS, "oracle: Nonsan 2025 months");
  const w = weekdaysOf(N2025);
  assert.deepEqual(w.items.map(i => [i.label, i.days, i.sum, i.rounded]), NONSAN_2025_WEEKDAYS, "oracle: Nonsan 2025 weekdays (수 53, others 52)");
  const m26 = monthsOf(N2026, 2026), w26 = weekdaysOf(N2026);
  assert.deepEqual(m26.slice(0, 7).map(m => m.rounded), NONSAN_2026_MONTHS_1_7, "oracle: Nonsan 2026 Jan–Jul");
  assert.ok(m26.slice(7).every(m => m.rounded === null), "oracle: Nonsan 2026 Aug–Dec no mean");
  assert.equal(N2026.filter(d => valid(d.value)).length, 220, "oracle: Nonsan 2026 observed days");
  assert.ok(!w26.yearComplete && w26.items.every(i => i.mean === null), "oracle: Nonsan 2026 all seven weekday means withheld");
  assert.deepEqual(w26.items.map(i => i.days), [52, 52, 52, 53, 52, 52, 52], "oracle: 2026 N(w) (목 53)");
  assert.equal(archiveDaily("44150", 2026).filter(d => valid(d.value)).length, 0, "oracle: Gongju has no 2026 row");
}

// Region refs from the catalogue (same exact code rule as the product: provinceCode + districtCode).
function regionRef(code) {
  const r = catalogue.rows.find(x => `${x.provinceCode}${x.districtCode}` === code);
  assert.ok(r, `catalogue region ${code}`);
  return { province: r.provinceCode, district: r.districtCode, code, name: `${r.provinceName} ${r.districtName}`, districtName: r.districtName };
}
const NONSAN = regionRef("44230"), GONGJU = regionRef("44150"), IMSIL = regionRef("52750"), JONGNO = regionRef("11110"), SEJONG = regionRef("3611036110");
const REGIONS = new Map([NONSAN, GONGJU, IMSIL, JONGNO, SEJONG].map(r => [`${r.province}|${r.district}`, r]));

// Formatting mirrors of the visible units (independent re-implementation).
const whole = v => v.toLocaleString("ko-KR", { maximumFractionDigits: 0 });
const raw = v => v.toLocaleString("ko-KR", { maximumFractionDigits: 3 });
const monthTitle = m => `${m.slice(0, 4)}년 ${Number(m.slice(5, 7))}월`;
const fullDate = d => `${d.slice(0, 4)}.${Number(d.slice(5, 7))}.${Number(d.slice(8, 10))}(${WD[weekdayOf(d)]})`;
const periodLabel = (s, e) => s === e ? fullDate(s) : `${fullDate(s)} ~ ${fullDate(e)}`;
const candidateName = (id, s, e) => `후보 ${id} · ${periodLabel(s, e)} · ${datesOf(s, e).length}일`;
const kstMonth = () => new Date(Date.now() + 9 * 3_600_000).toISOString().slice(0, 7);
/** Confirmed holiday dates of a range from the bundled calendar, as `2026.10.3(토) 개천절`, joined like the candidate card. */
function holidayText(start, end, extra = {}) {
  const byDate = new Map();
  for (const h of calendarFile.holidays) if (h.date >= start && h.date <= end) byDate.set(h.date, [...(byDate.get(h.date) ?? []), h.label]);
  for (const [date, label] of Object.entries(extra)) byDate.set(date, [...(byDate.get(date) ?? []), label]);
  const dates = [...byDate.keys()].sort();
  return dates.length ? dates.map(d => `${fullDate(d)} ${byDate.get(d).join("·")}`).join(", ") : "없음";
}
const weekendDays = (s, e) => datesOf(s, e).filter(d => [0, 6].includes(weekdayOf(d))).length;
function haversineKm(a, b) {
  const rad = Math.PI / 180, dLat = (b.latitude - a.latitude) * rad, dLon = (b.longitude - a.longitude) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.latitude * rad) * Math.cos(b.latitude * rad) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}
const kmText = v => `${v < 10 ? v.toFixed(1) : Math.round(v)}km`;

// ---- 검증용 fixtures (synthetic) ----
const LIST_AT = "2026-09-01T03:00:00.000Z", DETAIL_AT = "2026-09-15T03:00:00.000Z", EVENTS_AT = "2026-09-20T03:00:00.000Z";
const res = (id, kind, title, point, modifiedAt = null) => ({ id, kind, title, address: `검증용 가상 주소 ${id}`, point, modifiedAt });
const A = res("9101", "12", "검증용 관광지 가 (가상)", { latitude: 36.2, longitude: 127.1 }, "20260901000000");
const U = res("9102", "12", "검증용 관광지 나 · 좌표 없음 (가상)", null);
const C = res("9103", "12", "검증용 관광지 라 (가상)", { latitude: 36.21, longitude: 127.11 });
const B = res("9201", "14", "검증용 문화시설 다 (가상)", { latitude: 36.19, longitude: 127.18 });
const D = res("9202", "14", "검증용 문화시설 마 (가상)", { latitude: 36.15, longitude: 127.05 });
const RESOURCES = {
  "44230": { "12": [A, U, C], "14": [B, D] },
  "44150": { "12": [res("9301", "12", "검증용 공주 관광지 (가상)", { latitude: 36.46, longitude: 127.12 })], "14": [] },
  "52750": { "12": [res("9501", "12", "검증용 임실 관광지 (가상)", { latitude: 35.61, longitude: 127.28 })], "14": [] },
  "3611036110": { "12": [res("9601", "12", "검증용 세종 관광지 (가상)", { latitude: 36.48, longitude: 127.29 })], "14": [] },
};
{ // Fixture geometry sanity (independent distances): with C as anchor, only A and C lie within 5 km.
  const within = [A, B, C, D].filter(r => haversineKm(C.point, r.point) <= 5).map(r => r.id);
  assert.deepEqual(within.sort(), ["9101", "9103"], "fixture geometry");
}
const KIND_LABEL = { "12": "관광지", "14": "문화시설" };
const resourcesKey = r => JSON.stringify(["resources", r.province, r.district, r.types]);
function resourcesBody(p, override = {}) {
  const province = p.get("province").trim(), district = p.get("district").trim(), region = REGIONS.get(`${province}|${district}`);
  if (!region) throw new Error(`no fixture region ${province}/${district}`);
  const types = ["12", "14"].filter(k => (p.get("types") ?? "12,14").split(",").map(s => s.trim()).includes(k)), request = { province, district, types };
  return { key: resourcesKey(request), request, retrievedAt: new Date().toISOString(), region,
    byType: types.map(kind => {
      const o = override[kind];
      if (o === "unavailable") return { status: "unavailable", error: { code: "source-unavailable", retryable: true }, collectedAt: null, kind, label: KIND_LABEL[kind], total: null, items: [] };
      const items = o ?? RESOURCES[region.code]?.[kind] ?? [];
      return { status: items.length ? "complete" : "empty", error: null, collectedAt: LIST_AT, kind, label: KIND_LABEL[kind], total: items.length, items };
    }) };
}

const LONG_INTRO = `검증용 소개 가 (가상). 이 문장 안의 <b>굵게</b> 표시는 글자 그대로 보여야 해요. ${"지역 관광자원의 가상 소개 문장입니다. ".repeat(12)}`.trim();
const INTRO = { "9101": { status: "complete", overview: LONG_INTRO, modifiedAt: "20260910120000" }, "9201": { status: "empty" }, "9102": { status: "not-found" },
  "9103": { status: "type-mismatch" }, "9202": { status: "complete", overview: "검증용 소개 마 (가상). 다시 불러온 소개예요.", modifiedAt: null } };
const detailOutcome = new Map(); // id → "unavailable" | "empty" while a scenario needs a deterministic provider outcome
const detailKey = r => JSON.stringify(["new-resource-detail", r.province, r.district, r.kind, r.id]);
function detailBody(p) {
  const request = { province: p.get("province").trim(), district: p.get("district").trim(), kind: p.get("kind").trim(), id: p.get("id").trim() };
  const region = REGIONS.get(`${request.province}|${request.district}`), base = { key: detailKey(request), request, retrievedAt: new Date().toISOString(), region };
  const forced = detailOutcome.get(request.id), plan = forced ? { status: forced } : INTRO[request.id] ?? { status: "not-found" };
  if (plan.status === "unavailable") return { ...base, status: "unavailable", error: { code: "source-unavailable", retryable: true }, detail: null, source: null };
  const source = { title: "검증용 소개 출처 (가상)", url: "https://www.data.go.kr/data/15101578/openapi.do", checkedAt: null, publishedAt: null, collectedAt: DETAIL_AT };
  if (plan.status !== "complete") return { ...base, status: plan.status, error: null, detail: null, source };
  return { ...base, status: "complete", error: null, detail: { id: request.id, kind: request.kind, overview: plan.overview, truncated: false, modifiedAt: plan.modifiedAt }, source };
}

const EVENTS = [
  { id: "9401", title: "검증용 월경계 행사 (가상)", start: "2026-09-25", end: "2026-09-29" },
  { id: "9402", title: "검증용 10월 행사 (가상)", start: "2026-10-02", end: "2026-10-10" },
  { id: "9403", title: "검증용 연말연시 행사 (가상)", start: "2026-12-31", end: "2027-01-01" },
  { id: "9405", title: "검증용 4월 행사 (가상)", start: "2027-04-10", end: "2027-04-12" },
];
const UNDATED = { id: "9404", title: "검증용 일정 미확인 행사 (가상)", start: null, end: null };
const overlap = (e, s, t) => { const a = e.start > s ? e.start : s, b = e.end < t ? e.end : t; return b < a ? 0 : datesOf(a, b).length; };
function eventsFor(code, start, end) {
  if (code !== "44230") return [];
  const dated = EVENTS.filter(e => e.start <= end && e.end >= start).map(e => ({ ...e, overlapDays: overlap(e, start, end), datesKnown: true }));
  const undated = start <= "2026-10-31" && end >= "2026-09-01" ? [{ ...UNDATED, overlapDays: null, datesKnown: false }] : [];
  return [...dated, ...undated].map(e => ({ id: e.id, title: e.title, address: "검증용 가상 주소", start: e.start, end: e.end, datesKnown: e.datesKnown,
    scheduleStatus: "registered", point: null, modifiedAt: null, overlapDays: e.overlapDays }));
}
const DUP_LABEL = "검증용 같은 날 공휴일 (가상)";

// ---- API routing: default provenance per endpoint, one-shot overrides, request gates ----
const calls = [], served = [], queue = [], fixtureErrors = [], visitBodies = [];
let fetchFailures = 0;
async function fetchReal(route) {
  try { return await route.fetch(); } catch { fetchFailures++; return null; }
}
const NETWORK_FAIL = () => ({ kind: "abort" });
const HTTP_503 = () => ({ kind: "fulfill", options: { status: 503, json: { error: { code: "source-unavailable", retryable: true } } } });
async function visitsReal(route, p) {
  const response = await fetchReal(route);
  if (!response) return { kind: "abort" };
  const body = await response.json();
  if (response.ok()) visitBodies.push({ params: Object.fromEntries(p), body });
  return { kind: "fulfill", options: { response, json: body } };
}
/** 검증용 FIXTURE on the real Imsil 2023 answer: 2023-05-05 := 0 (observed), 2023-06-10 := missing; aggregates recomputed consistently. */
async function visitsZeroMissing(route) {
  const response = await fetchReal(route);
  if (!response) return { kind: "abort" };
  const body = await response.json();
  const set = (date, value) => { const d = body.daily.find(x => x.date === date); if (!d) throw new Error(`fixture date ${date}`); d.value = value; };
  set("2023-05-05", 0); set("2023-06-10", null);
  body.months = monthsOf(body.daily, 2023);
  body.weekdays = weekdaysOf(body.daily);
  body.years = body.years.map(y => y.year === 2023 ? { ...y, observedDays: body.daily.filter(d => valid(d.value)).length, complete: false } : y);
  body.status = "partial";
  return { kind: "fulfill", options: { response, json: body } }; // key/request stay exactly as served
}
function scheduleWith(outcome = "fixture", holidayExtra = null) {
  return async (route, p) => {
    const response = await fetchReal(route);
    if (!response) return { kind: "abort" };
    const body = await response.json(); // real days, weekends and holiday coverage from the bundled calendar
    if (!response.ok()) return { kind: "fulfill", options: { response, json: body } };
    const range = { start: p.get("start"), end: p.get("end") }, code = `${p.get("province")}${p.get("district")}`;
    if (outcome === "events-unavailable") {
      body.events = { status: "unavailable", error: { code: "source-unavailable", retryable: true }, collectedAt: null, range, items: [] };
      body.summary.events = { status: "unavailable", count: null, overlapping: null, cancelled: null, undated: null };
    } else {
      const items = eventsFor(code, range.start, range.end), status = items.length ? "complete" : "empty";
      body.events = { status, error: null, collectedAt: EVENTS_AT, range, items };
      body.summary.events = { status, count: items.length, overlapping: items.filter(e => (e.overlapDays ?? 0) > 0).length, cancelled: 0, undated: items.filter(e => e.overlapDays === null).length };
    }
    if (holidayExtra) for (const [date, label] of Object.entries(holidayExtra)) { // 검증용: a second label on an already listed date
      body.days.find(d => d.date === date).holidays.push(label);
      body.summary.holidays.dates.find(d => d.date === date).labels.push(label);
    }
    return { kind: "fulfill", options: { response, json: body } };
  };
}
const fixtureJson = make => (route, p) => ({ kind: "fulfill", options: { json: make(p) } });
const resourcesWith = override => fixtureJson(p => resourcesBody(p, override));
const DEFAULTS = { "new/visits": visitsReal, "new/resource-detail": fixtureJson(detailBody), "existing/resources": resourcesWith(), "existing/schedule": scheduleWith() };

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
  served.push({ endpoint, params: Object.fromEntries(p) });
  entry?.done?.();
}
const once = (match, respond) => queue.push({ match, respond });
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
const at = region => p => p.get("province") === region.province && p.get("district") === region.district;
async function waitServed(endpoint, test, label) {
  const deadline = Date.now() + 20_000;
  while (!served.some(s => s.endpoint === endpoint && test(new URLSearchParams(s.params)))) {
    if (Date.now() > deadline) throw new Error(`not served: ${label}`);
    await new Promise(r => setTimeout(r, 25)); // polling a recorded fact, never deciding response order
  }
}

// ---- Page helpers ----
const browser = await chromium.launch({ headless: true });
const errors = [], writes = [], passed = [];
async function openContext({ mapFail = false, ...options } = {}) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: "ko-KR", ...options });
  await mockMapTiles(context, { fail: mapFail });
  await context.route(u => u.pathname.startsWith("/api/new/") || u.pathname.startsWith("/api/existing/"), onApi);
  const page = await context.newPage();
  page.setDefaultTimeout(20_000);
  page.on("pageerror", e => errors.push(e.message));
  page.on("request", r => { if (r.method() !== "GET" && new URL(r.url()).origin === origin) writes.push(`${r.method()} ${new URL(r.url()).pathname}`); });
  return { context, page };
}
const visible = l => l.waitFor({ state: "visible" });
const params = page => new URL(page.url()).searchParams;
const waitParam = (page, key, value) => page.waitForFunction(([k, v]) => new URL(location.href).searchParams.get(k) === v, [key, value]);
const waitPath = (page, path) => page.waitForURL(u => u.pathname === path);
const waitFocusId = (page, id) => page.waitForFunction(i => document.activeElement?.id === i, id);
const waitFocusText = (page, text) => page.waitForFunction(t => document.activeElement?.textContent?.trim() === t, text);
const waitFocusAttr = (page, attr, value) => page.waitForFunction(([a, v]) => document.activeElement?.getAttribute(a) === v, [attr, value]);
const flush = page => page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
async function includes(locator, expected, label = "") {
  const text = await locator.innerText();
  assert.ok(text.includes(expected), `${label} expected ${JSON.stringify(expected)} in ${JSON.stringify(text.slice(0, 500))}`);
}
async function excludes(locator, pattern, label = "") {
  const text = await locator.innerText();
  const found = typeof pattern === "string" ? text.includes(pattern) : pattern.test(text);
  assert.ok(!found, `${label} must not show ${pattern} in ${JSON.stringify(text.slice(0, 500))}`);
}
const rowsOf = region => region.locator("tbody tr").evaluateAll(trs => trs.map(tr => [...tr.children].map(c => c.textContent.trim())));
const escapeRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const main = page => page.locator("main");
const title = (page, region) => page.getByRole("heading", { level: 1, name: region.name, exact: true });
const menu = (page, label) => page.getByRole("navigation", { name: "새 축제 탐색 메뉴" }).getByRole("link", { name: label, exact: true });
async function go(page, label, headingId) { await menu(page, label).click(); await waitFocusId(page, headingId); }
const combo = (scope, prefix) => scope.getByRole("combobox", { name: new RegExp(`^${prefix}`) });
async function pickRegion(scope, region, submit) {
  const row = catalogue.rows.find(r => `${r.provinceCode}${r.districtCode}` === region.code);
  await combo(scope, "시도").selectOption({ label: row.provinceName });
  await combo(scope, "시군구").selectOption({ label: row.districtName });
  await scope.getByRole("button", { name: submit, exact: true }).click();
}
async function changeRegion(page, region) {
  await page.getByRole("button", { name: "지역 바꾸기", exact: true }).click();
  await pickRegion(page.locator("#new-region-change"), region, "이 지역 보기");
}
// Resources
const resourceList = page => page.getByRole("list", { name: "관광자원 목록" });
const rowButton = (page, r) => resourceList(page).getByRole("button", { name: new RegExp(`^\\d+\\. ${escapeRe(r.title)}`) });
const listToggle = (page, r, action) => resourceList(page).getByRole("button", { name: `${r.title} ${action}`, exact: true });
const compare = page => page.getByRole("region", { name: /^함께 보기 \d\/2$/ });
const compareCard = (page, r) => compare(page).getByRole("article", { name: r.title, exact: true });
const detail = (page, r) => page.getByRole("complementary", { name: r.title, exact: true });
const intro = (page, r) => detail(page, r).getByRole("region", { name: `${r.title} 소개`, exact: true });
const ddOf = (scope, term) => scope.locator("dt").filter({ hasText: new RegExp(`^${escapeRe(term)}$`) }).locator("xpath=following-sibling::dd[1]");
const typeButton = (page, label) => page.getByRole("group", { name: "자원 유형" }).getByRole("button", { name: label, exact: true });
const marker = (page, n, r) => page.getByRole("button", { name: `지도에서 ${n}. ${r.title} 상세 보기`, exact: true });
async function listTitles(page) {
  return (await resourceList(page).locator("button[data-resource-id]").evaluateAll(bs => bs.map(b => b.querySelector("span")?.textContent?.trim())));
}
async function noAnchor(page) {
  assert.equal(await page.getByRole("button", { name: "기준점 해제", exact: true }).count(), 0, "no anchor controls before an explicit anchor");
  assert.equal(await page.getByRole("combobox", { name: /^정렬/ }).count(), 0, "no distance sort before an anchor");
  if (await resourceList(page).count()) await excludes(resourceList(page), /직선거리|거리 미확인/, "no distance before an anchor");
}
async function openIntroSettled(page, r) {
  await rowButton(page, r).click();
  await waitFocusId(page, "new-resource-detail-heading");
  await waitServed("new/resource-detail", p => p.get("id") === r.id, `detail ${r.id}`);
  await detail(page, r).getByText("소개를 불러오고 있어요…").waitFor({ state: "detached" });
  await flush(page);
}
// Visits / timing
const yearSelect = page => page.locator("#new-visits-year");
const monthButton = (page, year, m) => page.getByRole("group", { name: "일별 값을 볼 달" }).getByRole("button", { name: `${year}년 ${m}월 일별 값`, exact: true });
const candidate = (page, id) => page.getByRole("article", { name: new RegExp(`^후보 ${id} · `) });
const candidates = page => page.getByRole("article", { name: /^후보 [AB] · / });
const calendarHeading = (page, month, region) => page.getByRole("heading", { name: `${monthTitle(month)} · ${region.districtName} 달력`, exact: true });
async function addCandidate(page, start, end) {
  await page.getByLabel("시작일").fill(start);
  await page.getByLabel("종료일").fill(end);
  await page.getByRole("button", { name: "후보 기간 추가", exact: true }).click();
}
async function jumpMonth(page, month) {
  if (params(page).get("month") === month) return;
  await combo(page, "연도").selectOption(month.slice(0, 4));
  await combo(page, "월").selectOption(month.slice(5, 7));
  await page.getByRole("button", { name: "이동", exact: true }).click();
  await waitParam(page, "month", month);
}
/** `opener` is the button's accessible name; `shown` its visible text (differs when the button has an aria-label). */
async function dialogRoundTrip(page, opener, name, check, { scope = page, shown = opener } = {}) {
  const button = scope.getByRole("button", { name: opener, exact: true });
  await button.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name, exact: true });
  await visible(dialog);
  await check(dialog);
  // The native dialog hides before its queued close event restores focus. Wait for that event before opening the next dialog.
  const closed = await dialog.evaluateHandle(el => {
    const state = { closed: false };
    el.addEventListener("close", () => { state.closed = true; }, { once: true });
    return state;
  });
  await page.keyboard.press("Escape");
  await page.waitForFunction(state => state.closed, closed);
  await closed.dispose();
  await dialog.waitFor({ state: "hidden" });
  await waitFocusText(page, shown);
}
async function noPageOverflow(page, label) {
  const [scroll, inner] = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
  assert.ok(scroll <= inner, `${label}: page scrollWidth ${scroll} > ${inner}`);
}
async function noWritingFields(page, label) {
  assert.equal(await main(page).locator("textarea, input[type=text], input:not([type])").count(), 0, `${label}: no mandatory writing field`);
}
async function noInternalWording(page, label) {
  await excludes(main(page), /source-unavailable|not-selected|incomplete-year|not-found|type-mismatch|region-mismatch|TourAPI|\bAPI\b|fixture|undefined|NaN/, label);
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
async function entry({ page }) {
  // AC1 · AC10: purpose → region choice with nothing preselected → keyboard submit → resources of that region.
  await page.goto(`${base}/`);
  await page.getByRole("link", { name: "지역부터 살펴보기 →", exact: true }).click();
  await waitPath(page, "/new");
  await visible(page.getByRole("heading", { level: 1, name: "어느 지역의 축제를 구상하시나요?", exact: true }));
  assert.equal(await combo(page, "시도").inputValue(), "", "no preselected province");
  assert.equal(await combo(page, "시군구").isDisabled(), true, "district waits for a province");
  await noWritingFields(page, "start");
  await combo(page, "시도").selectOption({ label: "충청남도" });
  const submit = page.getByRole("button", { name: "지역 살펴보기", exact: true });
  await submit.focus(); await page.keyboard.press("Enter");
  await visible(page.getByRole("alert").filter({ hasText: "시군구까지 골라 주세요." }));
  assert.equal(await combo(page, "시군구").getAttribute("aria-invalid"), "true");
  await page.waitForFunction(() => document.activeElement?.tagName === "SELECT" && !document.activeElement.disabled);
  await combo(page, "시군구").selectOption({ label: "논산시" });
  await submit.focus(); await page.keyboard.press("Enter");
  await waitPath(page, "/new/44230/resources");
  await waitFocusText(page, NONSAN.name);
  await visible(page.getByRole("heading", { level: 2, name: "논산시 관광자원", exact: true }));
  passed.push("AC1-no-preselected-region-keyboard-choice-enters-resources", "AC10-keyboard-region-choice-title-focus");
}

async function resourcesAndIntro({ page }) {
  // AC9 · AC2 · AC13 (검증용 resources and introductions).
  await visible(page.getByRole("alert").filter({ hasText: "문화시설 목록을 불러오지 못했어요." }));
  await visible(page.getByText("관광지 3건", { exact: true }));
  await visible(page.getByText(/^불러온 3건 · 지도 위치 있는 자원 2건/));
  await excludes(main(page), /문화시설 0건|조회한 등록 결과가 없어요/, "a failed type is not zero");
  await page.getByRole("alert").filter({ hasText: "문화시설 목록을 불러오지 못했어요." }).getByRole("button", { name: "다시 불러오기" }).click();
  await visible(page.getByText("문화시설 2건", { exact: true }));
  await visible(page.getByText(/^조회 5건 · 지도 위치 있는 자원 4건/));
  assert.deepEqual(await listTitles(page), [`1. ${A.title}`, `2. ${U.title}`, `3. ${C.title}`, `4. ${B.title}`, `5. ${D.title}`], "name order");
  await includes(rowButton(page, U), "지도 위치 없음");
  await noAnchor(page);
  passed.push("AC9-one-type-failure-not-zero-retry-applies", "AC3-no-distance-or-distance-sort-before-anchor");

  // Map and list share the source id: a marker opens the same resource the list marks.
  await visible(marker(page, 1, A));
  for (const [n, r] of [[3, C], [4, B], [5, D]]) await visible(marker(page, n, r));
  assert.equal(await page.getByRole("button", { name: /^지도에서 \d+\. .+ 상세 보기$/ }).count(), 4, "only located resources get markers");
  await marker(page, 1, A).click();
  await visible(detail(page, A));
  assert.equal(await rowButton(page, A).getAttribute("aria-pressed"), "true");
  assert.equal(await marker(page, 1, A).getAttribute("aria-pressed"), "true");
  passed.push("AC2-map-marker-and-list-row-same-resource");

  // AC13: introduction text is a separate request with its own collection time; plain text only.
  await waitServed("new/resource-detail", p => p.get("id") === A.id, "detail A");
  const d = detail(page, A);
  assert.equal(await ddOf(d, "유형").innerText(), "관광지");
  assert.equal(await ddOf(d, "주소").innerText(), A.address);
  assert.equal(await ddOf(d, "지도 위치").innerText(), "있음");
  assert.equal(await ddOf(d, "목록 원천 수정일").innerText(), "2026-09-01", "list row modification date");
  await visible(intro(page, A));
  await includes(intro(page, A), "<b>굵게</b>", "markup-looking text stays literal");
  assert.equal(await intro(page, A).locator("b").count(), 0, "no element injected from introduction text");
  await page.getByRole("button", { name: `${A.title} 소개 더 보기`, exact: true }).click();
  await includes(intro(page, A), LONG_INTRO.slice(-40).trim());
  await page.getByRole("button", { name: `${A.title} 소개 접기`, exact: true }).click();
  await dialogRoundTrip(page, `${A.title} 소개 출처 보기`, `${A.title} 소개 출처`, async dialog => {
    assert.match(await dialog.innerText(), /소개 수집 2026\. 9\. 15\./, "introduction collection time (not the list time)");
    await includes(dialog, "소개 원천 수정일 2026-09-10");
    for (const href of await dialog.locator("a").evaluateAll(as => as.map(a => a.getAttribute("href")))) assert.match(href, /^https:\/\//, "official https link only");
  }, { scope: intro(page, A), shown: "소개 출처" });
  await dialogRoundTrip(page, "관광자원 출처 보기", "관광자원 출처", async dialog => {
    assert.match(await dialog.innerText(), /관광지 목록: 2026\. 9\. 1\. .*수집/, "list collection time");
    await excludes(dialog, /2026\. 9\. 15\. 오후 12:00 수집/, "the list never shows the introduction time");
  });
  await d.getByRole("button", { name: "상세 닫기", exact: true }).click();
  await waitFocusAttr(page, "data-resource-id", A.id);
  passed.push("AC13-intro-plain-text-own-source-and-time", "AC10-dialogs-and-detail-close-return-focus");

  for (const r of [B, U, C]) { // empty / not-found / type-mismatch → block omitted, list identity kept
    await openIntroSettled(page, r);
    await visible(detail(page, r));
    assert.equal(await intro(page, r).count(), 0, `${r.id}: no introduction block`);
    assert.equal(await detail(page, r).getByRole("alert").count(), 0, `${r.id}: absence is not a failure`);
    assert.equal(await ddOf(detail(page, r), "주소").innerText(), r.address);
  }
  assert.equal(await ddOf(detail(page, C), "유형").innerText(), "관광지");
  await openIntroSettled(page, U);
  assert.equal(await ddOf(detail(page, U), "지도 위치").innerText(), "없음 · 거리를 계산할 수 없어요");
  assert.equal(await detail(page, U).getByRole("button", { name: "이 자원을 기준점으로" }).count(), 0, "no anchor from an unlocated resource");

  detailOutcome.set(D.id, "unavailable");
  await openIntroSettled(page, D);
  const failed = detail(page, D).getByRole("alert").filter({ hasText: "소개를 불러오지 못했어요." });
  await visible(failed);
  assert.equal(await ddOf(detail(page, D), "주소").innerText(), D.address, "identity stays on intro failure");
  await visible(rowButton(page, A));
  detailOutcome.delete(D.id);
  await failed.getByRole("button", { name: `${D.title} 소개 다시 불러오기`, exact: true }).click();
  await visible(intro(page, D));
  await includes(intro(page, D), "다시 불러온 소개예요");
  await detail(page, D).getByRole("button", { name: "상세 닫기", exact: true }).click();
  await waitFocusAttr(page, "data-resource-id", D.id);
  passed.push("AC13-empty-notfound-mismatch-omit-block-failure-retries-in-place");
}

async function compareAndAnchor({ page }) {
  // AC2 · AC3 · AC11 (검증용 resources): two at most, third rejected, replace after removal, explicit anchors only.
  const add = async (r, expected = true) => {
    const t = listToggle(page, r, "함께 보기에 추가"); await t.focus(); await page.keyboard.press("Enter");
    if (expected) await visible(listToggle(page, r, "함께 보기에서 빼기"));
  };
  await add(A); await add(B);
  await visible(page.getByRole("heading", { name: "함께 보기 2/2", exact: true }));
  const names = await compare(page).getByRole("article").evaluateAll(as => as.map(a => a.querySelector("h4")?.textContent?.trim()));
  assert.deepEqual(names, [A.title, B.title]);
  for (const r of [A, B]) {
    const card = compareCard(page, r);
    assert.deepEqual(await card.locator("dt").allInnerTexts(), ["유형", "주소", "지도 위치", "소개"], "same fields, same order, no distance before anchor");
    assert.equal(await ddOf(card, "유형").innerText(), KIND_LABEL[r.kind]);
    assert.equal(await ddOf(card, "주소").innerText(), r.address);
    assert.equal(await ddOf(card, "지도 위치").innerText(), "있음");
  }
  await includes(ddOf(compareCard(page, A), "소개"), "검증용 소개 가 (가상)");
  assert.equal(await ddOf(compareCard(page, B), "소개").innerText(), "—", "confirmed empty introduction is a dash, not a failure");
  await visible(listToggle(page, A, "함께 보기에서 빼기"));
  await add(C, false);
  await visible(compare(page).getByRole("alert").filter({ hasText: "함께 보기는 2곳까지예요. 한 곳을 빼고 추가해 주세요." }));
  await waitFocusId(page, "new-compare-heading");
  assert.equal(await compare(page).getByRole("article").count(), 2, "nothing silently added or replaced");
  await visible(listToggle(page, C, "함께 보기에 추가"));
  await compare(page).getByRole("button", { name: `${A.title} 함께 보기에서 빼기`, exact: true }).click();
  await waitFocusId(page, "new-compare-heading");
  await add(C);
  await visible(page.getByRole("heading", { name: "함께 보기 2/2", exact: true }));
  assert.deepEqual(await compare(page).getByRole("article").evaluateAll(as => as.map(a => a.querySelector("h4")?.textContent?.trim())), [B.title, C.title]);
  await noAnchor(page);
  passed.push("AC2-compare-max-two-third-rejected-replace-after-removal", "AC3-compare-does-not-set-anchor");

  // Explicit anchor from a located resource; distances recomputed independently.
  await rowButton(page, C).click();
  await detail(page, C).getByRole("button", { name: "이 자원을 기준점으로", exact: true }).click();
  await visible(page.locator("p", { hasText: new RegExp(`^기준점\\s*${escapeRe(C.title)}$`) }));
  await includes(rowButton(page, A), `기준점에서 직선거리 약 ${kmText(haversineKm(C.point, A.point))}`);
  await includes(rowButton(page, C), "기준점에서 직선거리 약 0.0km");
  await includes(rowButton(page, U), "거리 미확인");
  assert.equal(await ddOf(compareCard(page, B), "기준점").innerText(), `기준점에서 직선거리 약 ${kmText(haversineKm(C.point, B.point))}`);
  await combo(page, "반경").selectOption("5");
  await visible(page.getByText(/ · 기준점 5km 안 2건$/));
  await visible(rowButton(page, U)); // unlocated stays listed, not counted inside the radius
  assert.equal(await rowButton(page, B).count(), 0, "outside the radius is hidden from the list");
  await visible(compareCard(page, B).getByText("지금 목록 조건에서는 보이지 않아요.", { exact: true }));
  await combo(page, "정렬").selectOption("distance");
  assert.deepEqual(await listTitles(page), [`1. ${C.title}`, `2. ${A.title}`, `3. ${U.title}`], "distance order after an explicit anchor");
  await combo(page, "반경").selectOption({ label: "제한 없음" });
  // AC11: a type filter hides a compared resource from the list but keeps it compared and removable.
  await typeButton(page, "문화시설").click();
  await waitParam(page, "types", "12");
  assert.equal(await typeButton(page, "문화시설").getAttribute("aria-pressed"), "false");
  assert.equal(await rowButton(page, B).count(), 0);
  await visible(compareCard(page, B).getByText("지금 목록 조건에서는 보이지 않아요.", { exact: true }));
  await visible(compare(page).getByRole("button", { name: `${B.title} 함께 보기에서 빼기`, exact: true }));
  await typeButton(page, "문화시설").click();
  await page.waitForFunction(() => new URL(location.href).searchParams.get("types") === null);
  await visible(rowButton(page, B));
  await page.getByRole("button", { name: "기준점 해제", exact: true }).click();
  await noAnchor(page);
  passed.push("AC3-explicit-resource-anchor-distances-radius-unlocated-listed", "AC11-filtered-out-compared-kept-and-removable");

  // Map position anchor: moving the map is not an anchor; the explicit button applies the map centre.
  await page.getByRole("group", { name: /^관광자원 지도/ }).focus();
  await page.keyboard.press("ArrowRight");
  await flush(page);
  await noAnchor(page);
  await page.getByRole("button", { name: "지도 중심을 기준점으로", exact: true }).click();
  const label = page.locator("p", { hasText: /^기준점\s*지도에서 고른 위치 \(/ });
  await visible(label);
  const [, lat, lon] = (await label.innerText()).match(/\((\d+\.\d{4}), (\d+\.\d{4})\)/);
  const shown = Number((await rowButton(page, A).innerText()).match(/직선거리 약 ([\d.]+)km/)[1]);
  const expected = haversineKm({ latitude: Number(lat), longitude: Number(lon) }, A.point);
  assert.ok(Math.abs(shown - expected) <= (expected < 10 ? 0.06 : 0.51), `map-centre distance ${shown} vs independent ${expected.toFixed(3)}`);
  await includes(rowButton(page, U), "거리 미확인");
  await page.getByRole("button", { name: "기준점 해제", exact: true }).click();
  await noAnchor(page);
  await excludes(main(page), /행사장 확정|기획안 저장|저장했어요|최적|추천 순위/, "no venue decision, save or ranking");
  await noInternalWording(page, "resources");
  passed.push("AC3-map-centre-anchor-explicit-only");
}

async function timing({ page }) {
  // AC6 · AC7 · AC14 · AC9: calendar first, candidates optional (0/1/2), whole-range counts, holiday coverage.
  await go(page, "개최 시기", "new-timing-heading");
  const month = kstMonth();
  await waitParam(page, "month", month);
  await visible(calendarHeading(page, month, NONSAN));
  await visible(page.getByRole("region", { name: `${monthTitle(month)} 달력`, exact: true }));
  await visible(page.getByRole("heading", { name: "등록 행사", exact: true }));
  assert.equal(await candidates(page).count(), 0, "calendar without candidates");
  await noWritingFields(page, "timing");
  await jumpMonth(page, "2026-10");
  await visible(calendarHeading(page, "2026-10", NONSAN));
  const october = page.getByRole("region", { name: "2026년 10월 달력", exact: true });
  for (const h of ["개천절", "개천절 대체공휴일", "한글날"]) await visible(october.getByText(h, { exact: true }).first()); // REAL calendar
  await visible(october.getByText("검증용 10월 행사 (가상)").first());
  passed.push("AC6-calendar-and-events-without-candidates");

  // Cross-month candidate: one request for the whole range; no count while it is pending.
  const A1 = ["2026-09-28", "2026-10-03"], held = gate(is("existing/schedule", p => p.get("start") === A1[0] && p.get("end") === A1[1]), "candidate A");
  await addCandidate(page, ...A1);
  await held.arrived;
  const a = candidate(page, "A");
  await visible(a.getByText("이 기간의 일정을 불러오고 있어요…", { exact: true }));
  await excludes(a, /등록 행사|\d+건|없어요/, "no count or zero while the whole range is pending");
  await held.release();
  await visible(ddOf(a, "등록 행사"));
  assert.equal(await a.getByRole("heading").innerText(), candidateName("A", ...A1));
  assert.equal(await ddOf(a, "토·일요일").innerText(), `${weekendDays(...A1)}일`);
  assert.equal(await ddOf(a, "공휴일").innerText(), holidayText(...A1), "real holiday once (Saturday not double counted)");
  await includes(ddOf(a, "등록 행사"), "기간과 겹치는 등록 행사 2건");
  await includes(ddOf(a, "등록 행사"), "일정 미확인 1건은 세지 않았어요");
  assert.ok(calls.filter(c => c.endpoint === "existing/schedule" && c.params.start === A1[0]).every(c => c.params.end === A1[1]), "never split by month");
  await waitFocusAttr(page, "data-candidate", "A");
  passed.push("AC14-cross-month-whole-range-count-only-after-complete");

  // Identical period: no duplicate, focus moves to the existing candidate.
  await page.locator("#candidates-heading").focus();
  await addCandidate(page, ...A1);
  await waitFocusAttr(page, "data-candidate", "A");
  assert.equal(await candidates(page).count(), 1, "identical candidate not added twice");
  // Invalid order: corrected in its own fields, other results stay.
  await addCandidate(page, "2026-10-10", "2026-10-05");
  await visible(page.getByRole("alert").filter({ hasText: "종료일은 시작일과 같거나 뒤여야 해요." }));
  assert.equal(await page.getByLabel("종료일").getAttribute("aria-invalid"), "true");
  assert.equal(await page.getByLabel("시작일").inputValue(), "2026-10-10", "input kept");
  assert.equal(await page.getByLabel("종료일").inputValue(), "2026-10-05", "input kept, not auto-corrected");
  await includes(ddOf(a, "등록 행사"), "기간과 겹치는 등록 행사 2건", "other candidate kept");
  await visible(page.getByRole("region", { name: "2026년 10월 달력", exact: true }));
  // Same-day candidate is valid.
  await page.getByLabel("종료일").fill("2026-10-10");
  await page.getByRole("button", { name: "후보 기간 추가", exact: true }).click();
  const b = candidate(page, "B");
  await visible(ddOf(b, "등록 행사"));
  assert.equal(await b.getByRole("heading").innerText(), candidateName("B", "2026-10-10", "2026-10-10"));
  assert.equal(await ddOf(b, "공휴일").innerText(), "없음", "confirmed none inside the covered calendar");
  assert.equal(await ddOf(b, "토·일요일").innerText(), "1일");
  await includes(ddOf(b, "등록 행사"), "기간과 겹치는 등록 행사 1건");
  assert.equal(await page.getByRole("button", { name: "후보 기간 추가", exact: true }).isDisabled(), true, "third needs a removal");
  await visible(page.getByText("후보는 2개까지 비교할 수 있어요. 다른 기간을 보려면 후보 하나를 지워 주세요.", { exact: true }));
  passed.push("AC7-invalid-dates-fixed-in-place-others-kept", "AC14-identical-not-duplicated-same-day-allowed-cap-two", "AC6-one-candidate-no-second-or-reason-required");

  // Partial overlap with A; 검증용 second label on 10-03 is still one date.
  await b.getByRole("button", { name: "후보 B 지우기", exact: true }).click();
  await waitFocusId(page, "candidates-heading");
  const B1 = ["2026-10-02", "2026-10-09"];
  once(is("existing/schedule", p => at(NONSAN)(p) && p.get("start") === B1[0] && p.get("end") === B1[1]), scheduleWith("fixture", { "2026-10-03": DUP_LABEL }));
  await addCandidate(page, ...B1);
  await visible(ddOf(b, "등록 행사"));
  const holidays = await ddOf(b, "공휴일").innerText();
  assert.equal(holidays, holidayText(...B1, { "2026-10-03": DUP_LABEL }));
  assert.equal(holidays.split(", ").length, 3, "three holiday dates; the doubly labelled date counted once");
  assert.equal(await ddOf(b, "토·일요일").innerText(), `${weekendDays(...B1)}일`);
  await includes(ddOf(b, "등록 행사"), "기간과 겹치는 등록 행사 1건");
  await includes(b, "후보와 8일 겹침");
  await includes(ddOf(a, "등록 행사"), "기간과 겹치는 등록 행사 2건", "overlapping candidates keep their own results");
  passed.push("AC14-partial-overlap-own-results-holiday-date-dedup(검증용 label)");

  // Cross-year candidate, gated.
  await b.getByRole("button", { name: "후보 B 지우기", exact: true }).click();
  const Y1 = ["2026-12-30", "2027-01-02"], heldYear = gate(is("existing/schedule", p => p.get("start") === Y1[0] && p.get("end") === Y1[1]), "cross-year");
  await addCandidate(page, ...Y1);
  await heldYear.arrived;
  await visible(b.getByText("이 기간의 일정을 불러오고 있어요…", { exact: true }));
  await excludes(b, /등록 행사|\d+건|없어요/, "no zero before the cross-year range completes");
  await heldYear.release();
  await visible(ddOf(b, "등록 행사"));
  assert.equal(await b.getByRole("heading").innerText(), candidateName("B", ...Y1));
  assert.equal(await ddOf(b, "공휴일").innerText(), holidayText(...Y1));
  assert.equal(await ddOf(b, "토·일요일").innerText(), `${weekendDays(...Y1)}일`);
  await includes(ddOf(b, "등록 행사"), "기간과 겹치는 등록 행사 1건");
  passed.push("AC14-cross-year-whole-range");

  // Outside the holiday calendar vs an events answer of zero.
  await b.getByRole("button", { name: "후보 B 지우기", exact: true }).click();
  const O1 = ["2027-01-30", "2027-02-03"];
  await addCandidate(page, ...O1);
  await visible(ddOf(b, "등록 행사"));
  assert.equal(await ddOf(b, "공휴일").innerText(), "일부 날짜의 공휴일 정보를 불러올 수 없어요", "partly outside coverage is not 'none'");
  assert.equal(await ddOf(b, "등록 행사").innerText(), "이 기간에 등록된 행사가 없어요", "completed zero is its own state");
  await jumpMonth(page, "2027-03");
  await visible(calendarHeading(page, "2027-03", NONSAN));
  await visible(page.getByText("이 기간의 공휴일 정보를 불러올 수 없어요.", { exact: true }));
  await visible(page.getByText("이 기간에 등록된 행사가 없어요.", { exact: true }));
  passed.push("AC7-holiday-unknown-distinct-from-zero-events");

  // AC9: events failure keeps the calendar; a retry answer for a month the user already left is ignored.
  once(is("existing/schedule", p => at(NONSAN)(p) && p.get("start") === "2027-04-01"), scheduleWith("events-unavailable"));
  await page.getByRole("button", { name: "다음 달, 2027년 4월 보기", exact: true }).click();
  const failed = page.getByRole("alert").filter({ hasText: "행사 일정을 불러오지 못했어요." });
  await visible(failed);
  await visible(page.getByRole("region", { name: "2027년 4월 달력", exact: true }));
  await excludes(page.locator("section[aria-labelledby=calendar-heading]"), "이 기간에 등록된 행사가 없어요", "failure is not zero");
  const retry = gate(is("existing/schedule", p => at(NONSAN)(p) && p.get("start") === "2027-04-01"), "events retry");
  await failed.getByRole("button", { name: "다시 불러오기", exact: true }).click();
  await retry.arrived;
  await page.getByRole("button", { name: "이전 달, 2027년 3월 보기", exact: true }).click();
  await visible(calendarHeading(page, "2027-03", NONSAN));
  await retry.release();
  await flush(page);
  await visible(calendarHeading(page, "2027-03", NONSAN));
  await excludes(page.locator("section[aria-labelledby=calendar-heading]"), "검증용 4월 행사", "late retry of another month ignored");
  assert.equal(await page.getByRole("alert").filter({ hasText: "행사 일정을 불러오지 못했어요." }).count(), 0);
  passed.push("AC9-events-failure-keeps-calendar-late-retry-ignored");

  await a.getByRole("button", { name: "달력에서 보기", exact: true }).click();
  await waitParam(page, "month", "2026-09");
  await waitFocusId(page, "calendar-heading");
  await visible(page.getByRole("region", { name: "2026년 9월 달력", exact: true }).getByText("검증용 월경계 행사 (가상)").first());
  await excludes(page.locator("section[aria-labelledby=new-timing-heading]"), /최적|추천|점수|순위|예상 방문|예측/, "no forecast or score");
  await noInternalWording(page, "timing");
}

async function visits({ page }) {
  // AC4 (REAL ARCHIVE): default 2025, month and weekday means equal the independent oracle; table/chart/detail agree.
  await go(page, "지역 방문 흐름", "new-visits-heading");
  await waitParam(page, "year", "2025");
  await visible(page.getByRole("heading", { name: "2025년 월별 일평균", exact: true }));
  assert.equal(await yearSelect(page).inputValue(), "2025");
  const options = await yearSelect(page).locator("option").allTextContents();
  for (const y of ["2023년", "2024년", "2025년"]) assert.ok(options.includes(y), `${y} complete`);
  assert.ok(options.includes("2026년 (220/365일 값 있음)"), `2026 marked incomplete: ${options}`);
  const api2025 = visitBodies.find(v => v.params.district === "230" && v.body.year === 2025)?.body;
  assert.ok(api2025, "real visits response observed");
  assert.equal(api2025.defaultYear, 2025);
  assert.deepEqual(api2025.weekdays.items.map(i => [i.label, i.days, i.sum, i.rounded]), NONSAN_2025_WEEKDAYS, "API weekday values");
  const oracleW = weekdaysOf(N2025).items;
  api2025.weekdays.items.forEach((i, k) => assert.ok(Math.abs(i.mean - oracleW[k].mean) < 1e-9 && i.zeroDays === 0 && i.observedDays === i.days, `API raw weekday mean ${i.label}`));
  assert.deepEqual(api2025.months.map(m => m.rounded), NONSAN_2025_MONTHS, "API monthly values");

  await page.getByRole("button", { name: "월별 수치 표 보기", exact: true }).click();
  const monthly = await rowsOf(page.getByRole("region", { name: "월별 일평균 수치 표", exact: true }));
  assert.deepEqual(monthly, monthsOf(N2025, 2025).map(m => [monthTitle(m.month), whole(m.rounded), `${m.days}/${m.days}일`, "0일"]));
  assert.equal(await page.getByRole("img", { name: /^2025년 월별 일평균 막대그래프/ }).locator("rect").count(), 12);
  await page.getByRole("button", { name: "요일별 수치 표 보기", exact: true }).click();
  const weekly = await rowsOf(page.getByRole("region", { name: "요일별 일평균 수치 표", exact: true }));
  assert.deepEqual(weekly, NONSAN_2025_WEEKDAYS.map(([l, n, s, r]) => [`${l}요일`, `${n}일`, raw(s), whole(r), "0일"]), "수 53, others 52");
  const chart = page.getByRole("img", { name: /^2025년 요일별 일평균 막대그래프, 월요일부터 일요일 순/ });
  assert.equal(await chart.locator("rect").count(), 7);
  const axis = await chart.locator("text").allTextContents();
  assert.deepEqual(axis.filter(t => WD.includes(t)), ["월", "화", "수", "목", "금", "토", "일"], "calendar order, not ranked");
  await page.getByRole("button", { name: "요일별 수치 표 보기 닫기", exact: true }).last().click();
  await waitFocusText(page, "요일별 수치 표 보기");
  await dialogRoundTrip(page, "출처·산식 보기", "방문 자료 출처와 계산", async dialog => {
    await includes(dialog, "2025년 날짜 수: 월 52일 · 화 52일 · 수 53일 · 목 52일 · 금 52일 · 토 52일 · 일 52일.");
  });
  await excludes(main(page), /평소|예상 관람객|축제 없이도|순위/, "observations are not forecasts or ranks");
  passed.push("AC4-real-2025-default-month-weekday-oracle-wed53-others52", "AC10-table-close-and-dialog-focus");

  // AC12: October daily values, the real year-month calendar link, Back restores selection and focus.
  const before = params(page).get("month");
  await monthButton(page, 2025, 10).click();
  await visible(page.getByRole("heading", { name: "2025년 10월 일별 방문", exact: true }));
  await includes(page.locator("section[aria-labelledby=new-month-daily-heading]"), "일평균 55,910명/일");
  const daily = await rowsOf(page.getByRole("region", { name: "2025년 10월 일별 수치 표", exact: true }));
  assert.deepEqual(daily, N2025.filter(d => d.date.startsWith("2025-10-")).map(d => [d.date, WD[weekdayOf(d.date)], raw(d.value)]));
  const link = page.getByRole("link", { name: "2025년 10월 일정 보기", exact: true });
  await link.click();
  await waitParam(page, "month", "2025-10");
  await waitFocusId(page, "new-timing-heading");
  await visible(calendarHeading(page, "2025-10", NONSAN));
  assert.equal(params(page).get("year"), "2025", "observation year unchanged");
  assert.equal(await candidates(page).count(), 2, "future candidates unchanged");
  await excludes(page.locator("section[aria-labelledby=calendar-heading]"), "검증용 10월 행사", "a past month never shows another year's events");
  await page.goBack();
  await waitFocusId(page, "new-observed-month-2025-10");
  assert.equal(await monthButton(page, 2025, 10).getAttribute("aria-pressed"), "true");
  assert.equal(params(page).get("month"), before);
  await go(page, "개최 시기", "new-timing-heading");
  assert.equal(params(page).get("month"), before, "the plain menu reopens the earlier calendar month");
  passed.push("AC12-real-2025-10-daily-link-back-restores-month-and-focus");

  // AC5 (REAL ARCHIVE): incomplete 2026 keeps months 1–7, no weekday means at all, no zero fill.
  await go(page, "지역 방문 흐름", "new-visits-heading");
  await yearSelect(page).selectOption("2026");
  await page.getByRole("button", { name: "연도 보기", exact: true }).click();
  await waitParam(page, "year", "2026");
  await visible(page.getByRole("heading", { name: "2026년 월별 일평균", exact: true }));
  const api2026 = visitBodies.find(v => v.params.district === "230" && v.params.year === "2026")?.body;
  assert.ok(api2026 && api2026.weekdays.status === "incomplete-year" && api2026.weekdays.items.length === 7, "API 2026 weekday block");
  assert.ok(api2026.weekdays.items.every(i => i.sum === null && i.mean === null && i.rounded === null && i.peak === null), "API withholds all seven weekday means");
  assert.deepEqual(api2026.weekdays.items.map(i => i.days), [52, 52, 52, 53, 52, 52, 52]);
  if (!(await page.getByRole("region", { name: "월별 일평균 수치 표", exact: true }).count())) await page.getByRole("button", { name: "월별 수치 표 보기", exact: true }).click();
  const rows2026 = await rowsOf(page.getByRole("region", { name: "월별 일평균 수치 표", exact: true }));
  assert.deepEqual(rows2026, monthsOf(N2026, 2026).map(m => [monthTitle(m.month), m.rounded === null ? "—" : whole(m.rounded), `${m.observedDays}/${m.days}일`, "0일"]));
  assert.equal(await page.getByRole("img", { name: /^2026년 월별 일평균 막대그래프/ }).locator("rect").count(), 7);
  const weekday = page.locator("section[aria-labelledby=new-weekday-heading]");
  await includes(weekday, "이 연도의 요일별 흐름을 불러올 수 없어요.");
  assert.equal(await page.getByRole("region", { name: "요일별 일평균 수치 표" }).count(), 0, "no partial weekday table");
  await dialogRoundTrip(page, "출처·산식 보기", "방문 자료 출처와 계산", async dialog => {
    await includes(dialog, "2026년 날짜 수: 월 52일 · 화 52일 · 수 52일 · 목 53일 · 금 52일 · 토 52일 · 일 52일.");
  });
  await monthButton(page, 2026, 8).click();
  await includes(page.locator("section[aria-labelledby=new-month-daily-heading]"), "일평균 없음 · 8/31일 값 있음");
  const aug = await rowsOf(page.getByRole("region", { name: "2026년 8월 일별 수치 표", exact: true }));
  assert.deepEqual(aug.map(r => r[2]), N2026.filter(d => d.date.startsWith("2026-08-")).map(d => d.value === null ? "—" : raw(d.value)), "missing is — never 0");
  await visible(page.getByText("선이 끊긴 날: 값 없음", { exact: true }));
  await weekday.getByRole("button", { name: "연도 바꾸기", exact: true }).click();
  await waitFocusId(page, "new-visits-year");
  await visible(page.getByRole("link", { name: "지역 관광자원 보기", exact: true }));
  await noInternalWording(page, "visits 2026");
  passed.push("AC5-real-2026-months-1-7-kept-all-weekday-means-withheld-missing-not-zero");
  // Leave the observation year at 2025 for later views.
  await yearSelect(page).selectOption("2025");
  await page.getByRole("button", { name: "연도 보기", exact: true }).click();
  await waitParam(page, "year", "2025");
}

async function zeroVersusMissing() {
  // AC5 — 검증용 FIXTURE on the real Imsil 2023 response (this condition only): 5-05 := 0, 6-10 := missing.
  const { context, page } = await openContext();
  once(is("new/visits", p => at(IMSIL)(p) && p.get("year") === "2023"), visitsZeroMissing);
  await page.goto(`${base}/new/52750/visits?year=2023`);
  await visible(page.getByRole("heading", { name: "2023년 월별 일평균", exact: true }));
  const fixtureDaily = archiveDaily("52750", 2023).map(d => d.date === "2023-05-05" ? { ...d, value: 0 } : d.date === "2023-06-10" ? { ...d, value: null } : d);
  const m = monthsOf(fixtureDaily, 2023);
  await page.getByRole("button", { name: "월별 수치 표 보기", exact: true }).click();
  const rows = await rowsOf(page.getByRole("region", { name: "월별 일평균 수치 표", exact: true }));
  assert.deepEqual(rows[4], ["2023년 5월", whole(m[4].rounded), "31/31일", "1일"], "a zero is observed and kept in the mean");
  assert.deepEqual(rows[5], ["2023년 6월", "—", "29/30일", "0일"], "a missing day withholds the month mean");
  await includes(page.locator("section[aria-labelledby=new-weekday-heading]"), "이 연도의 요일별 흐름을 불러올 수 없어요.");
  await monthButton(page, 2023, 5).click();
  const may = await rowsOf(page.getByRole("region", { name: "2023년 5월 일별 수치 표", exact: true }));
  assert.deepEqual(may.find(r => r[0] === "2023-05-05"), ["2023-05-05", "금", "0"]);
  await monthButton(page, 2023, 6).click();
  const june = await rowsOf(page.getByRole("region", { name: "2023년 6월 일별 수치 표", exact: true }));
  assert.deepEqual(june.find(r => r[0] === "2023-06-10"), ["2023-06-10", "토", "—"]);
  await visible(page.getByText("선이 끊긴 날: 값 없음", { exact: true }));
  await go(page, "지역 관광자원", "new-resources-heading");
  await visible(rowButton(page, RESOURCES["52750"]["12"][0]));
  await context.close();
  passed.push("AC5-zero-kept-missing-dash-and-no-mean(검증용 Imsil 2023 variant)");
}

async function regionChange() {
  // AC8: late responses of the previous region never render; region selections reset; year/month/candidates stay.
  const { context, page } = await openContext();
  await page.goto(`${base}/new/44230/timing?month=2026-10&year=2026`);
  await visible(calendarHeading(page, "2026-10", NONSAN));
  const A1 = ["2026-09-28", "2026-10-03"], O1 = ["2027-01-30", "2027-02-03"];
  await addCandidate(page, ...A1); await visible(ddOf(candidate(page, "A"), "등록 행사"));
  await addCandidate(page, ...O1); await visible(ddOf(candidate(page, "B"), "등록 행사"));
  await go(page, "지역 관광자원", "new-resources-heading");
  for (const r of [A, B]) await listToggle(page, r, "함께 보기에 추가").click();
  await rowButton(page, A).click();
  await detail(page, A).getByRole("button", { name: "이 자원을 기준점으로", exact: true }).click();
  await visible(page.getByRole("button", { name: "기준점 해제", exact: true }));

  // Visits: Nonsan 2026 pending → Gongju → Gongju first, late Nonsan success last.
  const older = gate(is("new/visits", p => at(NONSAN)(p) && p.get("year") === "2026"), "Nonsan visits");
  await menu(page, "지역 방문 흐름").click();
  await older.arrived;
  const newer = gate(is("new/visits", p => at(GONGJU)(p) && p.get("year") === "2026"), "Gongju visits");
  await changeRegion(page, GONGJU);
  await newer.arrived;
  await newer.release();
  await visible(page.getByText("2026년 공주시 방문 자료가 없어요.", { exact: true }));
  await waitFocusText(page, GONGJU.name);
  await older.release();
  await flush(page);
  await visible(title(page, GONGJU));
  assert.equal(await page.getByRole("heading", { name: /월별 일평균$/ }).count(), 0, "no Nonsan chart under the Gongju title");
  await excludes(main(page), whole(NONSAN_2026_MONTHS_1_7[0]), "no late Nonsan values");
  assert.equal(new URL(page.url()).pathname, "/new/44150/visits");
  assert.equal(params(page).get("year"), "2026", "observation year kept, no fallback to 2025");
  assert.equal(params(page).get("month"), "2026-10", "calendar month kept");
  assert.equal(await yearSelect(page).inputValue(), "2026");
  assert.ok((await yearSelect(page).locator("option").allTextContents()).includes("2026년 (자료 없음)"));
  await page.getByRole("button", { name: "연도 바꾸기", exact: true }).click();
  await waitFocusId(page, "new-visits-year");
  passed.push("AC8-late-previous-visits-ignored-year-kept-no-auto-fallback");

  // Resources: Gongju pending → Imsil; region-bound selections are gone.
  const oldList = gate(is("existing/resources", p => at(GONGJU)(p) && p.get("types") === "12"), "Gongju resources");
  await menu(page, "지역 관광자원").click();
  await oldList.arrived;
  assert.equal(await page.getByRole("heading", { name: "함께 보기 0/2", exact: true }).count(), 1, "compare reset on region change");
  assert.equal(await page.locator("#new-resource-detail-heading").count(), 0, "detail reset");
  await noAnchor(page);
  const newList = gate(is("existing/resources", p => at(IMSIL)(p) && p.get("types") === "12"), "Imsil resources");
  await changeRegion(page, IMSIL);
  await newList.arrived;
  await newList.release();
  await visible(rowButton(page, RESOURCES["52750"]["12"][0]));
  await oldList.release();
  await flush(page);
  await visible(page.getByRole("heading", { level: 2, name: "임실군 관광자원", exact: true }));
  await excludes(main(page), "검증용 공주 관광지", "late Gongju list ignored");
  await visible(page.getByRole("heading", { name: "함께 보기 0/2", exact: true }));

  // Timing: candidates and month stay and are re-queried for the new region; a late failure of the old one is ignored.
  const oldMonth = gate(is("existing/schedule", p => at(IMSIL)(p) && p.get("start") === "2026-10-01"), "Imsil month");
  await menu(page, "개최 시기").click();
  await oldMonth.arrived;
  assert.equal(await candidate(page, "A").getByRole("heading").innerText(), candidateName("A", ...A1));
  assert.equal(await candidate(page, "B").getByRole("heading").innerText(), candidateName("B", ...O1));
  await waitServed("existing/schedule", p => at(IMSIL)(p) && p.get("start") === A1[0] && p.get("end") === A1[1], "Imsil candidate A");
  await changeRegion(page, NONSAN);
  await visible(calendarHeading(page, "2026-10", NONSAN));
  await oldMonth.release(HTTP_503);
  await flush(page);
  await visible(calendarHeading(page, "2026-10", NONSAN));
  assert.equal(await page.getByRole("alert").filter({ hasText: /달력 정보를 불러오지 못했어요|행사 일정을 불러오지 못했어요/ }).count(), 0, "late failure ignored");
  assert.equal(await candidates(page).count(), 2);
  assert.equal(params(page).get("year"), "2026");
  await go(page, "지역 관광자원", "new-resources-heading");
  await visible(page.getByRole("heading", { name: "함께 보기 0/2", exact: true }));
  await noAnchor(page);
  assert.equal(await page.locator("#new-resource-detail-heading").count(), 0);
  passed.push("AC8-late-resources-and-events-ignored-selections-reset-candidates-month-kept");
  return { context, page };
}

async function refreshKeepsOrReleases() {
  // AC11 · AC13 · AC9 (검증용): after the 10-minute tab memory expires, a failed list refresh keeps the choice, a
  // successful complete refresh that no longer lists a compared id releases it; a failed intro refresh keeps the text.
  const { context, page } = await openContext();
  await context.clock.install();
  await page.goto(`${base}/new/44230/resources`);
  await visible(page.getByText(/^조회 5건/));
  for (const r of [A, B]) await listToggle(page, r, "함께 보기에 추가").click();
  await rowButton(page, A).click();
  await visible(intro(page, A));
  await context.clock.fastForward("11:00");
  once(is("existing/resources", p => at(NONSAN)(p) && p.get("types") === "12"), resourcesWith({ "12": "unavailable" }));
  once(is("existing/resources", p => at(NONSAN)(p) && p.get("types") === "14"), resourcesWith({ "14": [D] }));
  detailOutcome.set(A.id, "unavailable");
  await go(page, "지역 방문 흐름", "new-visits-heading");
  await go(page, "지역 관광자원", "new-resources-heading");
  await visible(page.getByRole("alert").filter({ hasText: /관광지 새 목록을 불러오지 못했어요\. 2026\. 9\. 1\./ }));
  await visible(page.getByRole("heading", { name: "함께 보기 1/2", exact: true }));
  await visible(compareCard(page, A));
  assert.equal(await compareCard(page, B).count(), 0, "confirmed gone after a complete successful refresh");
  await visible(detail(page, A));
  const stale = detail(page, A).getByRole("alert").filter({ hasText: /새 소개를 불러오지 못했어요\. 2026\. 9\. 15\./ });
  await visible(stale);
  await includes(intro(page, A), "검증용 소개 가 (가상)", "earlier introduction of the same resource kept");
  detailOutcome.delete(A.id);
  await stale.getByRole("button", { name: `${A.title} 소개 다시 불러오기`, exact: true }).click();
  await stale.waitFor({ state: "detached" });

  // Compare-only view (no detail open): an earlier EMPTY introduction whose refresh fails shows a failure and an
  // in-place retry instead of a silent dash; a compared text introduction shows its stale notice, retry and source.
  detailOutcome.set(D.id, "empty");
  await listToggle(page, D, "함께 보기에 추가").click();
  await visible(page.getByRole("heading", { name: "함께 보기 2/2", exact: true }));
  await waitServed("new/resource-detail", p => p.get("id") === D.id, "compare intro D");
  await ddOf(compareCard(page, D), "소개").filter({ hasText: /^—$/ }).waitFor({ state: "visible" });
  assert.equal(await ddOf(compareCard(page, D), "소개").innerText(), "—", "confirmed empty before the refresh");
  await detail(page, A).getByRole("button", { name: "상세 닫기", exact: true }).click();
  await context.clock.fastForward("11:00");
  detailOutcome.set(D.id, "unavailable"); detailOutcome.set(A.id, "unavailable");
  await go(page, "지역 방문 흐름", "new-visits-heading");
  await go(page, "지역 관광자원", "new-resources-heading");
  assert.equal(await page.locator("#new-resource-detail-heading").count(), 0, "compare-only view");
  const failedD = compareCard(page, D).getByRole("alert").filter({ hasText: "불러오지 못했어요." });
  await visible(failedD);
  assert.notEqual(await ddOf(compareCard(page, D), "소개").innerText(), "—", "a failed refresh is not a silent absence");
  const staleA = compareCard(page, A).getByRole("alert").filter({ hasText: /새 소개를 불러오지 못해 2026\. 9\. 15\./ });
  await visible(staleA);
  await includes(ddOf(compareCard(page, A), "소개"), "검증용 소개 가 (가상)", "earlier text kept in the compare card");
  await dialogRoundTrip(page, `${A.title} 소개 출처 보기`, `${A.title} 소개 출처`, async dialog => {
    assert.match(await dialog.innerText(), /소개 수집 2026\. 9\. 15\./);
  }, { scope: compareCard(page, A), shown: "소개 출처" });
  detailOutcome.set(D.id, "empty"); detailOutcome.delete(A.id);
  await failedD.getByRole("button", { name: `${D.title} 소개 다시 불러오기`, exact: true }).click();
  await failedD.waitFor({ state: "detached" });
  await ddOf(compareCard(page, D), "소개").filter({ hasText: /^—$/ }).waitFor({ state: "visible" });
  assert.equal(await ddOf(compareCard(page, D), "소개").innerText(), "—", "retry restores the confirmed empty state");
  await staleA.getByRole("button", { name: `${A.title} 소개 다시 불러오기`, exact: true }).click();
  await staleA.waitFor({ state: "detached" });
  detailOutcome.delete(D.id);
  await context.close();
  passed.push("AC11-failed-refresh-keeps-success-without-id-releases", "AC13-same-resource-intro-refresh-failure-keeps-earlier",
    "AC13-compare-only-empty-then-failed-refresh-shows-retry-and-stale-source");
}

async function failuresAndNoData() {
  // AC9: map background failure → list stays usable; a district without visit archive keeps resources and calendar.
  const { context, page } = await openContext({ mapFail: true });
  await page.goto(`${base}/new/44230/resources`);
  await visible(page.getByRole("alert").filter({ hasText: "지도를 불러오지 못했어요. 목록은 계속 볼 수 있어요." }));
  await visible(page.getByRole("button", { name: "지도 다시 열기", exact: true }));
  await rowButton(page, A).click();
  await visible(detail(page, A));
  await listToggle(page, B, "함께 보기에 추가").click();
  await visible(page.getByRole("heading", { name: "함께 보기 1/2", exact: true }));
  await page.goto(`${base}/new/11110/visits`);
  await visible(page.getByText("종로구의 방문 자료가 없어요.", { exact: true }));
  await excludes(main(page), whole(NONSAN_2025_MONTHS[0]), "never another region's values");
  await page.getByRole("link", { name: "지역 관광자원 보기", exact: true }).click();
  await visible(page.getByText("관광지: 조회한 등록 결과가 없어요", { exact: true }));
  await visible(page.getByText("선택한 유형에 조회된 자원이 없어요.", { exact: true }));
  await go(page, "개최 시기", "new-timing-heading");
  await visible(calendarHeading(page, kstMonth(), JONGNO));
  await context.close();
  passed.push("AC9-map-failure-list-usable-no-visit-archive-keeps-resources-and-calendar");
}

async function mobile() {
  // AC10: 390px, keyboard-reachable controls, no page-level horizontal overflow in any view.
  const { context, page } = await openContext({ viewport: { width: 390, height: 844 } });
  await page.goto(`${base}/new`);
  await noPageOverflow(page, "start");
  await pickRegion(page, NONSAN, "지역 살펴보기");
  await waitPath(page, "/new/44230/resources");
  await visible(rowButton(page, A));
  await noPageOverflow(page, "resources list");
  for (const r of [A, C]) { const t = listToggle(page, r, "함께 보기에 추가"); await t.focus(); await page.keyboard.press("Enter"); }
  await visible(page.getByRole("heading", { name: "함께 보기 2/2", exact: true }));
  await noPageOverflow(page, "compare");
  await page.getByRole("group", { name: "보기 방식" }).getByRole("button", { name: "지도", exact: true }).click();
  await visible(page.getByRole("group", { name: /^관광자원 지도/ }));
  await noPageOverflow(page, "resources map");
  await go(page, "지역 방문 흐름", "new-visits-heading");
  await page.getByRole("button", { name: "월별 수치 표 보기", exact: true }).click();
  await page.getByRole("button", { name: "요일별 수치 표 보기", exact: true }).click();
  await monthButton(page, 2025, 10).click();
  await visible(page.getByRole("region", { name: "2025년 10월 일별 수치 표", exact: true }));
  await noPageOverflow(page, "visits tables");
  await go(page, "개최 시기", "new-timing-heading");
  await addCandidate(page, "2026-09-28", "2026-10-03");
  await visible(ddOf(candidate(page, "A"), "등록 행사"));
  await noPageOverflow(page, "timing");
  mkdirSync("output/playwright", { recursive: true });
  await page.screenshot({ path: "output/playwright/new-festival-mobile.png", fullPage: true });
  await context.close();
  passed.push("AC10-390px-no-page-overflow-all-views");
}

async function sejong() {
  // AC1 · contract: Sejong's user route is /new/36110 and maps to the catalogue/API pair 36110/36110.
  const { context, page } = await openContext();
  await page.goto(`${base}/new`);
  await pickRegion(page, SEJONG, "지역 살펴보기");
  await page.waitForURL(u => u.pathname.startsWith("/new/") && u.pathname !== "/new");
  assert.equal(new URL(page.url()).pathname, "/new/36110/resources", "Sejong route must be /new/36110 (not /new/3611036110)");
  await visible(title(page, SEJONG));
  await waitServed("existing/resources", p => p.get("province") === "36110" && p.get("district") === "36110", "Sejong resources 36110/36110");
  const direct = await page.goto(`${base}/new/36110/visits`);
  assert.ok(direct && direct.status() < 400, `/new/36110 responds (${direct?.status()})`);
  await visible(title(page, SEJONG));
  await context.close();
  passed.push("AC1-sejong-route-36110-api-36110-36110");
}

// ---- Run ----
const primary = await openContext();
try {
  const { page, context } = primary;
  // AC1 · AC2 · AC3: the first region load fails one resource type once (retry is part of the scenario).
  once(is("existing/resources", p => at(NONSAN)(p) && p.get("types") === "14"), resourcesWith({ "14": "unavailable" }));
  await entry(primary);
  const before = await storageState(page, context);
  await resourcesAndIntro(primary);
  await compareAndAnchor(primary);
  await timing(primary);
  await visits(primary);
  await go(page, "지역 관광자원", "new-resources-heading"); // AC1: free order, no save step
  await visible(page.getByRole("heading", { name: "함께 보기 2/2", exact: true }));
  await noWritingFields(page, "resources");
  assert.deepEqual(await storageState(page, context), before, "no persisted decisions in the main tab");
  passed.push("AC1-three-views-any-order-without-writing-or-saving");
  await zeroVersusMissing();
  const changed = await regionChange();
  assert.deepEqual((await storageState(changed.page, changed.context)).local, [], "no persisted decisions after region changes");
  await changed.context.close();
  await refreshKeepsOrReleases();
  await failuresAndNoData();
  await mobile();
  assert.deepEqual(writes, [], "no same-origin non-GET request");
  assert.deepEqual(errors, []);
  assert.deepEqual(fixtureErrors, []);
  assert.equal(queue.length, 0, `unused overrides: ${queue.length}`);
  passed.push("AC10-no-writes-no-storage-no-page-errors");
  await sejong(); // last: a failure here names only the Sejong route contract
  console.log(JSON.stringify({ headless: true, realArchive: ["new/visits", "holidays"], fixtures: "검증용 resources/introductions/events/map tiles + Imsil 2023 zero/missing + one duplicate holiday label",
    passed, browserErrors: errors.length, clientWrites: writes.length, apiRequests: calls.length, ignoredFetchFailures: fetchFailures }));
} finally {
  await browser.close();
}
