// Public DataLab profile of one reviewed region (시군구). Pure types; safe for client imports.
export type RegionShare = { name: string; share: number };
/** The region's place in the province list it was downloaded with (1 = largest), over the download range. */
export type RegionRank = { position: number; count: number };
export type RegionSpending = {
  downloadDate: string;
  /** Total tourism spending per calendar year, thousand won (원문 소비액(천원)). */
  years: { year: number; total: number }[];
  industries: (RegionShare & { items: RegionShare[] })[];
  areas: RegionShare[];
  rank: RegionRank;
  links: { trend: string; industries: string; areas: string; province: string };
};
export type RegionVisitors = {
  downloadDate: string;
  /** Largest origins of outside visitors; `otherShare` is the listed rest, `listed` how many origins the source lists. */
  origins: { province: string; district: string; share: number }[];
  otherShare: number;
  listed: number;
  areas: RegionShare[];
  rank: RegionRank;
  links: { origins: string; areas: string; province: string };
};
export type RegionProfile = {
  code: string; name: string; province: string;
  range: { from: number; to: number };
  spending: RegionSpending;
  /** Null where no visitor download exists. */
  visitors: RegionVisitors | null;
};
export type RegionProfiles = { officialUrl: string; regions: RegionProfile[]; festivalRegions: Record<string, string> };
