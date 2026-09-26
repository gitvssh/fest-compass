import { unlink } from "node:fs/promises";
import { join } from "node:path";
import { verifiedLdongRegion } from "../existing/identity";
import { validDate } from "../kto/probe";
import { isKtoSuccessCode, parseKtoWire } from "../kto/wire";
import { type CollectContext, isRecord, isTimestamp, koreaDay, readCurrentOrPrevious, readVerified, sha256, writeChecked, writeRotating } from "./store";

// Nationwide TourAPI festival registry (KorService2/searchFestival2, contentTypeId 15 rows) from January 1 of the
// previous year. A sweep counts only when every page arrived with one stable total, exact row counts and unique
// content ids; otherwise the last complete sweep stays. Registration dates are provider registrations, not proof that
// a festival took place, and a row that disappears is never read as a cancellation.
export const REGISTRY = {
  endpoint: "https://apis.data.go.kr/B551011/KorService2/searchFestival2", pageSize: 100, maxRows: 5_000, maxBodyChars: 4_000_000,
  pageMaxBytes: 1024 * 1024, snapshotMaxBytes: 8 * 1024 * 1024, historyMaxBytes: 32 * 1024 * 1024, maxKeys: 50_000, maxObservationsPerKey: 20,
} as const;

export type RegistryRow = { contentId: string; regionCode: string | null; name: string; start: string | null; end: string | null; modifiedAt: string | null };
export type RegistryPage = { eventStartDate: string; pageNo: number; total: number; bodyHash: string; rows: RegistryRow[] };
export type RegistrySnapshot = { collectedAt: string; eventStartDate: string; total: number; pages: { pageNo: number; bodyHash: string }[]; items: RegistryRow[] };
type Observation = { start: string; end: string; name: string; firstSeenAt: string; lastSeenAt: string };
export type RegistryHistory = { updatedAt: string; entries: Record<string, Observation[]> };
export type RegistrationPeriod = { id: string; contentId: string; name: string; regionCode: string; start: string; end: string; collectedAt: string };

const ACCESS_STOP = new Set(["20", "22", "23", "29", "30", "31"]);
const expectedRows = (total: number, pageNo: number) => Math.max(0, Math.min(REGISTRY.pageSize, total - (pageNo - 1) * REGISTRY.pageSize));
const eventDates = (row: Record<string, unknown>) => {
  const start = validDate(row.eventstartdate), end = validDate(row.eventenddate);
  return start && end && end >= start ? { start, end } : { start: null, end: null };
};

