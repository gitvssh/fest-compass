import { createHash } from "node:crypto";
import { summarizeRegionalDay } from "./history-probe";
import { validDate } from "./probe";
import { isKtoSuccessCode, parseKtoWire } from "./wire";

export const HISTORY_SOURCE = "https://www.data.go.kr/data/15101972/openapi.do";
export const HISTORY_ENDPOINT = "https://apis.data.go.kr/B551011/DataLabService/locgoRegnVisitrDDList";
export const hash = (value: string) => createHash("sha256").update(value).digest("hex");
export const shiftDay = (day: string, delta: number) => new Date(Date.parse(`${day}T00:00:00Z`) + delta * 86_400_000).toISOString().slice(0, 10);
export function daysBetween(start: string, end: string): string[] {
  if (validDate(start) !== start || validDate(end) !== end || start > end) throw new Error("invalid-date-range");
  const days = [];
  for (let date = start; date <= end; date = shiftDay(date, 1)) days.push(date);
  return days;
}
export function monthWindows(start: string, end: string) {
  const days = daysBetween(start, end);
  return [...new Set(days.map((d) => d.slice(0, 7)))].map((month) => {
    const selected = days.filter((d) => d.startsWith(month));
    return { start: selected[0], end: selected[selected.length - 1] };
  });
}
export type HistoryPage = {
  schemaVersion: 1; start: string; end: string; pageNo: number; pageSize: number;
  totalCount: number; rowCount: number; fetchedAt: string; bodyHash: string;
  keys: string[]; selected: Record<string, unknown>[];
};
export type HistoryDay = {
  date: string; quality: "complete" | "missing" | "invalid"; issues: string[];
  values: Record<string, number | null>; sourcePages: string[];
};
export type HistoryDataset = {
  schemaVersion: 1; snapshotId: string; generatedAt: string; source: string;
  region: { code: "44230"; name: "논산시" }; sourcePublishedAt: null;
  range: { start: string; end: string }; quality: { expectedDays: number; completeDays: number; missingDates: string[]; invalidDates: string[] };
  pages: Omit<HistoryPage, "keys" | "selected">[]; days: HistoryDay[];
};

/** The caller persists this validated page before asking for another page. Errors never contain URLs or response text. */
export async function fetchHistoryPage(
  request: { start: string; end: string; pageNo: number; pageSize: number }, key: string, fetcher: typeof fetch = fetch,
): Promise<HistoryPage> {
  if (!key.trim() || daysBetween(request.start, request.end).length > 31
    || !Number.isInteger(request.pageNo) || request.pageNo < 1 || request.pageNo > 100
    || !Number.isInteger(request.pageSize) || request.pageSize < 1 || request.pageSize > 10_000) throw new Error("invalid-request");
  const query = new URLSearchParams({ serviceKey: key, MobileOS: "ETC", MobileApp: "FESTCompass", _type: "json",
    startYmd: request.start.replaceAll("-", ""), endYmd: request.end.replaceAll("-", ""),
    pageNo: String(request.pageNo), numOfRows: String(request.pageSize) });
  let response: Response, body: string;
  try {
    response = await fetcher(`${HISTORY_ENDPOINT}?${query}`, { signal: AbortSignal.timeout(30_000), redirect: "error", cache: "no-store" });
    body = await response.text();
  } catch { throw new Error("history-network-error"); }
  const wire = parseKtoWire(body);
  if ([401, 403, 429].includes(response.status) || ["20", "22", "23", "29", "30", "31"].includes(wire.gatewayCode ?? wire.resultCode ?? "")) {
    throw new Error("history-access-or-quota-stop");
  }
  if (!response.ok || wire.gatewayCode || wire.contractError || !isKtoSuccessCode(wire.resultCode)) throw new Error("history-provider-error");
  const reportedSize = wire.numOfRows ?? request.pageSize;
  const size = wire.totalCount === 0 && reportedSize === 0 ? request.pageSize : reportedSize;
  if (!Number.isSafeInteger(wire.totalCount) || wire.totalCount! < 0 || wire.totalCount! > 100_000
    || wire.pageNo !== request.pageNo || !Number.isSafeInteger(size) || size < 1 || size > request.pageSize
    || (request.pageNo === 1 ? wire.items.length !== Math.min(size, wire.totalCount!)
      : wire.items.length !== Math.max(0, Math.min(request.pageSize, wire.totalCount! - (request.pageNo - 1) * request.pageSize)))) throw new Error("history-pagination-error");
  const keys = wire.items.map((row) => {
    const date = validDate(row.baseYmd), code = String(row.signguCode ?? ""), type = String(row.touDivCd ?? "");
    if (!date || date < request.start || date > request.end || !/^\d{5}$/.test(code) || !/^[123]$/.test(type)) throw new Error("history-row-identity-error");
    return `${date}/${code}/${type}`;
  });
  if (new Set(keys).size !== keys.length) throw new Error("history-duplicate-row");
  return { schemaVersion: 1, ...request, pageSize: size, totalCount: wire.totalCount!, rowCount: wire.items.length,
    fetchedAt: new Date().toISOString(), bodyHash: hash(body), keys,
    selected: wire.items.filter((r) => String(r.signguCode) === "44230" || String(r.signguNm).trim() === "논산시") };
}

