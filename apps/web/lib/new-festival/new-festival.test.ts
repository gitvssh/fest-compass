import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import bundled from "../../data/region-history.json";
import expanded from "../../data/regional-history-expanded.json";
import type { Dataset } from "../region/model";
import { createExistingService } from "../existing/server";
import { InvalidRequest, parseMonthly } from "../existing/request";
import type { TourCall, TourOperation, TourPage } from "../existing/tour";
import type { DataFreshness } from "../existing/types";
import { loadResourceDetail, DETAIL_SOURCE_TITLE } from "./detail";
import { decodeEntities, OVERVIEW_MAX, overviewText } from "./overview";
import { newVisitsKey, parseNewVisits, parseResourceDetail, resourceDetailKey } from "./request";
import { defaultRegionAnnual } from "../datalab/region-annual";
import { createNewFestivalService, loadVisits as productionVisits } from "./server";
import { weekdayMeans } from "./weekday";

const FRESH: DataFreshness = { mode: "archive-only", collectedAt: null, runtimeCollectedAt: null, refresh: { status: "not-configured", retryable: false } };
const NOW = "2026-09-23T03:00:00.000Z";
const ALL = [...bundled, ...expanded.datasets] as Dataset[];
const noTour: TourCall = async () => { throw new Error("tour not used"); };
function services(datasets: Dataset[] = ALL, tour: TourCall = noTour) {
  const existing = createExistingService({ archive: async () => ({ datasets, freshness: FRESH, runtime: [], runtimeRegions: [] }), regionList: async () => { throw new Error("unused"); }, tour, now: () => NOW });
  return { existing, fresh: createNewFestivalService({ monthly: existing.loadMonthly, tour, now: () => NOW }) };
}
const q = (s: string) => new URLSearchParams(s);
const visits = (s: string, datasets?: Dataset[]) => services(datasets).fresh.loadVisits(parseNewVisits(q(s)));

/** Independent reference: latest collected row per date for one region; only quality "complete" with a finite value >= 0 counts. */
function reference(code: string, year: number) {
  const latest = new Map<string, { at: string; value: number | null }>();
  for (const d of ALL.filter(d => d.region.code === code)) for (const p of d.points) {
    if (!p.date.startsWith(`${year}-`)) continue;
    const prev = latest.get(p.date);
    if (!prev || d.collectedAt > prev.at) latest.set(p.date, { at: d.collectedAt, value: p.quality === "complete" && typeof p.value === "number" && p.value >= 0 ? p.value : null });
  }
  const byWeekday = new Map<number, { days: number; sum: number; missing: number }>();
  for (let t = Date.UTC(year, 0, 1); t <= Date.UTC(year, 11, 31); t += 86_400_000) {
    const date = new Date(t).toISOString().slice(0, 10), w = new Date(t).getUTCDay(), v = latest.get(date)?.value ?? null;
    const e = byWeekday.get(w) ?? { days: 0, sum: 0, missing: 0 };
    e.days++; if (v === null) e.missing++; else e.sum += v; byWeekday.set(w, e);
  }
  return byWeekday;
}

test("Nonsan default year is 2025; weekday means equal an independent raw-data recomputation and the published table", async () => {
  const r = await visits("province=44&district=230");
  assert.deepEqual([r.request.year, r.year, r.defaultYear, r.status, r.weekdays.status, r.weekdays.yearComplete], [null, 2025, 2025, "complete", "complete", true]);
  assert.deepEqual(r.weekdays.items.map(i => i.label), ["월", "화", "수", "목", "금", "토", "일"]);
  assert.deepEqual(r.weekdays.items.map(i => i.days), [52, 52, 53, 52, 52, 52, 52], "2025-01-01 is a Wednesday");
  const ref = reference("44230", 2025);
  for (const i of r.weekdays.items) {
    const e = ref.get(i.weekday)!;
    assert.equal(e.missing, 0);
    assert.deepEqual([i.days, i.observedDays, i.missingDays, i.coverage], [e.days, e.days, 0, "complete"]);
    assert.ok(Math.abs(i.sum! - e.sum) < 1e-6 && Math.abs(i.mean! - e.sum / e.days) < 1e-9);
  }
  // data-visualization.md SCR-FC-013 reference table (sum, rounded mean).
  const published: [number, number][] = [[2_309_744.5, 44_418], [2_223_602.5, 42_762], [2_189_110, 41_304], [2_116_257.5, 40_697], [2_269_018.5, 43_635], [3_273_445, 62_951], [3_069_832.5, 59_035]];
  assert.deepEqual(r.weekdays.items.map(i => [Math.round(i.sum! * 10) / 10, i.rounded]), published);
  assert.equal(r.weekdays.items[2].mean!.toFixed(6), "41303.962264");
  const peak = r.weekdays.items[5].peak!;
  assert.ok(peak.dates.length >= 1 && peak.dates.every(d => new Date(`${d}T00:00:00Z`).getUTCDay() === 6 && r.daily.find(x => x.date === d)!.value === peak.value));
});

