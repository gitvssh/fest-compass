import type { RegionResult, Resource } from "../region/types";
import type { SearchContext } from "../comparison/types";
export type CsvRegion = { key: string; name: string; result: RegionResult | null };
export type CsvEvent = { resource: Resource; regionKey: string };
export type EventCsvInput = { start: string; end: string; condition: string; regions: CsvRegion[]; events: CsvEvent[] };
export const EVENT_CSV_HEADER = ["구분", "행사명", "지역", "행사 시작일", "행사 종료일", "주소", "경도", "위도", "조회 기간", "검색 조건", "지역 조회 상태", "조회 시각(한국시간)", "원자료 수정 시점(관광공사 표기)", "출처"];
const FORMULA = /^[\s　﻿]*[=+\-@＝＋－＠]/;
// Every cell is quoted; text that a spreadsheet would run as a formula is kept as text.
export function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '""';
  if (typeof value === "number") return Number.isFinite(value) ? `"${value}"` : '""';
  let text = value.replace(/\r\n?/g, "\n").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/g, "");
  if (FORMULA.test(text) || text.startsWith("\t")) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}
export function koreaTime(iso: string | null | undefined): string {
  const time = Date.parse(iso ?? "");
  return Number.isFinite(time) ? new Date(time + 9 * 3_600_000).toISOString().slice(0, 19).replace("T", " ") : "";
}
export function modifiedLabel(value: string | null): string {
  return value && /^\d{14}$/.test(value) ? value.replace(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/, "$1-$2-$3 $4:$5:$6") : "";
}
export function regionStatus(result: RegionResult | null, events: number): string {
  if (!result || result.resources.status === "unavailable") return "불러오지 못함";
  if (result.resources.status === "empty") return "등록 결과 없음";
  return events ? "전체 확인" : "조건에 맞는 행사 없음";
}
const source = (result: RegionResult | null) => `한국관광공사 관광정보 서비스 ${result?.resources.source ?? "https://www.data.go.kr/data/15101578/openapi.do"}`;
// Export only after every requested region has finished, and only if at least one region was actually checked.
export function exportReady(regions: CsvRegion[], loading: boolean): boolean {
  return !loading && regions.length > 0 && regions.some(r => r.result !== null && r.result.resources.status !== "unavailable");
}
export function buildEventCsv({ start, end, condition, regions, events }: EventCsvInput): string {
  const range = `${start} ~ ${end}`, byKey = new Map(regions.map(r => [r.key, r]));
  const rows: (string | number | null)[][] = [EVENT_CSV_HEADER];
  for (const { resource: r, regionKey } of events) {
    const region = byKey.get(regionKey);
    if (!region) continue;
    rows.push(["행사", r.title, region.name, r.start, r.end, r.address || null, r.longitude, r.latitude, range, condition, regionStatus(region.result, 1), koreaTime(region.result?.resources.collectedAt), modifiedLabel(r.modifiedAt), source(region.result)]);
  }
  for (const region of regions) {
    if (events.some(e => e.regionKey === region.key)) continue;
    rows.push(["지역 조회 상태", null, region.name, null, null, null, null, null, range, condition, regionStatus(region.result, 0), koreaTime(region.result?.resources.collectedAt), null, source(region.result)]);
  }
  return `﻿${rows.map(row => row.map(csvCell).join(",")).join("\r\n")}\r\n`;
}
export function csvFileName(regionKeys: string[], start: string, end: string): string {
  const name = `pickDday-events_${regionKeys.map(k => k.replace("/", "-")).join("_")}_${start}_${end}`.replace(/[^A-Za-z0-9._-]/g, "").slice(0, 120);
  return `${name || "pickDday-events"}.csv`;
}
export const REGION_EVENT_CONDITION = "축제·행사 · 조회 기간과 일정이 겹치는 등록 행사 전체";
export function comparisonCondition(q: Pick<SearchContext, "dateRule" | "keyword" | "distance">): string {
  const keyword = q.keyword.trim(), d = q.distance;
  return [q.dateRule === "starts-within" ? "일정: 기간 안 시작" : "일정: 기간 겹침", keyword ? `이름: ${keyword}` : "이름: 전체",
    d ? d.radiusKm === null ? `거리: ${d.anchor.name} 기준 거리순(반경 제한 없음)` : `거리: ${d.anchor.name} 기준 ${d.radiusKm}km 이내(좌표 없는 행사 포함)` : "거리: 제한 없음"].join(" · ");
}
export function downloadCsv(raw: string, name: string) {
  const url = URL.createObjectURL(new Blob([raw], { type: "text/csv;charset=utf-8" })), a = document.createElement("a");
  a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
