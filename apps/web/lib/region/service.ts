import "server-only";
import { isKtoSuccessCode, parseKtoWire } from "../kto/wire";
import { loadRuntimeSummary } from "../forecast/runtime";
import { loadSnapshots } from "../forecast/store";
import bundled from "../../data/region-history.json";
import expanded from "../../data/regional-history-expanded.json";
import { mapResource, regionOf, selectHistory, SOURCE, type Dataset } from "./model";
import type { Query, RegionResult, ResourceResult } from "./types";

export type PageLoader = (page: number) => Promise<{ total: number; rows: Record<string, unknown>[] }>;
export async function collectResources(q: Query, load: PageLoader, now = () => new Date().toISOString()): Promise<ResourceResult> {
  const items: ResourceResult["items"] = [], ids = new Set<string>(); let total: number | null = null, pages = 0;
  try {
    for (let page = 1; page <= 6; page++) {
      const result = await load(page); pages++;
      if (!Number.isSafeInteger(result.total) || result.total < 0 || (total !== null && total !== result.total)) throw new Error("조회 중 전체 건수가 변경되어 부분 자료를 표시하지 않았습니다.");
      total = result.total;
      if (total > 600) throw new Error("한 지역 600건 조회 한도를 넘어 전체 자료를 확보하지 못했습니다.");
      if (result.rows.length !== Math.min(100, Math.max(0, total - items.length))) throw new Error("페이지가 누락되어 부분 자료를 표시하지 않았습니다.");
      for (const row of result.rows) {
        const item = mapResource(row, q);
        if (ids.has(item.id)) throw new Error("중복 항목이 있어 전체 조회를 확인하지 못했습니다.");
        ids.add(item.id); items.push(item);
      }
      if (items.length === total) return { status: total ? "complete" : "empty", message: total ? "전체 페이지 확인 완료" : "이 조건의 API 등록 결과가 없습니다. 실제 행사·자원 부재를 뜻하지 않습니다.", items, total, pages, source: SOURCE, collectedAt: now() };
    }
    throw new Error("전체 페이지를 확보하지 못했습니다.");
  } catch (e) {
    return { status: "unavailable", message: e instanceof Error ? e.message : "자료 조회에 실패했습니다.", items: [], total: null, pages, source: SOURCE, collectedAt: now() };
  }
}

// No database writes or upstream URLs in public responses. Shared requests are bounded and cached.
const cache = new Map<string, { expires: number; value: Promise<ResourceResult> }>();
let calls = 0, windowStart = Date.now(), active = 0;
async function getResources(q: Query): Promise<ResourceResult> {
  const key = [q.province, q.district, q.kind, q.kind === "15" ? `${q.start}/${q.end}` : "current"].join(":");
  const existing = cache.get(key); if (existing && existing.expires > Date.now()) return existing.value;
  const value = collectResources(q, async page => {
    const secret = process.env.TOUR_API_KEY?.trim();
    if (!secret) throw new Error("공공데이터 연결이 준비되지 않았습니다. 보관 방문 자료는 계속 조회할 수 있습니다.");
    if (Date.now() - windowStart > 600_000) { calls = 0; windowStart = Date.now(); }
    if (calls >= 100 || active >= 4) throw new Error("공공데이터 조회가 많습니다. 잠시 후 다시 조회하세요.");
    calls++; active++;
    try {
      let decoded = secret; try { decoded = decodeURIComponent(secret); } catch { /* raw key */ }
      const url = new URL(`https://apis.data.go.kr/B551011/KorService2/${q.kind === "15" ? "searchFestival2" : "areaBasedList2"}`);
      const params: Record<string, string> = { serviceKey: decoded, MobileOS: "ETC", MobileApp: "FestCompass", _type: "json", numOfRows: "100", pageNo: String(page), arrange: "C", lDongRegnCd: q.province, lDongSignguCd: q.district };
      if (q.kind === "15") { params.eventStartDate = q.start.replaceAll("-", ""); params.eventEndDate = q.end.replaceAll("-", ""); }
      else params.contentTypeId = q.kind;
      Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
      const response = await fetch(url, { signal: AbortSignal.timeout(10_000), cache: "no-store" });
      if (!response.ok) throw new Error();
      const raw = await response.text(); if (raw.length > 2_000_000) throw new Error();
      const wire = parseKtoWire(raw);
      if (wire.contractError || !isKtoSuccessCode(wire.resultCode) || wire.totalCount === null || wire.pageNo !== page) throw new Error();
      return { total: wire.totalCount, rows: wire.items };
    } catch { throw new Error("공공데이터 응답을 확인하지 못했습니다. 다시 조회하세요."); }
    finally { active--; }
  });
  if (cache.size >= 100) cache.delete(cache.keys().next().value!);
  const entry = { expires: Date.now() + 3_600_000, value }; cache.set(key, entry);
  const result = await value; if (result.status === "unavailable") entry.expires = Date.now() + 30_000;
  return result;
}
let runtimeHistory: { expires: number; value: Promise<{ datasets: Dataset[]; warning: string }> } | null = null;
async function historyDatasets() {
  if (runtimeHistory && runtimeHistory.expires > Date.now()) return runtimeHistory.value;
  const value = (async () => {
    const datasets: Dataset[] = [...bundled, ...expanded.datasets];
    try {
      const { summary, source } = await loadRuntimeSummary();
      const snapshot = summary.automation?.snapshot;
      if (source === "live" && snapshot && process.env.FORECAST_DATA_DIR) {
        for (const d of await loadSnapshots(process.env.FORECAST_DATA_DIR, [snapshot])) datasets.push({ snapshotId: d.snapshotId, collectedAt: d.generatedAt, source: d.source, region: d.region,
          points: d.days.map(p => ({ date: p.date, quality: p.quality, value: p.quality === "complete" ? p.values["2"] : null })) });
        return { datasets, warning: "매일 수집한 보관본을 함께 조회합니다. 실시간 자료가 아닙니다." };
      }
    } catch { /* Keep reviewed historical data with an explicit freshness limitation. */ }
    return { datasets, warning: "2026-09-07 보관본 기준입니다. 이후 날짜는 미확보로 표시합니다." };
  })();
  runtimeHistory = { expires: Date.now() + 60_000, value }; return value;
}
export async function getRegionData(q: Query): Promise<RegionResult> {
  const [resources, history] = await Promise.all([getResources(q), historyDatasets()]);
  const warning = q.province === "44" && q.district === "230" ? history.warning : "지역별 보관본에서 조회합니다. 실제 확보 기간·날짜별 수집 시각을 확인하세요.";
  return { query: q, region: regionOf(q), resources, history: selectHistory(q, history.datasets, warning) };
}
