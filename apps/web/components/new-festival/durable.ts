import { validMonth } from "@/components/existing/format";
import { RESOURCE_KINDS } from "@/lib/existing/request";
import type { ResourceKind } from "@/lib/existing/types";
import type { NewView } from "./memory";

// Pure helpers (server- and client-safe). Durable conditions live in the address: region (path), resource types,
// observation year and calendar month.
// Every view keeps all of them so a reload, a menu move or a region change restores the same conditions.
export const DURABLE_KEYS = ["types", "year", "month"] as const;

function single(params: URLSearchParams, key: string): string | null {
  const values = params.getAll(key);
  return values.length === 1 ? values[0] : null;
}
export function readYear(params: URLSearchParams): number | null {
  const raw = single(params, "year");
  return raw && /^\d{4}$/.test(raw) && Number(raw) >= 2000 && Number(raw) <= 2035 ? Number(raw) : null;
}
export function readMonth(params: URLSearchParams): string | null {
  const raw = single(params, "month");
  return validMonth(raw) ? raw : null;
}
/** absent = both types, `12` or `14` = one type, `none` = none chosen. */
export function readTypes(params: URLSearchParams): ResourceKind[] {
  const raw = single(params, "types");
  if (raw === null) return [...RESOURCE_KINDS];
  if (raw === "none") return [];
  const list = RESOURCE_KINDS.filter(k => raw.split(",").includes(k));
  return list.length ? list : [...RESOURCE_KINDS];
}
export function typesValue(types: ResourceKind[]): string | null {
  return types.length === RESOURCE_KINDS.length ? null : types.length ? types.join(",") : "none";
}

/** Only valid durable values; anything else in the address is dropped. */
export function durableParams(source: URLSearchParams, overrides: Partial<Record<(typeof DURABLE_KEYS)[number], string | null>> = {}): URLSearchParams {
  const out = new URLSearchParams(), types = typesValue(readTypes(source)), year = readYear(source), month = readMonth(source);
  if (types !== null && single(source, "types") !== null) out.set("types", types);
  if (year !== null) out.set("year", String(year));
  if (month !== null) out.set("month", month);
  for (const [key, value] of Object.entries(overrides)) { if (value === null || value === undefined) out.delete(key); else out.set(key, value); }
  out.sort();
  return out;
}
export function viewPath(code: string, view: NewView, params: URLSearchParams): string {
  const query = params.toString();
  return `/new/${encodeURIComponent(code)}/${view}${query ? `?${query}` : ""}`;
}
