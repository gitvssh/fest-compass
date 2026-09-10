import { dates, day, SOURCE } from "../region/model";
import type { RegionResult } from "../region/types";
import type { Cost, Edition, SearchContext } from "./types";
export const DAY = 86_400_000;
export const addDays = (date: string, n: number) => new Date(Date.parse(date) + n * DAY).toISOString().slice(0, 10);
export const duration = (e: Edition) => e.start && e.end ? Math.round((Date.parse(e.end) - Date.parse(e.start)) / DAY) + 1 : null;
export const regionKey = (e: Edition) => `${e.region.province}/${e.region.district}`;
export function overlaps(a: Edition, b: Edition): number | null {
  if (!a.start || !a.end || !b.start || !b.end) return null;
  if (a.status === "취소" || b.status === "취소") return null;
  const start = a.start > b.start ? a.start : b.start, end = a.end < b.end ? a.end : b.end;
  return end < start ? 0 : Math.round((Date.parse(end) - Date.parse(start)) / DAY) + 1;
}
export function filterEditions(items: Edition[], q: SearchContext): Edition[] {
  const keyword = q.keyword.trim().toLocaleLowerCase("ko-KR");
  return items.filter(e => (!q.regions.length || q.regions.includes(regionKey(e))) && (!q.theme || e.themes.includes(q.theme)) && (!keyword || `${e.name} ${e.region.name}`.toLocaleLowerCase("ko-KR").includes(keyword)) && (e.start && e.end ? e.start <= q.end && (q.dateRule === "starts-within" ? e.start >= q.start : e.end >= q.start) : q.mode === "archive" && e.year >= Number(q.start.slice(0, 4)) && e.year <= Number(q.end.slice(0, 4))));
}
export function currentEditions(r: RegionResult): Edition[] {
  if (r.query.kind !== "15" || r.resources.source !== SOURCE || r.resources.status === "unavailable") return [];
  return r.resources.items.map(a => ({ id: `current-${a.id}-${a.start}-${a.end}`, festivalId: `kto-${a.id}`, name: a.title, year: Number(a.start?.slice(0, 4)), region: { province: r.query.province, district: r.query.district, name: `${r.region.provinceName} ${r.region.districtName}` }, origin: "current", start: a.start, end: a.end, status: "현재 등록 정보", statusNote: "실제 개최·취소·변경은 미확인. 현재 조회값이며 과거 회차 보관본이 아닙니다.", themes: [], address: a.address || "주소 미확보", source: { title: "한국관광공사 현재 등록 축제·행사", url: SOURCE, checkedAt: r.resources.collectedAt, publishedAt: null, sha256: null, note: `contentId ${a.id} · 수정 표기 ${a.modifiedAt ?? "미확보"} · 전체 ${r.resources.total}건/${r.resources.pages}페이지 조회. 조회 조건 ${r.query.start}~${r.query.end}와 겹치는 등록 행사` }, visits: null, costs: [], missing: ["회차별 보관 원문", "실제 개최·취소 확인", "회차와 연결한 방문 이력", "전체 예산·결산"] }));
}
export function visitReason(e: Edition, reference?: Edition): string | null {
  if (!e.visits || !e.visits.points.some(p => p.value !== null)) return "연속 방문 이력 미확보";
  if (!e.start) return "개최 시작일 미확인";
  if (e.status === "취소") return "취소 회차는 개최일 기준 비교 보류";
  if (reference?.visits && ["metric", "unit", "method", "regionCode"].some(k => e.visits![k as keyof typeof e.visits] !== reference.visits![k as keyof typeof reference.visits])) return "지역·지표·단위·측정 방법이 달라 같은 축의 비교 보류";
  return null;
}
export function relativePoints(e: Edition, from = -7, to = 7) {
  if (!e.start || !e.visits || !Number.isInteger(from) || !Number.isInteger(to) || from < -7 || to > 7 || from > to) return [];
  const points = new Map(e.visits.points.map(p => [p.date, p.value]));
  return Array.from({ length: to - from + 1 }, (_, i) => { const offset = from + i, date = addDays(e.start!, offset); return { offset, date, value: points.get(date) ?? null }; });
}
export function costReason(a: Cost, b: Cost): string | null {
  if ([a.scopeId, b.scopeId, a.stage, b.stage, a.department, b.department].some(v => !v || v.includes("미확인"))) return "금액 단계·포함 범위·부서 미확인으로 비교 보류";
  if (["scopeId", "stage", "department", "unit"].some(k => a[k as keyof Cost] !== b[k as keyof Cost])) return "사업·포함 범위·금액 단계·부서가 달라 차액·순위 비교 보류";
  if (a.vat === "미확인" || b.vat === "미확인") return "세금 포함 기준 미확인으로 차액·순위 비교 보류";
  if (a.vat !== b.vat) return "세금 포함 기준이 달라 비교 보류";
  if (a.year !== b.year) return "회계연도가 달라 공통 가격·범위 확인 후 비교 필요";
  return null;
}
export function composition(c: Cost): { label: string; amount: number; share: number }[] | null {
  if (!c.complete || !c.parts?.length || c.amount <= 0 || !Number.isSafeInteger(c.amount) || c.parts.some(p => !Number.isSafeInteger(p.amount) || p.amount < 0) || new Set(c.parts.map(p => p.label)).size !== c.parts.length || c.parts.reduce((sum,p) => sum + p.amount, 0) !== c.amount) return null;
  return c.parts.map(p => ({ ...p, share: p.amount / c.amount }));
}
export function validRange(start: string, end: string, current = false) {
  if (!day(start) || !day(end) || start > end || start < "2000-01-01" || end > "2035-12-31") throw new Error("올바른 조회 기간을 선택하세요.");
  if (current) dates(start, end);
}
