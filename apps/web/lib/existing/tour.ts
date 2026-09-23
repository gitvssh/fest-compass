import "server-only";
import { isKtoSuccessCode, parseKtoWire } from "../kto/wire";
import { coordinate, day } from "../region/model";
import { MAX_PAGE } from "./request";
import { verifiedLdongRegion, type CurrentFields } from "./identity";
import type { LookupResult, Range, RegionRef } from "./types";

// Read-only TourAPI adapter for the journey. It never writes (unlike kto/client.ts loggedGet, which logs to the DB),
// never returns upstream messages or the service key, and bounds calls, concurrency, size and time.
export type TourOperation = "searchKeyword2" | "searchFestival2" | "detailCommon2" | "detailIntro2";
export type TourPage = { total: number; pageNo: number | null; rows: Record<string, unknown>[]; collectedAt: string };
export type TourCall = (operation: TourOperation, params: Record<string, string>) => Promise<TourPage>;
export class TourUnavailable extends Error { constructor() { super("tour-unavailable"); } }
/** A continued keyword search whose source total no longer matches the first page. */
export class TourChanged extends TourUnavailable {}

const BASE = "https://apis.data.go.kr/B551011/KorService2";
const TTL: Record<TourOperation, number> = { searchKeyword2: 600_000, searchFestival2: 600_000, detailCommon2: 3_600_000, detailIntro2: 3_600_000 };
export type TourDeps = { fetch?: typeof fetch; key?: () => string | undefined; now?: () => number; maxCalls?: number; windowMs?: number; maxActive?: number };

export function createTourCall(deps: TourDeps = {}): TourCall {
  const doFetch = deps.fetch ?? fetch, key = deps.key ?? (() => process.env.TOUR_API_KEY), now = deps.now ?? Date.now;
  const maxCalls = deps.maxCalls ?? 100, windowMs = deps.windowMs ?? 600_000, maxActive = deps.maxActive ?? 3;
  const cache = new Map<string, { expires: number; value: Promise<TourPage> }>();
  let calls = 0, windowStart = now(), active = 0;
  return (operation, params) => {
    const cacheKey = JSON.stringify([operation, Object.keys(params).sort().map(k => [k, params[k]])]);
    const hit = cache.get(cacheKey); if (hit && hit.expires > now()) return hit.value;
    const value = (async (): Promise<TourPage> => {
      const secret = key()?.trim();
      if (!secret) throw new TourUnavailable();
      if (now() - windowStart > windowMs) { calls = 0; windowStart = now(); }
      if (calls >= maxCalls || active >= maxActive) throw new TourUnavailable();
      calls++; active++;
      try {
        let decoded = secret; try { decoded = decodeURIComponent(secret); } catch { /* raw key */ }
        const url = new URL(`${BASE}/${operation}`);
        for (const [k, v] of Object.entries({ serviceKey: decoded, MobileOS: "ETC", MobileApp: "pickDday", _type: "json", ...params })) url.searchParams.set(k, v);
        const response = await doFetch(url, { signal: AbortSignal.timeout(10_000), cache: "no-store" });
        if (!response.ok) throw new TourUnavailable();
        const raw = await response.text(); if (raw.length > 2_000_000) throw new TourUnavailable();
        const wire = parseKtoWire(raw);
        if (wire.contractError || !isKtoSuccessCode(wire.resultCode) || wire.totalCount === null || !Number.isSafeInteger(wire.totalCount) || wire.totalCount < 0) throw new TourUnavailable();
        return { total: wire.totalCount, pageNo: wire.pageNo, rows: wire.items, collectedAt: new Date(now()).toISOString() };
      } catch { throw new TourUnavailable(); } // Upstream text and the key never leave this function.
      finally { active--; }
    })();
    if (cache.size >= 200) cache.delete(cache.keys().next().value!);
    const entry = { expires: now() + TTL[operation], value }; cache.set(cacheKey, entry);
    value.catch(() => { entry.expires = now() + 30_000; });
    return value;
  };
}

