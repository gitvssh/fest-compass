import { day } from "../region/model";
import { validPoint } from "./distance";
import { relativePoints, validRange } from "./model";
import type { ComparisonEvidence, Edition, SearchContext, Selection, Source } from "./types";
export const COMPARISON_KEY = "fest-compass.comparison-evidence.v1";
export const MAX_BYTES = 2_000_000;
const text = (v: unknown, max = 1000) => typeof v === "string" && v.length <= max;
const hex = (v: unknown) => typeof v === "string" && /^[a-f0-9]{64}$/.test(v);
const instant = (v: unknown) => text(v, 40) && Number.isFinite(Date.parse(v as string));
const amount = (v: unknown) => typeof v === "number" && Number.isSafeInteger(v) && v >= 0;
function source(s: Source) {
  const url = new URL(s.url);
  if (url.protocol !== "https:" || url.username || url.password || !(url.hostname.endsWith(".go.kr") || url.hostname === "www.imsilfestival.com") || !text(s.title) || !text(s.url, 2000) || !instant(s.checkedAt) || !(s.publishedAt === null || day(s.publishedAt)) || !(s.sha256 === null || hex(s.sha256)) || !text(s.note, 3000)) throw new Error();
}
function context(c: SearchContext) {
  if (c.distance !== undefined) {
    const d = c.distance;
    if (!d || c.mode !== "current" || d.method !== "haversine-v1" || !d.anchor || typeof d.anchor.editionId !== "string" || !/^[a-zA-Z0-9_-]{1,200}$/.test(d.anchor.editionId) || !text(d.anchor.name, 300) || !d.anchor.name.trim() || !validPoint(d.anchor.point) || !(d.radiusKm === null || [10,30,50,100].includes(d.radiusKm))) throw new Error();
    source(d.anchor.source);
  }
  validRange(c.start, c.end, c.mode === "current");
  if (!["archive", "current"].includes(c.mode) || !Array.isArray(c.regions) || c.regions.length > 3 || !c.regions.every(r => /^\d{2,5}\/\d{3,5}$/.test(r)) || !text(c.keyword, 200) || !text(c.theme, 100) || !(c.mode === "archive" ? c.dateRule === "overlap" : ["overlap", "starts-within"].includes(c.dateRule)) || !(c.queriedAt === null || instant(c.queriedAt))) throw new Error();
}
export function validateEditions(editions: Edition[]) {
  if (!Array.isArray(editions) || editions.length < 1 || editions.length > 3 || new Set(editions.map(e => e.id)).size !== editions.length) throw new Error();
  for (const e of editions) {
    if (e.point !== undefined && (e.origin !== "current" || !validPoint(e.point))) throw new Error();
    if (![e.id, e.festivalId].every(s => typeof s === "string" && /^[a-zA-Z0-9_-]{1,200}$/.test(s)) || !text(e.name, 300) || !amount(e.year) || e.year < 2000 || e.year > 2035 || !text(e.region.name) || !/^\d{2,5}$/.test(e.region.province) || !/^\d{3,5}$/.test(e.region.district) || !["archive", "current"].includes(e.origin) || !text(e.status) || !text(e.statusNote, 3000) || !text(e.address) || !Array.isArray(e.themes) || e.themes.length > 10 || !e.themes.every(t => text(t, 100)) || !Array.isArray(e.missing) || e.missing.length > 20 || !e.missing.every(t => text(t))) throw new Error();
    if (e.start === null ? e.end !== null : !day(e.start) || !e.end || !day(e.end) || e.end < e.start || Number(e.start.slice(0,4)) !== e.year) throw new Error();
    source(e.source); if (e.statusSource) source(e.statusSource); if (e.discoveredWith) context(e.discoveredWith);
    if (e.visits) {
      const v = e.visits;
      if (![v.metric, v.unit, v.method, v.regionCode].every(x => text(x)) || !hex(v.snapshotId) || !instant(v.collectedAt) || !Array.isArray(v.points) || v.points.length > 366 || new Set(v.points.map(p => p.date)).size !== v.points.length || !v.points.every(p => day(p.date) && (p.value === null || typeof p.value === "number" && Number.isFinite(p.value) && p.value >= 0))) throw new Error();
      source(v.source);
    }
    if (!Array.isArray(e.costs) || e.costs.length > 20 || new Set(e.costs.map(c => c.id)).size !== e.costs.length) throw new Error();
    for (const c of e.costs) {
      if (c.compositionKind !== undefined && !["funding", "expense"].includes(c.compositionKind)) throw new Error();
      if (![c.id, c.label, c.stage, c.scopeId, c.scope, c.department].every(x => text(x)) || !amount(c.amount) || !amount(c.year) || c.year !== e.year || c.unit !== "KRW" || !["포함", "별도", "미확인"].includes(c.vat) || typeof c.complete !== "boolean" || c.parts !== null && (!Array.isArray(c.parts) || c.parts.length > 20 || !c.parts.every(p => text(p.label) && amount(p.amount)))) throw new Error();
      source(c.source);
    }
  }
}
export function parseComparisons(raw: string): ComparisonEvidence[] {
  if (new TextEncoder().encode(raw).length > MAX_BYTES) throw new Error("비교 근거 파일은 2MB 이하여야 합니다.");
  try {
    const data = JSON.parse(raw);
    if (data.format !== "fest-compass-comparisons" || data.version !== 1 || !Array.isArray(data.items) || data.items.length > 50) throw new Error();
    for (const e of data.items as ComparisonEvidence[]) {
      if (e.version !== 1 || !hex(e.id) || !instant(e.savedAt) || !text(e.title) || !text(e.note, 2000)) throw new Error();
      context(e.context); validateEditions(e.editions);
      const s = e.selection;
      if (s.kind === "visits") { if (!Number.isInteger(s.from) || !Number.isInteger(s.to) || s.from < -7 || s.to > 7 || s.from > s.to || !e.editions.some(d => relativePoints(d, s.from, s.to).some(p => p.value !== null))) throw new Error(); }
      else if (s.kind === "cost") { if (!e.editions.some(d => d.id === s.editionId && d.costs.some(c => c.id === s.costId))) throw new Error(); }
      else if (s.kind !== "overview") throw new Error();
    }
    if (new Set(data.items.map((e: ComparisonEvidence) => e.id)).size !== data.items.length) throw new Error();
    return data.items;
  } catch { throw new Error("지원하지 않거나 손상된 비교 근거 파일입니다. 기존 근거는 유지됩니다."); }
}
export function encodeComparisons(items: ComparisonEvidence[]): string {
  const raw = JSON.stringify({ format: "fest-compass-comparisons", version: 1, items }, null, 2); parseComparisons(raw); return raw;
}
export async function makeComparison(editions: Edition[], query: SearchContext, selection: Selection, note: string): Promise<ComparisonEvidence> {
  const copy: Edition[] = JSON.parse(JSON.stringify(editions));
  if (selection.kind === "visits") for (const e of copy) if (e.visits) e.visits.points = relativePoints(e, selection.from, selection.to).map(p => ({ date: p.date, value: p.value }));
  const payload = JSON.parse(JSON.stringify({ editions: copy, context: query, selection }));
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(payload)));
  const evidence: ComparisonEvidence = { version: 1, id: Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join(""), savedAt: new Date().toISOString(), title: copy.map(e => `${e.year} ${e.name}`).join(" · "), ...payload, note: note.slice(0,2000) };
  encodeComparisons([evidence]); return evidence;
}
export function storeComparisons(incoming: ComparisonEvidence[]) {
  const raw = localStorage.getItem(COMPARISON_KEY), items = raw ? parseComparisons(raw) : [], ids = new Set(items.map(e => e.id));
  let added = 0;
  for (const e of incoming) if (!ids.has(e.id)) { ids.add(e.id); items.push(e); added++; }
  if (items.length > 50) throw new Error("비교 근거는 이 브라우저에 50개까지 보관할 수 있습니다.");
  localStorage.setItem(COMPARISON_KEY, encodeComparisons(items)); return { items, added };
}
