import { readdir, unlink } from "node:fs/promises";
import { join } from "node:path";
import { daysBetween, fetchHistoryPage, validateHistoryWindow, type HistoryPage } from "../kto/history";
import { scrubSecret } from "../kto/security";
import { parseKtoWire } from "../kto/wire";
import { HISTORY_SOURCE, REGIONS, type Dataset } from "../region/model";
import regionLinks from "../../data/region-code-links.json";
import { type CollectContext, isRecord, isTimestamp, koreaDay, readCurrentOrPrevious, readVerified, sha256, shiftDay, writeChecked, writeRotating } from "./store";

// All-district daily visits from the official DataLab region/day API (locgoRegnVisitrDDList). One month window is
// fetched completely (every page, frozen wire/pagination checks) and stored as a compact validated month file.
// Only outside-resident visits (touDivCd 2) are kept, and only for a day on which that district reported all
// three visitor types exactly once from one source code. No parent-city fallback, no district summing.
export const NATIONAL = {
  start: "2023-01-01", lookbackDays: 90, pageSize: 10_000, maxPagesPerWindow: 10, maxMonths: 240,
  monthMaxBytes: 2 * 1024 * 1024, pageMaxBytes: 16 * 1024 * 1024, maxBodyChars: 12_000_000,
} as const;
const VISITOR_TYPES: Record<string, string> = { "1": "현지인(a)", "2": "외지인(b)", "3": "외국인(c)" };
const DECIMAL = /^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?(?:[eE][+-]?\d+)?$/;
const DISTRICT_NAMES = new Map(REGIONS.map(r => [`${r.provinceCode}${r.districtCode}`, r.districtName]));

/**
 * Exact catalogue code for a DataLab signguCode, else null (row omitted and counted). Only verified migrations apply:
 * Gangwon 42→51 and Jeonbuk 45→52 keep the district suffix; Sejong's source 36110 is the catalogue pair 36110/36110.
 */
export function catalogueCode(source: string): string | null {
  if (!/^\d{5}$/.test(source)) return null;
  if (DISTRICT_NAMES.has(source)) return source;
  if (source === "36110") return DISTRICT_NAMES.has("3611036110") ? "3611036110" : null;
  const reviewed = (regionLinks.aliases as Record<string, string>)[source];
  if (reviewed && DISTRICT_NAMES.has(reviewed)) return reviewed;
  const migrated = source.startsWith("42") ? `51${source.slice(2)}` : source.startsWith("45") ? `52${source.slice(2)}` : null;
  return migrated && DISTRICT_NAMES.has(migrated) ? migrated : null;
}

