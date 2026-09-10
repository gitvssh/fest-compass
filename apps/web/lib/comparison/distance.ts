import type { Edition, Point, SearchContext } from "./types";

export function validPoint(p: unknown): p is Point {
  if (!p || typeof p !== "object") return false;
  const { latitude, longitude } = p as Point;
  return typeof latitude === "number" && Number.isFinite(latitude) && latitude >= 32 && latitude <= 39 && typeof longitude === "number" && Number.isFinite(longitude) && longitude >= 124 && longitude <= 132;
}

// Versioned spherical approximation; retain this calculation for saved evidence.
export function distanceKm(a: Point, b: Point): number {
  const rad = Math.PI / 180;
  const h = Math.sin((b.latitude - a.latitude) * rad / 2) ** 2 + Math.cos(a.latitude * rad) * Math.cos(b.latitude * rad) * Math.sin((b.longitude - a.longitude) * rad / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, h))));
}

export function distanceRows(items: Edition[], condition: SearchContext["distance"]) {
  const rows = items.map(edition => ({ edition, km: condition && validPoint(edition.point) ? distanceKm(condition.anchor.point, edition.point) : null }));
  if (!condition) return rows;
  return rows.filter(r => r.km === null || condition.radiusKm === null || r.km <= condition.radiusKm)
    .sort((a, b) => (a.km ?? Infinity) - (b.km ?? Infinity) || a.edition.id.localeCompare(b.edition.id));
}

export const distanceLabel = (km: number | null) => km === null ? "거리 미확인 · 반경 포함 여부 미확인" : `직선거리 약 ${km.toFixed(1)}km`;
