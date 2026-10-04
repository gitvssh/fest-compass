import test from "node:test";
import assert from "node:assert/strict";
import { regionRef } from "../existing/identity";
import { InvalidRequest } from "../existing/request";
import { TourUnavailable, type TourPage } from "../existing/tour";
import { parseCrowd, parseRelated } from "./request";
import { createSignalCall, createSignalService, crowdFrom, relatedFrom, relatedMonths, signalTargets, type SignalCall, type SignalOperation } from "./server";

const NOW = "2026-10-05T01:00:00.000Z";
const page = (rows: Record<string, unknown>[], total = rows.length): TourPage => ({ total, pageNo: 1, rows, collectedAt: NOW });
const crowdRow = (name: string, day: string, rate: string, areaCd = "44", signguCd = "44230") => ({ tAtsNm: name, baseYmd: day, cnctrRate: rate, areaCd, signguCd, areaNm: "충청남도", signguNm: "논산시" });
const relatedRow = (center: string, rank: number, name: string, category: string, ym = "202608", extra: Record<string, unknown> = {}) => ({
  baseYm: ym, tAtsCd: `c-${center}`, tAtsNm: center, rlteTatsNm: name, rlteRank: String(rank), rlteCtgryLclsNm: category, rlteCtgryMclsNm: category, rlteCtgrySclsNm: `${category}상세`, rlteSignguNm: "논산시", ...extra,
});
/** Fake provider: answers by operation and the queried codes/month; records every call. */
function fake(answer: (op: SignalOperation, p: Record<string, string>) => TourPage | Error) {
  const calls: [SignalOperation, Record<string, string>][] = [];
  const call: SignalCall = async (op, p) => { calls.push([op, p]); const a = answer(op, p); if (a instanceof Error) throw a; return a; };
  return { call, calls };
}
const nonsan = { province: "44", district: "230" };

test("request parsing: exact region pairs and an optional YYYY-MM month", () => {
  assert.deepEqual(parseCrowd(new URLSearchParams("province=44&district=230")), nonsan);
  assert.deepEqual(parseRelated(new URLSearchParams("province=44&district=230&month=2026-08")), { ...nonsan, month: "2026-08" });
  assert.deepEqual(parseRelated(new URLSearchParams("province=44&district=230")), { ...nonsan, month: null });
  for (const q of ["province=44&district=999", "province=&district=230", "province=44&district=230&month=2026-13", "province=44&district=230&month=202608"])
    assert.throws(() => (q.includes("month") ? parseRelated : parseCrowd)(new URLSearchParams(q)), InvalidRequest, q);
});

test("targets: previous code for merged Jeonnam districts first, the whole city for a ward, Sejong as 36/36110", () => {
  const codes = (p: string, d: string) => signalTargets(regionRef(p, d)!).map(t => `${t.areaCd}/${t.signguCd}${t.basis ? `(${t.basis.name})` : ""}`);
  assert.deepEqual(codes("12", "770"), ["46/46800", "12/12770"]);
  assert.deepEqual(codes("44", "230"), ["44/44230"]);
  assert.deepEqual(codes("41", "591"), ["41/41591", "41/41590(화성시)"]);
  assert.deepEqual(codes("36110", "36110"), ["36/36110"]);
});

test("crowd rows: spots x days with mean and peak; rows of another region, bad values or repeats are unusable", () => {
  const target = { areaCd: "44", signguCd: "44230", basis: null };
  const out = crowdFrom([crowdRow("가", "20261005", "50.5"), crowdRow("가", "20261006", "90"), crowdRow("나", "20261005", "70"), crowdRow("나", "20261007", "10")], target);
  assert.deepEqual(out.days, ["2026-10-05", "2026-10-06", "2026-10-07"]);
  assert.deepEqual(out.spots.map(s => [s.name, s.rates, s.mean, s.peak]), [["가", [50.5, 90, null], 70.25, { date: "2026-10-06", rate: 90 }], ["나", [70, null, 10], 40, { date: "2026-10-05", rate: 70 }]]);
  assert.deepEqual(out.daily, [60.25, 90, 10]);
  for (const bad of [[crowdRow("가", "20261005", "50", "44", "44150")], [crowdRow("가", "2026-10-05", "50")], [crowdRow("가", "20261005", "-1")], [crowdRow("가", "20261005", "x")], [crowdRow("가", "20261005", "50"), crowdRow("가", "20261005", "60")], [crowdRow("", "20261005", "50")]])
    assert.throws(() => crowdFrom(bad, target), TourUnavailable);
});