/** One nationwide page. Upstream text, URLs and the key never leave this function. */
export async function fetchRegistryPage(request: { eventStartDate: string; pageNo: number }, key: string, fetcher: typeof fetch = fetch): Promise<RegistryPage> {
  const secret = key.trim(), { eventStartDate, pageNo } = request;
  if (!secret || !/^\d{8}$/.test(eventStartDate) || !validDate(eventStartDate) || !Number.isSafeInteger(pageNo) || pageNo < 1
    || pageNo > REGISTRY.maxRows / REGISTRY.pageSize) throw new Error("invalid-request");
  let decoded = secret; try { decoded = decodeURIComponent(secret); } catch { /* raw key */ }
  const url = new URL(REGISTRY.endpoint);
  for (const [k, v] of Object.entries({ serviceKey: decoded, MobileOS: "ETC", MobileApp: "pickDday", _type: "json", eventStartDate,
    numOfRows: String(REGISTRY.pageSize), pageNo: String(pageNo), arrange: "A" })) url.searchParams.set(k, v);
  let response: Response, body: string;
  try {
    response = await fetcher(url, { signal: AbortSignal.timeout(30_000), redirect: "error", cache: "no-store" });
    body = await response.text();
  } catch { throw new Error("registry-network-error"); }
  if (body.length > REGISTRY.maxBodyChars) throw new Error("registry-provider-error");
  const wire = parseKtoWire(body);
  if ([401, 403, 429].includes(response.status) || ACCESS_STOP.has(wire.gatewayCode ?? wire.resultCode ?? "")) throw new Error("registry-access-or-quota-stop");
  if (!response.ok || wire.gatewayCode || wire.contractError || !isKtoSuccessCode(wire.resultCode)) throw new Error("registry-provider-error");
  const total = wire.totalCount;
  if (!Number.isSafeInteger(total) || total! < 0) throw new Error("registry-pagination-error");
  if (total! > REGISTRY.maxRows) throw new Error("registry-too-large");
  // numOfRows may shrink to the total; the page number and exact row count may not.
  if (wire.pageNo !== pageNo || wire.items.length !== expectedRows(total!, pageNo)) throw new Error("registry-pagination-error");
  const ids = new Set<string>();
  const rows = wire.items.map((row): RegistryRow => {
    const contentId = String(row.contentid ?? "");
    if ((row.contenttypeid !== undefined && row.contenttypeid !== null && String(row.contenttypeid) !== "15")
      || !/^\d{1,20}$/.test(contentId) || typeof row.title !== "string" || !row.title.trim()) throw new Error("registry-row-contract-error");
    if (ids.has(contentId)) throw new Error("registry-duplicate-row");
    ids.add(contentId);
    return { contentId, regionCode: verifiedLdongRegion(row.lDongRegnCd, row.lDongSignguCd)?.code ?? null, name: row.title.trim().slice(0, 300),
      ...eventDates(row), modifiedAt: /^\d{14}$/.test(String(row.modifiedtime)) ? String(row.modifiedtime) : null };
  });
  return { eventStartDate, pageNo, total: total!, bodyHash: sha256(body), rows };
}

const isDay = (v: unknown): v is string => typeof v === "string" && validDate(v) === v;
function validateRow(r: unknown): RegistryRow {
  if (!isRecord(r) || typeof r.contentId !== "string" || !/^\d{1,20}$/.test(r.contentId) || !(r.regionCode === null || (typeof r.regionCode === "string" && /^\d{5,10}$/.test(r.regionCode)))
    || typeof r.name !== "string" || !r.name || r.name.length > 300 || !(r.modifiedAt === null || (typeof r.modifiedAt === "string" && /^\d{14}$/.test(r.modifiedAt)))
    || !((r.start === null && r.end === null) || (isDay(r.start) && isDay(r.end) && r.end >= r.start))) throw new Error("invalid-registry-row");
  return r as RegistryRow;
}
function validatePage(value: unknown): RegistryPage {
  if (!isRecord(value) || typeof value.eventStartDate !== "string" || !Number.isSafeInteger(value.pageNo) || !Number.isSafeInteger(value.total)
    || typeof value.bodyHash !== "string" || !Array.isArray(value.rows)) throw new Error("invalid-registry-page");
  const page = value as RegistryPage;
  if (page.rows.length !== expectedRows(page.total, page.pageNo)) throw new Error("invalid-registry-page");
  page.rows.forEach(validateRow);
  return page;
}

/** All pages 1..n of one sweep, one stable total, exact counts and ids unique across pages; otherwise throws. */
export function assembleRegistry(pages: RegistryPage[], eventStartDate: string, collectedAt: string): RegistrySnapshot {
  const sorted = [...pages].sort((a, b) => a.pageNo - b.pageNo), total = sorted[0]?.total;
  if (total === undefined || sorted.length !== Math.max(1, Math.ceil(total / REGISTRY.pageSize))
    || sorted.some((p, i) => p.pageNo !== i + 1 || p.total !== total || p.eventStartDate !== eventStartDate || p.rows.length !== expectedRows(total, i + 1))) throw new Error("registry-incomplete-sweep");
  const items = sorted.flatMap(p => p.rows);
  if (items.length !== total || new Set(items.map(r => r.contentId)).size !== total) throw new Error("registry-duplicate-row");
  return { collectedAt, eventStartDate, total, pages: sorted.map(p => ({ pageNo: p.pageNo, bodyHash: p.bodyHash })), items };
}
export function validateSnapshot(value: unknown): RegistrySnapshot {
  if (!isRecord(value) || !isTimestamp(value.collectedAt) || typeof value.eventStartDate !== "string" || !validDate(value.eventStartDate)
    || !Number.isSafeInteger(value.total) || !Array.isArray(value.items) || value.items.length !== value.total || !Array.isArray(value.pages)) throw new Error("invalid-registry-snapshot");
  (value.items as unknown[]).forEach(validateRow);
  if (new Set((value.items as RegistryRow[]).map(r => r.contentId)).size !== value.total) throw new Error("invalid-registry-snapshot");
  return value as RegistrySnapshot;
}

