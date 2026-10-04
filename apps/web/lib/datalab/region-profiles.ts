import "server-only";
import raw from "../../data/datalab-region-profiles.json";
import type { RegionProfile, RegionProfiles, RegionRank, RegionShare } from "./region-profile-types";

// Strict reader for the generated region profiles. Internal evidence (paths, hashes, byte counts, province values) is
// checked here and never leaves; only the RegionProfiles projection does.
export class RegionProfileDataError extends Error {}

const OFFICIAL_URL = "https://datalab.visitkorea.or.kr/datalab/portal/loc/getAreaDataForm.do";
const YEARS = [2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025];
/** Origins shown before the rest are summed. */
export const ORIGINS_SHOWN = 10;

type Obj = Record<string, unknown>;
const fail = (why: string): never => { throw new RegionProfileDataError(`Invalid DataLab region profiles: ${why}`); };
const obj = (v: unknown, at: string): Obj => (v && typeof v === "object" && !Array.isArray(v) ? (v as Obj) : fail(`${at} must be an object`));
const arr = (v: unknown, at: string): unknown[] => (Array.isArray(v) ? v : fail(`${at} must be an array`));
const str = (v: unknown, at: string): string => (typeof v === "string" && v.trim().length > 0 ? v : fail(`${at} must be a non-empty string`));
const hex = (v: unknown, at: string) => { const s = str(v, at); if (!/^[0-9a-f]{64}$/.test(s)) fail(`${at} must be a hash`); return s; };
const https = (v: unknown, at: string) => { const s = str(v, at); if (!s.startsWith("https://")) fail(`${at} must be https`); return s; };
const date = (v: unknown, at: string) => { const s = str(v, at); if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) fail(`${at} must be a date`); return s; };
const amount = (v: unknown, at: string): number => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : fail(`${at} must be a non-negative number`));
const pct = (v: unknown, at: string): number => (typeof v === "number" && v >= 0 && v <= 100 && Math.abs(v * 10 - Math.round(v * 10)) < 1e-9 ? v : fail(`${at} must be a one-decimal percentage`));
const descending = (xs: number[], at: string) => xs.forEach((x, i) => { if (i && x > xs[i - 1]) fail(`${at} must be sorted largest first`); });

function shares(v: unknown, at: string): RegionShare[] {
  const out = arr(v, at).map((x, i) => { const o = obj(x, `${at}[${i}]`); return { name: str(o.name, `${at}[${i}].name`), share: pct(o.share, `${at}[${i}].share`) }; });
  if (!out.length || new Set(out.map(x => x.name)).size !== out.length) fail(`${at} must hold distinct names`);
  descending(out.map(x => x.share), at);
  return out;
}

function sources(v: unknown, tables: string[], at: string): Record<string, string> {
  const o = obj(v, at);
  if (Object.keys(o).sort().join() !== [...tables].sort().join()) fail(`${at} must list the reviewed tables`);
  return Object.fromEntries(tables.map(t => {
    const e = obj(o[t], `${at}.${t}`);
    str(e.path, `${at}.${t}.path`); hex(e.sha256, `${at}.${t}.sha256`);
    return [t, https(e.originalUrl, `${at}.${t}.originalUrl`)];
  }));
}

/** Position of the region in its province list (sorted largest first); the region must appear exactly once. */
function rank(v: unknown, name: string, at: string): RegionRank {
  const rows = arr(v, at).map((x, i) => { const o = obj(x, `${at}[${i}]`); return { name: str(o.name, `${at}[${i}].name`), value: amount(o.value, `${at}[${i}].value`) }; });
  descending(rows.map(r => r.value), at);
  if (rows.filter(r => r.name === name).length !== 1) fail(`${at} must list the region once`);
  const self = rows.find(r => r.name === name)!;
  return { position: rows.filter(r => r.value > self.value).length + 1, count: rows.length };
}

