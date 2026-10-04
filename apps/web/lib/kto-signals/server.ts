import "server-only";
import regionLinks from "../../data/region-code-links.json";
import { regionByCode, regionRef } from "../existing/identity";
import { InvalidRequest } from "../existing/request";
import type { TourPage } from "../existing/tour";
import { TourUnavailable } from "../existing/tour";
import type { RegionRef } from "../existing/types";
import { isKtoSuccessCode, parseKtoWire } from "../kto/wire";
import { crowdKey, relatedKey } from "./request";
import type { CrowdForecast, CrowdRequest, CrowdSpot, RelatedCategory, RelatedCenter, RelatedRequest, RelatedSpots, SignalBasis } from "./types";

// Read-only adapter for two live KTO OpenAPIs. Like the TourAPI adapter it never writes, keeps answers only in memory
// for a short time, never returns upstream messages or the service key, and bounds calls, concurrency, size and time.
export type SignalOperation = "tatsCnctrRatedList" | "areaBasedList1";
export type SignalCall = (operation: SignalOperation, params: Record<string, string>) => Promise<TourPage>;
const BASES: Record<SignalOperation, string> = {
  tatsCnctrRatedList: "https://apis.data.go.kr/B551011/TatsCnctrRateService",
  areaBasedList1: "https://apis.data.go.kr/B551011/TarRlteTarService1",
};
// The forecast is recomputed daily; related spots are monthly.
const TTL: Record<SignalOperation, number> = { tatsCnctrRatedList: 3_600_000, areaBasedList1: 43_200_000 };
export const CROWD_SOURCE = { title: "한국관광공사 관광지 집중률 방문자 추이 예측", url: "https://www.data.go.kr/data/15128555/openapi.do" };
export const RELATED_SOURCE = { title: "한국관광공사 관광지별 연관 관광지 정보", url: "https://www.data.go.kr/data/15128560/openapi.do" };
const PAGE = 1000, MAX_PAGES = 8;
/** Related spots are published with about two months' delay; the first published month is 2024-05. */
export const RELATED_FIRST_MONTH = "2024-05", RELATED_LAG_MONTHS = 2, RELATED_MONTHS = 12;
const CATEGORIES: readonly RelatedCategory[] = ["관광지", "음식", "숙박"];

export type SignalDeps = { fetch?: typeof fetch; key?: () => string | undefined; now?: () => number; maxCalls?: number; windowMs?: number; maxActive?: number };