/** Observations are keyed by exact region and content id together; a content id seen in another region is another key. */
const historyKey = (regionCode: string, contentId: string) => `${regionCode}:${contentId}`;
export function validateHistory(value: unknown): RegistryHistory {
  if (!isRecord(value) || !isTimestamp(value.updatedAt) || !isRecord(value.entries)) throw new Error("invalid-registry-history");
  const entries = Object.entries(value.entries);
  if (entries.length > REGISTRY.maxKeys) throw new Error("invalid-registry-history");
  for (const [key, list] of entries) {
    if (!/^\d{5,10}:\d{1,20}$/.test(key) || !Array.isArray(list) || !list.length || list.length > REGISTRY.maxObservationsPerKey) throw new Error("invalid-registry-history");
    for (const o of list) if (!isRecord(o) || !isDay(o.start) || !isDay(o.end) || o.end < o.start || typeof o.name !== "string" || !o.name || o.name.length > 300
      || !isTimestamp(o.firstSeenAt) || !isTimestamp(o.lastSeenAt) || o.lastSeenAt < o.firstSeenAt) throw new Error("invalid-registry-history");
  }
  return value as RegistryHistory;
}

/** Record each dated, region-verified registration of a complete sweep. Nothing is deleted when a row disappears. */
export function mergeHistory(previous: RegistryHistory | null, snapshot: RegistrySnapshot): RegistryHistory {
  const entries: Record<string, Observation[]> = Object.fromEntries(Object.entries(previous?.entries ?? {}).map(([k, list]) => [k, list.map(o => ({ ...o }))]));
  const at = snapshot.collectedAt;
  for (const item of snapshot.items) {
    if (!item.regionCode || !item.start || !item.end) continue;
    const key = historyKey(item.regionCode, item.contentId), list = entries[key] ?? (entries[key] = []);
    const same = list.find(o => o.start === item.start && o.end === item.end);
    if (same) { if (at >= same.lastSeenAt) { same.lastSeenAt = at; same.name = item.name; } }
    else list.push({ start: item.start, end: item.end, name: item.name, firstSeenAt: at, lastSeenAt: at });
    list.sort((a, b) => b.lastSeenAt.localeCompare(a.lastSeenAt) || a.start.localeCompare(b.start));
    list.splice(REGISTRY.maxObservationsPerKey);
  }
  const latest = (list: Observation[]) => list.reduce((m, o) => (o.lastSeenAt > m ? o.lastSeenAt : m), "");
  const kept = Object.entries(entries).sort((a, b) => latest(b[1]).localeCompare(latest(a[1])) || a[0].localeCompare(b[0])).slice(0, REGISTRY.maxKeys);
  return { updatedAt: at, entries: Object.fromEntries(kept.sort((a, b) => a[0].localeCompare(b[0]))) };
}

const snapshotPath = (dir: string) => join(dir, "registry", "current.json");
const historyPath = (dir: string) => join(dir, "registry", "history.json");

/**
 * Observed registration periods for exactly this content id in exactly this catalogue region: distinct observed
 * dates, and per start year only the most recently observed one. Nothing is derived from titles or other years.
 */
