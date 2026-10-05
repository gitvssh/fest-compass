// One festival's public DataLab bundle, fetched when a festival is chosen so a page never ships every festival at once.
// Pure types and request parsing; safe for client imports.
import { InvalidRequest } from "../existing/request";
import type { FestivalProfile } from "./festival-profile-types";
import type { RegionProfile } from "./region-profile-types";
import type { RegionTrend } from "./region-trend-types";
import type { FestivalTrendView } from "./types";

export type FestivalBundle = {
  key: string;
  trend: FestivalTrendView;
  /** Null when the profile artifact is unavailable. */
  profile: FestivalProfile | null;
  /** The host region's profile when the festival is linked to a downloaded region, otherwise null. */
  host: RegionProfile | null;
  /** The host region's yearly trend when its download holds only yearly totals; never set together with host. */
  hostTrend: RegionTrend | null;
};
export type FestivalBundleRequest = { festival: string };

export const festivalBundleKey = (id: string) => JSON.stringify(["datalab-festival", id]);

export function parseFestivalBundleRequest(p: URLSearchParams): FestivalBundleRequest {
  const festival = p.get("festival");
  if (!festival || festival.length > 80 || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(festival)) throw new InvalidRequest("festival");
  return { festival };
}
