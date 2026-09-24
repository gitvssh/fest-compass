import type { ArchiveFestival, CurrentFestival, RegionRef } from "@/lib/existing/types";

/**
 * Related-material search: builds a user-visible query from public names only and a plain DuckDuckGo link.
 * Nothing here fetches, stores or reports the query; the link is the only place the query leaves the page.
 */
export const FESTIVAL_TOPICS = ["프로그램", "운영 결과", "보도자료"] as const;
export const REGION_TOPICS = ["관광사업", "축제 사례"] as const;
export const RESOURCE_TOPICS = ["행사", "축제"] as const;
export const QUERY_MAX = 200;
const SEARCH_ORIGIN = "https://duckduckgo.com/";

/** NFC, control characters and line breaks to spaces, collapsed spaces, trimmed, at most QUERY_MAX characters. */
export function normalizeQuery(value: string): string {
  const flat = value.normalize("NFC").replace(/[\p{Cc}\p{Zl}\p{Zp}]/gu, " ").replace(/\s+/gu, " ").trim();
  return Array.from(flat).slice(0, QUERY_MAX).join("").trim();
}

/**
 * Subject, full region name, year, topic — in that order. A region searched for itself passes no subject
 * (or the same name), and the region name is not repeated.
 */
export function buildQuery({ subject, region, year, topic }: { subject?: string | null; region: RegionRef; year?: number | null; topic?: string | null }): string {
  const name = normalizeQuery(subject ?? ""), place = normalizeQuery(region.name);
  const parts = [name, name === place ? "" : place, year != null && Number.isInteger(year) ? String(year) : "", normalizeQuery(topic ?? "")];
  return normalizeQuery(parts.filter(Boolean).join(" "));
}

/** `https://duckduckgo.com/?q=…` with `q` as the only parameter; null when the query is blank. */
export function searchUrl(query: string): string | null {
  const q = normalizeQuery(query);
  if (!q) return null;
  const url = new URL(SEARCH_ORIGIN);
  url.searchParams.set("q", q);
  return url.toString();
}

const startYear = (day: string | null) => { const m = day ? /^(\d{4})-\d{2}-\d{2}$/.exec(day) : null; return m ? Number(m[1]) : null; };

/** Year choices: confirmed archive edition years (newest first), or a current registration's verified start year. */
export function editionYearOptions(festival: ArchiveFestival | CurrentFestival | null): number[] {
  if (!festival) return [];
  if (festival.source === "archive") return [...new Set(festival.editions.map(e => e.year))].filter(Number.isInteger).sort((a, b) => b - a);
  const year = festival.datesVerified ? startYear(festival.start) : null;
  return year === null ? [] : [year];
}

/**
 * The year of the one edition the visits view applies, read from the address the same way the visits request is
 * resolved. Any doubt — another view, repeated `editions` keys, an unknown id, several editions — gives null.
 */
export function selectedEditionYear(archive: ArchiveFestival | null, params: Pick<URLSearchParams, "getAll">, onVisits: boolean): number | null {
  if (!archive || !onVisits) return null;
  const values = params.getAll("editions");
  if (values.length > 1) return null;
  const raw = values[0] ?? "";
  const listed = raw.trim() === "" ? [] : [...new Set(raw.split(",").map(s => s.trim()).filter(Boolean))];
  const ids = listed.length ? listed : archive.defaultEditionIds.length ? archive.defaultEditionIds : archive.editions.slice(0, 1).map(e => e.editionId);
  if (ids.length !== 1) return null;
  const edition = archive.editions.find(e => e.editionId === ids[0]);
  return edition && Number.isInteger(edition.year) ? edition.year : null;
}
