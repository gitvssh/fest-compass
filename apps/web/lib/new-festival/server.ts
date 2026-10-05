import "server-only";
import { defaultRegionAnnual, type RegionAnnualResolver } from "../datalab/region-annual";
import { defaultRegionProfiles, regionProfileFor } from "../datalab/region-profiles";
import { defaultRegionTrends, regionAnnualFromTrend, regionTrendFor } from "../datalab/region-trends";
import { loadMonthly as existingMonthly } from "../existing/server";
import { VISIT_DEFINITION } from "../existing/history";
import { createTourCall, type TourCall } from "../existing/tour";
import type { MonthlyRequest, MonthlyResponse } from "../existing/types";
import { loadResourceDetail } from "./detail";
import { newVisitsKey } from "./request";
import type { NewVisitsRequest, NewVisitsResponse, RegionAnnual, RegionProfileBlock, RegionTrendBlock, ResourceDetailRequest, ResourceDetailResponse } from "./types";
import { weekdayMeans } from "./weekday";

export type NewFestivalDeps = {
  monthly: (req: MonthlyRequest) => Promise<MonthlyResponse>; tour: TourCall; now?: () => string;
  /** Reviewed DataLab annual totals by region code; absent -> annual is null. Production injects the verified default. */
  annual?: RegionAnnualResolver;
  /** Reviewed DataLab spending and outside-visitor profile by region code; absent -> regionProfile is null. */
  profile?: (regionCode: string) => RegionProfileBlock | null;
  /** Reviewed DataLab yearly spending for districts downloaded with yearly totals only; absent -> regionTrend is null. */
  trend?: (regionCode: string) => RegionTrendBlock | null;
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
  function profile(regionCode: string): RegionProfileBlock | null {
    if (!deps.profile) return null;
    try {
      const p = deps.profile(regionCode);
      if (p && p.profile.code !== regionCode) { console.error("datalab-region-profiles: region-mismatch"); return null; }
      return p;
    } catch { console.error("datalab-region-profiles: resolver-failed"); return null; }
  }
  function trend(regionCode: string): RegionTrendBlock | null {
    if (!deps.trend) return null;
    try {
      const t = deps.trend(regionCode);
      if (t && t.trend.code !== regionCode) { console.error("datalab-region-trends: region-mismatch"); return null; }
      return t;
    } catch { console.error("datalab-region-trends: resolver-failed"); return null; }
  }
  /** Existing monthly view (same observations, year choice, freshness, source) + weekday means + annual totals independent of the year. */
  async function loadVisits(req: NewVisitsRequest): Promise<NewVisitsResponse> {
    const m = await deps.monthly(req);
    const weekdays = m.year === null ? { status: "not-selected" as const, yearComplete: false, items: [] } : weekdayMeans(m.daily, m.year);
    return { ...m, key: newVisitsKey(req), metric: { name: VISIT_DEFINITION.metric, unit: "명/일", basis: "통신 기반 추정", estimate: true, regionCode: m.region.code }, weekdays,
      annual: annual(m.region.code), regionProfile: profile(m.region.code), regionTrend: trend(m.region.code) };
  }
  const loadDetail = (req: ResourceDetailRequest): Promise<ResourceDetailResponse> => loadResourceDetail(deps.tour, req, now);
  return { loadVisits, loadDetail };
}

const profileBlock = (code: string): RegionProfileBlock | null => {
  const p = regionProfileFor(defaultRegionProfiles, code);
  return p && defaultRegionProfiles ? { officialUrl: defaultRegionProfiles.officialUrl, profile: p } : null;
};
const trendBlock = (code: string): RegionTrendBlock | null => {
  const t = regionTrendFor(defaultRegionTrends, code);
  return t && defaultRegionTrends ? { officialUrl: defaultRegionTrends.officialUrl, trend: t } : null;
};
// Districts of the first import have local, outside and domestic totals; districts downloaded later have outside visitors only.
const annualTotals = (code: string) => defaultRegionAnnual(code) ?? regionAnnualFromTrend(defaultRegionTrends, code);
const service = createNewFestivalService({ monthly: existingMonthly, tour: createTourCall(), annual: annualTotals, profile: profileBlock, trend: trendBlock });
export const { loadVisits, loadDetail } = service;