export function createSignalCall(deps: SignalDeps = {}): SignalCall {
  const doFetch = deps.fetch ?? fetch, key = deps.key ?? (() => process.env.TOUR_API_KEY), now = deps.now ?? Date.now;
  const maxCalls = deps.maxCalls ?? 60, windowMs = deps.windowMs ?? 600_000, maxActive = deps.maxActive ?? 3;
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
        const url = new URL(`${BASES[operation]}/${operation}`);
        for (const [k, v] of Object.entries({ serviceKey: decoded, MobileOS: "ETC", MobileApp: "pickDday", _type: "json", ...params })) url.searchParams.set(k, v);
        const response = await doFetch(url, { signal: AbortSignal.timeout(10_000), cache: "no-store" });
        if (!response.ok) throw new TourUnavailable();
        const raw = await response.text(); if (raw.length > 4_000_000) throw new TourUnavailable();
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

/** Every page of one query; a total that changes between pages, too many pages or a short read is unavailable. */
async function allRows(call: SignalCall, operation: SignalOperation, params: Record<string, string>) {
  const first = await call(operation, { ...params, numOfRows: String(PAGE), pageNo: "1" });
  const pages = Math.ceil(first.total / PAGE);
  if (pages > MAX_PAGES) throw new TourUnavailable();
  const rows = [...first.rows];
  for (let page = 2; page <= pages; page++) {
    const next = await call(operation, { ...params, numOfRows: String(PAGE), pageNo: String(page) });
    if (next.total !== first.total) throw new TourUnavailable();
    rows.push(...next.rows);
  }
  if (rows.length !== first.total) throw new TourUnavailable();
  return { rows, collectedAt: first.collectedAt };
}

const ALIASES = regionLinks.aliases as Record<string, string>;
const OLD_CODE = new Map(Object.entries(ALIASES).map(([old, current]) => [current, old]));
type Target = { areaCd: string; signguCd: string; basis: SignalBasis | null };

/**
 * Codes to ask, in order: the provider still files merged Jeonnam/Gwangju districts under their previous codes (reviewed
 * one-to-one aliases), so that code comes first; then the current code; then, for a city's ward, the whole city.
 */
export function signalTargets(region: RegionRef): Target[] {
  const code = region.province.length === 5 ? region.province : region.code; // Sejong: 36110/36110
  if (!/^\d{5}$/.test(code)) return [];
  const own = (c: string): Target => ({ areaCd: c.slice(0, 2), signguCd: c, basis: null });
  const targets = [...(OLD_CODE.has(code) ? [own(OLD_CODE.get(code)!)] : []), own(code)];
  const parent = code.endsWith("0") ? null : regionByCode(`${code.slice(0, 4)}0`);
  if (parent && parent.code !== region.code) targets.push({ areaCd: parent.code.slice(0, 2), signguCd: parent.code, basis: { name: parent.districtName, parentOf: region.districtName } });
  return targets;
}

const ymd = (v: unknown) => { const s = String(v ?? ""); return /^\d{8}$/.test(s) ? `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}` : null; };
const rate = (v: unknown) => { const s = String(v ?? "").trim(); const n = /^\d+(\.\d+)?$/.test(s) ? Number(s) : NaN; return Number.isFinite(n) && n <= 200 ? n : null; };
const text = (v: unknown) => (typeof v === "string" ? v.trim() : typeof v === "number" ? String(v) : "");

/** Spots × days from the provider rows; any row of another region, date or value form makes the answer unusable. */
export function crowdFrom(rows: Record<string, unknown>[], target: Target): Pick<CrowdForecast, "days" | "daily" | "spots"> {
  const byName = new Map<string, Map<string, number>>(), days = new Set<string>();
  for (const row of rows) {
    const name = text(row.tAtsNm), day = ymd(row.baseYmd), value = rate(row.cnctrRate);
    if (!name || !day || value === null || text(row.signguCd) !== target.signguCd || text(row.areaCd) !== target.areaCd) throw new TourUnavailable();
    const spot = byName.get(name) ?? new Map<string, number>();
    if (spot.has(day)) throw new TourUnavailable();
    spot.set(day, value); byName.set(name, spot); days.add(day);
  }
  const order = [...days].sort();
  if (order.length > 31) throw new TourUnavailable();
  const spots: CrowdSpot[] = [...byName].map(([name, values]) => {
    const rates = order.map(d => values.get(d) ?? null), present = rates.filter((r): r is number => r !== null);
    const max = Math.max(...present), peakDay = order[rates.indexOf(max)];
    return { name, rates, mean: present.reduce((n, r) => n + r, 0) / present.length, peak: { date: peakDay, rate: max } };
  }).sort((a, b) => b.mean - a.mean || b.peak.rate - a.peak.rate || a.name.localeCompare(b.name, "ko"));
  const daily = order.map((_, i) => { const v = spots.map(s => s.rates[i]).filter((r): r is number => r !== null); return v.length ? v.reduce((n, r) => n + r, 0) / v.length : null; });
  return { days: order, daily, spots };
}

/** Center spots with their related spots by provider rank; rows of another month are unusable. */
export function relatedFrom(rows: Record<string, unknown>[], month: string): RelatedCenter[] {
  const centers = new Map<string, RelatedCenter>();
  for (const row of rows) {
    const center = text(row.tAtsNm), name = text(row.rlteTatsNm), category = text(row.rlteCtgryLclsNm) as RelatedCategory, rank = Number(text(row.rlteRank));
    if (text(row.baseYm) !== month.replace("-", "") || !center || !name || !CATEGORIES.includes(category) || !Number.isInteger(rank) || rank < 1) throw new TourUnavailable();
    const id = text(row.tAtsCd) || center, entry = centers.get(id) ?? { name: center, items: [] };
    if (!entry.items.some(i => i.rank === rank && i.name === name)) entry.items.push({ rank, name, category, detail: text(row.rlteCtgrySclsNm) || text(row.rlteCtgryMclsNm), place: text(row.rlteSignguNm) });
    centers.set(id, entry);
  }
  return [...centers.values()].map(c => ({ ...c, items: c.items.sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name, "ko")) }))
    .sort((a, b) => b.items.length - a.items.length || a.name.localeCompare(b.name, "ko"));
}