export type Window = { start: string; end: string };
const monthOf = (day: string) => day.slice(0, 7);
const nextMonth = (month: string) => { const [y, m] = month.split("-").map(Number); return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`; };
export const monthEnd = (month: string) => shiftDay(`${nextMonth(month)}-01`, -1);
/** Whole months touching the last 90 days (to yesterday, Korea time), newest first. */
export function standardWindows(day: string): Window[] {
  const yesterday = shiftDay(day, -1), first = shiftDay(day, -NATIONAL.lookbackDays), windows: Window[] = [];
  if (yesterday < NATIONAL.start) return [];
  for (let month = monthOf(first < NATIONAL.start ? NATIONAL.start : first); month <= monthOf(yesterday); month = nextMonth(month)) {
    windows.push({ start: `${month}-01`, end: monthEnd(month) < yesterday ? monthEnd(month) : yesterday });
  }
  return windows.reverse();
}
/** Every complete month from 2023-01 through the month before today's (Korea time), newest first. */
export function backfillWindows(day: string): Window[] {
  const windows: Window[] = [];
  for (let month = monthOf(NATIONAL.start); month < monthOf(day); month = nextMonth(month)) windows.push({ start: `${month}-01`, end: monthEnd(month) });
  return windows.reverse();
}

type Row = [date: string, code: string, type: string, value: number | null];
export type NationalPage = { meta: Omit<HistoryPage, "selected">; rows: Row[] };

/** The frozen fetchHistoryPage checks the wire, pagination and row identities; a response clone supplies every row. */
export async function fetchNationalPage(request: { start: string; end: string; pageNo: number; pageSize: number }, key: string, fetcher: typeof fetch = fetch): Promise<NationalPage> {
  let items: Record<string, unknown>[] = [];
  const page = await fetchHistoryPage(request, key, async (url, init) => {
    const response = await fetcher(url, init), text = await response.clone().text();
    if (text.length > NATIONAL.maxBodyChars) throw new Error("oversized");
    items = parseKtoWire(text).items;
    return response;
  });
  if (items.length !== page.rowCount || page.keys.length !== page.rowCount) throw new Error("history-pagination-error");
  // A malformed value, visitor-type label or missing district name marks the row (and so its district-day) invalid.
  const rows = items.map((row, i): Row => {
    const [date, code, type] = page.keys[i].split("/"), raw = row.touNum, text = String(raw ?? "").trim(), value = Number(text.replaceAll(",", ""));
    const ok = (typeof raw === "number" || typeof raw === "string") && DECIMAL.test(text) && Number.isFinite(value) && value >= 0
      && String(row.touDivNm ?? "").trim() === VISITOR_TYPES[type] && String(row.signguNm ?? "").trim().length > 0;
    return [date, code, type, ok ? value : null];
  });
  const { selected: _selected, ...meta } = page;
  return { meta, rows };
}

function validatePage(value: unknown): NationalPage {
  if (!isRecord(value) || !isRecord(value.meta) || !Array.isArray(value.rows)) throw new Error("invalid-national-page");
  const meta = value.meta as NationalPage["meta"], rows = value.rows as Row[];
  if (!Array.isArray(meta.keys) || meta.keys.length !== meta.rowCount || rows.length !== meta.rowCount
    || rows.some((r, i) => !Array.isArray(r) || r.length !== 4 || `${r[0]}/${r[1]}/${r[2]}` !== meta.keys[i]
      || !(r[3] === null || (typeof r[3] === "number" && Number.isFinite(r[3]) && r[3] >= 0)))) throw new Error("invalid-national-page");
  return value as NationalPage;
}

type PageMeta = Omit<HistoryPage, "selected" | "keys">;
export type MonthPayload = {
  month: string; start: string; end: string; fetchedAt: string; source: string; pages: PageMeta[];
  /** Outside-resident visits per catalogue code and day of the window; null unless that district-day is complete. */
  series: Record<string, (number | null)[]>;
  /** Day indexes whose rows were present but unusable (incomplete types, malformed values, code conflicts). */
  invalid: Record<string, number[]>;
  omittedRows: number; conflicts: number;
};

/** Complete pagination is required first; then each catalogue district-day is complete, invalid, or missing. */
export function buildMonth(pages: NationalPage[], window: Window, fetchedAt: string): MonthPayload {
  validateHistoryWindow(pages.map(p => ({ ...p.meta, selected: [] })), window.start, window.end);
  const days = daysBetween(window.start, window.end), index = new Map(days.map((d, i) => [d, i]));
  const cells = new Map<string, Map<number, { sources: Set<string>; types: Map<string, number | null>; bad: boolean }>>();
  let omittedRows = 0, conflicts = 0;
  for (const [date, code, type, value] of pages.flatMap(p => p.rows)) {
    const target = catalogueCode(code), day = index.get(date);
    if (!target || day === undefined) { omittedRows++; continue; }
    const byDay = cells.get(target) ?? new Map(); cells.set(target, byDay);
    const cell = byDay.get(day) ?? { sources: new Set<string>(), types: new Map(), bad: false }; byDay.set(day, cell);
    cell.sources.add(code);
    if (cell.types.has(type) || value === null) cell.bad = true;
    cell.types.set(type, value);
  }
  const series: MonthPayload["series"] = {}, invalid: MonthPayload["invalid"] = {};
  for (const code of [...cells.keys()].sort()) {
    const values: (number | null)[] = days.map(() => null), bad: number[] = [];
    for (const [day, cell] of [...cells.get(code)!.entries()].sort((a, b) => a[0] - b[0])) {
      // Old and new codes reporting the same district-day are a conflict: never pick one, never add them.
      if (cell.sources.size > 1) { conflicts++; bad.push(day); continue; }
      if (cell.bad || cell.types.size !== 3 || !["1", "2", "3"].every(t => cell.types.has(t))) { bad.push(day); continue; }
      values[day] = cell.types.get("2")!;
    }
    series[code] = values;
    if (bad.length) invalid[code] = bad;
  }
  const meta = pages.map(({ meta: { keys: _keys, ...m } }) => m).sort((a, b) => a.pageNo - b.pageNo);
  return { month: monthOf(window.start), start: window.start, end: window.end, fetchedAt, source: HISTORY_SOURCE, pages: meta, series, invalid, omittedRows, conflicts };
}

const safeInt = (v: unknown, min = 0): v is number => Number.isSafeInteger(v) && (v as number) >= min;
export function validateMonth(value: unknown, month?: string): MonthPayload {
  const fail = () => { throw new Error("invalid-national-month"); };
  if (!isRecord(value)) return fail();
  const p = value as MonthPayload;
  if (typeof p.month !== "string" || !/^\d{4}-\d{2}$/.test(p.month) || (month !== undefined && p.month !== month) || p.start !== `${p.month}-01`
    || typeof p.end !== "string" || !p.end.startsWith(p.month) || p.end > monthEnd(p.month) || !isTimestamp(p.fetchedAt) || koreaDay(p.fetchedAt) <= p.end
    || p.source !== HISTORY_SOURCE || !safeInt(p.omittedRows) || !safeInt(p.conflicts)) return fail();
  const days = daysBetween(p.start, p.end).length;
  if (!Array.isArray(p.pages) || !p.pages.length || p.pages.length > NATIONAL.maxPagesPerWindow
    || p.pages.some((g, i) => !isRecord(g) || g.pageNo !== i + 1 || g.start !== p.start || g.end !== p.end || !safeInt(g.pageSize, 1) || !safeInt(g.rowCount)
      || g.totalCount !== p.pages[0].totalCount || typeof g.bodyHash !== "string" || !/^[a-f0-9]{64}$/.test(g.bodyHash))
    || p.pages.reduce((n, g) => n + g.rowCount, 0) !== p.pages[0].totalCount) return fail();
  if (!isRecord(p.series) || !isRecord(p.invalid)) return fail();
  for (const [code, values] of Object.entries(p.series)) {
    if (!DISTRICT_NAMES.has(code) || !Array.isArray(values) || values.length !== days
      || values.some(v => v !== null && !(typeof v === "number" && Number.isFinite(v) && v >= 0))) return fail();
  }
  for (const [code, list] of Object.entries(p.invalid)) {
    const values = p.series[code];
    if (!values || !Array.isArray(list) || !list.length || list.some((d, i) => !safeInt(d) || d >= days || (i && d <= list[i - 1]) || values[d] !== null)) return fail();
  }
  return p;
}

const monthsDir = (dir: string) => join(dir, "national", "months");
const monthPath = (dir: string, month: string) => join(monthsDir(dir), `${month}.json`);
/** Valid stored months, oldest first. A corrupt month falls back to its previous version, else is skipped. */
export async function readNationalMonths(dir: string): Promise<MonthPayload[]> {
  let names: string[];
  try { names = await readdir(monthsDir(dir)); } catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return []; throw error; }
  const months = [...new Set(names.map(n => /^(\d{4}-\d{2})(?:\.prev)?\.json$/.exec(n)?.[1]).filter((m): m is string => !!m && m >= monthOf(NATIONAL.start)))]
    .sort().slice(-NATIONAL.maxMonths);
  const out: MonthPayload[] = [];
  for (const month of months) {
    const payload = await readCurrentOrPrevious(monthPath(dir, month), v => validateMonth(v, month), NATIONAL.monthMaxBytes);
    if (!payload) throw new Error("national-stored-month-corrupt");
    out.push(payload);
  }
  return out;
}

/**
 * Stored district series as archive datasets keyed by exact catalogue code (Sejong "3611036110") and district name.
 * Every day of every stored month is present as complete, invalid or missing. An uninitialized store returns [].
 */
export async function readNationalDatasets(dir: string, options: { codes?: readonly string[] } = {}): Promise<Dataset[]> {
  const months = await readNationalMonths(dir);
  if (!months.length) return [];
  const codes = [...new Set(months.flatMap(m => Object.keys(m.series)))].filter(c => !options.codes || options.codes.includes(c)).sort();
  const collectedAt = months.map(m => m.fetchedAt).sort().at(-1)!, lineage = months.map(m => [m.month, m.fetchedAt, m.pages.map(p => p.bodyHash)]);
  const calendars = months.map(m => daysBetween(m.start, m.end));
  return codes.map(code => {
    const points = months.flatMap((m, i) => {
      const values = m.series[code], invalid = new Set(m.invalid[code] ?? []);
      return calendars[i].map((date, d) => {
        const value = values?.[d] ?? null;
        return { date, value, quality: value !== null ? "complete" : invalid.has(d) ? "invalid" : "missing", collectedAt: m.fetchedAt };
      });
    });
    return { snapshotId: sha256(JSON.stringify([code, lineage])), collectedAt, source: HISTORY_SOURCE, region: { code, name: DISTRICT_NAMES.get(code)! }, points };
  });
}

const complete = (m: MonthPayload) => Object.values(m.series).reduce((n, values) => n + values.filter(v => v !== null).length, 0);
const pageId = (w: Window, pageNo: number) => `national-${w.start}-${w.end}-p${pageNo}`;

async function collectWindow(ctx: CollectContext, window: Window): Promise<MonthPayload> {
  const pages: NationalPage[] = [], cached = (id: string) => join(ctx.dir, "pages", ctx.day, `${id}.json`);
  let count = 1, size: number = NATIONAL.pageSize;
  for (let pageNo = 1; pageNo <= count; pageNo++) {
    const id = pageId(window, pageNo);
    let page = await readVerified(cached(id), validatePage, NATIONAL.pageMaxBytes);
    if (!page) {
      // Sent earlier today without a stored page (interrupted, failed, or already consumed): never resent today.
      if (ctx.attempts.has(id)) throw new Error("national-attempted-today");
      if (!await ctx.spend("national", id)) throw new Error("national-budget-stop");
      page = JSON.parse(scrubSecret(JSON.stringify(await fetchNationalPage({ ...window, pageNo, pageSize: size }, ctx.key, ctx.fetch)), ctx.key)) as NationalPage;
      await writeChecked(cached(id), page);
      await ctx.pause();
    }
    if (page.meta.start !== window.start || page.meta.end !== window.end || page.meta.pageNo !== pageNo) throw new Error("national-cache-mismatch");
    pages.push(page);
    if (pageNo === 1) {
      size = page.meta.pageSize; count = Math.max(1, Math.ceil(page.meta.totalCount / size));
      if (count > NATIONAL.maxPagesPerWindow) throw new Error("national-page-limit");
      // Do not start a window whose remaining pages the budget cannot finish.
      let uncached = 0;
      for (let n = 2; n <= count; n++) if (!await readVerified(cached(pageId(window, n)), validatePage, NATIONAL.pageMaxBytes)) uncached++;
      if (uncached > ctx.remaining("national")) throw new Error("national-budget-stop");
    }
  }
  const payload = buildMonth(pages, window, ctx.now);
  for (let n = 1; n <= count; n++) await unlink(cached(pageId(window, n))).catch(() => undefined);
  return payload;
}

export type NationalOutcome = { status: "ok" | "fresh" | "partial" | "failed"; error: string | null; committed: number };
/**
 * Standard: refresh whole months touching the last 90 days, skipping months already refreshed today.
 * Backfill: fetch complete months since 2023-01 that are not yet stored as whole months.
 * A failed month keeps its stored version; a refetch with fewer complete district-days never replaces it.
 */
export async function collectNational(ctx: CollectContext, mode: "standard" | "backfill", safe: (e: unknown) => string): Promise<NationalOutcome> {
  const windows: Window[] = [];
  for (const window of mode === "backfill" ? backfillWindows(ctx.day) : standardWindows(ctx.day)) {
    const stored = await readCurrentOrPrevious(monthPath(ctx.dir, monthOf(window.start)), v => validateMonth(v), NATIONAL.monthMaxBytes);
    if (stored && stored.end === window.end && (mode === "backfill" || koreaDay(stored.fetchedAt) === ctx.day)) continue;
    windows.push(window);
  }
  if (!windows.length) return { status: "fresh", error: null, committed: 0 };
  let committed = 0, error: string | null = null;
  for (const window of windows) {
    try {
      const payload = await collectWindow(ctx, window), path = monthPath(ctx.dir, payload.month);
      const stored = await readCurrentOrPrevious(path, v => validateMonth(v, payload.month), NATIONAL.monthMaxBytes);
      if (stored && complete(payload) < complete(stored)) { error ??= "national-coverage-regressed"; continue; }
      await writeRotating(path, payload, v => validateMonth(v, payload.month), NATIONAL.monthMaxBytes);
      committed++;
    } catch (cause) {
      error ??= safe(cause);
      if (/budget-stop|access-or-quota-stop|storage-limit/.test(safe(cause))) break;
    }
  }
  return { status: !error ? "ok" : committed ? "partial" : "failed", error, committed };
}
