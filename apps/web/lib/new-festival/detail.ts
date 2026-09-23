import { SOURCE } from "../region/model";
import { regionRef, verifiedLdongRegion } from "../existing/identity";
import type { TourCall } from "../existing/tour";
import type { PublicSource } from "../existing/types";
import { overviewText } from "./overview";
import { resourceDetailKey } from "./request";
import type { ResourceDetailRequest, ResourceDetailResponse } from "./types";

export const DETAIL_SOURCE_TITLE = "한국관광공사 국문 관광정보 · 공통정보";
const explicit = (row: Record<string, unknown>, field: string) => row[field] !== undefined && row[field] !== null && String(row[field]).trim() !== "";

/**
 * Read-only resource description (detailCommon2) for ONE list resource. Identity is checked before any text is read:
 * exactly one row, the same explicit contentid, an explicit contenttypeid equal to the requested kind, and a verified
 * lDong pair equal to the requested region. Mismatches return no descriptive data; ambiguous or failed replies are
 * `unavailable` (retryable). Only the overview is returned, as plain text; collectedAt is this detail fetch's time.
 */
export async function loadResourceDetail(call: TourCall, req: ResourceDetailRequest, now: () => string): Promise<ResourceDetailResponse> {
  const region = regionRef(req.province, req.district)!;
  const base = { key: resourceDetailKey(req), request: req, retrievedAt: now(), region };
  const unavailable: ResourceDetailResponse = { ...base, status: "unavailable", error: { code: "source-unavailable", retryable: true }, detail: null, source: null };
  let page: Awaited<ReturnType<TourCall>>;
  try { page = await call("detailCommon2", { contentId: req.id }); } catch { return unavailable; }
  const source: PublicSource = { title: DETAIL_SOURCE_TITLE, url: SOURCE, checkedAt: null, publishedAt: null, collectedAt: page.collectedAt };
  const result = (status: "empty" | "not-found" | "type-mismatch" | "region-mismatch"): ResourceDetailResponse => ({ ...base, status, error: null, detail: null, source });
  if (page.rows.length === 0) return page.total === 0 ? result("not-found") : unavailable;
  if (page.rows.length !== 1 || page.total !== 1) return unavailable;
  const row = page.rows[0];
  if (!explicit(row, "contentid") || String(row.contentid).trim() !== req.id || !explicit(row, "contenttypeid")) return unavailable;
  if (String(row.contenttypeid).trim() !== req.kind) return result("type-mismatch");
  const rowRegion = verifiedLdongRegion(row.lDongRegnCd, row.lDongSignguCd);
  if (!rowRegion || rowRegion.code !== region.code) return result("region-mismatch");
  const { text, truncated } = overviewText(row.overview);
  if (!text) return result("empty");
  const modifiedAt = /^\d{14}$/.test(String(row.modifiedtime)) ? String(row.modifiedtime) : null;
  return { ...base, status: "complete", error: null, detail: { id: req.id, kind: req.kind, overview: text, truncated, modifiedAt }, source };
}