test("related rows: centers with their spots by rank; another month or an unknown category is unusable", () => {
  const out = relatedFrom([relatedRow("탑정호", 2, "선샤인랜드", "관광지"), relatedRow("탑정호", 1, "강경젓갈", "음식"), relatedRow("미내다리", 1, "호텔", "숙박"), relatedRow("탑정호", 1, "강경젓갈", "음식")], "2026-08");
  assert.deepEqual(out.map(c => [c.name, c.items.map(i => `${i.rank}.${i.name}/${i.category}/${i.detail}`)]), [["탑정호", ["1.강경젓갈/음식/음식상세", "2.선샤인랜드/관광지/관광지상세"]], ["미내다리", ["1.호텔/숙박/숙박상세"]]]);
  assert.throws(() => relatedFrom([relatedRow("탑정호", 1, "x", "관광지", "202607")], "2026-08"), TourUnavailable);
  assert.throws(() => relatedFrom([relatedRow("탑정호", 1, "x", "쇼핑")], "2026-08"), TourUnavailable);
  assert.throws(() => relatedFrom([relatedRow("탑정호", 0, "x", "관광지")], "2026-08"), TourUnavailable);
});

test("related months: twelve months ending two months back, never before 2024-05", () => {
  assert.deepEqual(relatedMonths("2026-10-05"), ["2026-08", "2026-07", "2026-06", "2026-05", "2026-04", "2026-03", "2026-02", "2026-01", "2025-12", "2025-11", "2025-10", "2025-09"]);
  assert.deepEqual(relatedMonths("2024-09-01"), ["2024-07", "2024-06", "2024-05"]);
  assert.deepEqual(relatedMonths("2027-01-31"), relatedMonths("2027-01-01"));
  assert.equal(relatedMonths("2027-02-01")[0], "2026-12");
});

test("crowd: complete through the previous code, empty when no code answers, unavailable on failure", async () => {
  const days = Array.from({ length: 30 }, (_, i) => `202610${String(5 + i).padStart(2, "0")}`.replace(/^(\d{6})(\d+)$/, (_, ym, d) => Number(d) > 31 ? `202611${String(Number(d) - 31).padStart(2, "0")}` : `${ym}${d}`));
  const jangheung = fake((op, p) => (p.signguCd === "46800" ? page(days.map(d => crowdRow("보림사", d, "40", "46", "46800"))) : page([])));
  const s = createSignalService({ call: jangheung.call, now: () => NOW });
  const c = await s.loadCrowd({ province: "12", district: "770" });
  assert.deepEqual([c.status, c.days.length, c.spots.map(x => x.name), c.basis, c.region.code], ["complete", 30, ["보림사"], null, "12770"]);
  assert.deepEqual(jangheung.calls.map(([, p]) => `${p.areaCd}/${p.signguCd}/${p.numOfRows}/${p.pageNo}`), ["46/46800/1000/1"]);
  assert.equal(c.source?.url, "https://www.data.go.kr/data/15128555/openapi.do");
  const none = createSignalService({ call: fake(() => page([])).call, now: () => NOW });
  assert.deepEqual(await none.loadCrowd({ province: "12", district: "770" }).then(x => [x.status, x.spots.length, x.source]), ["empty", 0, null]);
  const down = createSignalService({ call: fake(() => new TourUnavailable()).call, now: () => NOW });
  const failed = await down.loadCrowd(nonsan);
  assert.deepEqual([failed.status, failed.days, failed.source], ["unavailable", [], null]);
  assert.ok(!JSON.stringify(failed).includes("serviceKey"));
});