/** The months that can be chosen, newest first: twelve months ending two months before `today` (Korea time). */
export function relatedMonths(today: string): string[] {
  let y = Number(today.slice(0, 4)), m = Number(today.slice(5, 7)) - RELATED_LAG_MONTHS;
  const out: string[] = [];
  while (out.length < RELATED_MONTHS) {
    while (m < 1) { m += 12; y--; }
    const month = `${y}-${String(m).padStart(2, "0")}`;
    if (month < RELATED_FIRST_MONTH) break;
    out.push(month); m--;
  }
  return out;
}

const koreaDay = (iso: string) => new Date(new Date(iso).getTime() + 9 * 3_600_000).toISOString().slice(0, 10);

export function createSignalService(deps: { call: SignalCall; now?: () => string }) {
  const now = deps.now ?? (() => new Date().toISOString());
  function regionOf(r: { province: string; district: string }) { const region = regionRef(r.province, r.district); if (!region) throw new InvalidRequest("region"); return region; }

  async function loadCrowd(req: CrowdRequest): Promise<CrowdForecast> {
    const region = regionOf(req), retrievedAt = now(), base = { key: crowdKey(req), request: req, retrievedAt, region };
    try {
      for (const target of signalTargets(region)) {
        const { rows, collectedAt } = await allRows(deps.call, "tatsCnctrRatedList", { areaCd: target.areaCd, signguCd: target.signguCd });
        if (rows.length) return { ...base, status: "complete", basis: target.basis, ...crowdFrom(rows, target), source: { ...CROWD_SOURCE, collectedAt } };
      }
      return { ...base, status: "empty", basis: null, days: [], daily: [], spots: [], source: null };
    } catch { return { ...base, status: "unavailable", basis: null, days: [], daily: [], spots: [], source: null }; }
  }

  async function loadRelated(req: RelatedRequest): Promise<RelatedSpots> {
    const region = regionOf(req), retrievedAt = now(), months = relatedMonths(koreaDay(retrievedAt));
    if (req.month !== null && !months.includes(req.month)) throw new InvalidRequest("month");
    // Without a chosen month: the newest month, or the one before it when the newest has nothing for this district yet.
    const tries = req.month !== null ? [req.month] : months.slice(0, 2);
    const base = { key: relatedKey(req), request: req, retrievedAt, region, months };
    try {
      for (const month of tries) {
        for (const target of signalTargets(region)) {
          const { rows, collectedAt } = await allRows(deps.call, "areaBasedList1", { baseYm: month.replace("-", ""), areaCd: target.areaCd, signguCd: target.signguCd });
          if (rows.length) return { ...base, status: "complete", basis: target.basis, month, centers: relatedFrom(rows, month), source: { ...RELATED_SOURCE, collectedAt } };
        }
      }
      return { ...base, status: "empty", basis: null, month: tries[0], centers: [], source: null };
    } catch { return { ...base, status: "unavailable", basis: null, month: tries[0], centers: [], source: null }; }
  }
  return { loadCrowd, loadRelated };
}

const service = createSignalService({ call: createSignalCall() });
export const { loadCrowd, loadRelated } = service;
