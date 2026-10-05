import "server-only";
import raw from "../../data/datalab-region-trends.json";
import type { RegionAnnual } from "../new-festival/types";
import type { RegionTrend, RegionTrends } from "./region-trend-types";

// Strict reader for the generated region trends. Internal evidence (paths, hashes, byte counts) is checked here and never
// leaves; only the RegionTrends projection does.
export class RegionTrendDataError extends Error {}

const OFFICIAL_URL = "https://datalab.visitkorea.or.kr/datalab/portal/loc/getAreaDataForm.do";
const INDUSTRIES = ["쇼핑업", "숙박업", "식음료업", "여가서비스업", "여행업", "운송업", "의료웰니스업"];
const VISITORS_TITLE = "한국관광 데이터랩 · 지역 외지인 방문자 수(연인원) 추이";

type Obj = Record<string, unknown>;
const fail = (why: string): never => { throw new RegionTrendDataError(`Invalid DataLab region trends: ${why}`); };
const obj = (v: unknown, at: string): Obj => (v && typeof v === "object" && !Array.isArray(v) ? (v as Obj) : fail(`${at} must be an object`));
const arr = (v: unknown, at: string): unknown[] => (Array.isArray(v) ? v : fail(`${at} must be an array`));
const str = (v: unknown, at: string): string => (typeof v === "string" && v.trim().length > 0 ? v : fail(`${at} must be a non-empty string`));
const int = (v: unknown, at: string, min: number, max: number): number => (Number.isInteger(v) && (v as number) >= min && (v as number) <= max ? (v as number) : fail(`${at} out of range`));
const amount = (v: unknown, at: string): number => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : fail(`${at} must be a non-negative amount`));
const hex = (v: unknown, at: string) => { const s = str(v, at); if (!/^[0-9a-f]{64}$/.test(s)) fail(`${at} must be a hash`); return s; };
const date = (v: unknown, at: string) => { const s = str(v, at); if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) fail(`${at} must be a date`); return s; };
const slug = (v: unknown, at: string) => { const s = str(v, at); if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(s)) fail(`${at} must be a slug`); return s; };
function link(v: unknown, at: string): string {
  const s = obj(v, at);
  str(s.path, `${at}.path`); hex(s.sha256, `${at}.sha256`); int(s.bytes, `${at}.bytes`, 1, 1e8);
  const url = str(s.originalUrl, `${at}.originalUrl`);
  if (!url.startsWith("https://")) fail(`${at}.originalUrl must be https`);
  return url;
}
function range(v: unknown, at: string) {
  const r = obj(v, at), out = { from: int(r.from, `${at}.from`, 2000, 2100), to: int(r.to, `${at}.to`, 2000, 2100) };
  if (out.from > out.to) fail(`${at} must not be reversed`);
  return out;
}
/** Years must be exactly the range, in order. */
const covers = (years: { year: number }[], r: { from: number; to: number }, at: string) => {
  if (years.length !== r.to - r.from + 1 || years.some((y, i) => y.year !== r.from + i)) fail(`${at} must cover ${r.from}~${r.to} in order`);
};

