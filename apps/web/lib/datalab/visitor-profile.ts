import "server-only";
import raw2023 from "../../data/datalab-visitor-profile-2023.json";
import raw2024 from "../../data/datalab-visitor-profile-2024.json";
import raw from "../../data/datalab-visitor-profile.json";
import type { ArchiveFestival } from "../existing/types";
import type { VisitorProfile, VisitorProfileBand, VisitorProfileDestination, VisitorProfileDestinationGroup, VisitorProfileGroupId, VisitorProfileResource, VisitorProfileSelection } from "./visitor-profile-types";

// Strict reader for the generated Imsil 2023, 2024 and 2025 visitor profiles. Internal evidence (paths, hashes, request years,
// DataLab IDs, display flags) is checked here and never leaves; only the exact VisitorProfile projection does.
export class VisitorProfileDataError extends Error {}

const OFFICIAL_URL = "https://datalab.visitkorea.or.kr/datalab/portal/fes/getFesDataForm.do";
/** Reviewed identity, host area and original period of one edition. The artifact must carry exactly these values. */
const reviewed = (year: number, start: string, end: string, days: number) => Object.freeze({
  archiveFestivalId: "imsil-cheese", editionId: `imsil-cheese-${year}`, datalabFestivalId: "KCTF0061", name: "임실N치즈축제",
  regionCode: "52750", areaCode: "52750340", areaName: "임실군 성수면", year, start, end, days,
});
export type ReviewedFestival = ReturnType<typeof reviewed>;
export type ReviewedYear = 2023 | 2024 | 2025;
type ReviewedConfig = { festival: ReviewedFestival; importDir: string; resources: Readonly<Record<string, VisitorProfileResource>> };
const PARK: VisitorProfileResource = Object.freeze({ id: "2718832", kind: "12", title: "임실치즈테마파크" });
const SANGIAM: VisitorProfileResource = Object.freeze({ id: "317571", kind: "12", title: "상이암(임실)" });
const SOCHUNGSA: VisitorProfileResource = Object.freeze({ id: "527279", kind: "12", title: "소충사" });
/**
 * Reviewed 2026-09-24, one pin per edition: identity and original period, capture folder, and destination ID -> current resource
 * identity. Any other place must carry no resource. Every artifact is read against the pin of the year it is loaded for.
 */
export const REVIEWED_PROFILES: Readonly<Record<ReviewedYear, ReviewedConfig>> = Object.freeze({
  2023: { festival: reviewed(2023, "2023-10-06", "2023-10-09", 4), importDir: "docs/research/imported/datalab-imsil-2023", resources: Object.freeze({ "2773331": PARK, "3306424": SANGIAM }) },
  2024: { festival: reviewed(2024, "2024-10-03", "2024-10-06", 4), importDir: "docs/research/imported/datalab-imsil-2024", resources: Object.freeze({ "2773331": PARK, "3306424": SANGIAM }) },
  2025: { festival: reviewed(2025, "2025-10-08", "2025-10-12", 5), importDir: "docs/research/imported/datalab-imsil-2025", resources: Object.freeze({ "2773331": PARK, "3306424": SANGIAM, "725050": SOCHUNGSA }) },
});
export const REVIEWED_PROFILE = REVIEWED_PROFILES[2025].festival;
const AGE_BANDS = ["0~9세", "10~19세", "20~29세", "30~39세", "40~49세", "50~59세", "60~69세", "70세 이상"];
const GROUPS: { group: VisitorProfileGroupId; sourceLabel: string; label: string }[] = [
  { group: "outside", sourceLabel: "외지인", label: "외지인" },
  { group: "local", sourceLabel: "현지인", label: "현지인" },
  { group: "all", sourceLabel: "전체", label: "전체" },
];
const RECORD_KINDS = ["festival-list", "festival-periods", "trend", "demographics", "destinations"];
const PERIOD_KINDS = ["trend", "demographics", "destinations"];
const EXCLUDED_CATEGORY = /음식|식당|한식|중식|일식|양식|카페|주점|제과|분식|뷔페|숙박|호텔|모텔|펜션|콘도|민박|게스트하우스|여관/;
const BAND_KEYS = ["ageBand", "display", "femalePercent", "malePercent", "order"];
const ITEM_KEYS = ["address", "category", "id", "name", "rank", "resource"];
const MAX_RANK_ROWS = 10;

