import type { Resource } from "./types";
export type Bounds = [number, number, number, number];
export const NATIONAL_BOUNDS: Bounds = [124.3, 32.8, 132.2, 38.8];
// Selection anchors, never administrative boundaries or centroids.
export const PROVINCE_ANCHORS: Record<string, [number, number, string, number]> = {
  "11": [126.98, 37.57, "서울", .45], "12": [126.9, 34.8, "전남광주", 2.8],
  "26": [129.07, 35.18, "부산", .7], "27": [128.6, 35.88, "대구", .9], "28": [126.45, 37.46, "인천", 1.2],
  "30": [127.38, 36.35, "대전", .5], "31": [129.31, 35.55, "울산", .6], "36110": [127.28, 36.6, "세종", .55],
  "41": [127.25, 37.9, "경기", 2], "43": [127.9, 36.85, "충북", 1.8], "44": [126.65, 36.68, "충남", 1.8],
  "47": [128.85, 36.5, "경북", 2.4], "48": [128.1, 35.3, "경남", 2], "50": [126.55, 33.38, "제주", 1.3],
  "51": [128.45, 37.7, "강원", 2.3], "52": [127.15, 35.7, "전북", 1.7],
};
export const hasPosition = (r: Resource): r is Resource & { longitude: number; latitude: number } =>
  r.longitude !== null && r.latitude !== null && Number.isFinite(r.longitude) && Number.isFinite(r.latitude)
  && r.longitude >= 124 && r.longitude <= 132 && r.latitude >= 32 && r.latitude <= 39;
export function resourceBounds(resources: Resource[], province: string): Bounds {
  const positioned = resources.filter(hasPosition);
  if (positioned.length) {
    const x = positioned.map(r => r.longitude), y = positioned.map(r => r.latitude);
    const west = Math.min(...x), east = Math.max(...x), south = Math.min(...y), north = Math.max(...y);
    const dx = Math.max(.01, (east - west) * .15), dy = Math.max(.01, (north - south) * .15);
    return [west - dx, south - dy, east + dx, north + dy];
  }
  const a = PROVINCE_ANCHORS[province];
  return a ? [a[0] - a[3] / 2, a[1] - a[3] / 2, a[0] + a[3] / 2, a[1] + a[3] / 2] : [...NATIONAL_BOUNDS];
}
export function groupResources(resources: Resource[], project: (lon: number, lat: number) => { x: number; y: number }) {
  const groups = new Map<string, { resource: Resource & { longitude: number; latitude: number }; number: number }[]>();
  resources.forEach((resource, index) => {
    if (!hasPosition(resource)) return;
    const p = project(resource.longitude, resource.latitude), key = `${Math.floor(p.x / 42)}:${Math.floor(p.y / 42)}`;
    const rows = groups.get(key) ?? []; rows.push({ resource, number: index + 1 }); groups.set(key, rows);
  });
  const clusters = [...groups.values()].map(rows => ({ rows, x: rows.reduce((s, r) => s + project(r.resource.longitude, r.resource.latitude).x, 0) / rows.length,
    y: rows.reduce((s, r) => s + project(r.resource.longitude, r.resource.latitude).y, 0) / rows.length }));
  // Grid edges can put almost identical locations in different cells. Merge
  // overlapping cluster centres too, repeating after each centre moves.
  let merged = true;
  while (merged) {
    merged = false;
    outer: for (let i = 0; i < clusters.length; i++) for (let j = i + 1; j < clusters.length; j++) {
      const a = clusters[i], b = clusters[j];
      if (Math.hypot(a.x - b.x, a.y - b.y) >= 52) continue;
      const count = a.rows.length + b.rows.length;
      a.x = (a.x * a.rows.length + b.x * b.rows.length) / count;
      a.y = (a.y * a.rows.length + b.y * b.rows.length) / count;
      a.rows.push(...b.rows); clusters.splice(j, 1); merged = true; break outer;
    }
  }
  return clusters.map(c => c.rows.sort((a, b) => a.number - b.number));
}