const ymd = (v: unknown) => { const s = String(v ?? "").replace(/^(\d{4})(\d{2})(\d{2})$/, "$1-$2-$3"); return day(s) ? s : null; };
/** Valid start<=end pair, else both null (unknown dates are kept as unknown, never guessed). */
function dates(row: Record<string, unknown>): { start: string | null; end: string | null } {
  const start = ymd(row.eventstartdate), end = ymd(row.eventenddate);
  return start && end && end >= start ? { start, end } : { start: null, end: null };
}
function fields(row: Record<string, unknown>): CurrentFields {
  if (!/^\d{1,20}$/.test(String(row.contentid ?? "")) || typeof row.title !== "string" || !row.title.trim()) throw new TourUnavailable();
  const longitude = coordinate(row.mapx, 124, 132), latitude = coordinate(row.mapy, 32, 39);
  return { id: String(row.contentid), title: row.title.trim().slice(0, 300), address: String(row.addr1 ?? "").slice(0, 500),
    longitude: latitude === null ? null : longitude, latitude: longitude === null ? null : latitude, start: null, end: null,
    modifiedAt: /^\d{14}$/.test(String(row.modifiedtime)) ? String(row.modifiedtime) : null };
}
// List endpoints are queried with festival type 15; a row that states another type breaks the contract.
const listFestivalType = (row: Record<string, unknown>) => row.contenttypeid === undefined || row.contenttypeid === null || String(row.contenttypeid) === "15";
const explicit = (row: Record<string, unknown>, field: string, value: string) => row[field] !== undefined && row[field] !== null && String(row[field]) === value;

export const KEYWORD_PAGE_SIZE = 20;
export type KeywordPage = { total: number; page: number; next: { page: number; total: number } | null; omitted: number; collectedAt: string; items: { region: RegionRef; fields: CurrentFields }[] };
/**
 * One page of national keyword search (contentTypeId 15), optional verified lDong filter. A wrong page number,
 * a short page, a non-festival row or a row outside the requested region fails the whole page. When the caller
 * continues from an earlier page it passes that page's total; a different total means the listing changed (TourChanged).
 * Rows whose lDong pair is not a verified catalogue pair are omitted (counted), never guessed.
 */
export async function searchKeywordPage(call: TourCall, input: { keyword: string; region: RegionRef | null; page: number; expectTotal?: number | null }): Promise<KeywordPage> {
  const params: Record<string, string> = { keyword: input.keyword, contentTypeId: "15", numOfRows: String(KEYWORD_PAGE_SIZE), pageNo: String(input.page), arrange: "A" };
  if (input.region) { params.lDongRegnCd = input.region.province; params.lDongSignguCd = input.region.district; }
  const res = await call("searchKeyword2", params);
  if (input.expectTotal !== undefined && input.expectTotal !== null && res.total !== input.expectTotal) throw new TourChanged();
  const expected = Math.min(KEYWORD_PAGE_SIZE, Math.max(0, res.total - (input.page - 1) * KEYWORD_PAGE_SIZE));
  if (res.pageNo !== input.page || res.rows.length !== expected) throw new TourUnavailable();
  const items: KeywordPage["items"] = [], ids = new Set<string>(); let omitted = 0;
  for (const row of res.rows) {
    if (!listFestivalType(row)) throw new TourUnavailable();
    const f = fields(row), region = verifiedLdongRegion(row.lDongRegnCd, row.lDongSignguCd);
    if (!region) { omitted++; continue; }
    if (input.region && region.code !== input.region.code) throw new TourUnavailable();
    if (ids.has(f.id)) continue; // identical current id only
    ids.add(f.id); items.push({ region, fields: f });
  }
  const next = input.page * KEYWORD_PAGE_SIZE < res.total && input.page < MAX_PAGE ? { page: input.page + 1, total: res.total } : null;
  return { total: res.total, page: input.page, next, omitted, collectedAt: res.collectedAt, items };
}