type Obj = Record<string, unknown>;
const fail = (why: string): never => { throw new VisitorProfileDataError(`Invalid DataLab visitor profile: ${why}`); };
const obj = (v: unknown, at: string): Obj => (v && typeof v === "object" && !Array.isArray(v) ? (v as Obj) : fail(`${at} must be an object`));
const arr = (v: unknown, at: string): unknown[] => (Array.isArray(v) ? v : fail(`${at} must be an array`));
const str = (v: unknown, at: string): string => (typeof v === "string" && v.length > 0 ? v : fail(`${at} must be a non-empty string`));
const exactKeys = (o: Obj, keys: string[], at: string) => { if (Object.keys(o).sort().join() !== keys.join()) fail(`${at} fields differ from the schema`); };
const instant = (v: unknown, at: string) => {
  const s = str(v, at);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(s) || new Date(s).toISOString() !== s) fail(`${at} must be a UTC instant`);
  return s;
};
/** Published share: a real number 0..100 with one decimal. null, strings or other precision are rejected, never coerced. */
const percent = (v: unknown, at: string): number => {
  if (typeof v !== "number" || !Number.isFinite(v) || v < 0 || v > 100 || Math.abs(v * 10 - Math.round(v * 10)) >= 1e-9) fail(`${at} must be a 0..100 percentage with one decimal`);
  return v as number;
};

export type VisitorProfileDataset = {
  festival: ReviewedFestival;
  source: VisitorProfile["source"];
  demographics: VisitorProfileBand[];
  destinationGroups: VisitorProfileDestinationGroup[];
};

function evidence(v: unknown, collectedAt: string, config: ReviewedConfig) {
  const e = obj(v, "evidence"), records = arr(e.records, "evidence.records").map((r, i) => obj(r, `evidence.records[${i}]`));
  if (records.length !== RECORD_KINDS.length || RECORD_KINDS.some(k => records.filter(r => r.kind === k).length !== 1)) fail("evidence must cover the five reviewed responses");
  const year = String(config.festival.year);
  for (const r of records) {
    const at = `evidence ${String(r.kind)}`;
    if (r.path !== `${config.importDir}/original/${String(r.kind)}.json` || !/^[0-9a-f]{64}$/.test(str(r.sha256, `${at}.sha256`))) fail(`${at} is not the reviewed capture`);
    instant(r.retrievedAt, `${at}.retrievedAt`);
    const years = PERIOD_KINDS.includes(r.kind as string) ? [year, year] : null;
    if (JSON.stringify(r.baseYears) !== JSON.stringify(years)) fail(`${at} is not bound to the reviewed ${year} period`);
  }
  if (records.map(r => r.retrievedAt as string).sort().at(-1) !== collectedAt) fail("source.collectedAt must be the latest response time");
  if (e.residence !== "hidden-on-official-page") fail("residence must stay out of the profile");
}

function bands(v: unknown): VisitorProfileBand[] {
  const rows = arr(v, "demographics");
  if (rows.length !== AGE_BANDS.length) fail(`demographics must hold exactly ${AGE_BANDS.length} age bands`);
  const out = rows.map((x, i) => {
    const at = `demographics[${i}]`, b = obj(x, at);
    exactKeys(b, BAND_KEYS, at);
    if (b.ageBand !== AGE_BANDS[i] || b.order !== i + 1) fail(`${at} must be ${AGE_BANDS[i]} in chronological order`);
    if (b.display !== "Y" && b.display !== "N") fail(`${at}.display must be Y or N`);
    return { ageBand: AGE_BANDS[i], malePercent: percent(b.malePercent, `${at}.malePercent`), femalePercent: percent(b.femalePercent, `${at}.femalePercent`) };
  });
  const sum = out.reduce((n, b) => n + b.malePercent + b.femalePercent, 0);
  if (Math.abs(sum - 100) > 0.8 + 1e-9) fail("percentages must add up to 100 within rounding");
  return out;
}

