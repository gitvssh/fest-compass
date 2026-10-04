import type { FestivalPeriodDataset, FestivalPeriodTrend, FestivalPeriodYear, PeriodMetric } from "./types";

export class DatalabDataError extends Error {}
const TREND_HEADER = ["축제명", "개최년도", "축체기간(일)", "(현지인)방문자수", "(외지인)방문자수", "(외국인)방문자수", "(전체)방문자수", "일평균 방문자수", "전년도 일평균 방문자수", "일평균 방문자수 증감률", "(이전)전체방문자", "(전체)방문자증감", "(현지인)방문자비율", "(외지인)방문자비율", "(외국인)방문자비율", "전년대비방문자증감비율"];

type Obj = Record<string, unknown>;
const fail = (why: string): never => { throw new DatalabDataError(`Invalid DataLab festival trend: ${why}`); };
const obj = (v: unknown, at: string): Obj => (v && typeof v === "object" && !Array.isArray(v) ? (v as Obj) : fail(`${at} must be an object`));
const arr = (v: unknown, at: string): unknown[] => (Array.isArray(v) ? v : fail(`${at} must be an array`));
const str = (v: unknown, at: string): string => (typeof v === "string" && v.length > 0 ? v : fail(`${at} must be a non-empty string`));
const num = (v: unknown, at: string, min: number): number => (typeof v === "number" && Number.isFinite(v) && v >= min ? v : fail(`${at} must be a number >= ${min}`));
const int = (v: unknown, at: string, min: number, max: number): number => (Number.isInteger(v) && (v as number) >= min && (v as number) <= max ? (v as number) : fail(`${at} out of range`));
const https = (v: unknown, at: string) => { const s = str(v, at); if (!s.startsWith("https://")) fail(`${at} must be https`); return s; };
const hex = (v: unknown, at: string, n: number) => { const s = str(v, at); if (!new RegExp(`^[0-9a-f]{${n}}$`).test(s)) fail(`${at} must be a hash`); return s; };

function year(v: unknown, name: string, at: string): FestivalPeriodYear {
  const y = obj(v, at), raw = arr(y.raw, `${at}.raw`);
  if (raw.length !== TREND_HEADER.length || raw.some(c => typeof c !== "string")) fail(`${at}.raw must hold ${TREND_HEADER.length} strings`);
  const r = { year: int(y.year, `${at}.year`, 2000, 2100), days: int(y.days, `${at}.days`, 1, 366), periodTotal: num(y.periodTotal, `${at}.periodTotal`, 1), dailyMean: num(y.dailyMean, `${at}.dailyMean`, 0.0001), local: num(y.local, `${at}.local`, 1), outside: num(y.outside, `${at}.outside`, 1), foreign: num(y.foreign, `${at}.foreign`, 0), raw: raw as string[] };
  if (r.raw[0] !== name || r.raw[1] !== String(r.year) || r.raw[2] !== String(r.days)) fail(`${at} raw identity mismatch`);
  if ([3, 4, 5, 6, 7].some(c => !/^-?(0|[1-9]\d*)(\.\d+)?$/.test(r.raw[c]))) fail(`${at} required raw values must be numeric text`);
  if ([r.local, r.foreign, r.periodTotal, r.dailyMean].some((n, i) => Number(r.raw[[3, 5, 6, 7][i]]) !== n) || Number(r.raw[4]) !== r.outside) fail(`${at} parsed values differ from raw`);
  if (Math.abs(r.local + r.outside + r.foreign - r.periodTotal) > 0.5) fail(`${at} category sum mismatch`);
  if (Math.abs(r.periodTotal / r.days - r.dailyMean) > 0.01) fail(`${at} daily mean mismatch`);
  return r;
}

