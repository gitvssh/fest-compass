import type { Range } from "@/lib/existing/types";
import { DEFAULT_PAD, type Pads } from "./EditionControls";
import { daysBetween, validDay } from "./format";
import { one } from "./route-params";

// Address conditions of the visits view (compared editions, shown days around them, custom chart windows). The summary
// view reads the same conditions so a reload gathers the same editions.
export type VisitsApplied = Pads & { editions: string[]; windows: Record<string, Range> };
const WINDOW_ITEM = /^([a-z0-9-]{1,100}):(\d{4}-\d{2}-\d{2}):(\d{4}-\d{2}-\d{2})$/;

export function readVisitsApplied(params: URLSearchParams): VisitsApplied {
  const list = (one(params, "editions") ?? "").split(",").map(s => s.trim()).filter(Boolean);
  const pad = (key: string) => { const v = one(params, key); return v !== null && /^\d{1,2}$/.test(v) && Number(v) <= 30 ? Number(v) : DEFAULT_PAD; };
  const windows: Record<string, Range> = {};
  for (const item of (one(params, "windows") ?? "").split(",")) {
    const m = WINDOW_ITEM.exec(item.trim());
    if (m && validDay(m[2]) && validDay(m[3]) && m[2] <= m[3] && daysBetween(m[2], m[3]) <= 120) windows[m[1]] = { start: m[2], end: m[3] };
  }
  return { editions: [...new Set(list)], before: pad("before"), after: pad("after"), windows };
}
export const windowsParam = (w: Record<string, Range>) => Object.keys(w).sort().map(k => `${k}:${w[k].start}:${w[k].end}`).join(",");
export function visitsAddress(a: VisitsApplied): URLSearchParams {
  const params = new URLSearchParams();
  if (a.editions.length) params.set("editions", a.editions.join(","));
  if (a.before !== DEFAULT_PAD) params.set("before", String(a.before));
  if (a.after !== DEFAULT_PAD) params.set("after", String(a.after));
  if (Object.keys(a.windows).length) params.set("windows", windowsParam(a.windows));
  params.sort();
  return params;
}
/** Query of the history answer for these conditions. */
export function historyRequest(festivalId: string, a: VisitsApplied): URLSearchParams {
  return new URLSearchParams({ festival: festivalId, ...(a.editions.length ? { editions: a.editions.join(",") } : {}), before: String(a.before), after: String(a.after),
    ...(Object.keys(a.windows).length ? { windows: windowsParam(a.windows) } : {}) });
}
