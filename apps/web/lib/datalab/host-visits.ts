import "server-only";
import linksRaw from "../../data/datalab-festival-links.json";
import trendRaw from "../../data/datalab-festival-trend.json";
import type { ArchiveFestival, HostAreaEdition, HostAreaVisits } from "../existing/types";
import { parseFestivalPeriodDataset } from "./model";
import type { FestivalPeriodDataset } from "./types";

// Reviewed archive festival -> DataLab festival links. Never matched by name; evidence stays in this module.
export class HostVisitsDataError extends Error {}
export type ReviewedEdition = { editionId: string; year: number; start: string; end: string; days: number };
export type FestivalLink = { archiveFestivalId: string; datalabFestivalId: string; regionCode: string; editions: ReviewedEdition[] };

type Obj = Record<string, unknown>;
const fail = (why: string): never => { throw new HostVisitsDataError(`Invalid DataLab festival links: ${why}`); };
const obj = (v: unknown, at: string): Obj => (v && typeof v === "object" && !Array.isArray(v) ? (v as Obj) : fail(`${at} must be an object`));
const arr = (v: unknown, at: string): unknown[] => (Array.isArray(v) ? v : fail(`${at} must be an array`));
const str = (v: unknown, at: string): string => (typeof v === "string" && v.length > 0 ? v : fail(`${at} must be a non-empty string`));
const slug = (v: unknown, at: string) => { const s = str(v, at); if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(s)) fail(`${at} must be a slug`); return s; };
const date = (v: unknown, at: string) => {
  const s = str(v, at), t = Date.parse(`${s}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || !Number.isFinite(t) || new Date(t).toISOString().slice(0, 10) !== s) fail(`${at} must be a date`);
  return s;
};
const spanDays = (start: string, end: string) => Math.round((Date.parse(end) - Date.parse(start)) / 86_400_000) + 1;

function edition(v: unknown, at: string): ReviewedEdition {
  const e = obj(v, at), start = date(e.start, `${at}.start`), end = date(e.end, `${at}.end`);
  if (!Number.isInteger(e.year) || String(e.year) !== start.slice(0, 4)) fail(`${at}.year must be the start year`);
  if (end < start || e.days !== spanDays(start, end)) fail(`${at}.days must match the original period`);
  return { editionId: slug(e.editionId, `${at}.editionId`), year: e.year as number, start, end, days: e.days as number };
}

/** Strict links parse plus a cross-check against the verified trend: every reviewed year exists there with the same day count. */
export function parseFestivalLinks(input: unknown, trend: FestivalPeriodDataset): FestivalLink[] {
  const d = obj(input, "links file");
  if (d.version !== 1) fail("unexpected version");
  const links = arr(d.links, "links").map((v, i) => {
    const l = obj(v, `links[${i}]`), at = `links[${i}]`;
    str(l.evidence, `${at}.evidence`);
    const regionCode = str(l.regionCode, `${at}.regionCode`);
    if (!/^\d{5}$/.test(regionCode)) fail(`${at}.regionCode must be a 5-digit code`);
    const link = { archiveFestivalId: slug(l.archiveFestivalId, `${at}.archiveFestivalId`), datalabFestivalId: slug(l.datalabFestivalId, `${at}.datalabFestivalId`), regionCode,
      editions: arr(l.editions, `${at}.editions`).map((e, j) => edition(e, `${at}.editions[${j}]`)) };
    if (!link.editions.length || new Set(link.editions.map(e => e.editionId)).size !== link.editions.length) fail(`${at}.editions must be unique and non-empty`);
    const source = trend.festivals.find(f => f.id === link.datalabFestivalId) ?? fail(`${at} DataLab festival is unknown`);
    for (const e of link.editions) if (source.years.find(y => y.year === e.year)?.days !== e.days) fail(`${at} ${e.editionId} has no DataLab year with the same days`);
    return link;
  });
  if (!links.length || new Set(links.map(l => l.archiveFestivalId)).size !== links.length) fail("archive festival IDs must be unique");
  return links;
}

export type HostVisitsResolver = (festival: ArchiveFestival, editionIds: string[]) => HostAreaVisits | null;

/**
 * Only selected editions that are dated, not cancelled, and identical (id, year, original start/end, days) to a reviewed
 * edition of a reviewed festival in the same region. The chart window never takes part. No valid edition -> null.
 */
export function hostVisitsFrom(links: FestivalLink[], trend: FestivalPeriodDataset): HostVisitsResolver {
  return (festival, editionIds) => {
    const link = links.find(l => l.archiveFestivalId === festival.festivalId);
    const source = link && trend.festivals.find(f => f.id === link.datalabFestivalId);
    if (!link || !source || festival.region.code !== link.regionCode) return null;
    const editions = editionIds.flatMap((id): HostAreaEdition[] => {
      const ref = festival.editions.find(e => e.editionId === id), reviewed = link.editions.find(e => e.editionId === id);
      if (!ref || !reviewed || ref.cancelled || ref.start === null || ref.end === null || ref.days === null) return [];
      if (ref.year !== reviewed.year || ref.start !== reviewed.start || ref.end !== reviewed.end || ref.days !== reviewed.days) return [];
      const y = source.years.find(x => x.year === ref.year);
      if (!y || y.days !== ref.days) return [];
      return [{ editionId: id, year: ref.year, start: ref.start, end: ref.end, days: ref.days, local: y.local, outside: y.outside, foreign: y.foreign,
        total: y.periodTotal, dailyMean: y.dailyMean, outsideShare: y.outside / y.periodTotal }];
    });
    return editions.length ? { festivalName: source.name, editions, allYearsHref: `/compare/annual?festival=${encodeURIComponent(source.id)}`,
      source: { title: trend.source.title, url: trend.source.officialUrl, downloadedOn: source.downloadDate } } : null;
  };
}

/** An invalid artifact disables only this optional block; the log carries a fixed category, never data or paths. */
export function createHostVisitsResolver(links: unknown, trend: unknown, log: (category: string) => void = c => console.error(c)): HostVisitsResolver {
  try { const t = parseFestivalPeriodDataset(trend); return hostVisitsFrom(parseFestivalLinks(links, t), t); }
  catch { log("datalab-host-visits: invalid-artifact"); return () => null; }
}

export const defaultHostVisits = createHostVisitsResolver(linksRaw, trendRaw);
