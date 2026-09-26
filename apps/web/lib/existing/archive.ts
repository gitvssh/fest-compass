import { day, type Dataset } from "../region/model";
import { regionByCode } from "./identity";
import type { DataFreshness } from "./types";

// Visit-archive composition: reviewed bundles + the validated runtime regional daily snapshot.
// The reader is injected so the policy is testable without files; lineage (snapshot ids) stays internal.
export type RuntimeRead = { kind: "not-configured" } | { kind: "ok"; datasets: Dataset[] };
/**
 * `freshness` is the loader-wide state; responses must use `scopedFreshness()`. `runtime`/`runtimeRegions` are
 * internal: the runtime rows in use and the districts the runtime collector covers (targets + validated rows).
 */
export type ArchiveState = { datasets: Dataset[]; freshness: DataFreshness; runtime: Dataset[]; runtimeRegions: string[]; byRegion?: Record<string, DataFreshness> };
export type ArchiveLoaderOptions = { bundles: Dataset[]; readRuntime: () => Promise<RuntimeRead>; runtimeTargets?: string[]; now?: () => number; successMs?: number; failureMs?: number };

const QUALITIES = new Set(["complete", "missing", "invalid"]);
/** A runtime snapshot is merged only if every row is well-formed, for a catalogue region, and not collected in the future. */
export function validRuntimeDataset(d: Dataset, nowMs: number): boolean {
  const region = d && d.region ? regionByCode(String(d.region.code)) : null, at = Date.parse(d?.collectedAt ?? "");
  if (!region || region.districtName !== d.region.name || typeof d.snapshotId !== "string" || !d.snapshotId || !Number.isFinite(at) || at > nowMs + 60_000) return false;
  if (!Array.isArray(d.points) || !d.points.length) return false;
  const dates = new Set<string>();
  for (const p of d.points) {
    if (!p || !day(p.date) || dates.has(p.date) || !QUALITIES.has(p.quality)) return false;
    dates.add(p.date);
    if (p.collectedAt !== undefined && (!Number.isFinite(Date.parse(p.collectedAt)) || Date.parse(p.collectedAt) > at)) return false;
    if (p.value !== null && !(typeof p.value === "number" && Number.isFinite(p.value) && p.value >= 0)) return false;
    if (p.quality === "complete" && p.value === null) return false;
  }
  return true;
}
const newest = (list: Dataset[]) => list.map(d => d.collectedAt).filter(v => Number.isFinite(Date.parse(v))).sort().at(-1) ?? null;
const newestTime = (list: (string | null)[]) => list.filter((v): v is string => !!v && Number.isFinite(Date.parse(v))).sort().at(-1) ?? null;

/**
 * Freshness for the districts a response is about. `collected` = source times of the observations actually used
 * (null: every row of those districts). Runtime mode/refresh apply only to districts the runtime collector covers;
 * other districts are archive-only with their own bundle times.
 */
export function scopedFreshness(state: ArchiveState, codes: string[], collected: (string | null)[] | null = null): DataFreshness {
  if (state.byRegion) {
    const candidates = codes.map(c => state.byRegion?.[c]).filter((f): f is DataFreshness => !!f);
    const selected = candidates.sort((a, b) => (b.collectedAt ?? "").localeCompare(a.collectedAt ?? ""))[0];
    if (selected) return { ...selected, collectedAt: newestTime(collected ?? state.datasets.filter(d => codes.includes(d.region.code)).map(d => d.collectedAt)), refresh: { ...selected.refresh } };
  }
  const inScope = (d: Dataset) => codes.includes(d.region.code);
  const collectedAt = newestTime(collected ?? state.datasets.filter(inScope).map(d => d.collectedAt));
  if (!codes.some(c => state.runtimeRegions.includes(c))) return { mode: "archive-only", collectedAt, runtimeCollectedAt: null, refresh: { status: "not-configured", retryable: false } };
  return { mode: state.freshness.mode, collectedAt, runtimeCollectedAt: newest(state.runtime.filter(inScope)), refresh: { ...state.freshness.refresh } };
}

/** Independent sources keep their own failures and collection times; one collector cannot erase another. */
export function combineArchiveStates(states: ArchiveState[]): ArchiveState {
  const datasets = states.flatMap(s => s.datasets), codes = [...new Set(datasets.map(d => d.region.code))];
  const byRegion: Record<string, DataFreshness> = {};
  for (const code of codes) {
    const candidates = states.filter(s => s.datasets.some(d => d.region.code === code)).map(s => scopedFreshness(s, [code]));
    byRegion[code] = candidates.sort((a, b) => (b.collectedAt ?? "").localeCompare(a.collectedAt ?? ""))[0];
  }
  return { datasets, runtime: states.flatMap(s => s.runtime), runtimeRegions: [...new Set(states.flatMap(s => s.runtimeRegions))],
    freshness: states[0].freshness, byRegion };
}

/**
 * - not configured: bundles only ("archive-only"), not a failure.
 * - success: bundles + runtime ("runtime"); that snapshot becomes the last validated one.
 * - failure/invalid: keep the last validated snapshot ("runtime-stale") or bundles alone ("archive-fallback");
 *   invalid new data is never merged or retained. Success is cached briefly, failure shorter.
 */
export function createArchiveLoader(o: ArchiveLoaderOptions): () => Promise<ArchiveState> {
  const now = o.now ?? Date.now, successMs = o.successMs ?? 60_000, failureMs = o.failureMs ?? 30_000;
  let lastGood: Dataset[] | null = null, cache: { expires: number; value: Promise<ArchiveState> } | null = null;
  const state = (runtime: Dataset[] | null, mode: DataFreshness["mode"], refresh: DataFreshness["refresh"]["status"]): ArchiveState => {
    const datasets = [...o.bundles, ...(runtime ?? [])];
    const runtimeRegions = mode === "archive-only" ? [] : [...new Set([...(o.runtimeTargets ?? []), ...(runtime ?? []).map(d => d.region.code)])];
    return { datasets, runtime: runtime ?? [], runtimeRegions,
      freshness: { mode, collectedAt: newest(datasets), runtimeCollectedAt: runtime ? newest(runtime) : null, refresh: { status: refresh, retryable: refresh === "failed" } } };
  };
  return () => {
    if (cache && cache.expires > now()) return cache.value;
    const entry: { expires: number; value: Promise<ArchiveState> } = { expires: Number.POSITIVE_INFINITY, value: Promise.resolve(null as never) };
    entry.value = (async () => {
      try {
        const read = await o.readRuntime();
        if (read.kind === "not-configured") { lastGood = null; entry.expires = now() + successMs; return state(null, "archive-only", "not-configured"); }
        if (!read.datasets.length || !read.datasets.every(d => validRuntimeDataset(d, now()))) throw new Error("invalid-runtime");
        lastGood = read.datasets; entry.expires = now() + successMs;
        return state(lastGood, "runtime", "ok");
      } catch {
        entry.expires = now() + failureMs;
        return lastGood ? state(lastGood, "runtime-stale", "failed") : state(null, "archive-fallback", "failed");
      }
    })();
    cache = entry; return entry.value;
  };
}
