// Response contracts for the new-festival journey (UC-FC-010). Pure types; safe for client imports.
import type { MonthlyRequest, MonthlyResponse, PublicSource, RegionRef, ResourceKind, SourceError } from "../existing/types";

export type WeekdayCoverage = "complete" | "partial" | "none";
/**
 * Weekday w daily mean = sum of valid V(d) on weekday w in the selected year ÷ N(w). Generated only when the WHOLE
 * selected year is observed; otherwise sum/mean/rounded/peak are null for all seven weekdays (counts stay).
 */
export type WeekdayMean = {
  weekday: number; label: string; days: number; observedDays: number; missingDays: number; zeroDays: number; missingDates: string[];
  sum: number | null; mean: number | null; rounded: number | null; peak: { value: number; dates: string[] } | null; coverage: WeekdayCoverage;
};
/** complete: year fully observed, means present. incomplete-year: some days observed, all means withheld. none: no observed day. */
export type WeekdayBlock = { status: "complete" | "incomplete-year" | "none" | "not-selected"; yearComplete: boolean; items: WeekdayMean[] };
export type NewVisitsRequest = MonthlyRequest;
export type NewVisitsResponse = MonthlyResponse & {
  metric: { name: string; unit: "명/일"; basis: "통신 기반 추정"; estimate: true; regionCode: string };
  weekdays: WeekdayBlock;
};

export type ResourceDetailRequest = { province: string; district: string; kind: ResourceKind; id: string };
export type ResourceDetailStatus = "complete" | "empty" | "unavailable" | "not-found" | "type-mismatch" | "region-mismatch";
export type ResourceDetail = { id: string; kind: ResourceKind; overview: string; truncated: boolean; modifiedAt: string | null };
export type ResourceDetailResponse = {
  key: string; request: ResourceDetailRequest; retrievedAt: string; region: RegionRef;
  status: ResourceDetailStatus; error: SourceError | null; detail: ResourceDetail | null;
  /** Provenance of THIS detail fetch; never the list collection time. */
  source: PublicSource | null;
};