test("new visits keeps every existing monthly field and value; only the key differs", async () => {
  const s = services(), req = parseMonthly(q("province=44&district=230&year=2025"));
  const [m, n] = await Promise.all([s.existing.loadMonthly(req), s.fresh.loadVisits(req)]);
  const { key: mk, ...mRest } = m, { key: nk, weekdays, metric, annual, ...nRest } = n;
  assert.deepEqual(nRest, mRest);
  assert.equal(annual, null, "annual is a separate optional block (null without an injected resolver)");
  assert.notEqual(mk, nk);
  assert.equal(nk, newVisitsKey(req));
  assert.deepEqual(metric, { name: "시군구 일별 외지인 방문", unit: "명/일", basis: "통신 기반 추정", estimate: true, regionCode: "44230" });
  assert.equal(weekdays.items.reduce((s, i) => s + i.days, 0), 365);
  // Month and weekday sums come from the same daily values.
  const monthTotal = n.months.reduce((s, x) => s + x.sum!, 0), weekTotal = weekdays.items.reduce((s, i) => s + i.sum!, 0);
  assert.ok(Math.abs(monthTotal - weekTotal) < 1e-6);
});

test("leap year 2024: 366 calendar days, Monday and Tuesday have 53", async () => {
  const r = await visits("province=44&district=150&year=2024");
  assert.deepEqual(r.weekdays.items.map(i => i.days), [53, 53, 52, 52, 52, 52, 52]);
  assert.equal(r.weekdays.items.reduce((s, i) => s + i.days, 0), 366);
  const ref = reference("44150", 2024);
  for (const i of r.weekdays.items) assert.ok(Math.abs(i.mean! - ref.get(i.weekday)!.sum / ref.get(i.weekday)!.days) < 1e-9);
});

test("partial 2026 is never the default; explicitly chosen it withholds all seven weekday means but keeps counts and complete months", async () => {
  const r = await visits("province=44&district=230&year=2026");
  assert.deepEqual([r.year, r.defaultYear, r.status, r.weekdays.status, r.weekdays.yearComplete], [2026, 2025, "partial", "incomplete-year", false]);
  assert.ok(r.weekdays.items.every(i => i.sum === null && i.mean === null && i.rounded === null && i.peak === null));
  const ref = reference("44230", 2026);
  for (const i of r.weekdays.items) assert.deepEqual([i.days, i.missingDays, i.observedDays + i.missingDays, i.missingDates.length], [ref.get(i.weekday)!.days, ref.get(i.weekday)!.missing, i.days, i.missingDays]);
  assert.ok(r.months.some(m => m.status === "complete" && m.mean !== null), "independent complete months remain");
});

