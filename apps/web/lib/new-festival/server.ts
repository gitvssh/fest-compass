import "server-only";
import { loadMonthly as existingMonthly } from "../existing/server";
import { VISIT_DEFINITION } from "../existing/history";
import { createTourCall, type TourCall } from "../existing/tour";
import type { MonthlyRequest, MonthlyResponse } from "../existing/types";
import { loadResourceDetail } from "./detail";
import { newVisitsKey } from "./request";
import type { NewVisitsRequest, NewVisitsResponse, ResourceDetailRequest, ResourceDetailResponse } from "./types";
import { weekdayMeans } from "./weekday";

export type NewFestivalDeps = { monthly: (req: MonthlyRequest) => Promise<MonthlyResponse>; tour: TourCall; now?: () => string };

export function createNewFestivalService(deps: NewFestivalDeps) {
  const now = deps.now ?? (() => new Date().toISOString());
  /** Existing monthly view (same observations, year choice, freshness, source) + weekday means from its daily values. */
  async function loadVisits(req: NewVisitsRequest): Promise<NewVisitsResponse> {
    const m = await deps.monthly(req);
    const weekdays = m.year === null ? { status: "not-selected" as const, yearComplete: false, items: [] } : weekdayMeans(m.daily, m.year);
    return { ...m, key: newVisitsKey(req), metric: { name: VISIT_DEFINITION.metric, unit: "명/일", basis: "통신 기반 추정", estimate: true, regionCode: m.region.code }, weekdays };
  }
  const loadDetail = (req: ResourceDetailRequest): Promise<ResourceDetailResponse> => loadResourceDetail(deps.tour, req, now);
  return { loadVisits, loadDetail };
}

const service = createNewFestivalService({ monthly: existingMonthly, tour: createTourCall() });
export const { loadVisits, loadDetail } = service;
