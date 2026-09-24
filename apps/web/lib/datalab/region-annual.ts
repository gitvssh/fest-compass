import "server-only";
import raw from "../../data/datalab-region-annual.json";
import reviewedRegions from "../../data/datalab-region-ids.json";
import type { RegionAnnual, RegionAnnualYear } from "../new-festival/types";

// Strict reader for the generated DataLab region annual totals. Only the public projection (RegionAnnual) leaves this module.
export class RegionAnnualDataError extends Error {}
const HEADER = ["기준년월", "기초지자체", "방문자 구분", "방문자 수"];
const COUNT = /^(0|[1-9]\d*)(\.\d+)?(E[+-]?\d+)?$/;

type Obj = Record<string, unknown>;
const fail = (why: string): never => { throw new RegionAnnualDataError(`Invalid DataLab region annual: ${why}`); };
const obj = (v: unknown, at: string): Obj => (v && typeof v === "object" && !Array.isArray(v) ? (v as Obj) : fail(`${at} must be an object`));
const arr = (v: unknown, at: string): unknown[] => (Array.isArray(v) ? v : fail(`${at} must be an array`));
const str = (v: unknown, at: string): string => (typeof v === "string" && v.length > 0 ? v : fail(`${at} must be a non-empty string`));
const https = (v: unknown, at: string) => { const s = str(v, at); if (!s.startsWith("https://")) fail(`${at} must be https`); return s; };

export type RegionAnnualRegion = { code: string; name: string; downloadDate: string; years: RegionAnnualYear[] };
export type RegionAnnualDataset = { title: string; officialUrl: string; regions: RegionAnnualRegion[] };

/** Source text -> value: "" / "N/A" are null (never 0); anything else must be a non-negative count, E notation allowed. */
function count(rawValue: unknown, parsed: unknown, at: string): number | null {
  const s = typeof rawValue === "string" ? rawValue : fail(`${at} raw must be a string`);
  const expected = s === "" || s === "N/A" ? null : COUNT.test(s) ? Number(s) : fail(`${at} raw is not a count`);
  if (expected !== null && !Number.isFinite(expected)) fail(`${at} raw is not finite`);
  if (parsed !== expected) fail(`${at} parsed value differs from raw`);
  return expected;
}

function year(v: unknown, at: string): RegionAnnualYear {
  const y = obj(v, at), r = obj(y.raw, `${at}.raw`);
  if (!Number.isInteger(y.year) || (y.year as number) < 2000 || (y.year as number) > 2100) fail(`${at}.year out of range`);
  const local = count(r.local, y.local, `${at}.local`), outside = count(r.outside, y.outside, `${at}.outside`), total = count(r.total, y.total, `${at}.total`);
  if (local !== null && outside !== null && total !== null && Math.abs(local + outside - total) > 1) fail(`${at} segment sum mismatch`);
  return { year: y.year as number, outside, local, total };
}

function region(v: unknown, at: string): RegionAnnualRegion {
  const r = obj(v, at), s = obj(r.source, `${at}.source`), code = str(r.code, `${at}.code`), stamp = str(r.downloadStamp, `${at}.downloadStamp`);
  if (!/^\d{5}$/.test(code)) fail(`${at}.code must be a 5-digit region code`);
  const reviewed = reviewedRegions.regions.find(item => item.code === code);
  if (!reviewed || r.name !== reviewed.name || s.path !== `docs/research/imported/hkjin-plan-03/original/${reviewed.sourceFile}`) fail(`${at} must match a reviewed region and source`);
  if (!/^\d{14}$/.test(stamp) || r.downloadDate !== `${stamp.slice(0, 4)}-${stamp.slice(4, 6)}-${stamp.slice(6, 8)}`) fail(`${at} download stamp mismatch`);
  https(s.originalUrl, `${at}.source.originalUrl`);
  if (!/^[0-9a-f]{64}$/.test(str(s.sha256, `${at}.source.sha256`))) fail(`${at}.source.sha256 must be a hash`);
  const years = arr(r.years, `${at}.years`).map((y, i) => year(y, `${at}.years[${i}]`));
  if (!years.length) fail(`${at} has no years`);
  years.forEach((y, i) => { if (i && y.year <= years[i - 1].year) fail(`${at} years must be unique and ascending`); });
  if (years.length !== 8 || years.some((y, i) => y.year !== 2018 + i)) fail(`${at} must cover the reviewed observation years`);
  return { code, name: str(r.name, `${at}.name`), downloadDate: r.downloadDate as string, years };
}

export function parseRegionAnnualDataset(input: unknown): RegionAnnualDataset {
  const d = obj(input, "dataset"), source = obj(d.source, "source"), header = arr(d.rawHeader, "rawHeader");
  if (d.kind !== "datalab-region-visitor-annual" || d.schemaVersion !== 1) fail("unexpected kind or schema version");
  if (header.length !== HEADER.length || header.some((h, i) => h !== HEADER[i])) fail("unexpected raw header");
  if (source.downloadTimezone !== null) fail("download timezone is not established");
  const regions = arr(d.regions, "regions").map((r, i) => region(r, `regions[${i}]`));
  if (!regions.length || new Set(regions.map(r => r.code)).size !== regions.length) fail("region codes must be unique");
  return { title: str(source.title, "source.title"), officialUrl: https(source.officialUrl, "source.officialUrl"), regions };
}

export type RegionAnnualResolver = (regionCode: string) => RegionAnnual | null;

/** Public projection only: no paths, hashes, raw strings or scope notes. Unknown regions are null. */
export function regionAnnualFrom(dataset: RegionAnnualDataset): RegionAnnualResolver {
  return code => {
    const r = dataset.regions.find(x => x.code === code);
    return r ? { regionCode: r.code, years: r.years.map(y => ({ ...y })), source: { title: dataset.title, url: dataset.officialUrl, downloadedOn: r.downloadDate } } : null;
  };
}

/** An invalid artifact disables only this optional block; the log carries a fixed category, never data or paths. */
export function createRegionAnnualResolver(input: unknown, log: (category: string) => void = c => console.error(c)): RegionAnnualResolver {
  try { return regionAnnualFrom(parseRegionAnnualDataset(input)); }
  catch { log("datalab-region-annual: invalid-artifact"); return () => null; }
}

export const defaultRegionAnnual = createRegionAnnualResolver(raw);