/** A month enters a dataset only after complete pagination and cross-page identity checks. */
export function validateHistoryWindow(pages: HistoryPage[], start: string, end: string): HistoryDay[] {
  if (!pages.length) throw new Error("history-incomplete-window");
  const sorted = [...pages].sort((a, b) => a.pageNo - b.pageNo), first = sorted[0];
  const expectedPages = Math.max(1, Math.ceil(first.totalCount / first.pageSize));
  if (sorted.length !== expectedPages || sorted.some((p, i) => p.start !== start || p.end !== end
    || p.pageNo !== i + 1 || p.totalCount !== first.totalCount
    // This provider reports the final page's actual row count as numOfRows.
    // The first page sets the offset stride; a short final page must still match the exact remainder.
    || (p.pageSize !== first.pageSize && !(i === expectedPages - 1 && p.pageSize === p.rowCount))
    || p.rowCount !== p.keys.length || p.rowCount !== Math.max(0, Math.min(first.pageSize, first.totalCount - i * first.pageSize)))
    || sorted.reduce((n, p) => n + p.rowCount, 0) !== first.totalCount) throw new Error("history-incomplete-window");
  const keys = sorted.flatMap((p) => p.keys);
  if (new Set(keys).size !== keys.length) throw new Error("history-duplicate-page-rows");
  return daysBetween(start, end).map((date) => {
    const sourcePages = sorted.filter((p) => p.selected.some((r) => validDate(r.baseYmd) === date));
    const rows = sourcePages.flatMap((p) => p.selected.filter((r) => validDate(r.baseYmd) === date));
    const region = summarizeRegionalDay(rows, date, true).find((r) => r.regionId === "nonsan")!;
    return { date, quality: rows.length === 0 ? "missing" : region.status === "complete-day" ? "complete" : "invalid",
      issues: region.issues, values: Object.fromEntries(["1", "2", "3"].map((type) => [type,
        region.status === "complete-day" ? region.points.find((p) => p.visitorTypeCode === type)!.value : null])),
      sourcePages: sourcePages.map((p) => p.bodyHash) };
  });
}

export function makeHistoryDataset(pages: HistoryPage[], start: string, end: string): HistoryDataset {
  const windows = monthWindows(start, end);
  if (pages.some((p) => !windows.some((w) => w.start === p.start && w.end === p.end))) throw new Error("history-unexpected-window");
  const days = windows.flatMap((w) => validateHistoryWindow(pages.filter((p) => p.start === w.start && p.end === w.end), w.start, w.end));
  const metadata = pages.map(({ keys: _keys, selected: _selected, ...page }) => page).sort((a, b) => a.start.localeCompare(b.start) || a.pageNo - b.pageNo);
  const content = { source: HISTORY_SOURCE, region: { code: "44230" as const, name: "논산시" as const }, sourcePublishedAt: null,
    range: { start, end }, pages: metadata, days };
  return { schemaVersion: 1, snapshotId: hash(JSON.stringify(content)), generatedAt: new Date().toISOString(), ...content,
    quality: { expectedDays: days.length, completeDays: days.filter((d) => d.quality === "complete").length,
      missingDates: days.filter((d) => d.quality === "missing").map((d) => d.date), invalidDates: days.filter((d) => d.quality === "invalid").map((d) => d.date) } };
}