function region(v: unknown, at: string): { profile: RegionProfile; festivalIds: string[] } {
  const r = obj(v, at), code = str(r.code, `${at}.code`), name = str(r.name, `${at}.name`), range = obj(r.range, `${at}.range`);
  if (!/^\d{5}$/.test(code)) fail(`${at}.code must be a 5-digit region code`);
  if (range.from !== YEARS[0] || range.to !== YEARS.at(-1)) fail(`${at}.range must be the reviewed download range`);
  const festivalIds = arr(r.festivalIds, `${at}.festivalIds`).map((f, i) => { const id = str(f, `${at}.festivalIds[${i}]`); if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(id)) fail(`${at}.festivalIds[${i}] must be a slug`); return id; });
  const s = obj(r.spending, `${at}.spending`);
  const years = arr(s.years, `${at}.spending.years`).map((y, i) => { const o = obj(y, `${at}.spending.years[${i}]`); return { year: o.year as number, total: amount(o.total, `${at}.spending.years[${i}].total`) }; });
  if (years.map(y => y.year).join() !== YEARS.join()) fail(`${at}.spending.years must cover the reviewed years`);
  const industries = arr(s.industries, `${at}.spending.industries`).map((g, i) => {
    const o = obj(g, `${at}.spending.industries[${i}]`);
    return { name: str(o.name, `${at}.spending.industries[${i}].name`), share: pct(o.share, `${at}.spending.industries[${i}].share`), items: shares(o.items, `${at}.spending.industries[${i}].items`) };
  });
  if (!industries.length) fail(`${at}.spending.industries is empty`);
  descending(industries.map(g => g.share), `${at}.spending.industries`);
  const spendingLinks = sources(s.sources, ["관광소비 추이", "관광소비 히트맵", "업종별 지출액", "지역별 지출액"], `${at}.spending.sources`);
  const spending = {
    downloadDate: date(s.downloadDate, `${at}.spending.downloadDate`), years, industries, areas: shares(s.areas, `${at}.spending.areas`),
    rank: rank(s.province, name, `${at}.spending.province`),
    links: { trend: spendingLinks["관광소비 추이"], industries: spendingLinks["업종별 지출액"], areas: spendingLinks["지역별 지출액"], province: spendingLinks["관광소비 히트맵"] },
  };
  let visitors: RegionProfile["visitors"] = null;
  if (r.visitors !== null) {
    const o = obj(r.visitors, `${at}.visitors`);
    const origins = arr(o.origins, `${at}.visitors.origins`).map((x, i) => {
      const e = obj(x, `${at}.visitors.origins[${i}]`);
      return { province: str(e.province, `${at}.visitors.origins[${i}].province`), district: str(e.district, `${at}.visitors.origins[${i}].district`), share: pct(e.share, `${at}.visitors.origins[${i}].share`) };
    });
    if (!origins.length) fail(`${at}.visitors.origins is empty`);
    descending(origins.map(x => x.share), `${at}.visitors.origins`);
    const links = sources(o.sources, ["방문자 거주지", "방문자수 히트맵", "지역별 방문자 수"], `${at}.visitors.sources`);
    const shown = origins.slice(0, ORIGINS_SHOWN), rest = origins.slice(ORIGINS_SHOWN).reduce((n, x) => n + x.share, 0);
    visitors = {
      downloadDate: date(o.downloadDate, `${at}.visitors.downloadDate`), origins: shown, otherShare: Math.round(rest * 10) / 10, listed: origins.length,
      areas: shares(o.areas, `${at}.visitors.areas`), rank: rank(o.province, name, `${at}.visitors.province`),
      links: { origins: links["방문자 거주지"], areas: links["지역별 방문자 수"], province: links["방문자수 히트맵"] },
    };
  }
  return { profile: { code, name, province: str(r.province, `${at}.province`), range: { from: YEARS[0], to: YEARS.at(-1)! }, spending, visitors }, festivalIds };
}

/** Strictly validate the checked-in artifact before any UI use. */
export function parseRegionProfiles(input: unknown): RegionProfiles {
  const d = obj(input, "dataset"), source = obj(d.source, "source");
  if (d.kind !== "datalab-region-profiles" || d.schemaVersion !== 1) fail("unexpected kind or schema version");
  if (source.officialUrl !== OFFICIAL_URL || source.downloadTimezone !== null) fail("source must be the official region page without a download timezone");
  hex(source.manifestSha256, "source.manifestSha256");
  const parsed = arr(d.regions, "regions").map((r, i) => region(r, `regions[${i}]`));
  if (!parsed.length || new Set(parsed.map(r => r.profile.code)).size !== parsed.length) fail("region codes must be unique");
  const festivalRegions: Record<string, string> = {};
  for (const r of parsed) for (const id of r.festivalIds) { if (Object.hasOwn(festivalRegions, id)) fail(`festival ${id} is linked twice`); festivalRegions[id] = r.profile.code; }
  return { officialUrl: OFFICIAL_URL, regions: parsed.map(r => r.profile), festivalRegions };
}

/** An invalid artifact removes the region cards (other screens still work); the log carries a fixed category, never data. */
export function loadRegionProfiles(input: unknown, log: (category: string) => void = c => console.error(c)): RegionProfiles | null {
  try { return parseRegionProfiles(input); } catch { log("datalab-region-profiles: invalid-artifact"); return null; }
}

export const defaultRegionProfiles = loadRegionProfiles(raw);

/** Profile of one region code, or null. */
export const regionProfileFor = (profiles: RegionProfiles | null, code: string): RegionProfile | null => profiles?.regions.find(r => r.code === code) ?? null;
