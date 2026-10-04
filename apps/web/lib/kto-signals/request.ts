import { regionRef } from "../existing/identity";
import { InvalidRequest } from "../existing/request";
import type { CrowdRequest, RelatedRequest } from "./types";

// Canonical keys: identical conditions produce identical keys so the UI can drop answers for older conditions.
export const crowdKey = (r: CrowdRequest) => JSON.stringify(["kto-crowd", r.province, r.district]);
export const relatedKey = (r: RelatedRequest) => JSON.stringify(["kto-related", r.province, r.district, r.month]);

function region(p: URLSearchParams) {
  const province = p.get("province")?.trim() ?? "", district = p.get("district")?.trim() ?? "";
  if (!regionRef(province, district)) throw new InvalidRequest("region");
  return { province, district };
}

/** Exact REGIONS pair only. */
export const parseCrowd = (p: URLSearchParams): CrowdRequest => region(p);

/** Exact REGIONS pair and an optional month YYYY-MM (which months exist is checked by the service). */
export function parseRelated(p: URLSearchParams): RelatedRequest {
  const r = region(p), month = p.get("month")?.trim() || null;
  if (month !== null && !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new InvalidRequest("month");
  return { ...r, month };
}