test("a single missing day withholds all seven weekday means; a true zero stays observed", () => {
  const days: { date: string; value: number | null }[] = [];
  for (let t = Date.UTC(2025, 0, 1); t <= Date.UTC(2025, 11, 31); t += 86_400_000) days.push({ date: new Date(t).toISOString().slice(0, 10), value: 10 });
  const zero = days.map(d => d.date === "2025-03-05" ? { ...d, value: 0 } : d);
  const full = weekdayMeans(zero, 2025), wed = full.items[2];
  assert.deepEqual([full.status, wed.zeroDays, wed.observedDays, wed.sum, wed.rounded], ["complete", 1, 53, 520, 10]);
  assert.equal(wed.mean, 520 / 53);
  const gap = weekdayMeans(zero.map(d => d.date === "2025-07-01" ? { ...d, value: null } : d), 2025);
  assert.deepEqual([gap.status, gap.yearComplete], ["incomplete-year", false]);
  assert.ok(gap.items.every(i => i.mean === null && i.sum === null && i.peak === null));
  assert.deepEqual(gap.items[1].missingDates, ["2025-07-01"]);
  assert.deepEqual(gap.items.map(i => i.coverage), ["complete", "partial", "complete", "complete", "complete", "complete", "complete"]);
  assert.equal(gap.items[2].zeroDays, 1);
  const invalid = weekdayMeans(zero.map(d => d.date === "2025-07-02" ? { ...d, value: -1 } : d.date === "2025-07-03" ? { ...d, value: Number.NaN } : d), 2025);
  assert.deepEqual(invalid.items.map(i => i.missingDays), [0, 0, 1, 1, 0, 0, 0]);
  assert.deepEqual(weekdayMeans([], 2025).status, "none");
});

test("a newer same-definition row reporting a day missing is not revived from the older value", async () => {
  const nonsan = ALL.find(d => d.region.code === "44230" && d.points[0].date === "2023-01-01")!;
  const later: Dataset = { snapshotId: "test-correction", collectedAt: "2026-09-20T00:00:00.000Z", source: nonsan.source, region: nonsan.region,
    points: [{ date: "2025-06-11", quality: "missing", value: null }, { date: "2025-06-12", quality: "complete", value: 0 }] };
  const r = await visits("province=44&district=230&year=2025", [...ALL, later]);
  assert.deepEqual([r.status, r.weekdays.status], ["partial", "incomplete-year"]);
  assert.deepEqual(r.weekdays.items[2].missingDates, ["2025-06-11"]);
  assert.equal(r.daily.find(d => d.date === "2025-06-12")!.value, 0);
  assert.equal(r.weekdays.items[3].zeroDays, 1);
  assert.equal(r.months[5].status, "partial");
});

test("explicit unavailable year or region without data never substitutes another year or region", async () => {
  const future = await visits("province=44&district=230&year=2030");
  assert.deepEqual([future.year, future.status, future.weekdays.status, future.source], [2030, "empty", "none", null]);
  assert.ok(future.months.every(m => m.status === "none") && future.daily.every(d => d.value === null));
  const sejong = await visits("province=36110&district=36110&year=2025");
  assert.deepEqual([sejong.region.code, sejong.year, sejong.status, sejong.weekdays.status, sejong.years], ["3611036110", 2025, "empty", "none", []]);
  const sejongDefault = await visits("province=36110&district=36110");
  assert.deepEqual([sejongDefault.year, sejongDefault.status, sejongDefault.weekdays], [null, "empty", { status: "not-selected", yearComplete: false, items: [] }]);
  const gongju = await visits("province=44&district=150&year=2025"), nonsan = await visits("province=44&district=230&year=2025");
  assert.notDeepEqual(gongju.weekdays.items.map(i => i.sum), nonsan.weekdays.items.map(i => i.sum));
});