function festival(v: unknown, at: string): FestivalPeriodTrend {
  const f = obj(v, at), s = obj(f.source, `${at}.source`), name = str(f.name, `${at}.name`), id = str(f.id, `${at}.id`);
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(id)) fail(`${at}.id must be a slug`);
  const aliases = arr(f.aliases, `${at}.aliases`).map((a, i) => str(a, `${at}.aliases[${i}]`));
  if (aliases[0] !== name) fail(`${at}.aliases must start with the source name`);
  const stamp = str(f.downloadStamp, `${at}.downloadStamp`);
  if (!/^\d{14}$/.test(stamp) || f.downloadDate !== `${stamp.slice(0, 4)}-${stamp.slice(4, 6)}-${stamp.slice(6, 8)}`) fail(`${at} download stamp mismatch`);
  const years = arr(f.years, `${at}.years`).map((y, i) => year(y, name, `${at}.years[${i}]`));
  if (!years.length) fail(`${at} has no years`);
  years.forEach((y, i) => { if (i && y.year <= years[i - 1].year) fail(`${at} years must be unique and ascending`); });
  return { id, name, aliases, downloadStamp: stamp, downloadDate: f.downloadDate as string, years,
    source: { path: str(s.path, `${at}.source.path`), originalPath: str(s.originalPath, `${at}.source.originalPath`), originalUrl: https(s.originalUrl, `${at}.source.originalUrl`), bytes: int(s.bytes, `${at}.source.bytes`, 1, 1e8), sha256: hex(s.sha256, `${at}.source.sha256`, 64) } };
}

/** Strictly validate the checked-in generated artifact before any UI use. */
export function parseFestivalPeriodDataset(input: unknown): FestivalPeriodDataset {
  const d = obj(input, "dataset");
  if (d.kind !== "datalab-festival-period-annual" || d.schemaVersion !== 1) fail("unexpected kind or schema version");
  const scope = obj(d.scope, "scope"), source = obj(d.source, "source");
  const header = arr(d.rawHeader, "rawHeader");
  if (header.length !== TREND_HEADER.length || header.some((h, i) => h !== TREND_HEADER[i])) fail("unexpected raw header");
  if (source.downloadTimezone !== null) fail("download timezone is not established");
  const festivals = arr(d.festivals, "festivals").map((f, i) => festival(f, `festivals[${i}]`));
  if (!festivals.length || new Set(festivals.map(f => f.id)).size !== festivals.length) fail("festival IDs must be unique");
  const s = (k: string) => str(scope[k], `scope.${k}`), t = (k: string) => str(source[k], `source.${k}`);
  return {
    kind: "datalab-festival-period-annual", schemaVersion: 1, rawHeader: TREND_HEADER.slice(), festivals,
    scope: { area: s("area"), period: s("period"), method: s("method"), unit: s("unit"), periodTotal: s("periodTotal"), dailyMean: s("dailyMean"), note: s("note") },
    source: { title: t("title"), officialUrl: https(source.officialUrl, "source.officialUrl"), definitionReviewedAt: t("definitionReviewedAt"), repository: https(source.repository, "source.repository"), commit: hex(source.commit, "source.commit", 40), basePath: t("basePath"), manifestPath: t("manifestPath"), manifestSha256: hex(source.manifestSha256, "source.manifestSha256", 64), downloadTimezone: null },
  };
}

export const METRICS: Record<PeriodMetric, { label: string; short: string }> = {
  mean: { label: "일평균", short: "개최기간 일평균" },
  total: { label: "기간 합계", short: "개최기간 합계" },
};
export const parseMetric = (v: unknown): PeriodMetric => (v === "total" ? "total" : "mean");
export const metricValue = (y: FestivalPeriodYear, m: PeriodMetric) => (m === "total" ? y.periodTotal : y.dailyMean);

const normal = (s: string) => s.normalize("NFC").replace(/\s+/g, "").toLowerCase();
/** Match on source name and reviewed aliases only; never fabricates entries. */
export function searchFestivals(festivals: FestivalPeriodTrend[], query: string) {
  const q = normal(query);
  return q ? festivals.filter(f => f.aliases.some(a => normal(a).includes(q))) : festivals;
}

/** Every calendar year across the dataset span, so gaps keep their real spacing. */
export function axisYears(festivals: FestivalPeriodTrend[]) {
  const all = festivals.flatMap(f => f.years.map(y => y.year)), lo = Math.min(...all), hi = Math.max(...all);
  return Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);
}

/** Runs of consecutive calendar years; a missing year always breaks the line. */
export function consecutiveRuns(years: FestivalPeriodYear[]) {
  const runs: FestivalPeriodYear[][] = [];
  for (const y of years) { const last = runs.at(-1); if (last && y.year === last.at(-1)!.year + 1) last.push(y); else runs.push([y]); }
  return runs;
}

export function niceMax(value: number) {
  if (!(value > 0)) return 1;
  const p = 10 ** Math.floor(Math.log10(value)), n = value / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
}

export const formatCount = (v: number, digits = 0) => v.toLocaleString("ko-KR", { minimumFractionDigits: digits, maximumFractionDigits: digits });
export const formatMetric = (v: number, m: PeriodMetric) => formatCount(v, m === "mean" ? 1 : 0);
