// Response contracts for the existing-festival journey (UC-FC-009). Pure types; safe for client imports.
import type { VisitorProfileSelection } from "../datalab/visitor-profile-types";
export type { VisitorProfile, VisitorProfileBand, VisitorProfileDestination, VisitorProfileDestinationGroup, VisitorProfileGroupId, VisitorProfileResource, VisitorProfileSelection } from "../datalab/visitor-profile-types";
export type Point = { latitude: number; longitude: number };
export type Range = { start: string; end: string };
export type SourceStatus = "complete" | "empty" | "unavailable" | "not-requested";
export type SourceError = { code: "source-unavailable"; retryable: true };
export type SourceBlock = { status: SourceStatus; error: SourceError | null; collectedAt: string | null };
export type SourceRef = { title: string; url: string; checkedAt: string | null; publishedAt: string | null };
/** Only public provenance: never hashes, snapshot ids, raw notes or upstream messages. */
export type PublicSource = SourceRef & { collectedAt: string | null };
export type RegionRef = { province: string; district: string; code: string; name: string; districtName: string };
export type Envelope<Req> = { key: string; request: Req; retrievedAt: string };
export type RequestError = { error: { code: "invalid-request" | "not-found"; field: string } };
/** Visit-archive freshness: original collection times only; never hashes, paths or error text. */
export type DataFreshness = {
  mode: "archive-only" | "runtime" | "runtime-stale" | "archive-fallback";
  collectedAt: string | null; runtimeCollectedAt: string | null;
  refresh: { status: "ok" | "failed" | "not-configured"; retryable: boolean };
};

export type ArchiveEditionRef = { editionId: string; year: number; start: string | null; end: string | null; days: number | null; status: string; cancelled: boolean; comparable: boolean; source: SourceRef };
export type ArchiveFestival = { id: string; source: "archive"; festivalId: string; name: string; region: RegionRef; editions: ArchiveEditionRef[]; defaultEditionIds: string[]; hasDates: boolean; hasHistory: boolean };
export type CurrentFestival = {
  id: string; source: "current"; contentId: string; name: string; region: RegionRef;
  start: string | null; end: string | null; datesVerified: boolean;
  address: string; point: Point | null; modifiedAt: string | null; linkedArchiveId: string | null; provenance: PublicSource;
};

export type FestivalSearchRequest = { q: string; province: string | null; district: string | null; start: string; end: string; page: number; total: number | null; id: string | null };
export type CurrentMode = "keyword" | "region-list" | "lookup";
export type LookupResult = "verified" | "not-found" | "not-festival" | "region-mismatch";
export type CurrentBlock = SourceBlock & {
  mode: CurrentMode | null; range: Range | null; page: number | null; next: { page: number; total: number } | null;
  continuity: "consistent" | "changed" | null;
  total: number | null; omitted: number; lookup: LookupResult | null; items: CurrentFestival[];
};
export type FestivalSearchResponse = Envelope<FestivalSearchRequest> & {
  archive: SourceBlock & { items: ArchiveFestival[]; freshness: DataFreshness | null };
  current: CurrentBlock;
};

export type DayPoint = { date: string; weekday: number; inFestival: boolean; value: number | null; collectedAt: string | null };
export type PeriodSummary =
  | { status: "available"; numerator: number; denominator: number; mean: number; rounded: number; peak: { value: number; dates: string[] } }
  | { status: "incomplete"; denominator: number; observedDays: number; missingDates: string[] }
  | { status: "no-dates" }
  | { status: "no-history" }
  | { status: "cancelled" }
  | { status: "incompatible" };
