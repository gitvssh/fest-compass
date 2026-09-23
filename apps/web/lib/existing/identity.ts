import { REGIONS, SOURCE } from "../region/model";
import { validPoint } from "../comparison/distance";
import type { Edition, Source } from "../comparison/types";
import type { Resource } from "../region/types";
import type { ArchiveEditionRef, ArchiveFestival, CurrentFestival, PublicSource, RegionRef, SourceRef } from "./types";

// Archive festivalId/editionId and TourAPI contentid are independent identifier systems.
// Only a reviewed row here may join them; name, year or coordinate similarity never does.
export type IdentityLink = { archiveFestivalId: string; contentId: string; region: string; evidence: string; verifiedAt: string; version: string };
export const IDENTITY_LINKS: readonly IdentityLink[] = [];

// Regions whose daily visit archive exists today (region-history.json + regional-history-expanded.json).
export const HISTORY_REGIONS = ["44230", "44150", "52750"] as const;
export const MAX_EDITIONS = 3;

const toRef = (r: (typeof REGIONS)[number]): RegionRef => ({ province: r.provinceCode, district: r.districtCode, code: `${r.provinceCode}${r.districtCode}`, name: `${r.provinceName} ${r.districtName}`, districtName: r.districtName });
const BY_CODE = new Map(REGIONS.map(r => [`${r.provinceCode}${r.districtCode}`, r]));
export function regionRef(province: string, district: string): RegionRef | null {
  const r = REGIONS.find(x => x.provinceCode === province && x.districtCode === district);
  return r ? toRef(r) : null;
}
/** Exact concatenated REGIONS code (e.g. "44230", Sejong "3611036110"); never split by digit count. */
export function regionByCode(code: string): RegionRef | null { const r = BY_CODE.get(code); return r ? toRef(r) : null; }
/**
 * TourAPI lDong pair → verified region. Accepts the exact catalogue pair, or a 5-digit district code that repeats
 * the province prefix, only when exactly one REGIONS row matches. Anything else is unverified (null).
 */
export function verifiedLdongRegion(regn: unknown, signgu: unknown): RegionRef | null {
  const p = String(regn ?? "").trim(), d = String(signgu ?? "").trim();
  if (!/^\d+$/.test(p) || !/^\d+$/.test(d)) return null;
  const candidates = REGIONS.filter(r => (r.provinceCode === p && r.districtCode === d) || (d.length === p.length + r.districtCode.length && d === `${p}${r.districtCode}` && r.provinceCode === p));
  return candidates.length === 1 ? toRef(candidates[0]) : null;
}

export const sourceRef = (s: Pick<Source, "title" | "url" | "checkedAt" | "publishedAt">): SourceRef => ({ title: s.title, url: s.url, checkedAt: s.checkedAt || null, publishedAt: s.publishedAt || null });
export const currentProvenance = (collectedAt: string | null): PublicSource => ({ title: "한국관광공사 국문 관광정보 · 축제·행사", url: SOURCE, checkedAt: null, publishedAt: null, collectedAt });
export const archiveId = (festivalId: string) => `archive:${festivalId}`;
export const currentId = (region: RegionRef, contentId: string) => `current:${region.code}:${contentId}`;
export function parseFestivalId(id: string): { source: "archive"; festivalId: string } | { source: "current"; province: string; district: string; contentId: string } | null {
  const a = /^archive:([a-z0-9-]{1,80})$/.exec(id);
  if (a) return { source: "archive", festivalId: a[1] };
  const c = /^current:(\d{5,10}):(\d{1,20})$/.exec(id), region = c ? regionByCode(c[1]) : null;
  return c && region ? { source: "current", province: region.province, district: region.district, contentId: c[2] } : null;
}
export function linkedArchiveId(region: RegionRef, contentId: string, links: readonly IdentityLink[] = IDENTITY_LINKS): string | null {
  const link = links.find(l => l.contentId === contentId && l.region === region.code);
  return link ? archiveId(link.archiveFestivalId) : null;
}

export const editionDays = (start: string | null, end: string | null) => start && end && end >= start ? Math.round((Date.parse(end) - Date.parse(start)) / 86_400_000) + 1 : null;
export const isCancelled = (status: string) => status.trim() === "취소";

