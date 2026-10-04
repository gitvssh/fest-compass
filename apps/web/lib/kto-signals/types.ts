// Response contracts for two live KTO OpenAPIs: the 30-day tourist-spot concentration forecast (TatsCnctrRateService)
// and navigation-based related tourist spots (TarRlteTarService1). Pure types; safe for client imports.
import type { RegionRef } from "../existing/types";

export type SignalStatus = "complete" | "empty" | "unavailable";
export type SignalSource = { title: string; url: string; collectedAt: string };
/** The region the provider answered for: the selected one, or its whole city when only the city is published. */
export type SignalBasis = { name: string; parentOf: string | null };

export type CrowdRequest = { province: string; district: string };
/** One spot's predicted concentration per forecast day (busiest period = 100), aligned with `days`. */
export type CrowdSpot = { name: string; rates: (number | null)[]; mean: number; peak: { date: string; rate: number } };
export type CrowdForecast = {
  key: string; request: CrowdRequest; retrievedAt: string; region: RegionRef;
  status: SignalStatus; basis: SignalBasis | null;
  /** Forecast days (YYYY-MM-DD), oldest first. */
  days: string[];
  /** Mean of the spots that have a value that day; null when none do. */
  daily: (number | null)[];
  /** Spots by 30-day mean, then peak, largest first. */
  spots: CrowdSpot[];
  source: SignalSource | null;
};

export type RelatedRequest = { province: string; district: string; month: string | null };
export type RelatedCategory = "관광지" | "음식" | "숙박";
export type RelatedSpot = { rank: number; name: string; category: RelatedCategory; detail: string; place: string };
/** A center spot of the district and the spots searched with it, by provider rank. */
export type RelatedCenter = { name: string; items: RelatedSpot[] };
export type RelatedSpots = {
  key: string; request: RelatedRequest; retrievedAt: string; region: RegionRef;
  status: SignalStatus; basis: SignalBasis | null;
  /** Month shown (YYYY-MM) and the months that can be chosen, newest first. */
  month: string; months: string[];
  centers: RelatedCenter[];
  source: SignalSource | null;
};