function item(v: unknown, at: string, index: number, previous: number | null, resources: ReviewedConfig["resources"]): VisitorProfileDestination {
  const it = obj(v, at);
  exactKeys(it, ITEM_KEYS, at);
  const id = str(it.id, `${at}.id`), rank = it.rank;
  if (!/^\d+$/.test(id)) fail(`${at}.id must be a numeric place ID`);
  if (typeof rank !== "number" || !Number.isInteger(rank) || rank < 1 || rank > index + 1 || (previous === null ? rank !== 1 : rank < previous)) fail(`${at}.rank must start at 1 and never go down`);
  const category = str(it.category, `${at}.category`);
  if (EXCLUDED_CATEGORY.test(category)) fail(`${at} food or lodging is outside the ranking definition`);
  const mapped = Object.hasOwn(resources, id) ? resources[id] : null;
  if (mapped === null) {
    if (it.resource !== null) fail(`${at}.resource is not the reviewed mapping`);
  } else {
    const r = obj(it.resource, `${at}.resource`);
    if (Object.keys(r).length !== 3 || r.id !== mapped.id || r.kind !== mapped.kind || r.title !== mapped.title) fail(`${at}.resource is not the reviewed mapping`);
  }
  return { id, rank: rank as number, name: str(it.name, `${at}.name`), address: str(it.address, `${at}.address`), category, resource: mapped && { id: mapped.id, kind: mapped.kind, title: mapped.title } };
}

function groups(v: unknown, resources: ReviewedConfig["resources"]): VisitorProfileDestinationGroup[] {
  const list = arr(v, "destinationGroups");
  if (list.length !== GROUPS.length) fail("destinationGroups must hold the three reviewed groups");
  const out = list.map((x, i) => {
    const at = `destinationGroups[${i}]`, g = obj(x, at), spec = GROUPS[i];
    if (g.group !== spec.group || g.sourceLabel !== spec.sourceLabel || g.label !== spec.label) fail(`${at} must be ${spec.group}`);
    const rows = arr(g.items, `${at}.items`);
    if (!rows.length || rows.length > MAX_RANK_ROWS) fail(`${at} must hold 1..${MAX_RANK_ROWS} places`);
    const items: VisitorProfileDestination[] = [];
    rows.forEach((y, j) => items.push(item(y, `${at}.items[${j}]`, j, j ? items[j - 1].rank : null, resources)));
    if (new Set(items.map(it => it.id)).size !== items.length) fail(`${at} repeats a place`);
    return { group: spec.group, label: spec.label, items };
  });
  if (Object.keys(resources).some(id => !out.some(g => g.items.some(it => it.id === id)))) fail("every reviewed resource mapping must appear in the ranking");
  return out;
}

/** Reads one artifact against the pin of `year` (the edition it is loaded for); any other edition, period or area fails. */
export function parseVisitorProfileDataset(input: unknown, year: ReviewedYear = 2025): VisitorProfileDataset {
  const config = Object.hasOwn(REVIEWED_PROFILES, year) ? REVIEWED_PROFILES[year] : fail("year is not a reviewed edition");
  const d = obj(input, "dataset"), s = obj(d.source, "source"), f = obj(d.festival, "festival");
  if (d.kind !== "datalab-festival-visitor-profile" || d.schemaVersion !== 1) fail("unexpected kind or schema version");
  if (s.officialUrl !== OFFICIAL_URL) fail("source must be the official festival page");
  if (s.importDir !== config.importDir) fail("source is not the reviewed capture");
  for (const k of ["manifestSha256", "resourceLinksSha256"]) if (!/^[0-9a-f]{64}$/.test(str(s[k], `source.${k}`))) fail(`source.${k} must be a hash`);
  const collectedAt = instant(s.collectedAt, "source.collectedAt");
  const pinned = Object.entries(config.festival);
  if (Object.keys(f).length !== pinned.length || pinned.some(([k, v]) => f[k] !== v)) fail("festival identity or period is not the reviewed one");
  evidence(d.evidence, collectedAt, config);
  return { festival: config.festival, source: { title: str(s.title, "source.title"), url: OFFICIAL_URL, collectedAt }, demographics: bands(d.demographics), destinationGroups: groups(d.destinationGroups, config.resources) };
}

