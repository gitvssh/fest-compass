import { SOURCE } from "../region/model";
import { regionRef, verifiedLdongRegion } from "../existing/identity";
import type { TourCall } from "../existing/tour";
import type { PublicSource } from "../existing/types";
import { resourceInfoText, resourceIntro, resourceWebsite } from "../resources/info";
import { RESOURCE_GALLERY_LIMIT, resourceImageUrl, resourcePhoto, resourcePhotos } from "../resources/media";
import type { ResourceFact, ResourcePhoto, ResourceSectionStatus } from "../resources/types";
import { overviewText } from "./overview";
import { resourceDetailKey } from "./request";
import type { ResourceDetailRequest, ResourceDetailResponse } from "./types";

export const DETAIL_SOURCE_TITLE = "한국관광공사 국문 관광정보";
const explicit = (row: Record<string, unknown>, field: string) => row[field] !== undefined && row[field] !== null && String(row[field]).trim() !== "";
const matches = (row: Record<string, unknown>, field: string, value: string) => explicit(row, field) && String(row[field]).trim() === value;

/** One bounded page of optional gallery photos. An identity/shape fault cannot leak another resource's images. */
async function gallery(call: TourCall, req: ResourceDetailRequest, title: string): Promise<{ status: ResourceSectionStatus; photos: ResourcePhoto[]; collectedAt: string | null; deniedUrls: Set<string> }> {
  const unavailable = { status: "unavailable" as const, photos: [], collectedAt: null, deniedUrls: new Set<string>() };
  try {
    const page = await call("detailImage2", { contentId: req.id, numOfRows: String(RESOURCE_GALLERY_LIMIT), pageNo: "1" });
    if (!Number.isSafeInteger(page.total) || page.total < 0 || page.pageNo !== 1 || page.rows.length !== Math.min(page.total, RESOURCE_GALLERY_LIMIT)
      || page.rows.some(row => !matches(row, "contentid", req.id))) return unavailable;
    const deniedUrls = new Set(page.rows.filter(row => !["Type1", "Type3"].includes(String(row.cpyrhtDivCd ?? "").trim()))
      .flatMap(row => [resourceImageUrl(row.originimgurl), resourceImageUrl(row.smallimageurl)]).filter((url): url is string => url !== null));
    const photos = resourcePhotos(page.rows.map(row => resourcePhoto(row, "gallery", title))).filter(photo => !deniedPhoto(photo, deniedUrls));
    return { status: photos.length ? "complete" : "empty", photos, collectedAt: page.collectedAt, deniedUrls };
  } catch { return unavailable; }
}
const deniedPhoto = (photo: ResourcePhoto, deniedUrls: Set<string>) => deniedUrls.has(photo.url) || !!photo.thumbnailUrl && deniedUrls.has(photo.thumbnailUrl);

async function intro(call: TourCall, req: ResourceDetailRequest): Promise<{ status: ResourceSectionStatus; facts: ResourceFact[]; phone: string | null; collectedAt: string | null }> {
  const unavailable = { status: "unavailable" as const, facts: [], phone: null, collectedAt: null };
  try {
    const page = await call("detailIntro2", { contentId: req.id, contentTypeId: req.kind });
    if (page.total === 0 && page.rows.length === 0) return { ...unavailable, status: "empty", collectedAt: page.collectedAt };
    if (page.total !== 1 || page.rows.length !== 1 || !matches(page.rows[0], "contentid", req.id) || !matches(page.rows[0], "contenttypeid", req.kind)) return unavailable;
    const info = resourceIntro(page.rows[0], req.kind);
    return { status: info.facts.length || info.phone ? "complete" : "empty", ...info, collectedAt: page.collectedAt };
  } catch { return unavailable; }
}

/**
 * Read-only resource description (detailCommon2) for ONE list resource. Identity is checked before any text is read:
 * exactly one row, the same explicit contentid, an explicit contenttypeid equal to the requested kind, and a verified
 * lDong pair equal to the requested region. Mismatches return no descriptive data; ambiguous or failed replies are
 * `unavailable` (retryable). Optional gallery/intro failures stay independent; verified common content is preserved.
 * Gallery returns at most 20 photos; plain-text facts never guess absent values. No database writes occur.
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
  const representative = resourcePhoto(row, "common");
  // Optional calls start only AFTER the common row has established id, kind and the verified district.
  // One in-flight optional request per resource keeps two-place comparisons within the shared three-call limit.
  const images = await gallery(call, req, representative?.title ?? "관광 사진");
  const info = await intro(call, req);
  const photos = resourcePhotos([representative && !deniedPhoto(representative, images.deniedUrls) ? representative : null, ...images.photos]);
  const phone = resourceInfoText(row.tel, 400) ?? info.phone, website = resourceWebsite(row.homepage);
  if (!text && !photos.length && !info.facts.length && !phone && !website && images.status !== "unavailable" && info.status !== "unavailable") return result("empty");
  const modifiedAt = /^\d{14}$/.test(String(row.modifiedtime)) ? String(row.modifiedtime) : null;
  return { ...base, status: "complete", error: null, detail: { id: req.id, kind: req.kind, overview: text, truncated, modifiedAt,
    photos, galleryStatus: images.status, facts: info.facts, infoStatus: info.status, phone, website,
    galleryCollectedAt: images.collectedAt, infoCollectedAt: info.collectedAt }, source };
}
