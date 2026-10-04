// DataLab festival-period annual counts: one value per held year, over the festival's administrative dong(s).
// Deliberately unrelated to region VisitSeries / Edition.visits (municipality daily history).
export type PeriodMetric = "mean" | "total";

export type FestivalPeriodYear = {
  year: number;
  days: number;
  periodTotal: number;
  dailyMean: number;
  local: number;
  outside: number;
  /** Raw source 0 is kept as 0; the source does not say whether it means none or suppressed. */
  foreign: number;
  /** Source row strings in rawHeader order, including derivative columns that are not re-derived. */
  raw: string[];
};

export type FestivalPeriodTrend = {
  id: string;
  name: string;
  aliases: string[];
  /** 14-digit stamp from the download file name; timezone is not recorded. */
  downloadStamp: string;
  downloadDate: string;
  source: { path: string; originalPath: string; originalUrl: string; bytes: number; sha256: string };
  years: FestivalPeriodYear[];
};

export type FestivalPeriodDataset = {
  kind: "datalab-festival-period-annual";
  schemaVersion: 1;
  scope: { area: string; period: string; method: string; unit: string; periodTotal: string; dailyMean: string; note: string };
  source: { title: string; officialUrl: string; definitionReviewedAt: string; repository: string; commit: string; basePath: string; manifestPath: string; manifestSha256: string; downloadTimezone: null };
  rawHeader: string[];
  festivals: FestivalPeriodTrend[];
};
