import "server-only";
import raw from "../../data/datalab-festival-profiles.json";
import { FESTIVAL_INDICATOR_KEYS, WITHHELD_REASONS, type FestivalDestinationGroup, type FestivalIndicatorYear, type FestivalProfile, type FestivalProfiles, type WithheldYear } from "./festival-profile-types";
import type { VisitorProfileBand } from "./visitor-profile-types";

// Strict reader for the generated festival profiles. Internal evidence (paths, hashes, byte counts) is checked here and
// never leaves; only the FestivalProfiles projection does.
export class FestivalProfileDataError extends Error {}

const OFFICIAL_URL = "https://datalab.visitkorea.or.kr/datalab/portal/fes/getFesDataForm.do";
const INDICATOR_SOURCES = ["외부방문자 유입", "현지인방문자 유입", "내비게이션 검색량", "관광소비", "축제지 집중률"];
const AGE_BANDS = ["0~9세", "10~19세", "20~29세", "30~39세", "40~49세", "50~59세", "60~69세", "70세 이상"];
const GROUPS: { group: FestivalDestinationGroup["group"]; label: string }[] = [{ group: "outside", label: "외지인" }, { group: "local", label: "현지인" }, { group: "all", label: "전체" }];
const TABLES = ["indicators", "demographics", "destinations"] as const;

type Obj = Record<string, unknown>;
const fail = (why: string): never => { throw new FestivalProfileDataError(`Invalid DataLab festival profiles: ${why}`); };
const obj = (v: unknown, at: string): Obj => (v && typeof v === "object" && !Array.isArray(v) ? (v as Obj) : fail(`${at} must be an object`));
const arr = (v: unknown, at: string): unknown[] => (Array.isArray(v) ? v : fail(`${at} must be an array`));
const str = (v: unknown, at: string): string => (typeof v === "string" && v.trim().length > 0 ? v : fail(`${at} must be a non-empty string`));
const int = (v: unknown, at: string, min: number, max: number): number => (Number.isInteger(v) && (v as number) >= min && (v as number) <= max ? (v as number) : fail(`${at} out of range`));
const hex = (v: unknown, at: string) => { const s = str(v, at); if (!/^[0-9a-f]{64}$/.test(s)) fail(`${at} must be a hash`); return s; };
const https = (v: unknown, at: string) => { const s = str(v, at); if (!s.startsWith("https://")) fail(`${at} must be https`); return s; };
const decimals = (v: number, n: number) => Math.abs(v * 10 ** n - Math.round(v * 10 ** n)) < 1e-9;
/** Held-year indicator: 0 < v <= 1 with up to three decimals (all-zero years are withheld by the build). */
const index = (v: unknown, at: string): number => (typeof v === "number" && v > 0 && v <= 1 && decimals(v, 3) ? v : fail(`${at} must be 0..1 with up to three decimals`));
const share = (v: unknown, at: string): number => (typeof v === "number" && v >= 0 && v <= 100 && decimals(v, 1) ? v : fail(`${at} must be a one-decimal percentage`));
const ascendingUnique = (xs: number[], at: string) => xs.forEach((x, i) => { if (i && x <= xs[i - 1]) fail(`${at} must be unique and ascending`); });

function indicators(v: unknown, range: FestivalProfile["range"], at: string): { years: FestivalIndicatorYear[]; withheldYears: WithheldYear[] } {
  const o = obj(v, at);
  const years = arr(o.years, `${at}.years`).map((y, i) => {
    const e = obj(y, `${at}.years[${i}]`), year = int(e.year, `${at}.years[${i}].year`, range.from, range.to);
    const values = (k: "festival" | "base") => {
      const xs = arr(e[k], `${at}.years[${i}].${k}`);
      if (xs.length !== FESTIVAL_INDICATOR_KEYS.length) fail(`${at}.years[${i}].${k} must hold ${FESTIVAL_INDICATOR_KEYS.length} values`);
      return xs.map((x, j) => index(x, `${at}.years[${i}].${k}[${j}]`));
    };
    return { year, festival: values("festival"), base: values("base") };
  });
  const withheldYears = arr(o.withheldYears, `${at}.withheldYears`).map((y, i) => {
    const w = obj(y, `${at}.withheldYears[${i}]`), reason = w.reason;
    if (typeof reason !== "string" || !(WITHHELD_REASONS as readonly string[]).includes(reason)) fail(`${at}.withheldYears[${i}].reason is unknown`);
    return { year: int(w.year, `${at}.withheldYears[${i}].year`, range.from, range.to), reason: reason as WithheldYear["reason"] };
  });
  if (!years.length) fail(`${at} has no held year`);
  ascendingUnique(years.map(y => y.year), `${at}.years`);
  ascendingUnique(withheldYears.map(w => w.year), `${at}.withheldYears`);
  if (withheldYears.some(w => years.some(h => h.year === w.year))) fail(`${at} withheld years overlap held years`);
  return { years, withheldYears };
}

