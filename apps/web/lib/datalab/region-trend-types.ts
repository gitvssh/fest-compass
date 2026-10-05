// Public DataLab trend of one region whose download holds only yearly spending and outside visitors. Pure types; safe for client imports.
export type RegionTrendYear = {
  year: number;
  /** Domestic tourism spending, thousand won (원문 소비액(천원)); local + outside within rounding. */
  total: number;
  local: number;
  outside: number;
};
export type RegionTrend = {
  code: string; name: string; province: string;
  spending: {
    downloadDate: string;
    range: { from: number; to: number };
    years: RegionTrendYear[];
    /** Industry groups' share (%) of domestic spending over the range. */
    industries: { name: string; share: number }[];
    links: { domestic: string; local: string; outside: string };
  };
  visitors: {
    downloadDate: string;
    /** The download range plus the comparison year the site adds before it. */
    range: { from: number; to: number };
    /** Outside visitors per year (연인원, same measure as the daily outside visitors summed over the year). */
    years: { year: number; outside: number }[];
    link: string;
  };
};
export type RegionTrends = { officialUrl: string; regions: RegionTrend[]; festivalRegions: Record<string, string> };
