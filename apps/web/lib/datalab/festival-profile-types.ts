// Public DataLab profile of one reviewed 문화관광축제. Pure types; safe for client imports.
import type { VisitorProfileBand } from "./visitor-profile-types";

/** Source indicator order: 외부방문자 유입, 현지인방문자 유입, 내비게이션 검색량, 관광소비, 축제지 집중률. */
export const FESTIVAL_INDICATOR_KEYS = ["outside", "local", "search", "spending", "concentration"] as const;
export type FestivalIndicatorKey = (typeof FESTIVAL_INDICATOR_KEYS)[number];
/** One held year. Values follow FESTIVAL_INDICATOR_KEYS: the period's mean ÷ that year's maximum (0~1). base = 4 weeks before and after. */
export type FestivalIndicatorYear = { year: number; festival: number[]; base: number[] };
export type FestivalDestination = { rank: number; area: string; name: string; address: string; category: string };
export type FestivalDestinationGroup = { group: "outside" | "local" | "all"; label: string; items: FestivalDestination[] };
/** Why a year in the download range has no comparison: no visit measurement that year, or a source value above that year's maximum. */
export const WITHHELD_REASONS = ["no-visit-measurement", "above-maximum"] as const;
export type WithheldYear = { year: number; reason: (typeof WITHHELD_REASONS)[number] };
export type FestivalProfile = {
  id: string; name: string;
  /** The download's selected years; shares and ranks cover the festival periods of this whole range, not one year. */
  range: { from: number; to: number };
  downloadDate: string;
  indicators: FestivalIndicatorYear[];
  /** Years in the range without a comparison, never drawn as zeros. */
  withheldYears: WithheldYear[];
  demographics: VisitorProfileBand[];
  /** Null when the official download had no destination ranking for this festival. */
  destinations: FestivalDestinationGroup[] | null;
  /** Original CSV links per table. */
  links: { indicators: string; demographics: string; destinations: string | null };
};
export type FestivalProfiles = { officialUrl: string; festivals: FestivalProfile[] };