test("request parsing and canonical keys isolate region, year, kind and id", () => {
  const a = parseNewVisits(q("province=44&district=230&year=2025")), b = parseNewVisits(q("province=44&district=150&year=2025")), c = parseNewVisits(q("province=44&district=230"));
  assert.equal(new Set([newVisitsKey(a), newVisitsKey(b), newVisitsKey(c)]).size, 3);
  assert.equal(newVisitsKey(a), newVisitsKey(parseNewVisits(q("district=230&year=2025&province=44"))));
  for (const bad of ["province=44&district=999", "province=44&district=230&year=1999", "province=44&district=230&year=25"]) assert.throws(() => parseNewVisits(q(bad)), InvalidRequest);
  const d = parseResourceDetail(q("province=36110&district=36110&kind=14&id=126508"));
  assert.deepEqual(d, { province: "36110", district: "36110", kind: "14", id: "126508" });
  assert.notEqual(resourceDetailKey(d), resourceDetailKey({ ...d, kind: "12" }));
  assert.notEqual(resourceDetailKey(d), resourceDetailKey({ ...d, id: "126509" }));
  assert.notEqual(resourceDetailKey(d), resourceDetailKey({ ...d, province: "44", district: "230" }));
  const field = (s: string) => { try { parseResourceDetail(q(s)); return null; } catch (e) { return (e as InvalidRequest).field; } };
  assert.equal(field("province=44&district=230&kind=15&id=1"), "kind");
  assert.equal(field("province=44&district=230&kind=12&id=12a"), "id");
  assert.equal(field("province=44&district=230&kind=12&id="), "id");
  assert.equal(field("province=44&district=230&kind=12&id=123456789012345678901"), "id");
  assert.equal(field("province=44&district=23&kind=12&id=1"), "region");
});

const DETAIL_AT = "2026-09-23T02:00:00.000Z", LIST_AT = "2026-09-01T00:00:00.000Z";
const row = (extra: Record<string, unknown> = {}) => ({ contentid: "126508", contenttypeid: "12", title: "URL 제목과 무관", addr1: "주소", lDongRegnCd: "44", lDongSignguCd: "230",
  overview: "<p>강경의 <b>근대</b>역사문화거리.</p>", modifiedtime: "20260801120000", homepage: "<a href=\"javascript:alert(1)\">x</a>", ...extra });
function tour(page: Partial<TourPage> | Error) {
  const calls: [TourOperation, Record<string, string>][] = [];
  const call: TourCall = async (op, params) => {
    calls.push([op, params]);
    if (page instanceof Error) throw page;
    return { total: 1, pageNo: 1, rows: [row()], collectedAt: DETAIL_AT, ...page };
  };
  return { call, calls };
}
const detailReq = { province: "44", district: "230", kind: "12" as const, id: "126508" };

test("resource detail: verified identity returns only a plain-text overview with the detail fetch time", async () => {
  const t = tour({}), r = await loadResourceDetail(t.call, detailReq, () => NOW);
  assert.deepEqual(t.calls, [["detailCommon2", { contentId: "126508" }]]);
  assert.deepEqual([r.status, r.error, r.key, r.request, r.retrievedAt, r.region.code], ["complete", null, resourceDetailKey(detailReq), detailReq, NOW, "44230"]);
  assert.deepEqual(r.detail, { id: "126508", kind: "12", overview: "강경의 근대역사문화거리.", truncated: false, modifiedAt: "20260801120000" });
  assert.deepEqual(r.source, { title: DETAIL_SOURCE_TITLE, url: "https://www.data.go.kr/data/15101578/openapi.do", checkedAt: null, publishedAt: null, collectedAt: DETAIL_AT });
  assert.notEqual(r.source!.collectedAt, LIST_AT);
  assert.ok(!JSON.stringify(r).includes("URL 제목과 무관") && !JSON.stringify(r).includes("javascript") && !JSON.stringify(r).includes("주소"));
  assert.ok(r.source!.url.startsWith("https://"));
});

