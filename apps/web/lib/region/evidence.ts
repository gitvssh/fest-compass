import { day, parseQuery, SOURCE, HISTORY_SOURCE } from "./model";
import type { Evidence, RegionResult } from "./types";
export const EVIDENCE_KEY = "fest-compass.region-evidence.v1";
export const HOME_REGION_KEY = "fest-compass.home-region.v1";
export const MAX_EVIDENCE_BYTES = 2_000_000;
export async function makeEvidence(result: RegionResult, selection: Evidence["selection"], note: string): Promise<Evidence> {
  const snapshot: RegionResult = JSON.parse(JSON.stringify(result));
  snapshot.resources.items = "resourceId" in selection ? snapshot.resources.items.filter(r => r.id === selection.resourceId) : [];
  snapshot.history.points = "dates" in selection ? snapshot.history.points.filter(p => selection.dates.includes(p.date)) : [];
  if ("resourceId" in selection && snapshot.resources.items.length !== 1) throw new Error("먼저 자료를 선택하세요.");
  if ("dates" in selection && !snapshot.history.points.some(p => p.value !== null)) throw new Error("보관할 관측값이 없습니다.");
  const title = "resourceId" in selection ? snapshot.resources.items[0].title : `${result.region.districtName} · 일별 외지인 방문`;
  const content = JSON.stringify({ result: snapshot, selection });
  const id = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(content)))).map(b => b.toString(16).padStart(2, "0")).join("");
  return { version: 1, id, savedAt: new Date().toISOString(), title, result: snapshot, selection, note: note.slice(0, 2000) };
}
export function parseEvidence(raw: string): Evidence[] {
  if (new TextEncoder().encode(raw).length > MAX_EVIDENCE_BYTES) throw new Error("근거 파일은 2MB 이하여야 합니다.");
  try {
    const value = JSON.parse(raw);
    if (value.version !== 1 || !Array.isArray(value.items) || value.items.length > 50) throw new Error();
    const text = (v: unknown, max = 500) => typeof v === "string" && v.length <= max;
    for (const e of value.items) {
      if (e.version !== 1 || !/^[a-f0-9]{64}$/.test(e.id) || !text(e.savedAt, 30) || !Number.isFinite(Date.parse(e.savedAt)) || !text(e.title) || !text(e.note, 2000)) throw new Error();
      const r = e.result; parseQuery(new URLSearchParams(r.query));
      if (!r.region || r.region.provinceCode !== r.query.province || r.region.districtCode !== r.query.district || !text(r.region.provinceName) || !text(r.region.districtName)) throw new Error();
      if (r.resources.source !== SOURCE || r.history.source !== HISTORY_SOURCE || !text(r.resources.message, 2000) || !text(r.history.message, 2000) || !text(r.history.unit) || !text(r.history.metric)) throw new Error();
      if (!Number.isFinite(Date.parse(r.resources.collectedAt)) || !["complete", "empty", "unavailable"].includes(r.resources.status) || !["available", "unavailable"].includes(r.history.status)) throw new Error();
      if (!Array.isArray(r.resources.items) || r.resources.items.length > 1 || !Array.isArray(r.history.points) || r.history.points.length > 366) throw new Error();
      for (const p of r.history.points) if (!day(p.date) || p.date < r.query.start || p.date > r.query.end || !(p.value === null || (typeof p.value === "number" && Number.isFinite(p.value) && p.value >= 0)) || !text(p.quality) || !(p.snapshotId === null || /^[a-f0-9]{64}$/.test(p.snapshotId)) || !(p.collectedAt === null || Number.isFinite(Date.parse(p.collectedAt)))) throw new Error();
      for (const a of r.resources.items) if (!/^\d+$/.test(a.id) || !text(a.title) || !text(a.address) || ![a.longitude, a.latitude].every(n => n === null || (typeof n === "number" && Number.isFinite(n))) || ![a.start, a.end].every(d => d === null || day(d)) || !(a.modifiedAt === null || /^\d{14}$/.test(a.modifiedAt))) throw new Error();
      if (!e.selection || ("resourceId" in e.selection ? r.resources.items.length !== 1 || e.selection.resourceId !== r.resources.items[0].id || r.history.points.length !== 0 : !Array.isArray(e.selection.dates) || e.selection.dates.length !== r.history.points.length || !r.history.points.every((p: { date: string }, i: number) => p.date === e.selection.dates[i]) || r.resources.items.length !== 0)) throw new Error();
      if (e.selection.mapBounds && (!Array.isArray(e.selection.mapBounds) || e.selection.mapBounds.length !== 4 || !e.selection.mapBounds.every((n: unknown) => typeof n === "number" && Number.isFinite(n)))) throw new Error();
    }
    if (new Set(value.items.map((e: Evidence) => e.id)).size !== value.items.length) throw new Error();
    return value.items as Evidence[];
  } catch { throw new Error("지원하지 않거나 손상된 근거 파일입니다. 기존 근거는 유지됩니다."); }
}
export function encodeEvidence(items: Evidence[]): string { const raw = JSON.stringify({ version: 1, items }, null, 2); parseEvidence(raw); return raw; }
export function storeEvidence(incoming: Evidence[]): { items: Evidence[]; added: number } {
  // Read immediately before writing, so another tab's recent additions are preserved.
  const raw = localStorage.getItem(EVIDENCE_KEY), items = raw ? parseEvidence(raw) : [], ids = new Set(items.map(e => e.id));
  let added = 0; for (const item of incoming) if (!ids.has(item.id)) { ids.add(item.id); items.push(item); added++; }
  if (items.length > 50) throw new Error("이 브라우저에는 근거 50개까지 보관할 수 있습니다.");
  localStorage.setItem(EVIDENCE_KEY, encodeEvidence(items)); return { items, added };
}