test("crowd: a ward falls back to its whole city and says so; pages are read until the total", async () => {
  const rows = Array.from({ length: 1500 }, (_, i) => crowdRow(`곳${Math.floor(i / 30)}`, `202610${String(1 + (i % 30)).padStart(2, "0")}`, "50", "41", "41590"));
  const city = fake((op, p) => (p.signguCd === "41590" ? page(rows.slice((Number(p.pageNo) - 1) * 1000, Number(p.pageNo) * 1000), 1500) : page([])));
  const c = await createSignalService({ call: city.call, now: () => NOW }).loadCrowd({ province: "41", district: "591" });
  assert.deepEqual([c.status, c.basis, c.spots.length, c.days.length], ["complete", { name: "화성시", parentOf: "화성시 만세구" }, 50, 30]);
  assert.deepEqual(city.calls.map(([, p]) => `${p.signguCd}:${p.pageNo}`), ["41591:1", "41590:1", "41590:2"]);
  const shifting = fake((op, p) => (p.pageNo === "1" ? page(rows.slice(0, 1000), 1500) : page(rows.slice(1000), 1499)));
  assert.equal((await createSignalService({ call: shifting.call, now: () => NOW }).loadCrowd({ province: "41", district: "590" })).status, "unavailable");
});

test("related: newest month, or the one before when the newest has nothing; a month outside the list is invalid", async () => {
  const provider = fake((op, p) => (p.baseYm === "202607" ? page([relatedRow("탑정호", 1, "선샤인랜드", "관광지", "202607")]) : page([])));
  const s = createSignalService({ call: provider.call, now: () => NOW });
  const r = await s.loadRelated({ ...nonsan, month: null });
  assert.deepEqual([r.status, r.month, r.months[0], r.months.length, r.centers[0].name], ["complete", "2026-07", "2026-08", 12, "탑정호"]);
  assert.deepEqual(provider.calls.map(([, p]) => p.baseYm), ["202608", "202607"]);
  const chosen = await s.loadRelated({ ...nonsan, month: "2026-08" });
  assert.deepEqual([chosen.status, chosen.month, chosen.centers], ["empty", "2026-08", []]);
  await assert.rejects(s.loadRelated({ ...nonsan, month: "2025-08" }), InvalidRequest);
  const down = await createSignalService({ call: fake(() => new TourUnavailable()).call, now: () => NOW }).loadRelated({ ...nonsan, month: null });
  assert.deepEqual([down.status, down.month, down.centers], ["unavailable", "2026-08", []]);
});

test("call: no key or an upstream error is unavailable without leaking; answers are kept for a while", async () => {
  await assert.rejects(createSignalCall({ key: () => undefined })("tatsCnctrRatedList", {}), TourUnavailable);
  let fetched = 0;
  const ok = (body: unknown) => { fetched++; return new Response(JSON.stringify(body), { status: 200 }); };
  const body = { response: { header: { resultCode: "0000", resultMsg: "OK" }, body: { items: { item: [crowdRow("가", "20261005", "50")] }, numOfRows: 1000, pageNo: 1, totalCount: 1 } } };
  let now = 0;
  const call = createSignalCall({ key: () => "secret%2Bkey", now: () => now, fetch: (async (url: URL) => { assert.ok(String(url).includes("TatsCnctrRateService/tatsCnctrRatedList")); return ok(body); }) as typeof fetch });
  const a = await call("tatsCnctrRatedList", { areaCd: "44", signguCd: "44230" });
  await call("tatsCnctrRatedList", { signguCd: "44230", areaCd: "44" });
  assert.deepEqual([a.total, a.rows.length, fetched], [1, 1, 1], "same query is answered from memory");
  now = 3_600_001; await call("tatsCnctrRatedList", { areaCd: "44", signguCd: "44230" }); assert.equal(fetched, 2, "forecast is refreshed after an hour");
  const failing = createSignalCall({ key: () => "secret", fetch: (async () => new Response("SERVICE_KEY_IS_NOT_REGISTERED_ERROR secret", { status: 200 })) as typeof fetch });
  await assert.rejects(failing("areaBasedList1", { baseYm: "202608" }), (e: unknown) => e instanceof TourUnavailable && !String((e as Error).message).includes("secret"));
});
