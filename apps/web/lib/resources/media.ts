import { overviewText } from "../new-festival/overview";
import type { ResourcePhoto } from "./types";

export const RESOURCE_PHOTO_SOURCE = "https://www.data.go.kr/data/15101578/openapi.do";
export const RESOURCE_GALLERY_LIMIT = 20;

/** Only provider-hosted bitmap resources; never arbitrary remote images, scripts, credentials or URL parameters. */
export function resourceImageUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const raw = value.trim();
  if (!raw || raw.length > 2048 || /[\s\u0000-\u001f\u007f\\?#]/.test(raw) || /(?:^|\/)\.{1,2}(?:\/|$)/.test(raw)) return null;
  try {
    const url = new URL(raw);
    if (!["http:", "https:"].includes(url.protocol) || url.hostname !== "tong.visitkorea.or.kr" || url.port || url.username || url.password) return null;
    if (!/^\/cms\/resource\/(?:[a-z0-9_-]+\/)*[a-z0-9_.-]+\.(?:jpe?g|png|webp|gif|avif)$/i.test(url.pathname)) return null;
    url.protocol = "https:";
    return url.href;
  } catch { return null; }
}

/** The gallery's license belongs to each row; the representative image's license is never inherited by it. */
export function resourcePhoto(row: Record<string, unknown>, format: "common" | "gallery", fallbackTitle = "관광 사진"): ResourcePhoto | null {
  const license = typeof row.cpyrhtDivCd === "string" ? row.cpyrhtDivCd.trim() : "";
  if (license !== "Type1" && license !== "Type3") return null;
  const original = resourceImageUrl(format === "common" ? row.firstimage : row.originimgurl);
  const thumbnail = resourceImageUrl(format === "common" ? row.firstimage2 : row.smallimageurl);
  const url = original ?? thumbnail;
  if (!url) return null;
  const title = overviewText(format === "common" ? row.title : row.imgname).text.replace(/\s+/g, " ").slice(0, 300)
    || overviewText(fallbackTitle).text.replace(/\s+/g, " ").slice(0, 300) || "관광 사진";
  return { url, thumbnailUrl: thumbnail && thumbnail !== url ? thumbnail : null, title, license, sourceUrl: RESOURCE_PHOTO_SOURCE };
}

export function resourcePhotos(photos: (ResourcePhoto | null)[]): ResourcePhoto[] {
  const byUrl = new Map<string, ResourcePhoto>();
  for (const photo of photos) {
    if (!photo) continue;
    const previous = byUrl.get(photo.url);
    // When sources disagree on an allowed photo's terms, retain the more restrictive no-change license.
    byUrl.set(photo.url, previous?.license === "Type3" && photo.license === "Type1" ? { ...photo, license: "Type3" } : photo);
  }
  return [...byUrl.values()].slice(0, RESOURCE_GALLERY_LIMIT);
}
