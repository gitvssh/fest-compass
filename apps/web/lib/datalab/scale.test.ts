import test from "node:test";
import assert from "node:assert/strict";
import raw from "../../data/datalab-festival-trend.json";
import { parseFestivalPeriodDataset } from "./model";
import { orientationOf, provincesOf, rankScale, scaleFestivals, scaleParams, scaleProvinces, scaleYears, sharePercent } from "./scale";
import type { FestivalPeriodDataset } from "./types";

const dataset = parseFestivalPeriodDataset(raw);
const names = (year: number, sort: Parameters<typeof rankScale>[2], n = 3) => rankScale(dataset, year, sort).rows.slice(0, n).map(r => r.name);

test("scale: the newest year ranks the file's own daily means, period totals and group shares", () => {
  assert.deepEqual(scaleYears(dataset), [2025, 2024, 2023, 2022, 2019, 2018], "2020-2021 are absent in the source");
  const y = rankScale(dataset, 2025, "mean");
  assert.deepEqual([y.rows.length, y.absent.length], [62, 30]);
  assert.ok(["고령대가야축제", "강경젓갈축제", "진주유등축제"].every(n => y.absent.some(a => a.name === n)), "ranges ending in 2023 or 2024 have no 2025");
  assert.deepEqual(y.rows.map(r => r.rank), Array.from({ length: 62 }, (_, i) => i + 1));
  assert.deepEqual(names(2025, "mean"), ["광주김치축제", "추억의충장축제", "부평풍물대축제"]);
  assert.deepEqual(names(2025, "total"), ["진주남강유등축제", "보령머드축제", "수원화성문화제"], "long festivals lead the total but not the daily mean");
  assert.deepEqual(names(2025, "outside"), ["임실N치즈축제", "곡성세계장미축제", "하동야생차문화축제"]);
  assert.deepEqual(names(2025, "local"), ["목포항구축제", "시흥갯골축제", "밀양아리랑대축제"]);
  const top = y.rows[0], source = dataset.festivals.find(f => f.id === top.id)!.years.find(v => v.year === 2025)!;
  assert.deepEqual([top.days, top.dailyMean, top.periodTotal, top.local, top.outside, top.foreign], [source.days, source.dailyMean, source.periodTotal, source.local, source.outside, source.foreign]);
  for (const r of y.rows) assert.ok(Math.abs(r.shares.local + r.shares.outside + r.shares.foreign - 1) < 1e-6, r.name);
  assert.equal(rankScale(dataset, 2024, "mean").absent.length, 27);
  assert.equal(y.rows.find(r => r.name === "논산딸기축제")!.place, "충남 논산시");
});

test("scale: 60% of one group marks its side, anything else is mixed", () => {
  assert.equal(orientationOf({ local: 0.4, outside: 0.6, foreign: 0 }), "outside");
  assert.equal(orientationOf({ local: 0.6, outside: 0.39, foreign: 0.01 }), "local");
  assert.equal(orientationOf({ local: 0.5, outside: 0.49, foreign: 0.01 }), "mixed");
  const y = rankScale(dataset, 2025, "outside");
  assert.equal(y.rows.find(r => r.name === "임실N치즈축제")!.orientation, "outside");
  assert.equal(y.rows.find(r => r.name === "목포항구축제")!.orientation, "local");
});

test("scale: equal values keep a stable name order", () => {
  const twin = (id: string, name: string): FestivalPeriodDataset["festivals"][number] => ({ ...dataset.festivals[0], id, name, years: [{ ...dataset.festivals[0].years[0], year: 2030 }] });
  const tied: FestivalPeriodDataset = { ...dataset, festivals: [twin("b", "나축제"), twin("a", "가축제")] };
  assert.deepEqual(rankScale(tied, 2030, "mean").rows.map(r => [r.rank, r.name]), [[1, "가축제"], [2, "나축제"]]);
});

test("scale: address state falls back to the newest year and the daily mean; small shares never read as none", () => {
  assert.deepEqual(scaleParams(dataset, "2024", "outside"), { year: 2024, sort: "outside", province: null });
  assert.deepEqual(scaleParams(dataset, "2020", "views"), { year: 2025, sort: "mean", province: null });
  assert.deepEqual(scaleParams(dataset, ["2024"], undefined), { year: 2025, sort: "mean", province: null });
  assert.deepEqual(scaleParams(dataset, "2025", "mean", "충남"), { year: 2025, sort: "mean", province: "충남" });
  assert.deepEqual(scaleParams(dataset, "2025", "mean", "충청남도").province, null, "only the listed short names");
  assert.deepEqual([sharePercent(0), sharePercent(0.0003), sharePercent(0.004), sharePercent(0.0099), sharePercent(0.8838)], ["0%", "<0.1%", "0.4%", "1%", "88%"]);
});

test("scale: a province ranks only its own festivals, in the conventional province order", () => {
  assert.deepEqual(scaleProvinces(dataset).map(p => p.name), ["서울", "부산", "대구", "인천", "광주", "대전", "울산", "세종", "경기", "강원", "충북", "충남", "전북", "전남", "경북", "경남", "제주"]);
  assert.equal(scaleProvinces(dataset).reduce((n, p) => n + p.count, 0), 92, "every festival sits in exactly one province");
  const chungnam = rankScale(dataset, 2025, "mean", "충남");
  assert.deepEqual(chungnam.rows.map(r => [r.rank, r.name]), [[1, "보령머드축제"], [2, "금산인삼축제"], [3, "천안흥타령축제"], [4, "서산해미읍성축제"], [5, "논산딸기축제"], [6, "한산모시문화제"]]);
  assert.deepEqual(chungnam.absent.map(a => a.name), ["강경젓갈축제", "석장리세계구석기축제"]);
  assert.deepEqual(provincesOf("광주 서구·남구"), ["광주"]);
  assert.deepEqual(provincesOf("A 가시 · B 나군"), ["A", "B"]);
});

test("scale: the page input carries per-year values only", () => {
  const slim = scaleFestivals(dataset.festivals);
  assert.equal(slim.length, 92);
  assert.ok(!/"(raw|source|aliases|sha256|path)"/.test(JSON.stringify(slim)));
  assert.deepEqual(rankScale({ festivals: slim }, 2025, "local").rows.map(r => r.id), rankScale(dataset, 2025, "local").rows.map(r => r.id));
});
