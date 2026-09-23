import { distanceKm, validPoint } from "../comparison/distance";
import type { Point, ResourceItem, ResourceRow } from "./types";

export type RowOptions = { radiusKm?: number | null; sort?: "name" | "distance" };
/**
 * Distances exist only after the user picks a center. Items without coordinates stay listed with an
 * unknown distance and never count as inside the radius. Ties sort by name then id for stable order.
 */
export function resourceRows(items: ResourceItem[], center: Point | null, options: RowOptions = {}) {
  const origin = center && validPoint(center) ? center : null;
  const radius = origin && typeof options.radiusKm === "number" && Number.isFinite(options.radiusKm) && options.radiusKm > 0 ? options.radiusKm : null;
  const rows: ResourceRow[] = items.map(item => {
    const km = origin && item.point && validPoint(item.point) ? distanceKm(origin, item.point) : null;
    return { item, distanceKm: km, withinRadius: km === null || radius === null ? null : km <= radius };
  });
  const byName = (a: ResourceRow, b: ResourceRow) => a.item.title.localeCompare(b.item.title, "ko-KR") || a.item.id.localeCompare(b.item.id);
  rows.sort(origin && options.sort === "distance" ? (a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity) || byName(a, b) : byName);
  return { rows, counts: { returned: items.length, withCoordinates: items.filter(i => i.point && validPoint(i.point)).length, withinRadius: radius === null ? null : rows.filter(r => r.withinRadius === true).length } };
}
