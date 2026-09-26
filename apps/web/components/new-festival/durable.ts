import { validMonth } from "@/components/existing/format";
import { readResourceTypes, resourceTypesValue, type ResourceKind } from "@/lib/existing/types";
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
/** absent or invalid = the default kinds (관광지·문화시설), `none` = none chosen, otherwise the listed kinds in display order. */
export function readTypes(params: URLSearchParams): ResourceKind[] {
  return readResourceTypes(single(params, "types"));
}
/** null only for exactly the default set; all four kinds stay explicit (`12,14,39,32`). */
export function typesValue(types: ResourceKind[]): string | null {
  return resourceTypesValue(types);
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
