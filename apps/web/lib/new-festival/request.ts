import { regionRef } from "../existing/identity";
import { InvalidRequest, parseMonthly, RESOURCE_KINDS } from "../existing/request";
import type { ResourceKind } from "../existing/types";
import type { NewVisitsRequest, ResourceDetailRequest } from "./types";

// Canonical keys: identical conditions produce identical keys so the UI can drop responses for older conditions.
export const newVisitsKey = (r: NewVisitsRequest) => JSON.stringify(["new-visits", r.province, r.district, r.year]);
export const resourceDetailKey = (r: ResourceDetailRequest) => JSON.stringify(["new-resource-detail", r.province, r.district, r.kind, r.id]);

/** Same region/year rules as the existing monthly view (exact REGIONS pair, optional year 2000–2035). */
export const parseNewVisits = (p: URLSearchParams): NewVisitsRequest => parseMonthly(p);

export function parseResourceDetail(p: URLSearchParams): ResourceDetailRequest {
  const province = p.get("province")?.trim() ?? "", district = p.get("district")?.trim() ?? "";
  if (!regionRef(province, district)) throw new InvalidRequest("region");
  const kind = p.get("kind")?.trim() ?? "";
  if (!(RESOURCE_KINDS as readonly string[]).includes(kind)) throw new InvalidRequest("kind");
  const id = p.get("id")?.trim() ?? "";
  if (!/^\d{1,20}$/.test(id)) throw new InvalidRequest("id");
  return { province, district, kind: kind as ResourceKind, id };
}
