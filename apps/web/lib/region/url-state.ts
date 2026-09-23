import { parseQuery } from "./model";
import { validMonth } from "./calendar";
import type { Query } from "./types";
export type RegionInitial = { query: Query; month: string | null };
type Params = URLSearchParams | Record<string, string | string[] | undefined>;
const KEYS = ["province", "district", "start", "end", "kind"] as const;
function one(params: Params, key: string): string | null {
  const values = params instanceof URLSearchParams ? params.getAll(key) : [params[key]].flat();
  return values.length === 1 && typeof values[0] === "string" ? values[0] : null;
}
// Only a complete, valid address condition is restored. Anything else starts from the nationwide view.
export function parseRegionState(params: Params): RegionInitial | null {
  const values = KEYS.map(k => one(params, k));
  if (values.some(v => v === null)) return null;
  try {
    const query = parseQuery(new URLSearchParams(KEYS.map((k, i) => [k, values[i]!])));
    const month = one(params, "month");
    return { query, month: query.kind === "15" && validMonth(month) ? month : null };
  } catch { return null; }
}
export function regionSearch(query: Query, month?: string | null): string {
  const params = new URLSearchParams({ province: query.province, district: query.district, start: query.start, end: query.end, kind: query.kind });
  if (query.kind === "15" && validMonth(month)) params.set("month", month);
  return params.toString();
}
export const queryKey = (q: Query) => [q.province, q.district, q.kind, q.start, q.end].join("/");
