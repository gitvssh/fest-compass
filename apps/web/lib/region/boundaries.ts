import catalogue from "@/data/region-boundaries.json";
import type { Bounds } from "./map-view";
export type BoundaryReference = { version: string; source: string; boundaryDate: string; crosswalkDate: string; province: string; district: string; codes: string[] };
type RegionBoundary = { status: string; codes: string[]; aggregate: boolean; bounds?: Bounds };
type ProvinceBoundary = { status: string; bounds?: Bounds };
export const BOUNDARIES = catalogue as unknown as { version: string; source: string; boundaryDate: string; crosswalkDate: string; regions: Record<string, RegionBoundary>; provinces: Record<string, ProvinceBoundary> };
export function boundaryRegion(province: string, district: string) { return BOUNDARIES.regions[`${province}:${district}`]; }
export function boundaryBounds(province: string, district = ""): Bounds | undefined {
  return district ? boundaryRegion(province, district)?.bounds : BOUNDARIES.provinces[province]?.bounds;
}
export function boundaryReference(province: string, district: string): BoundaryReference | null {
  const item = boundaryRegion(province, district);
  return item?.status === "available" ? { version: BOUNDARIES.version, source: BOUNDARIES.source, boundaryDate: BOUNDARIES.boundaryDate,
    crosswalkDate: BOUNDARIES.crosswalkDate, province, district, codes: [...item.codes] } : null;
}
