import catalogue from "../../data/region-catalogue.json";
import type { History, Observation, Query, Region, Resource } from "./types";
export const REGIONS: Region[] = catalogue.rows;
export const CATALOGUE = { ...catalogue, rows: undefined };
export const TYPES = { "12": "관광지", "14": "문화시설", "15": "축제·행사" } as const;
export const SOURCE = "https://www.data.go.kr/data/15101578/openapi.do";
export const HISTORY_SOURCE = "https://www.data.go.kr/data/15101972/openapi.do";
export function day(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}
export function dates(start: string, end: string): string[] {
  if (!day(start) || !day(end) || end < start || Date.parse(end) - Date.parse(start) > 365 * 86400000) throw new Error("기간을 올바른 날짜로, 최대 366일 이내로 선택하세요.");
  return Array.from({ length: (Date.parse(end) - Date.parse(start)) / 86400000 + 1 }, (_, n) => new Date(Date.parse(start) + n * 86400000).toISOString().slice(0, 10));
}
export function parseQuery(params: URLSearchParams): Query {
  const province = params.get("province") ?? "", district = params.get("district") ?? "", start = params.get("start") ?? "", end = params.get("end") ?? "", kind = params.get("kind") ?? "";
  if (!REGIONS.some(r => r.provinceCode === province && r.districtCode === district)) throw new Error("지역 목록에서 시도와 시군구를 선택하세요.");
  dates(start, end);
  if (start < "2000-01-01" || end > "2035-12-31" || !["12", "14", "15"].includes(kind)) throw new Error("지원하는 기간과 자료 종류를 선택하세요.");
  return { province, district, start, end, kind: kind as Query["kind"] };
}
export function regionOf(q: Query): Region { return REGIONS.find(r => r.provinceCode === q.province && r.districtCode === q.district)!; }
export function coordinate(value: unknown, min: number, max: number): number | null {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  const n = Number(value); return Number.isFinite(n) && n >= min && n <= max ? n : null;
}
export function mapResource(row: Record<string, unknown>, q: Query): Resource {
  // Preserve KTO's own code system, including Sejong's verified 36110/36110 pair.
  if (String(row.lDongRegnCd) !== q.province || String(row.lDongSignguCd) !== q.district) throw new Error("다른 지역의 응답이 섞여 자료를 표시하지 않았습니다.");
  if (!/^\d+$/.test(String(row.contentid)) || typeof row.title !== "string" || !row.title.trim()) throw new Error("자료 식별자를 확인하지 못했습니다.");
  const date = (v: unknown) => { const s = String(v ?? "").replace(/^(\d{4})(\d{2})(\d{2})$/, "$1-$2-$3"); return day(s) ? s : null; };
  const start = date(row.eventstartdate), end = date(row.eventenddate);
  if (q.kind === "15" && (!start || !end || end < start || start < q.start || start > q.end)) throw new Error("행사 시작일 조건과 응답이 달라 표시를 보류했습니다.");
  const longitude = coordinate(row.mapx, 124, 132), latitude = coordinate(row.mapy, 32, 39);
  return { id: String(row.contentid), title: row.title.slice(0, 300), address: String(row.addr1 ?? "").slice(0, 500),
    longitude: latitude === null ? null : longitude, latitude: longitude === null ? null : latitude,
    start, end, modifiedAt: /^\d{14}$/.test(String(row.modifiedtime)) ? String(row.modifiedtime) : null };
}
export type Dataset = { snapshotId: string; collectedAt: string; source: string; region: { code: string; name: string }; points: { date: string; value: number | null; quality: string }[] };
export function selectHistory(q: Query, datasets: Dataset[], warning = ""): History {
  const points: Observation[] = dates(q.start, q.end).map(date => ({ date, value: null, quality: "missing", snapshotId: null, collectedAt: null }));
  const selected = q.province === "44" && q.district === "230";
  if (selected) for (const d of [...datasets].filter(d => d.region.code === "44230").sort((a, b) => a.collectedAt.localeCompare(b.collectedAt))) {
    const byDate = new Map(d.points.map(p => [p.date, p]));
    for (const p of points) { const v = byDate.get(p.date); if (v) Object.assign(p, { value: v.quality === "complete" && v.value !== null && Number.isFinite(v.value) && v.value >= 0 ? v.value : null, quality: v.quality, snapshotId: d.snapshotId, collectedAt: d.collectedAt }); }
  }
  return { status: points.some(p => p.value !== null) ? "available" : "unavailable", source: HISTORY_SOURCE, unit: "명 (통신 기반 추정)", metric: "시군구 일별 외지인 방문",
    message: `${selected ? "논산시 보관 관측 자료" : "선택 지역의 연속 방문 이력 미확보"}. 행사장 입장객·혼잡도가 아니며 날짜별 합계를 고유 방문객으로 해석할 수 없습니다.${warning ? ` ${warning}` : ""}`, points };
}
export function lineSegments(points: Observation[], x: (i: number) => number, y: (v: number) => number): string[] {
  const segments: string[] = []; let segment = "";
  points.forEach((p, i) => { if (p.value === null) { if (segment) segments.push(segment); segment = ""; } else segment += `${segment ? "L" : "M"}${x(i)},${y(p.value)}`; });
  if (segment) segments.push(segment); return segments;
}