test("resource detail: empty, not-found, mismatches and provider failures stay distinct and carry no descriptive text", async () => {
  const status = async (page: Partial<TourPage> | Error, req: Parameters<typeof loadResourceDetail>[1] = detailReq) => { const r = await loadResourceDetail(tour(page).call, req, () => NOW); return [r.status, r.detail, r.error?.retryable ?? null]; };
  assert.deepEqual(await status({ rows: [row({ overview: "" })] }), ["empty", null, null]);
  assert.deepEqual(await status({ rows: [row({ overview: "<script>x()</script>  <br/> " })] }), ["empty", null, null]);
  assert.deepEqual(await status({ rows: [row({ overview: undefined })] }), ["empty", null, null]);
  assert.deepEqual(await status({ total: 0, rows: [] }), ["not-found", null, null]);
  assert.deepEqual(await status({ total: 3, rows: [] }), ["unavailable", null, true]);
  assert.deepEqual(await status({ total: 2, rows: [row(), row()] }), ["unavailable", null, true]);
  assert.deepEqual(await status({ total: 2, rows: [row()] }), ["unavailable", null, true]);
  assert.deepEqual(await status({ rows: [row({ contentid: "126509" })] }), ["unavailable", null, true]);
  assert.deepEqual(await status({ rows: [row({ contentid: undefined })] }), ["unavailable", null, true]);
  assert.deepEqual(await status({ rows: [row({ contenttypeid: null })] }), ["unavailable", null, true]);
  assert.deepEqual(await status({ rows: [row({ contenttypeid: "14" })] }), ["type-mismatch", null, null]);
  assert.deepEqual(await status({ rows: [row({ contenttypeid: "15" })] }), ["type-mismatch", null, null]);
  assert.deepEqual(await status({ rows: [row({ lDongSignguCd: "150" })] }), ["region-mismatch", null, null]);
  assert.deepEqual(await status({ rows: [row({ lDongRegnCd: undefined, lDongSignguCd: undefined })] }), ["region-mismatch", null, null]);
  assert.deepEqual(await status(new Error("upstream secret text")), ["unavailable", null, true]);
  const failed = await loadResourceDetail(tour(new Error("upstream secret text")).call, detailReq, () => NOW);
  assert.equal(failed.source, null);
  assert.ok(!JSON.stringify(failed).includes("secret"));
  const sejong = { province: "36110", district: "36110", kind: "14" as const, id: "5" };
  assert.deepEqual(await status({ rows: [row({ contentid: "5", contenttypeid: "14", lDongRegnCd: "36110", lDongSignguCd: "36110" })] }, sejong), ["complete", { id: "5", kind: "14", overview: "강경의 근대역사문화거리.", truncated: false, modifiedAt: "20260801120000" }, null]);
  assert.deepEqual(await status({ rows: [row({ modifiedtime: "2026-08-01" })] }).then(s => (s[1] as { modifiedAt: string | null }).modifiedAt), null);
});

test("overview plain text drops script/style/hidden content, decodes entities once and removes link schemes", () => {
  const html = "<div>첫 줄<br>둘째 줄</div><script type=\"text/javascript\">steal(document.cookie)</script><STYLE>.a{}</STYLE>"
    + "<!-- internal note --><p onclick=\"x()\">&lt;b&gt;굵게&lt;/b&gt; &amp;lt; &#54620;&#xAE00; &#0; &#x110000; &bogus;</p>"
    + "<a href=\"javascript:alert(1)\">링크</a> javascript:alert(2) data:text/html,<x> <iframe src=x>숨김</iframe><noscript>대체</noscript>끝<script>미완결";
  const { text, truncated } = overviewText(html);
  assert.equal(truncated, false);
  assert.equal(text, "첫 줄\n둘째 줄\n\n<b>굵게</b> &lt; 한글 &bogus;\n링크 끝");
  for (const hidden of ["steal", "cookie", ".a{}", "internal note", "숨김", "대체", "미완결", "onclick", "alert", "text/html"]) assert.ok(!text.includes(hidden), hidden);
  assert.equal(decodeEntities("&amp;amp;"), "&amp;");
  assert.equal(overviewText("a\u0000b​c   \n\n\n\n d").text, "abc\n\nd");
  assert.deepEqual(overviewText(42), { text: "", truncated: false });
  const long = overviewText("가".repeat(OVERVIEW_MAX + 10));
  assert.deepEqual([Array.from(long.text).length, long.truncated], [OVERVIEW_MAX, true]);
  assert.deepEqual(overviewText("😀".repeat(OVERVIEW_MAX + 1)).text, "😀".repeat(OVERVIEW_MAX), "cut on code points");
});

