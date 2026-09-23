import { parseFestivalId } from "@/lib/existing/identity";

export type SearchParams = Record<string, string | string[] | undefined>;

/** The festival segment carries the source-prefixed id (archive:… or current:…); anything else is not a festival. */
export function festivalParam(segment: string): string | null {
  let id = segment;
  try { id = decodeURIComponent(segment); } catch { return null; }
  return parseFestivalId(id) ? id : null;
}
export function festivalPath(id: string, view: "visits" | "resources" | "timing"): string {
  return `/existing/${encodeURIComponent(id)}/${view}`;
}
export function one(params: SearchParams | URLSearchParams, key: string): string | null {
  const values = params instanceof URLSearchParams ? params.getAll(key) : [params[key]].flat().filter((v): v is string => typeof v === "string");
  return values.length === 1 ? values[0] : null;
}