export async function readRegistrationPeriods(dir: string, contentId: string, regionCode: string): Promise<RegistrationPeriod[]> {
  if (!/^\d{1,20}$/.test(contentId) || !/^\d{5,10}$/.test(regionCode)) return [];
  const history = await readCurrentOrPrevious(historyPath(dir), validateHistory, REGISTRY.historyMaxBytes);
  const byYear = new Map<string, Observation>();
  for (const o of history?.entries[historyKey(regionCode, contentId)] ?? []) {
    const year = o.start.slice(0, 4), held = byYear.get(year);
    if (!held || o.lastSeenAt > held.lastSeenAt || (o.lastSeenAt === held.lastSeenAt && o.firstSeenAt > held.firstSeenAt)) byYear.set(year, o);
  }
  return [...byYear.values()].sort((a, b) => a.start.localeCompare(b.start)).map(o => ({
    id: `reg-${regionCode}-${contentId}-${o.start.replaceAll("-", "")}`, contentId, name: o.name, regionCode, start: o.start, end: o.end, collectedAt: o.lastSeenAt }));
}
export async function readRegistrySnapshot(dir: string): Promise<RegistrySnapshot | null> {
  return readCurrentOrPrevious(snapshotPath(dir), validateSnapshot, REGISTRY.snapshotMaxBytes);
}
export const registrationCount = (s: RegistrySnapshot | null) => s ? s.items.filter(i => i.regionCode && i.start).length : 0;

export type RegistryOutcome = { status: "ok" | "empty" | "fresh" | "failed"; error: string | null };
/** One sweep a Korea day. History is written before the snapshot, so an interrupted commit is redone from cached pages. */
export async function collectRegistry(ctx: CollectContext): Promise<RegistryOutcome> {
  const current = await readVerified(snapshotPath(ctx.dir), validateSnapshot, REGISTRY.snapshotMaxBytes);
  if (current && koreaDay(current.collectedAt) === ctx.day) return { status: "fresh", error: null };
  const eventStartDate = `${Number(ctx.day.slice(0, 4)) - 1}0101`, pages: RegistryPage[] = [];
  const pageId = (n: number) => `registry-${eventStartDate}-p${n}`, cached = (n: number) => join(ctx.dir, "pages", ctx.day, `${pageId(n)}.json`);
  let count = 1;
  for (let pageNo = 1; pageNo <= count; pageNo++) {
    let page = await readVerified(cached(pageNo), validatePage, REGISTRY.pageMaxBytes);
    if (!page) {
      if (ctx.attempts.has(pageId(pageNo))) throw new Error("registry-attempted-today");
      if (!await ctx.spend("registry", pageId(pageNo))) throw new Error("registry-budget-stop");
      page = await fetchRegistryPage({ eventStartDate, pageNo }, ctx.key, ctx.fetch);
      await writeChecked(cached(pageNo), page);
      await ctx.pause();
    }
    if (page.pageNo !== pageNo || page.eventStartDate !== eventStartDate) throw new Error("registry-cache-mismatch");
    if (pages.length && page.total !== pages[0].total) throw new Error("registry-incomplete-sweep");
    pages.push(page);
    if (pageNo === 1) {
      count = Math.max(1, Math.ceil(page.total / REGISTRY.pageSize));
      let uncached = 0;
      for (let n = 2; n <= count; n++) if (!await readVerified(cached(n), validatePage, REGISTRY.pageMaxBytes)) uncached++;
      if (uncached > ctx.remaining("registry")) throw new Error("registry-budget-stop");
    }
  }
  const snapshot = assembleRegistry(pages, eventStartDate, ctx.now);
  const history = await readCurrentOrPrevious(historyPath(ctx.dir), validateHistory, REGISTRY.historyMaxBytes);
  await writeRotating(historyPath(ctx.dir), mergeHistory(history, snapshot), validateHistory, REGISTRY.historyMaxBytes);
  await writeRotating(snapshotPath(ctx.dir), snapshot, validateSnapshot, REGISTRY.snapshotMaxBytes);
  for (let n = 1; n <= count; n++) await unlink(cached(n)).catch(() => undefined);
  return { status: snapshot.total ? "ok" : "empty", error: null };
}