function demographics(v: unknown, at: string): VisitorProfileBand[] {
  const rows = arr(v, at);
  if (rows.length !== AGE_BANDS.length) fail(`${at} must hold the eight age bands`);
  const out = rows.map((x, i) => {
    const b = obj(x, `${at}[${i}]`);
    if (b.ageBand !== AGE_BANDS[i]) fail(`${at}[${i}] must be ${AGE_BANDS[i]}`);
    return { ageBand: AGE_BANDS[i], malePercent: share(b.malePercent, `${at}[${i}].malePercent`), femalePercent: share(b.femalePercent, `${at}[${i}].femalePercent`) };
  });
  if (Math.abs(out.reduce((n, b) => n + b.malePercent + b.femalePercent, 0) - 100) > 0.8 + 1e-9) fail(`${at} must add up to 100 within rounding`);
  return out;
}

function destinations(v: unknown, at: string): FestivalDestinationGroup[] {
  const list = arr(v, at);
  if (list.length !== GROUPS.length) fail(`${at} must hold the three groups`);
  return list.map((x, i) => {
    const g = obj(x, `${at}[${i}]`), spec = GROUPS[i];
    if (g.group !== spec.group || g.label !== spec.label) fail(`${at}[${i}] must be ${spec.group}`);
    const items = arr(g.items, `${at}[${i}].items`).map((y, j) => {
      const it = obj(y, `${at}[${i}].items[${j}]`), w = `${at}[${i}].items[${j}]`;
      return { rank: int(it.rank, `${w}.rank`, 1, 10000), area: str(it.area, `${w}.area`), name: str(it.name, `${w}.name`), address: str(it.address, `${w}.address`), category: str(it.category, `${w}.category`) };
    });
    if (!items.length) fail(`${at}[${i}] has no place`);
    items.forEach((it, j) => { if (it.rank > j + 1 || (j === 0 ? it.rank !== 1 : it.rank < items[j - 1].rank)) fail(`${at}[${i}] ranks must start at 1 and never go down`); });
    return { group: spec.group, label: spec.label, items };
  });
}

function festival(v: unknown, at: string): FestivalProfile {
  const f = obj(v, at), id = str(f.id, `${at}.id`), r = obj(f.range, `${at}.range`), s = obj(f.sources, `${at}.sources`);
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(id)) fail(`${at}.id must be a slug`);
  const range = { from: int(r.from, `${at}.range.from`, 2000, 2100), to: int(r.to, `${at}.range.to`, 2000, 2100) };
  if (range.from > range.to) fail(`${at}.range must not be reversed`);
  const downloadDate = str(f.downloadDate, `${at}.downloadDate`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(downloadDate)) fail(`${at}.downloadDate must be a date`);
  // Only the destination ranking may be absent (the official download had none); then its source is absent too.
  const links = Object.fromEntries(TABLES.map(t => {
    if (t === "destinations" && f.destinations === null) { if (s[t] !== null) fail(`${at}.sources.${t} must be null without destinations`); return [t, null]; }
    const e = obj(s[t], `${at}.sources.${t}`);
    str(e.path, `${at}.sources.${t}.path`); hex(e.sha256, `${at}.sources.${t}.sha256`); int(e.bytes, `${at}.sources.${t}.bytes`, 1, 1e8);
    return [t, https(e.originalUrl, `${at}.sources.${t}.originalUrl`)];
  })) as FestivalProfile["links"];
  const ind = indicators(f.indicators, range, `${at}.indicators`);
  return { id, name: str(f.name, `${at}.name`), range, downloadDate, indicators: ind.years, withheldYears: ind.withheldYears,
    demographics: demographics(f.demographics, `${at}.demographics`), destinations: f.destinations === null ? null : destinations(f.destinations, `${at}.destinations`), links };
}

/** Strictly validate the checked-in artifact before any UI use. */
export function parseFestivalProfiles(input: unknown): FestivalProfiles {
  const d = obj(input, "dataset"), source = obj(d.source, "source");
  if (d.kind !== "datalab-festival-profiles" || d.schemaVersion !== 2) fail("unexpected kind or schema version");
  if (source.officialUrl !== OFFICIAL_URL || source.downloadTimezone !== null) fail("source must be the official festival page without a download timezone");
  const imports = arr(source.imports, "source.imports");
  if (!imports.length) fail("source.imports must not be empty");
  imports.forEach((m, i) => { const o = obj(m, `source.imports[${i}]`); str(o.id, `source.imports[${i}].id`); hex(o.manifestSha256, `source.imports[${i}].manifestSha256`); });
  const names = arr(d.indicators, "indicators").map((x, i) => { const o = obj(x, `indicators[${i}]`); return `${String(o.key)}|${String(o.source)}`; });
  if (names.join() !== FESTIVAL_INDICATOR_KEYS.map((k, i) => `${k}|${INDICATOR_SOURCES[i]}`).join()) fail("indicators differ from the reviewed five");
  const festivals = arr(d.festivals, "festivals").map((f, i) => festival(f, `festivals[${i}]`));
  if (!festivals.length || new Set(festivals.map(f => f.id)).size !== festivals.length) fail("festival IDs must be unique");
  return { officialUrl: OFFICIAL_URL, festivals };
}

/** An invalid artifact removes the profiles (the trend page still works); the log carries a fixed category, never data. */
export function loadFestivalProfiles(input: unknown, log: (category: string) => void = c => console.error(c)): FestivalProfiles | null {
  try { return parseFestivalProfiles(input); } catch { log("datalab-festival-profiles: invalid-artifact"); return null; }
}

export const defaultFestivalProfiles = loadFestivalProfiles(raw);