function region(v: unknown, at: string): { trend: RegionTrend; festivalIds: string[] } {
  const r = obj(v, at), s = obj(r.spending, `${at}.spending`), vis = obj(r.visitors, `${at}.visitors`), code = str(r.code, `${at}.code`);
  if (!/^\d{5}$/.test(code)) fail(`${at}.code must be a 5-digit region code`);
  const festivalIds = arr(r.festivalIds, `${at}.festivalIds`).map((f, i) => slug(f, `${at}.festivalIds[${i}]`));
  const sr = range(s.range, `${at}.spending.range`);
  const years = arr(s.years, `${at}.spending.years`).map((y, i) => {
    const e = obj(y, `${at}.spending.years[${i}]`), w = `${at}.spending.years[${i}]`;
    const out = { year: int(e.year, `${w}.year`, 2000, 2100), total: amount(e.total, `${w}.total`), local: amount(e.local, `${w}.local`), outside: amount(e.outside, `${w}.outside`) };
    if (Math.abs(out.local + out.outside - out.total) > 2) fail(`${w} local and outside must add up to the total`);
    return out;
  });
  covers(years, sr, `${at}.spending.years`);
  const groups = arr(s.industries, `${at}.spending.industries`).map((g, i) => {
    const e = obj(g, `${at}.spending.industries[${i}]`), name = str(e.name, `${at}.spending.industries[${i}].name`);
    if (!INDUSTRIES.includes(name)) fail(`${at}.spending.industries[${i}] is not a known industry group`);
    return { name, total: amount(e.total, `${at}.spending.industries[${i}].total`) };
  });
  const sum = groups.reduce((n, g) => n + g.total, 0), whole = years.reduce((n, y) => n + y.total, 0);
  if (!groups.length || new Set(groups.map(g => g.name)).size !== groups.length || Math.abs(sum - whole) > INDUSTRIES.length * years.length) fail(`${at}.spending.industries must split the range total`);
  const sources = obj(s.sources, `${at}.spending.sources`);
  const vr = range(vis.range, `${at}.visitors.range`);
  const visits = arr(vis.years, `${at}.visitors.years`).map((y, i) => { const e = obj(y, `${at}.visitors.years[${i}]`); return { year: int(e.year, `${at}.visitors.years[${i}].year`, 2000, 2100), outside: int(e.outside, `${at}.visitors.years[${i}].outside`, 0, 1e10) }; });
  covers(visits, vr, `${at}.visitors.years`);
  return {
    festivalIds,
    trend: {
      code, name: str(r.name, `${at}.name`), province: str(r.province, `${at}.province`),
      spending: { downloadDate: date(s.downloadDate, `${at}.spending.downloadDate`), range: sr, years,
        industries: groups.map(g => ({ name: g.name, share: (g.total / sum) * 100 })),
        links: { domestic: link(sources.domestic, `${at}.spending.sources.domestic`), local: link(sources.local, `${at}.spending.sources.local`), outside: link(sources.outside, `${at}.spending.sources.outside`) } },
      visitors: { downloadDate: date(vis.downloadDate, `${at}.visitors.downloadDate`), range: vr, years: visits, link: link(obj(vis.sources, `${at}.visitors.sources`).trend, `${at}.visitors.sources.trend`) },
    },
  };
}

/** Strictly validate the checked-in artifact before any UI use. */
export function parseRegionTrends(input: unknown): RegionTrends {
  const d = obj(input, "dataset"), source = obj(d.source, "source");
  if (d.kind !== "datalab-region-trends" || d.schemaVersion !== 1) fail("unexpected kind or schema version");
  if (source.officialUrl !== OFFICIAL_URL || source.downloadTimezone !== null) fail("source must be the official region page without a download timezone");
  hex(obj(source.import, "source.import").manifestSha256, "source.import.manifestSha256");
  const parsed = arr(d.regions, "regions").map((r, i) => region(r, `regions[${i}]`));
  if (!parsed.length || new Set(parsed.map(r => r.trend.code)).size !== parsed.length) fail("region codes must be unique");
  const festivalRegions: Record<string, string> = {};
  for (const r of parsed) for (const id of r.festivalIds) { if (Object.hasOwn(festivalRegions, id)) fail(`festival ${id} is linked twice`); festivalRegions[id] = r.trend.code; }
  return { officialUrl: OFFICIAL_URL, regions: parsed.map(r => r.trend), festivalRegions };
}

/** An invalid artifact removes the trend cards (other screens still work); the log carries a fixed category, never data. */
export function loadRegionTrends(input: unknown, log: (category: string) => void = c => console.error(c)): RegionTrends | null {
  try { return parseRegionTrends(input); } catch { log("datalab-region-trends: invalid-artifact"); return null; }
}

export const defaultRegionTrends = loadRegionTrends(raw);

export const regionTrendFor = (trends: RegionTrends | null, code: string): RegionTrend | null => trends?.regions.find(r => r.code === code) ?? null;

/** Yearly outside visitors as the new-festival annual block: the same measure, without local or domestic totals. */
export function regionAnnualFromTrend(trends: RegionTrends | null, code: string): RegionAnnual | null {
  const t = regionTrendFor(trends, code);
  return t && trends ? { regionCode: t.code, years: t.visitors.years.map(y => ({ year: y.year, outside: y.outside, local: null, total: null })),
    source: { title: VISITORS_TITLE, url: trends.officialUrl, downloadedOn: t.visitors.downloadDate } } : null;
}
