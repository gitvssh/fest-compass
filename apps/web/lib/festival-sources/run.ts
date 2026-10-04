import { mkdir } from "node:fs/promises";
import { isAbsolute, join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { collectIntros, INTRO, readIntroStore } from "./intro";
import { collectNational, readNationalMonths } from "./national";
import { collectRegistry, readRegistrySnapshot, registrationCount } from "./registry";
import { type Attempt, AttemptLog, type CollectContext, acquireLock, checkStorage, isRecord, isTimestamp, koreaDay, pruneDays, readVerified, writeChecked } from "./store";

/**
 * Standard daily run: at most 30 official calls per Korea day (registry sweep 18, district months 12).
 * Backfill: at most 180 calls per run, and at most 162 district calls per Korea day (resumable).
 */
export const RUN_LIMITS = { standardMaxCalls: 30, backfillMaxCalls: 180, registryMaxCalls: 18, backfillNationalDailyCalls: 162 } as const;
export type RunOptions = { now?: string; backfill?: boolean; maxCalls?: number; fetch?: typeof fetch; pauseMs?: number };
export type RunResult = { status: "success" | "partial" | "failed"; calls: number; regions: number; registrations: number; national: string; registry: string };

const SAFE = /^(history|national|registry|intro|sources|invalid)-[a-z-]+$/;
export const safeError = (error: unknown) => error instanceof Error && SAFE.test(error.message) ? error.message : "sources-processing-failed";

async function summary(dir: string) {
  const months = await readNationalMonths(dir).catch(() => []), codes = new Set<string>();
  for (const m of months) for (const [code, values] of Object.entries(m.series)) if (values.some(v => v !== null)) codes.add(code);
  return { regions: codes.size, registrations: registrationCount(await readRegistrySnapshot(dir).catch(() => null)) };
}

/**
 * Collect both official sources into `dir`. Each source fails independently and keeps its last valid data. Every
 * call is logged (Korea day + request id) before it is sent and never resent that day. Results carry fixed codes only.
 */
export async function runFestivalSources(dir: string, key: string, options: RunOptions = {}): Promise<RunResult> {
  const now = options.now ?? new Date().toISOString(), mode: Attempt["mode"] = options.backfill ? "backfill" : "standard";
  const cap = options.backfill ? RUN_LIMITS.backfillMaxCalls : RUN_LIMITS.standardMaxCalls, limit = options.maxCalls ?? cap;
  if (!isAbsolute(dir) || !isTimestamp(now) || !Number.isSafeInteger(limit) || limit < 0 || limit > cap) {
    return { status: "failed", calls: 0, regions: 0, registrations: 0, national: "invalid-options", registry: "invalid-options" };
  }
  if (!key.trim()) return { status: "failed", calls: 0, ...await summary(dir), national: "sources-key-missing", registry: "sources-key-missing" };
  const day = koreaDay(now), registryRun = Math.min(RUN_LIMITS.registryMaxCalls, Math.floor(limit * 0.6)), nationalRun = limit - registryRun;
  const standardNationalDaily = RUN_LIMITS.standardMaxCalls - RUN_LIMITS.registryMaxCalls;
  await mkdir(dir, { recursive: true, mode: 0o700 });
  const release = await acquireLock(dir).catch(() => null);
  if (!release) return { status: "failed", calls: 0, ...await summary(dir), national: "sources-locked", registry: "sources-locked" };
  const used: Record<Attempt["source"], number> = { national: 0, registry: 0, intro: 0 };
  let national = "sources-processing-failed", registry = "sources-processing-failed", nationalOk = false, nationalPartial = false, registryOk = false;
  try {
    for (const sub of [["national", "months"], ["registry"], ["pages", day]]) await mkdir(join(dir, ...sub), { recursive: true, mode: 0o700 });
    await pruneDays(dir, day);
    await checkStorage(dir);
    const attempts = await AttemptLog.open(dir, day);
    const remaining = (source: Attempt["source"]) => source === "intro" ? 0 : source === "registry"
      ? Math.max(0, Math.min(registryRun - used.registry, RUN_LIMITS.registryMaxCalls - attempts.count(a => a.source === "registry")))
      : Math.max(0, Math.min(nationalRun - used.national, RUN_LIMITS.backfillNationalDailyCalls - attempts.count(a => a.source === "national"), mode === "backfill" ? RUN_LIMITS.backfillNationalDailyCalls - attempts.count(a => a.source === "national" && a.mode === "backfill")
        : standardNationalDaily - attempts.count(a => a.source === "national" && a.mode === "standard")));
    const ctx: CollectContext = { dir, day, now, key, fetch: options.fetch ?? fetch, attempts, remaining,
      pause: () => sleep(options.pauseMs ?? 250),
      spend: async (source, id) => {
        if (attempts.has(id) || remaining(source) < 1) return false;
        await attempts.record({ id, source, mode, at: new Date().toISOString() });
        used[source]++;
        return true;
      } };
    try { const r = await collectRegistry(ctx); registry = r.status; registryOk = true; } catch (cause) { registry = safeError(cause); }
    try {
      await checkStorage(dir);
      const r = await collectNational(ctx, mode, safeError);
      national = r.status === "partial" ? `partial:${r.error}` : r.error ?? r.status;
      nationalOk = r.status === "ok" || r.status === "fresh"; nationalPartial = r.status === "partial";
    } catch (cause) { national = safeError(cause); }
  } catch (cause) { national = registry = safeError(cause); }
  finally { await release(); }
  const status: RunResult["status"] = nationalOk && registryOk ? "success" : nationalOk || nationalPartial || registryOk ? "partial" : "failed";
  const result: RunResult = { status, calls: used.national + used.registry, ...await summary(dir), national, registry };
  await writeChecked(join(dir, "status.json"), { day, completedAt: new Date().toISOString(), mode, ...result }).catch(() => undefined);
  return result;
}

export type IntroRunOptions = { now?: string; maxCalls?: number; fetch?: typeof fetch; pauseMs?: number };
export type IntroRunResult = { status: "success" | "partial" | "idle" | "failed"; calls: number; collected: number; entries: number; intro: string };
/**
 * Read registration introductions after the daily sweep, under the same kernel lock. Its own daily attempt log and budget:
 * the first days (few entries) up to INTRO.bootstrapCalls, afterwards INTRO.dailyCalls. Fixed result codes only.
 */
export async function runFestivalIntros(dir: string, key: string, options: IntroRunOptions = {}): Promise<IntroRunResult> {
  const now = options.now ?? new Date().toISOString();
  const entries = async () => Object.keys((await readIntroStore(dir).catch(() => null))?.entries ?? {}).length;
  if (!isAbsolute(dir) || !isTimestamp(now) || (options.maxCalls !== undefined && (!Number.isSafeInteger(options.maxCalls) || options.maxCalls < 0))) {
    return { status: "failed", calls: 0, collected: 0, entries: 0, intro: "invalid-options" };
  }
  if (!key.trim()) return { status: "failed", calls: 0, collected: 0, entries: await entries(), intro: "sources-key-missing" };
  const day = koreaDay(now);
  await mkdir(join(dir, "intro"), { recursive: true, mode: 0o700 });
  const release = await acquireLock(dir).catch(() => null);
  if (!release) return { status: "failed", calls: 0, collected: 0, entries: await entries(), intro: "sources-locked" };
  let calls = 0, result: IntroRunResult;
  try {
    await checkStorage(dir);
    const attempts = await AttemptLog.open(dir, day, "intro");
    const cap = (await entries()) < INTRO.bootstrapUntilEntries ? INTRO.bootstrapCalls : INTRO.dailyCalls;
    const limit = Math.min(cap, options.maxCalls ?? cap);
    const remaining = (source: Attempt["source"]) => source !== "intro" ? 0 : Math.max(0, Math.min(limit - calls, cap - attempts.count(a => a.source === "intro")));
    const ctx: CollectContext = { dir, day, now, key, fetch: options.fetch ?? fetch, attempts, remaining,
      pause: () => sleep(options.pauseMs ?? 250),
      spend: async (source, id) => {
        if (source !== "intro" || attempts.has(id) || remaining(source) < 1) return false;
        await attempts.record({ id, source, mode: "standard", at: new Date().toISOString() });
        calls++;
        return true;
      } };
    const outcome = await collectIntros(ctx);
    result = { status: outcome.status === "ok" ? "success" : outcome.status, calls, collected: outcome.collected, entries: await entries(), intro: outcome.error ?? outcome.status };
  } catch (cause) {
    result = { status: "failed", calls, collected: 0, entries: await entries(), intro: safeError(cause) };
  } finally { await release(); }
  await writeChecked(join(dir, "intro-status.json"), { day, completedAt: new Date().toISOString(), ...result }).catch(() => undefined);
  return result;
}