test("new-festival modules and routes are GET-only and never touch the database, filesystem or logged KTO client", () => {
  const root = join(__dirname, "..", "..");
  const sources = [...readdirSync(__dirname).filter(f => f.endsWith(".ts") && !f.endsWith(".test.ts")).map(f => join(__dirname, f)),
    join(root, "app/api/new/visits/route.ts"), join(root, "app/api/new/resource-detail/route.ts")];
  for (const file of sources) {
    const src = readFileSync(file, "utf8");
    assert.ok(!/from "(node:)?fs|prisma|\.\.\/db"|@\/lib\/db"|kto\/client|loggedGet|writeFile|appendFile/.test(src), file);
  }
  for (const route of sources.filter(f => f.endsWith("route.ts"))) {
    const src = readFileSync(route, "utf8");
    assert.ok(/export function GET\(/.test(src) && !/export (async )?function (POST|PUT|PATCH|DELETE)/.test(src), route);
  }
});

test("annual totals follow the selected region, not the requested monthly year; monthly and weekday contract unchanged", async () => {
  const { existing } = services(), fresh = createNewFestivalService({ monthly: existing.loadMonthly, tour: noTour, now: () => NOW, annual: defaultRegionAnnual });
  const [y2019, y2025, plain] = await Promise.all([fresh.loadVisits(parseNewVisits(q("province=52&district=750&year=2019"))), fresh.loadVisits(parseNewVisits(q("province=52&district=750&year=2025"))),
    visits("province=52&district=750&year=2025")]);
  assert.ok(y2019.annual && y2019.annual.regionCode === "52750");
  assert.deepEqual(y2019.annual, y2025.annual);
  assert.deepEqual(y2019.annual.years.map(y => y.year), [2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025]);
  assert.deepEqual([y2019.status, y2019.year, y2019.months.every(m => m.mean === null)], ["empty", 2019, true], "no daily 2019 data; annual 2019 still present");
  assert.equal(plain.annual, null, "no resolver injected -> null");
  const { annual, ...rest } = y2025, { annual: none, ...plainRest } = plain;
  assert.deepEqual([rest, none], [plainRest, null], "annual adds one field and changes nothing else");
  assert.equal((await fresh.loadVisits(parseNewVisits(q("province=44&district=230")))).annual, null, "other regions get no annual block");
  const text = JSON.stringify(y2025.annual);
  for (const leak of ["sha256", "docs/research", "commit", "\"raw\"", "E7"]) assert.ok(!text.includes(leak), `${leak} leaked`);
});

test("annual resolver failures or a region mismatch omit only the annual block; monthly failures still propagate", async () => {
  const { existing } = services(), logged: unknown[][] = [], original = console.error;
  const other = defaultRegionAnnual("52750")!;
  console.error = (...args: unknown[]) => { logged.push(args); };
  try {
    const broken = await createNewFestivalService({ monthly: existing.loadMonthly, tour: noTour, now: () => NOW, annual: () => { throw new Error("bad /tmp/x"); } }).loadVisits(parseNewVisits(q("province=52&district=750&year=2025")));
    assert.deepEqual([broken.annual, broken.status], [null, "complete"]);
    const wrong = await createNewFestivalService({ monthly: existing.loadMonthly, tour: noTour, now: () => NOW, annual: () => other }).loadVisits(parseNewVisits(q("province=44&district=230")));
    assert.equal(wrong.annual, null);
  } finally { console.error = original; }
  assert.deepEqual(logged, [["datalab-region-annual: resolver-failed"], ["datalab-region-annual: region-mismatch"]]);
  const failing = createNewFestivalService({ monthly: async () => { throw new Error("monthly down"); }, tour: noTour, annual: defaultRegionAnnual });
  await assert.rejects(failing.loadVisits(parseNewVisits(q("province=52&district=750"))), /monthly down/);
});

test("production visits wiring uses the verified annual resolver", async () => {
  const r = await productionVisits(parseNewVisits(q("province=52&district=750&year=2025")));
  assert.equal(r.annual?.regionCode, "52750");
  assert.equal(r.annual?.source.url, "https://datalab.visitkorea.or.kr/datalab/portal/loc/getAreaDataForm.do");
});
