import "server-only";
import { join } from "node:path";
import editionsData from "../../data/festival-editions.json";
import bundled from "../../data/region-history.json";
import expanded from "../../data/regional-history-expanded.json";
import calendarData from "../../data/nonsan-calendar.json";
import { defaultHostVisits, type HostVisitsResolver } from "../datalab/host-visits";
import { defaultVisitorProfile, type VisitorProfileResolver } from "../datalab/visitor-profile";
import { loadRuntimeSummary } from "../forecast/runtime";
import { loadSnapshots } from "../forecast/store";
import { readNationalDatasets, readRegistrationPeriods } from "../festival-sources";
import { koreaDate } from "../region/calendar";
import { HISTORY_SOURCE, selectHistory, TYPES, type Dataset } from "../region/model";
import { getRegionData } from "../region/service";
import type { Edition } from "../comparison/types";
import type { Query, ResourceResult } from "../region/types";
import { combineArchiveStates, createArchiveLoader, scopedFreshness, type ArchiveState, type RuntimeRead } from "./archive";
import { archiveCatalogue, currentFestival, parseFestivalId, regionRef, searchArchive } from "./identity";
import { dailyValues, datesBetween, defaultYear, editionHistory, editionWindow, linkedVisitsCompatible, monthlyMeans, sharedYMax, VISIT_DEFINITION, type LinkedVisits, type Observed, yearCoverage } from "./history";
import { festivalsKey, historyKey, InvalidRequest, monthlyKey, resourcesKey, scheduleKey } from "./request";
import { holidaySources, scheduleDays, scheduleEvents, summarizeSchedule, type HolidayCalendar } from "./schedule";
import { collectRegionEvents, createTourCall, lookupCurrent, searchKeywordPage, TourChanged, type RegionEvents, type TourCall } from "./tour";
import type { ArchiveFestival, CurrentBlock, FestivalSearchRequest, FestivalSearchResponse, HistoryRequest, HistoryResponse, HostAreaVisits, MonthlyRequest, MonthlyResponse, Range, RegionRef, ResourceItem,
  ResourceKind, ResourcesRequest, ResourcesResponse, ScheduleRequest, ScheduleResponse, SourceBlock, SourceRef, VisitorProfileSelection } from "./types";

export class NotFound extends Error { constructor(readonly field: string) { super(`not-found:${field}`); } }
const VISITS_SOURCE: SourceRef = { title: "한국관광공사 지역별 방문자", url: HISTORY_SOURCE, checkedAt: null, publishedAt: null };
const CALENDAR = calendarData as HolidayCalendar;
const unavailable: SourceBlock = { status: "unavailable", error: { code: "source-unavailable", retryable: true }, collectedAt: null };

export type ExistingDeps = {
  /** Visit archive + freshness (internal lineage such as snapshot ids stays inside and never reaches responses). */
  archive: () => Promise<ArchiveState>;
  /** Tourism resources (types 12/14/39/32) through the existing read-only region service. */
  regionList: (q: Query) => Promise<ResourceResult>;
  /** Read-only TourAPI adapter: keyword search, identity lookup and the verified regional event collector. */
  tour: TourCall;
  editions?: Edition[];
  /** Reviewed DataLab host-area visit mix per selected edition; absent -> hostVisits is null. Production injects the verified default. */
  hostVisits?: HostVisitsResolver;
  /** Reviewed DataLab visitor profiles of the exact selected editions; absent -> visitorProfile is null. Production injects the verified default. */
  visitorProfile?: VisitorProfileResolver;
  registrationPeriods?: (contentId: string, regionCode: string) => Promise<{ id: string; start: string; end: string; collectedAt: string; name?: string }[]>;
  now?: () => string;
  today?: () => string;
};

/** Default runtime reader: only the validated regional daily snapshot; no collector configured is not a failure. */
async function readRuntime(): Promise<RuntimeRead> {
  const dir = process.env.FORECAST_DATA_DIR;
  if (!dir) return { kind: "not-configured" };
  const { summary, source } = await loadRuntimeSummary(dir), snapshot = summary.automation?.snapshot;
  if (source !== "live" || !snapshot) throw new Error("runtime-unavailable");
  const loaded = await loadSnapshots(dir, [snapshot]);
  return { kind: "ok", datasets: loaded.map(d => ({ snapshotId: d.snapshotId, collectedAt: d.generatedAt, source: d.source, region: d.region,
    points: d.days.map(p => ({ date: p.date, quality: p.quality, value: p.quality === "complete" ? p.values["2"] : null })) })) };
}
// The runtime daily collector covers Nonsan only; its state never labels other districts.
const forecastArchive = createArchiveLoader({ bundles: [...bundled, ...expanded.datasets], readRuntime, runtimeTargets: ["44230"] });
export const festivalSourceDir = () => process.env.SOURCE_DATA_DIR || (process.env.FORECAST_DATA_DIR ? join(process.env.FORECAST_DATA_DIR, "festival-sources") : null);
const nationalArchive = createArchiveLoader({ bundles: [], readRuntime: async () => {
  const dir = festivalSourceDir();
  if (!dir) return { kind: "not-configured" };
  const datasets = await readNationalDatasets(dir);
  return datasets.length ? { kind: "ok", datasets } : { kind: "not-configured" };
} });
export async function archiveState(): Promise<ArchiveState> {
  return combineArchiveStates(await Promise.all([forecastArchive(), nationalArchive()]));
}

