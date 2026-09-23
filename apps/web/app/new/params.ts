import { regionFromRoute } from "@/components/new-festival/region-route";
import type { RegionRef } from "@/lib/existing/types";

export type SearchParams = Record<string, string | string[] | undefined>;
export type RegionParams = Promise<{ regionCode: string }>;

export function toParams(search: SearchParams): URLSearchParams {
  const out = new URLSearchParams();
  for (const [key, value] of Object.entries(search)) for (const v of [value].flat()) if (typeof v === "string") out.append(key, v);
  return out;
}
/** Five-digit administrative route code (e.g. 44230, Sejong 36110); anything else is not a region. */
export async function regionParam(params: RegionParams): Promise<RegionRef | null> {
  let code = (await params).regionCode;
  try { code = decodeURIComponent(code); } catch { return null; }
  return regionFromRoute(code);
}
