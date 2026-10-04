import type { FestivalPeriodTrend, ScaleDataset, ScaleFestival } from "./types";

// One year of the culture-tourism festival file, ranked. Nothing here is a new estimate: every number is the file's
// own value (or its share of the file's own period total), so a row can always be traced back to its source line.
export type ScaleSort = "mean" | "total" | "outside" | "local";
export const SCALE_SORTS: Readonly<Record<ScaleSort, { label: string; share: boolean }>> = {
  mean: { label: "일평균", share: false }, total: { label: "기간 합계", share: false },
  outside: { label: "외지인 비율", share: true }, local: { label: "현지인 비율", share: true },
};
export const isScaleSort = (v: unknown): v is ScaleSort => typeof v === "string" && Object.hasOwn(SCALE_SORTS, v);

/** Display rule of this service (not a source classification): 60% or more of one group marks the festival as that group's. */
export const ORIENTATION_SHARE = 0.6;
export type Orientation = "outside" | "local" | "mixed";
export type Shares = { local: number; outside: number; foreign: number };
export const orientationOf = (s: Shares): Orientation => s.outside >= ORIENTATION_SHARE ? "outside" : s.local >= ORIENTATION_SHARE ? "local" : "mixed";

export type ScaleRow = {
  rank: number; id: string; name: string; place: string; days: number; periodTotal: number; dailyMean: number;
  local: number; outside: number; foreign: number; shares: Shares; orientation: Orientation;
};
export type ScaleYear = { year: number; sort: ScaleSort; rows: ScaleRow[]; absent: { id: string; name: string }[] };
type Festivals = Pick<ScaleDataset, "festivals">;

/** Years with at least one festival, newest first. */
export function scaleYears(dataset: Festivals): number[] {
  return [...new Set(dataset.festivals.flatMap(f => f.years.map(y => y.year)))].sort((a, b) => b - a);
}

const sortValue = (r: Omit<ScaleRow, "rank">, sort: ScaleSort) =>
  sort === "mean" ? r.dailyMean : sort === "total" ? r.periodTotal : sort === "outside" ? r.shares.outside : r.shares.local;

/** Province short names in the conventional order, as DataLab road addresses write them. */
const PROVINCE_ORDER = ["서울", "부산", "대구", "인천", "광주", "대전", "울산", "세종", "경기", "강원", "충북", "충남", "전북", "전남", "경북", "경남", "제주"];
/** A place label is "충남 논산시", "광주 서구·남구" or several of these joined by " · ". */
export const provincesOf = (place: string) => [...new Set(place.split(" · ").map(p => p.split(" ")[0]))];
const provinceRank = (p: string) => { const i = PROVINCE_ORDER.indexOf(p); return i < 0 ? PROVINCE_ORDER.length : i; };
/** Provinces that hold at least one festival, with how many, in the conventional order. */
export function scaleProvinces(dataset: Festivals): { name: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const f of dataset.festivals) for (const p of provincesOf(f.place)) counts.set(p, (counts.get(p) ?? 0) + 1);
  return [...counts].map(([name, count]) => ({ name, count })).sort((a, b) => provinceRank(a.name) - provinceRank(b.name) || a.name.localeCompare(b.name, "ko-KR"));
}

/** Ranks festivals of one year; with a province, only that province's festivals take part and ranks count within it. */
export function rankScale(dataset: Festivals, year: number, sort: ScaleSort, province: string | null = null): ScaleYear {
  const rows: Omit<ScaleRow, "rank">[] = [], absent: ScaleYear["absent"] = [];
  for (const f of dataset.festivals) {
    if (province && !provincesOf(f.place).includes(province)) continue;
    const y = f.years.find(v => v.year === year);
    if (!y) { absent.push({ id: f.id, name: f.name }); continue; }
    const shares = { local: y.local / y.periodTotal, outside: y.outside / y.periodTotal, foreign: y.foreign / y.periodTotal };
    rows.push({ id: f.id, name: f.name, place: f.place, days: y.days, periodTotal: y.periodTotal, dailyMean: y.dailyMean, local: y.local, outside: y.outside, foreign: y.foreign, shares, orientation: orientationOf(shares) });
  }
  const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, "ko-KR");
  rows.sort((a, b) => sortValue(b, sort) - sortValue(a, sort) || byName(a, b));
  return { year, sort, rows: rows.map((r, i) => ({ ...r, rank: i + 1 })), absent: absent.sort(byName) };
}

/** Address state: an unknown year, sort or province falls back to the newest year, the daily mean and the whole country. */
export function scaleParams(dataset: Festivals, rawYear: unknown, rawSort: unknown, rawProvince?: unknown): { year: number; sort: ScaleSort; province: string | null } {
  const years = scaleYears(dataset), year = Number(rawYear);
  const province = typeof rawProvince === "string" && scaleProvinces(dataset).some(p => p.name === rawProvince) ? rawProvince : null;
  return { year: typeof rawYear === "string" && years.includes(year) ? year : years[0], sort: isScaleSort(rawSort) ? rawSort : "mean", province };
}

/** Whole percent, but a non-zero share below 1% keeps one decimal (or reads "<0.1%") so it never reads as none. */
export function sharePercent(share: number): string {
  const p = share * 100;
  if (p > 0 && p < 0.05) return "<0.1%";
  return p > 0 && p < 0.95 ? `${p.toFixed(1)}%` : `${Math.round(p)}%`;
}

/** The ranking's public input: per-year values only, no raw rows or source evidence. */
export const scaleFestivals = (festivals: FestivalPeriodTrend[]): ScaleFestival[] =>
  festivals.map(f => ({ id: f.id, name: f.name, place: f.place, years: f.years.map(({ year, days, periodTotal, dailyMean, local, outside, foreign }) => ({ year, days, periodTotal, dailyMean, local, outside, foreign })) }));