/** Latest-collected row per date wins, including an explicit missing/invalid row (never revives older values). */
export function regionObservations(all: Dataset[], province: string, district: string, range: Range): Observed[] {
  const days = datesBetween(range.start, range.end), out: Observed[] = [];
  for (let i = 0; i < days.length; i += 366) { // selectHistory reads at most 366 days per call
    const start = days[i], end = days[Math.min(i + 365, days.length - 1)];
    out.push(...selectHistory({ province, district, start, end, kind: "12" }, all).points.map(p => ({ date: p.date, value: p.value, collectedAt: p.collectedAt })));
  }
  return out;
}
const linkOf = (e: Edition): LinkedVisits | null => e.visits ? { metric: e.visits.metric, unit: e.visits.unit, method: e.visits.method, regionCode: e.visits.regionCode, points: e.visits.points } : null;

export function createExistingService(deps: ExistingDeps) {
  const now = deps.now ?? (() => new Date().toISOString()), today = deps.today ?? (() => koreaDate());
  const editions = deps.editions ?? (editionsData.editions as Edition[]), byId = new Map(editions.map(e => [e.id, e]));

  async function catalogue(): Promise<{ state: ArchiveState; festivals: ArchiveFestival[] }> {
    const state = await deps.archive();
    // Default comparison needs a compatible definition AND a value for every original festival day.
    const festivals = archiveCatalogue(editions, e => !!e.start && !!e.end && e.end >= e.start
      && linkedVisitsCompatible({ regionCode: `${e.region.province}${e.region.district}`, linked: linkOf(e) })
      && regionObservations(state.datasets, e.region.province, e.region.district, { start: e.start, end: e.end }).every(o => o.value !== null));
    return { state, festivals };
  }
  async function list(q: Query): Promise<ResourceResult | null> { try { return await deps.regionList(q); } catch { return null; } }
  async function events(region: RegionRef, range: Range): Promise<RegionEvents | null> { try { return await collectRegionEvents(deps.tour, region, range); } catch { return null; } }
  const block = (r: ResourceResult | null): SourceBlock => !r || r.status === "unavailable" ? unavailable : { status: r.status, error: null, collectedAt: r.collectedAt };
  // Optional block: a resolver failure omits only hostVisits and logs a fixed category.
  function hostVisits(festival: ArchiveFestival, editionIds: string[]): HostAreaVisits | null {
    if (!deps.hostVisits) return null;
    try { return deps.hostVisits(festival, editionIds); } catch { console.error("datalab-host-visits: resolver-failed"); return null; }
  }
  function visitorProfile(festival: ArchiveFestival, editionIds: string[]): VisitorProfileSelection | null {
    if (!deps.visitorProfile) return null;
    try { return deps.visitorProfile(festival, editionIds); } catch { console.error("datalab-visitor-profile: resolver-failed"); return null; }
  }

  async function current(req: FestivalSearchRequest, target: ReturnType<typeof parseFestivalId>): Promise<CurrentBlock> {
    const none: CurrentBlock = { status: "not-requested", error: null, collectedAt: null, mode: null, range: null, page: null, next: null, continuity: null, total: null, omitted: 0, lookup: null, items: [] };
    if (target?.source === "archive") return none;
    if (target?.source === "current") {
      const expected = regionRef(target.province, target.district)!;
      try {
        const found = await lookupCurrent(deps.tour, target.contentId, expected);
        const items = found.festival ? [currentFestival(found.festival.region, found.festival.fields, found.festival.datesVerified, found.collectedAt)] : [];
        if (items[0] && deps.registrationPeriods) {
          try {
            items[0].periods = (await deps.registrationPeriods(items[0].contentId, items[0].region.code)).filter(p => !p.name || p.name === items[0].name).map(p => ({ id: p.id, start: p.start, end: p.end, collectedAt: p.collectedAt }));
          } catch { /* A registration archive failure never hides current identity or district observations. */ }
        }
        return { ...none, status: items.length ? "complete" : "empty", collectedAt: found.collectedAt, mode: "lookup", lookup: found.result, items };
      } catch { return { ...none, ...unavailable, mode: "lookup" }; }
    }
    const region = req.province && req.district ? regionRef(req.province, req.district) : null;
    if (req.q) {
      const continuity = req.total === null ? null : "consistent" as const;
      try {
        const page = await searchKeywordPage(deps.tour, { keyword: req.q, region, page: req.page, expectTotal: req.total });
        const items = page.items.map(i => currentFestival(i.region, i.fields, false, page.collectedAt));
        return { ...none, status: items.length ? "complete" : "empty", collectedAt: page.collectedAt, mode: "keyword", page: page.page, next: page.next, continuity, total: page.total, omitted: page.omitted, items };
      } catch (e) { return { ...none, ...unavailable, mode: "keyword", page: req.page, continuity: e instanceof TourChanged ? "changed" : continuity }; }
    }
    if (!region) return none;
    const range = { start: req.start, end: req.end }, found = await events(region, range);
    if (!found) return { ...none, ...unavailable, mode: "region-list", range, page: 1 };
    const items = found.items.map(r => currentFestival(region, r, r.datesKnown, found.collectedAt))
      .sort((a, c) => (a.start ?? "9999-12-31").localeCompare(c.start ?? "9999-12-31") || a.name.localeCompare(c.name, "ko-KR") || a.contentId.localeCompare(c.contentId));
    return { ...none, status: found.status, collectedAt: found.collectedAt, mode: "region-list", range, page: 1, total: found.total, items };
  }

  async function loadFestivals(req: FestivalSearchRequest): Promise<FestivalSearchResponse> {
    const target = req.id ? parseFestivalId(req.id) : null;
    const [{ state, festivals }, cur] = await Promise.all([catalogue(), current(req, target)]);
    const archive: FestivalSearchResponse["archive"] = (() => {
      const items = target?.source === "current" ? festivals.filter(f => f.id === cur.items[0]?.linkedArchiveId) : target?.source === "archive" ? festivals.filter(f => f.festivalId === target.festivalId) : searchArchive(festivals, req.q, req.province && req.district ? regionRef(req.province, req.district) : null);
      const codes = [...new Set(items.map(f => f.region.code))];
      return { status: items.length ? "complete" as const : "empty" as const, error: null, collectedAt: null, items, freshness: codes.length ? scopedFreshness(state, codes) : null };
    })();
    return { key: festivalsKey(req), request: req, retrievedAt: now(), archive, current: cur };
  }

  async function loadHistory(req: HistoryRequest): Promise<HistoryResponse> {
    const { state, festivals } = await catalogue();
    const parsed = parseFestivalId(req.festival);
    let archiveFestivalId = req.festival;
    if (parsed?.source === "current") {
      const cur = await current({ id: req.festival, q: "", province: null, district: null, start: today(), end: today(), page: 1, total: null }, parsed);
      if (cur.status === "unavailable") throw new Error("source-unavailable");
      archiveFestivalId = cur.items[0]?.linkedArchiveId?.replace(/^archive:/, "") ?? "";
    }
    const festival = festivals.find(f => f.festivalId === archiveFestivalId);
    if (!festival) throw new NotFound("festival");
    const ids = req.editions.length ? req.editions : festival.defaultEditionIds.length ? festival.defaultEditionIds : festival.editions.slice(0, 1).map(e => e.editionId);
    const refs = ids.map(id => festival.editions.find(e => e.editionId === id));
    if (refs.some(r => !r)) throw new InvalidRequest("editions");
    if (Object.keys(req.windows).some(k => !ids.includes(k))) throw new InvalidRequest("windows");
    const { province, district, code } = festival.region;
    const used: (string | null)[] = [];
    const histories = refs.map(r => r!).sort((a, b) => b.year - a.year).map(ref => {
      const custom = req.windows[ref.editionId] ?? null;
      const input = { editionId: ref.editionId, year: ref.year, start: ref.start, end: ref.end, status: ref.status, source: ref.source, regionCode: code, linked: linkOf(byId.get(ref.editionId)!) };
      // Chart window and original period are read separately, so any chart range leaves the period summary untouched.
      const window = ref.start && ref.end ? custom ?? editionWindow(ref.start, ref.end, req.before, req.after) : null;
      const obs = window ? [...regionObservations(state.datasets, province, district, window), ...regionObservations(state.datasets, province, district, { start: ref.start!, end: ref.end! })] : [];
      used.push(...obs.map(o => o.collectedAt));
      return editionHistory(input, [...new Map(obs.map(o => [o.date, o])).values()], { before: req.before, after: req.after, window: custom, visits: VISITS_SOURCE });
    });
    return { key: historyKey(req), request: req, retrievedAt: now(), festival, metric: { name: VISIT_DEFINITION.metric, unit: "명/일", regionCode: code, estimate: true },
      sharedYMax: sharedYMax(histories), maxWindowDays: Math.max(0, ...histories.map(e => e.points.length)), editions: histories, freshness: scopedFreshness(state, [code], used),
      hostVisits: hostVisits(festival, histories.map(h => h.editionId)), visitorProfile: visitorProfile(festival, histories.map(h => h.editionId)) };
  }

  async function loadMonthly(req: MonthlyRequest): Promise<MonthlyResponse> {
    const state = await deps.archive(), all = state.datasets, region = regionRef(req.province, req.district)!;
    const years = [...new Set(all.filter(d => d.region.code === region.code).flatMap(d => d.points.map(p => Number(p.date.slice(0, 4)))))].sort();
    const byYear = new Map(years.map(y => [y, regionObservations(all, req.province, req.district, { start: `${y}-01-01`, end: `${y}-12-31` })]));
    const coverage = yearCoverage([...byYear.values()].flat()), fallback = defaultYear(coverage), year = req.year ?? fallback;
    const used = (year === null ? [...byYear.values()].flat() : byYear.get(year) ?? []).map(o => o.collectedAt);
    const base = { key: monthlyKey(req), request: req, retrievedAt: now(), region, years: coverage, defaultYear: fallback, year, freshness: scopedFreshness(state, [region.code], used) };
    if (year === null) return { ...base, status: coverage.length ? "not-selected" : "empty", months: [], daily: [], source: null };
    const obs = byYear.get(year) ?? [], cov = coverage.find(c => c.year === year);
    const collectedAt = obs.map(o => o.collectedAt).filter((v): v is string => !!v).sort().at(-1) ?? null;
    return { ...base, status: !cov ? "empty" : cov.complete ? "complete" : "partial", months: monthlyMeans(obs, year), daily: dailyValues(obs, `${year}-01-01`, `${year}-12-31`),
      source: cov ? { ...VISITS_SOURCE, collectedAt } : null };
  }

  async function loadResources(req: ResourcesRequest): Promise<ResourcesResponse> {
    const region = regionRef(req.province, req.district)!, day = today();
    const byType = await Promise.all(req.types.map(async (kind: ResourceKind) => {
      const result = await list({ province: req.province, district: req.district, kind, start: day, end: day }), b = block(result);
      const items: ResourceItem[] = b.status === "unavailable" ? [] : result!.items.map(r => ({ id: r.id, kind, title: r.title, address: r.address,
        point: r.latitude !== null && r.longitude !== null ? { latitude: r.latitude, longitude: r.longitude } : null, modifiedAt: r.modifiedAt }));
      return { ...b, kind, label: TYPES[kind], total: b.status === "unavailable" ? null : result!.total, items };
    }));
    return { key: resourcesKey(req), request: req, retrievedAt: now(), region, byType };
  }

  async function loadSchedule(req: ScheduleRequest): Promise<ScheduleResponse> {
    const region = regionRef(req.province, req.district)!, range = { start: req.start, end: req.end }, found = await events(region, range);
    const eventsBlock = found ? { status: found.status, error: null, collectedAt: found.collectedAt, range, items: scheduleEvents(found.items, range) } : { ...unavailable, range, items: [] };
    return { key: scheduleKey(req), request: req, retrievedAt: now(), region, days: scheduleDays(range, CALENDAR), summary: summarizeSchedule(range, CALENDAR, eventsBlock),
      holidaySource: { version: CALENDAR.version, sources: holidaySources(range, CALENDAR) }, events: eventsBlock };
  }

  return { loadFestivals, loadHistory, loadMonthly, loadResources, loadSchedule };
}

const service = createExistingService({ archive: archiveState, regionList: async q => (await getRegionData(q)).resources, tour: createTourCall(), hostVisits: defaultHostVisits, visitorProfile: defaultVisitorProfile,
  registrationPeriods: async (contentId, code) => { const dir = festivalSourceDir(); return dir ? readRegistrationPeriods(dir, contentId, code) : []; } });
export const { loadFestivals, loadHistory, loadMonthly, loadResources, loadSchedule } = service;