export const EVENT_PAGE_SIZE = 100, EVENT_MAX_PAGES = 10;
export type RegionEvent = CurrentFields & { datesKnown: boolean; cancelled: boolean };
export type RegionEvents = { status: "complete" | "empty"; total: number; collectedAt: string; items: RegionEvent[] };
/**
 * Registered festivals/events of ONE verified district overlapping `range` (searchFestival2). Every page must arrive
 * with the same total, the right page number, the exact row count, unique contentids, type 15 and the requested
 * verified lDong pair; otherwise the whole collection is rejected. Rows with missing or invalid dates are kept as
 * unknown-date registrations. No cancellation field exists in this source, so rows are never marked cancelled here.
 */
export async function collectRegionEvents(call: TourCall, region: RegionRef, range: Range): Promise<RegionEvents> {
  const items: RegionEvent[] = [], ids = new Set<string>(); let total: number | null = null, collectedAt = "";
  for (let page = 1; page <= EVENT_MAX_PAGES; page++) {
    const res = await call("searchFestival2", { eventStartDate: range.start.replaceAll("-", ""), eventEndDate: range.end.replaceAll("-", ""),
      lDongRegnCd: region.province, lDongSignguCd: region.district, numOfRows: String(EVENT_PAGE_SIZE), pageNo: String(page), arrange: "A" });
    if (res.pageNo !== page || (total !== null && res.total !== total) || res.total > EVENT_PAGE_SIZE * EVENT_MAX_PAGES) throw new TourUnavailable();
    total = res.total;
    if (res.rows.length !== Math.min(EVENT_PAGE_SIZE, total - items.length)) throw new TourUnavailable();
    for (const row of res.rows) {
      if (!listFestivalType(row)) throw new TourUnavailable();
      const f = fields(row), rowRegion = verifiedLdongRegion(row.lDongRegnCd, row.lDongSignguCd);
      if (!rowRegion || rowRegion.code !== region.code || ids.has(f.id)) throw new TourUnavailable();
      const d = dates(row);
      ids.add(f.id); items.push({ ...f, ...d, datesKnown: d.start !== null, cancelled: false });
    }
    if (res.collectedAt > collectedAt) collectedAt = res.collectedAt;
    if (items.length === total) return { status: total ? "complete" : "empty", total, collectedAt, items };
  }
  throw new TourUnavailable();
}

export type Lookup = { result: LookupResult; collectedAt: string; festival: { region: RegionRef; fields: CurrentFields; datesVerified: boolean } | null };
/**
 * Server-side identity check for `current:<code>:<contentid>`: detailCommon2 must return exactly one row with the
 * same explicit contentid, an explicit type (15 => festival) and a verified lDong pair equal to the id's region.
 * Dates count as verified only from exactly one detailIntro2 row with the same explicit contentid and type 15;
 * any intro failure or ambiguity leaves the identity verified with unknown dates.
 */
export async function lookupCurrent(call: TourCall, contentId: string, expected: RegionRef): Promise<Lookup> {
  const common = await call("detailCommon2", { contentId });
  if (common.rows.length === 0) { if (common.total === 0) return { result: "not-found", collectedAt: common.collectedAt, festival: null }; throw new TourUnavailable(); }
  if (common.rows.length !== 1 || common.total !== 1) throw new TourUnavailable();
  const row = common.rows[0];
  if (!explicit(row, "contentid", contentId) || row.contenttypeid === undefined || row.contenttypeid === null) throw new TourUnavailable();
  if (String(row.contenttypeid) !== "15") return { result: "not-festival", collectedAt: common.collectedAt, festival: null };
  const region = verifiedLdongRegion(row.lDongRegnCd, row.lDongSignguCd);
  if (!region || region.code !== expected.code) return { result: "region-mismatch", collectedAt: common.collectedAt, festival: null };
  const f = fields(row);
  try {
    const intro = await call("detailIntro2", { contentId, contentTypeId: "15" }), i = intro.rows[0];
    if (intro.rows.length === 1 && intro.total === 1 && explicit(i, "contentid", contentId) && explicit(i, "contenttypeid", "15")) {
      const d = dates(i);
      if (d.start) return { result: "verified", collectedAt: common.collectedAt, festival: { region, fields: { ...f, ...d }, datesVerified: true } };
    }
  } catch { /* Dates are optional; identity stays verified. */ }
  return { result: "verified", collectedAt: common.collectedAt, festival: { region, fields: f, datesVerified: false } };
}
