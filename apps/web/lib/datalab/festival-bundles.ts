import "server-only";
import trendRaw from "../../data/datalab-festival-trend.json";
import { festivalBundleKey, type FestivalBundle } from "./festival-bundle-types";
import { defaultFestivalProfiles } from "./festival-profiles";
import { parseFestivalPeriodDataset } from "./model";
import { defaultRegionProfiles, regionProfileFor } from "./region-profiles";
import { defaultRegionTrends, regionTrendFor } from "./region-trends";
import type { FestivalPeriodDataset, FestivalPeriodTrend, FestivalSummary, FestivalTrendView } from "./types";

// Server view of the DataLab festival files: a light index for pickers and one festival's bundle on request.
// Source evidence (paths, hashes, byte counts) stays here; only the original CSV link leaves.
export const festivalTrend: FestivalPeriodDataset = parseFestivalPeriodDataset(trendRaw);

const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, "ko-KR");
/** Every festival by name, with its place and the years it has values for. */
export const festivalSummaries: FestivalSummary[] = festivalTrend.festivals
  .map(f => ({ id: f.id, name: f.name, aliases: f.aliases, place: f.place, years: f.years.map(y => y.year) })).sort(byName);

const view = (f: FestivalPeriodTrend): FestivalTrendView => ({ id: f.id, name: f.name, place: f.place, downloadDate: f.downloadDate, originalUrl: f.source.originalUrl, years: f.years });

export function festivalBundle(id: string): FestivalBundle | null {
  const f = festivalTrend.festivals.find(x => x.id === id);
  if (!f) return null;
  const code = defaultRegionProfiles?.festivalRegions[id], trendCode = defaultRegionTrends?.festivalRegions[id];
  const host = code ? regionProfileFor(defaultRegionProfiles, code) : null;
  return { key: festivalBundleKey(id), trend: view(f), profile: defaultFestivalProfiles?.festivals.find(p => p.id === id) ?? null, host,
    hostTrend: !host && trendCode ? regionTrendFor(defaultRegionTrends, trendCode) : null };
}
