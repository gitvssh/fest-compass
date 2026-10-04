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
  /** Province and district of the host dong(s), from the destination ranking's road addresses (e.g. "충남 논산시"). */
  place: string;
  /** 14-digit stamp from the download file name; timezone is not recorded. */
  downloadStamp: string;
  downloadDate: string;
  source: { path: string; originalPath: string; originalUrl: string; bytes: number; sha256: string };
  years: FestivalPeriodYear[];
};

export type FestivalPeriodDataset = {
  kind: "datalab-festival-period-annual";
  schemaVersion: 2;
  scope: { area: string; period: string; method: string; unit: string; periodTotal: string; dailyMean: string; note: string; place: string };
  /** One entry per byte-preserved import the festivals come from. */
  source: { title: string; officialUrl: string; definitionReviewedAt: string; imports: { id: string; manifestPath: string; manifestSha256: string }[]; downloadTimezone: null };
  rawHeader: string[];
  festivals: FestivalPeriodTrend[];
};

/** Public picker entry: no source evidence, no yearly values. */
export type FestivalSummary = { id: string; name: string; aliases: string[]; place: string; years: number[] };
/** Public view of one festival's trend: values and the original CSV link, without paths, hashes or byte counts. */
export type FestivalTrendView = { id: string; name: string; place: string; downloadDate: string; originalUrl: string; years: FestivalPeriodYear[] };
/** Per-year values the scale ranking needs, without raw rows. */
export type ScaleYearValues = Omit<FestivalPeriodYear, "raw">;
export type ScaleFestival = { id: string; name: string; place: string; years: ScaleYearValues[] };
export type ScaleDataset = { title: string; officialUrl: string; festivals: ScaleFestival[] };
