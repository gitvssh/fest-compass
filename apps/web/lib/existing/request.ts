import { day } from "../region/model";
import { koreaDate } from "../region/calendar";
import { MAX_EDITIONS, normalizeKeyword, parseFestivalId, regionRef } from "./identity";
import { CUSTOM_WINDOW_MAX, datesBetween, PAD_DEFAULT, PAD_MAX } from "./history";
import { DEFAULT_RESOURCE_KINDS, isResourceKind, RESOURCE_KINDS } from "./types";
import type { FestivalSearchRequest, HistoryRequest, MonthlyRequest, ResourcesRequest, ScheduleRequest } from "./types";
export { DEFAULT_RESOURCE_KINDS, RESOURCE_KINDS } from "./types";

export class InvalidRequest extends Error { constructor(readonly field: string) { super(`invalid-request:${field}`); } }
const MAX_RANGE_DAYS = 366;
export const MAX_PAGE = 50;

function range(start: string, end: string, field = "range") {
  if (!day(start) || !day(end) || end < start || start < "2000-01-01" || end > "2035-12-31" || datesBetween(start, end).length > MAX_RANGE_DAYS) throw new InvalidRequest(field);
  return { start, end };
}
function region(p: URLSearchParams, optional = false): { province: string; district: string } | null {
  const province = p.get("province")?.trim() ?? "", district = p.get("district")?.trim() ?? "";
  if (optional && !province && !district) return null;
  if (!regionRef(province, district)) throw new InvalidRequest("region");
  return { province, district };
}

// Canonical keys: identical conditions produce identical keys so the UI can keep and match results per condition.
export const festivalsKey = (r: FestivalSearchRequest) => JSON.stringify(["festivals", r.id, r.q, r.province, r.district, r.start, r.end, r.page, r.total]);
export const historyKey = (r: HistoryRequest) => JSON.stringify(["history", r.festival, r.editions, r.before, r.after, Object.keys(r.windows).sort().map(k => [k, r.windows[k].start, r.windows[k].end])]);
export const monthlyKey = (r: MonthlyRequest) => JSON.stringify(["monthly", r.province, r.district, r.year]);
export const resourcesKey = (r: ResourcesRequest) => JSON.stringify(["resources", r.province, r.district, r.types]);
export const scheduleKey = (r: ScheduleRequest) => JSON.stringify(["schedule", r.province, r.district, r.start, r.end]);

export function parseFestivalSearch(p: URLSearchParams, today = koreaDate()): FestivalSearchRequest {
  const id = p.get("id")?.trim() || null;
  if (id !== null && !parseFestivalId(id)) throw new InvalidRequest("id");
  const q = normalizeKeyword(p.get("q") ?? ""), where = region(p, true), year = today.slice(0, 4);
  const r = range(p.get("start") || `${year}-01-01`, p.get("end") || `${year}-12-31`);
  const rawPage = p.get("page");
  if (rawPage !== null && rawPage !== "" && (!/^\d{1,2}$/.test(rawPage) || Number(rawPage) < 1 || Number(rawPage) > MAX_PAGE)) throw new InvalidRequest("page");
  // `total` = the source total reported with `next`; a continued page must still match it.
  const rawTotal = p.get("total");
  if (rawTotal !== null && rawTotal !== "" && !/^\d{1,6}$/.test(rawTotal)) throw new InvalidRequest("total");
  return { q, province: where?.province ?? null, district: where?.district ?? null, ...r, page: rawPage ? Number(rawPage) : 1, total: rawTotal ? Number(rawTotal) : null, id };
}
/** `windows=<editionId>:<start>:<end>,...` — absolute chart ranges; they never change the festival-period summary. */
export function parseWindows(raw: string | null): Record<string, { start: string; end: string }> {
  const windows: Record<string, { start: string; end: string }> = {};
  if (raw === null || raw.trim() === "") return windows;
  for (const part of raw.split(",")) {
    const m = /^([a-z0-9-]{1,100}):(\d{4}-\d{2}-\d{2}):(\d{4}-\d{2}-\d{2})$/.exec(part.trim());
    if (!m || windows[m[1]] || !day(m[2]) || !day(m[3]) || m[3] < m[2] || datesBetween(m[2], m[3]).length > CUSTOM_WINDOW_MAX) throw new InvalidRequest("windows");
    windows[m[1]] = { start: m[2], end: m[3] };
  }
  if (Object.keys(windows).length > MAX_EDITIONS) throw new InvalidRequest("windows");
  return windows;
}
export function parseHistory(p: URLSearchParams): HistoryRequest {
  const festival = (p.get("festival") ?? "").trim().replace(/^archive:/, "");
  if (!/^[a-z0-9-]{1,80}$/.test(festival) && parseFestivalId(festival)?.source !== "current") throw new InvalidRequest("festival");
  const raw = p.get("editions"), editions = raw === null || raw.trim() === "" ? [] : [...new Set(raw.split(",").map(s => s.trim()).filter(Boolean))];
  if (editions.length > MAX_EDITIONS || editions.some(e => !/^[a-z0-9-]{1,100}$/.test(e))) throw new InvalidRequest("editions");
  const pad = (name: string) => {
    const v = p.get(name); if (v === null || v === "") return PAD_DEFAULT;
    if (!/^\d{1,2}$/.test(v) || Number(v) > PAD_MAX) throw new InvalidRequest(name);
    return Number(v);
  };
  const windows = parseWindows(p.get("windows"));
  if (editions.length && Object.keys(windows).some(k => !editions.includes(k))) throw new InvalidRequest("windows");
  return { festival, editions, before: pad("before"), after: pad("after"), windows };
}
export function parseMonthly(p: URLSearchParams): MonthlyRequest {
  const where = region(p)!, raw = p.get("year");
  if (raw && (!/^\d{4}$/.test(raw) || Number(raw) < 2000 || Number(raw) > 2035)) throw new InvalidRequest("year");
  return { ...where, year: raw ? Number(raw) : null };
}
/** Absent `types` = the default kinds; otherwise every listed part must be one of the four kinds (display order, no empty list). */
export function parseResources(p: URLSearchParams): ResourcesRequest {
  const where = region(p)!, raw = p.get("types");
  if (raw === null) return { ...where, types: [...DEFAULT_RESOURCE_KINDS] };
  const parts = raw.split(",").map(s => s.trim());
  if (parts.some(s => !isResourceKind(s))) throw new InvalidRequest("types");
  return { ...where, types: RESOURCE_KINDS.filter(k => parts.includes(k)) };
}
export function parseSchedule(p: URLSearchParams): ScheduleRequest {
  return { ...region(p)!, ...range(p.get("start") ?? "", p.get("end") ?? "") };
}
