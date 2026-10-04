import "server-only";
import { defaultRegionAnnual, type RegionAnnualResolver } from "../datalab/region-annual";
import { loadMonthly as existingMonthly } from "../existing/server";
import { VISIT_DEFINITION } from "../existing/history";
import { createTourCall, type TourCall } from "../existing/tour";
import type { MonthlyRequest, MonthlyResponse } from "../existing/types";
import { loadResourceDetail } from "./detail";
import { newVisitsKey } from "./request";
import type { NewVisitsRequest, NewVisitsResponse, RegionAnnual, ResourceDetailRequest, ResourceDetailResponse } from "./types";
import { weekdayMeans } from "./weekday";

export type NewFestivalDeps = {
  monthly: (req: MonthlyRequest) => Promise<MonthlyResponse>; tour: TourCall; now?: () => string;
  /** Reviewed DataLab annual totals by region code; absent -> annual is null. Production injects the verified default. */
  annual?: RegionAnnualResolver;
};

export function createNewFestivalService(deps: NewFestivalDeps) {
  const now = deps.now ?? (() => new Date().toISOString());
  // Optional block: only a total for the selected region is kept; failures omit it and log a fixed category.
  function annual(regionCode: string): RegionAnnual | null {
    if (!deps.annual) return null;
    try {
      const a = deps.annual(regionCode);
      if (a && a.regionCode !== regionCode) { console.error("datalab-region-annual: region-mismatch"); return null; }
      return a;
    } catch { console.error("datalab-region-annual: resolver-failed"); return null; }
  }
  /** Existing monthly view (same observations, year choice, freshness, source) + weekday means + annual totals independent of the year. */
  async function loadVisits(req: NewVisitsRequest): Promise<NewVisitsResponse> {
    const m = await deps.monthly(req);
    const weekdays = m.year === null ? { status: "not-selected" as const, yearComplete: false, items: [] } : weekdayMeans(m.daily, m.year);
    return { ...m, key: newVisitsKey(req), metric: { name: VISIT_DEFINITION.metric, unit: "명/일", basis: "통신 기반 추정", estimate: true, regionCode: m.region.code }, weekdays,
      annual: annual(m.region.code) };
  }
  const loadDetail = (req: ResourceDetailRequest): Promise<ResourceDetailResponse> => loadResourceDetail(deps.tour, req, now);
  return { loadVisits, loadDetail };
}

const service = createNewFestivalService({ monthly: existingMonthly, tour: createTourCall(), annual: defaultRegionAnnual });
export const { loadVisits, loadDetail } = service;
