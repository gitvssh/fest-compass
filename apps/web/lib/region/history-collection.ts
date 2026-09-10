import { fetchHistoryPage, hash, validateHistoryWindow, type HistoryPage } from "../kto/history";
import { CANDIDATE_REGIONS, summarizeRegionalDay } from "../kto/history-probe";
import { parseKtoWire } from "../kto/wire";
import { validDate } from "../kto/probe";
import { HISTORY_SOURCE, type Dataset } from "./model";

export const EXPANDED_REGIONS = [
  { id: "gongju", code: "44150", name: "공주시", codes: ["44150"] },
  { id: "imsil", code: "52750", name: "임실군", codes: ["45750", "52750"] },
] as const;

/** Reuse the frozen collector's wire/pagination checks without changing its Nonsan selection. */
export async function fetchRegionalPage(request: Parameters<typeof fetchHistoryPage>[0], key: string, fetcher: typeof fetch = fetch): Promise<HistoryPage> {
  let rows: Record<string, unknown>[] = [];
  const page = await fetchHistoryPage(request, key, async (url, init) => {
    const response = await fetcher(url, init);
    rows = parseKtoWire(await response.clone().text()).items;
    return response;
  });
  return { ...page, selected: rows.filter(row => EXPANDED_REGIONS.some(r => (r.codes as readonly string[]).includes(String(row.signguCode)) || String(row.signguNm).trim() === r.name)) };
}

export function regionalDatasets(pages: HistoryPage[], windows: { start: string; end: string }[]): (Dataset & { sourceRegionCodes: string[]; sourcePages: string[] })[] {
  if (!windows.length || new Set(windows.map(w => w.start)).size !== windows.length || pages.some(p => !windows.some(w => w.start === p.start && w.end === p.end))) throw new Error("history-unexpected-window");
  const days = windows.flatMap(w => validateHistoryWindow(pages.filter(p => p.start === w.start && p.end === w.end), w.start, w.end).map(d => d.date));
  if (new Set(days).size !== days.length) throw new Error("history-overlapping-windows");
  const rows = pages.flatMap(p => p.selected), collectedAt = [...pages].map(p => p.fetchedAt).sort().at(-1)!;
  return EXPANDED_REGIONS.map(region => {
    const candidate = CANDIDATE_REGIONS.find(r => r.id === region.id)!;
    const selected = rows.filter(row => (candidate.codes as readonly string[]).includes(String(row.signguCode)) || String(row.signguNm).trim() === region.name);
    const points = days.map(date => {
      const daily = selected.filter(row => validDate(row.baseYmd) === date);
      const summary = summarizeRegionalDay(daily, date, true).find(r => r.regionId === region.id)!;
      return { date, quality: daily.length === 0 ? "missing" : summary.status === "complete-day" ? "complete" : "invalid", value: summary.status === "complete-day" ? summary.points.find(p => p.visitorTypeCode === "2")!.value : null };
    });
    const content = { source: HISTORY_SOURCE, region: { code: region.code, name: region.name }, collectedAt, sourceRegionCodes: [...new Set(selected.map(row => String(row.signguCode)))].sort(), sourcePages: pages.map(p => p.bodyHash), points };
    return { snapshotId: hash(JSON.stringify(content)), ...content };
  });
}
