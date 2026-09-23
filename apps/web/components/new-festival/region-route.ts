import { REGIONS } from "@/lib/region/model";
import type { Region } from "@/lib/region/types";
import type { RegionRef } from "@/lib/existing/types";

// The address uses the five-digit administrative code (e.g. 44230). The catalogue keeps Sejong as the pair
// 36110/36110, so route 36110 maps explicitly to that exact row; every other route is province(2)+district(3)
// of exactly one catalogue row. Codes are never split by guesswork beyond that.
const toRef = (r: Region): RegionRef => ({ province: r.provinceCode, district: r.districtCode, code: `${r.provinceCode}${r.districtCode}`, name: `${r.provinceName} ${r.districtName}`, districtName: r.districtName });
const BY_ROUTE = new Map<string, Region>();
for (const r of REGIONS) {
  const route = r.provinceCode === r.districtCode && r.provinceCode.length === 5 ? r.provinceCode
    : r.provinceCode.length === 2 && r.districtCode.length === 3 ? `${r.provinceCode}${r.districtCode}` : null;
  if (route && !BY_ROUTE.has(route)) BY_ROUTE.set(route, r);
}

export function regionFromRoute(code: string): RegionRef | null {
  if (!/^\d{5}$/.test(code)) return null;
  const row = BY_ROUTE.get(code);
  return row ? toRef(row) : null;
}
export function routeCode(region: { province: string; district: string }): string {
  return region.province === region.district && region.province.length === 5 ? region.province : `${region.province}${region.district}`;
}