/** Latest comparable editions first; two by default, one when only one exists. */
export function defaultEditionIds(editions: ArchiveEditionRef[]): string[] {
  return editions.filter(e => e.comparable).sort((a, b) => b.year - a.year || b.editionId.localeCompare(a.editionId)).slice(0, 2).map(e => e.editionId);
}

/**
 * Group reviewed archive editions by festivalId. Every festival with a verified region is a target, dated or not.
 * `periodObserved` answers whether the region archive holds a value for every original festival day; it only drives
 * the default comparison.
 */
export function archiveCatalogue(editions: Edition[], periodObserved: (e: Edition) => boolean): ArchiveFestival[] {
  const groups = new Map<string, Edition[]>();
  for (const e of editions) if (e.origin === "archive" && regionRef(e.region.province, e.region.district)) groups.set(e.festivalId, [...(groups.get(e.festivalId) ?? []), e]);
  return [...groups.entries()].flatMap(([festivalId, list]) => {
    if (new Set(list.map(e => `${e.region.province}/${e.region.district}`)).size !== 1) return []; // never sum districts
    const region = regionRef(list[0].region.province, list[0].region.district)!;
    const refs: ArchiveEditionRef[] = [...list].sort((a, b) => b.year - a.year || b.id.localeCompare(a.id)).map(e => {
      const days = editionDays(e.start, e.end), cancelled = isCancelled(e.status);
      return { editionId: e.id, year: e.year, start: days ? e.start : null, end: days ? e.end : null, days, status: e.status, cancelled,
        comparable: !!days && !cancelled && periodObserved(e), source: sourceRef(e.source) };
    });
    return [{ id: archiveId(festivalId), source: "archive" as const, festivalId, name: list[0].name, region, editions: refs,
      defaultEditionIds: defaultEditionIds(refs), hasDates: refs.some(r => r.days !== null), hasHistory: refs.some(r => r.comparable) }];
  }).sort((a, b) => a.name.localeCompare(b.name, "ko-KR") || a.id.localeCompare(b.id));
}

export type CurrentFields = Pick<Resource, "id" | "title" | "address" | "latitude" | "longitude" | "start" | "end" | "modifiedAt">;
export function currentFestival(region: RegionRef, r: CurrentFields, datesVerified: boolean, collectedAt: string | null, links: readonly IdentityLink[] = IDENTITY_LINKS): CurrentFestival {
  const point = { latitude: r.latitude, longitude: r.longitude }, dated = datesVerified && !!r.start && !!r.end && r.end >= r.start;
  return { id: currentId(region, r.id), source: "current", contentId: r.id, name: r.title, region,
    start: dated ? r.start : null, end: dated ? r.end : null, datesVerified: dated, address: r.address,
    point: validPoint(point) ? point : null, modifiedAt: r.modifiedAt, linkedArchiveId: linkedArchiveId(region, r.id, links), provenance: currentProvenance(collectedAt) };
}
/** Append a further page: only identical current ids collapse (first wins); same names never merge. */
export function mergeCurrentItems(prev: CurrentFestival[], next: CurrentFestival[]): CurrentFestival[] {
  const seen = new Set(prev.map(f => f.id));
  return [...prev, ...next.filter(f => !seen.has(f.id) && (seen.add(f.id), true))];
}

export function normalizeKeyword(q: string): string { return q.normalize("NFC").replace(/\s+/g, " ").trim().slice(0, 50); }
/** Every whitespace token must appear in the name or region, ignoring spacing ("논산 딸기" finds "논산딸기축제"). */
export function matchesKeyword(keyword: string, name: string, regionName: string): boolean {
  const tokens = normalizeKeyword(keyword).toLocaleLowerCase("ko-KR").split(" ").filter(Boolean);
  const haystack = `${name}${regionName}`.normalize("NFC").replace(/\s+/g, "").toLocaleLowerCase("ko-KR");
  return tokens.every(t => haystack.includes(t));
}
export function searchArchive(items: ArchiveFestival[], q: string, region: RegionRef | null): ArchiveFestival[] {
  return items.filter(f => (!region || f.region.code === region.code) && matchesKeyword(q, f.name, f.region.name));
}