export type VisitorProfileResolver = (festival: ArchiveFestival, editionIds: string[]) => VisitorProfileSelection | null;
const MAX_COMPARED = 2;

/** The reviewed archive festival in its reviewed region, with this edition selected, uncancelled and identical in year and original start/end/days. */
function selected(f: ReviewedFestival, festival: ArchiveFestival, editionIds: string[]): boolean {
  if (festival.festivalId !== f.archiveFestivalId || festival.region.code !== f.regionCode || !editionIds.includes(f.editionId)) return false;
  const ref = festival.editions.find(e => e.editionId === f.editionId);
  return !!ref && !ref.cancelled && ref.year === f.year && ref.start === f.start && ref.end === f.end && ref.days === f.days;
}

const project = (d: VisitorProfileDataset): VisitorProfile => {
  const f = d.festival;
  return {
    editionId: f.editionId, year: f.year, start: f.start, end: f.end, areaName: f.areaName,
    demographics: d.demographics.map(b => ({ ageBand: b.ageBand, malePercent: b.malePercent, femalePercent: b.femalePercent })),
    destinationGroups: d.destinationGroups.map(g => ({ group: g.group, label: g.label, items: g.items.map(i => ({
      id: i.id, rank: i.rank, name: i.name, address: i.address, category: i.category, resource: i.resource && { id: i.resource.id, kind: i.resource.kind, title: i.resource.title } })) })),
    source: { title: d.source.title, url: d.source.url, collectedAt: d.source.collectedAt },
  };
};

/**
 * Only reviewed editions that are currently selected, never an unselected fallback; the chart window never takes part.
 * One match gives a single profile, two give a comparison in ascending date order. Selection beyond two keeps the latest
 * two, like the default edition choice.
 */
export function visitorProfileFrom(...datasets: VisitorProfileDataset[]): VisitorProfileResolver {
  const area = (f: ReviewedFestival) => [f.archiveFestivalId, f.regionCode, f.areaCode, f.areaName].join("|");
  if (new Set(datasets.map(d => d.festival.editionId)).size !== datasets.length || new Set(datasets.map(d => area(d.festival))).size > 1) {
    fail("editions must be distinct and share one reviewed host area");
  }
  const ordered = [...datasets].sort((a, b) => a.festival.start.localeCompare(b.festival.start));
  return (festival, editionIds) => {
    const matched = ordered.filter(d => selected(d.festival, festival, editionIds));
    return matched.length ? { editions: matched.slice(-MAX_COMPARED).map(project) } : null;
  };
}

export type VisitorProfileArtifact = { year: ReviewedYear; input: unknown };

/** Each artifact is read against its own year's pin. An invalid one drops only its edition; the log carries a fixed category, never data or paths. */
export function createVisitorProfileResolver(artifacts: VisitorProfileArtifact[], log: (category: string) => void = c => console.error(c)): VisitorProfileResolver {
  const valid: VisitorProfileDataset[] = [];
  for (const a of artifacts) {
    try { valid.push(parseVisitorProfileDataset(a.input, a.year)); } catch { log("datalab-visitor-profile: invalid-artifact"); }
  }
  try { return visitorProfileFrom(...valid); }
  catch { log("datalab-visitor-profile: invalid-artifact"); return () => null; }
}

export const defaultVisitorProfile = createVisitorProfileResolver([{ year: 2023, input: raw2023 }, { year: 2024, input: raw2024 }, { year: 2025, input: raw }]);