export type EditionState = "available" | "no-dates" | "no-history" | "cancelled" | "incompatible";
export type EditionHistory = {
  editionId: string; year: number; start: string | null; end: string | null; days: number | null; status: string;
  state: EditionState; withheld: { reason: Exclude<EditionState, "available">; message: string } | null;
  window: Range | null; windowSource: "padding" | "custom" | null; points: DayPoint[]; summary: PeriodSummary; comparable: boolean;
  source: { edition: SourceRef; visits: PublicSource | null };
};
export type HistoryRequest = { festival: string; editions: string[]; before: number; after: number; windows: Record<string, Range> };
/** DataLab festival-period counts for the festival's host area over the edition's original dates (not the district daily series). */
export type HostAreaEdition = {
  editionId: string; year: number; start: string; end: string; days: number;
  local: number; outside: number; foreign: number; total: number; dailyMean: number;
  /** outside ÷ total from the counts (ratio 0..1), not the source's rounded percent column. */
  outsideShare: number;
};
export type HostAreaVisits = { festivalName: string; editions: HostAreaEdition[]; allYearsHref: string; source: { title: string; url: string; downloadedOn: string } };
export type HistoryResponse = Envelope<HistoryRequest> & {
  festival: ArchiveFestival;
  metric: { name: string; unit: "명/일"; regionCode: string; estimate: true };
  sharedYMax: number | null; maxWindowDays: number; editions: EditionHistory[]; freshness: DataFreshness;
  hostVisits: HostAreaVisits | null;
  /** Reviewed festival-period visitor profiles of selected editions only (one, or two ascending by date); none -> null. */
  visitorProfile: VisitorProfileSelection | null;
};

export type MonthMean = { month: string; days: number; observedDays: number; missingDays: number; zeroDays: number; sum: number | null; mean: number | null; rounded: number | null; status: "complete" | "partial" | "none" };
export type YearCoverage = { year: number; days: number; observedDays: number; complete: boolean };
export type DailyValue = { date: string; weekday: number; value: number | null };
export type MonthlyRequest = { province: string; district: string; year: number | null };
export type MonthlyResponse = Envelope<MonthlyRequest> & {
  // not-selected: observations exist but no complete year to default to — the user picks a (partial) year.
  region: RegionRef; status: "complete" | "partial" | "empty" | "not-selected"; years: YearCoverage[]; defaultYear: number | null; year: number | null;
  months: MonthMean[]; daily: DailyValue[]; source: PublicSource | null; freshness: DataFreshness;
};

export type ResourceKind = "12" | "14";
export type ResourceItem = { id: string; kind: ResourceKind; title: string; address: string; point: Point | null; modifiedAt: string | null };
export type ResourceTypeBlock = SourceBlock & { kind: ResourceKind; label: string; total: number | null; items: ResourceItem[] };
export type ResourcesRequest = { province: string; district: string; types: ResourceKind[] };
export type ResourcesResponse = Envelope<ResourcesRequest> & { region: RegionRef; byType: ResourceTypeBlock[] };
export type ResourceRow = { item: ResourceItem; distanceKm: number | null; withinRadius: boolean | null };

export type ScheduleEvent = {
  id: string; title: string; address: string; start: string | null; end: string | null; datesKnown: boolean;
  scheduleStatus: "registered" | "cancelled"; point: Point | null; modifiedAt: string | null; overlapDays: number | null;
};
export type EventsBlock = SourceBlock & { range: Range; items: ScheduleEvent[] };
export type ScheduleDay = { date: string; weekday: number; weekend: boolean; holidayKnown: boolean; holidays: string[] };
export type HolidaySummary = { status: "complete" | "partial" | "unknown"; coveredDays: number; uncovered: Range[]; dates: { date: string; labels: string[] }[]; holidayDays: number | null };
export type EventsSummary = { status: SourceStatus; count: number | null; overlapping: number | null; cancelled: number | null; undated: number | null };
export type ScheduleSummary = { totalDays: number; weekendDays: number; holidays: HolidaySummary; events: EventsSummary };
export type ScheduleRequest = { province: string; district: string; start: string; end: string };
export type ScheduleResponse = Envelope<ScheduleRequest> & {
  region: RegionRef; days: ScheduleDay[]; summary: ScheduleSummary;
  holidaySource: { version: string; sources: SourceRef[] }; events: EventsBlock;
};
