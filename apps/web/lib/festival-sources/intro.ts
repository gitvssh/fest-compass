import { join } from "node:path";
import { INTRO_FIELD_MAX, introText, type IntroText } from "../existing/festival-marks";
import { isKtoSuccessCode, parseKtoWire } from "../kto/wire";
import { ACCESS_STOP, readRegistrySnapshot, type RegistryRow, type RegistrySnapshot } from "./registry";
import { type CollectContext, isRecord, isTimestamp, koreaDay, readCurrentOrPrevious, shiftDay, writeRotating } from "./store";

// Registration introductions (KorService2/detailIntro2) of the festivals in the latest complete registry sweep:
// programme, side events, age limit and fee text only, as plain text. One call per registration, a small daily budget,
// upcoming festivals first. The web reads the store to mark festivals; nothing here judges a festival.
export const INTRO = {
  endpoint: "https://apis.data.go.kr/B551011/KorService2/detailIntro2", maxBodyChars: 400_000, storeMaxBytes: 24 * 1024 * 1024,
  maxEntries: 4_000, dailyCalls: 40, bootstrapCalls: 200, bootstrapUntilEntries: 150, refreshDays: 45, failureStreak: 3, saveEvery: 20,
} as const;

export type IntroEntry = IntroText & { contentId: string; regionCode: string; collectedAt: string; sourceModifiedAt: string | null; found: boolean };
export type IntroStore = { updatedAt: string; entries: Record<string, IntroEntry> };
export type IntroCandidate = { key: string; contentId: string; regionCode: string; modifiedAt: string | null };
const EMPTY: IntroText = { program: "", subevent: "", agelimit: "", fee: "" };
export const introKey = (regionCode: string, contentId: string) => `${regionCode}:${contentId}`;
const storePath = (dir: string) => join(dir, "intro", "current.json");

/** One registration's introduction; null when the provider answers with no introduction row. Upstream text and the key never leave. */
export async function fetchIntro(contentId: string, key: string, fetcher: typeof fetch = fetch): Promise<IntroText | null> {
  const secret = key.trim();
  if (!secret || !/^\d{1,20}$/.test(contentId)) throw new Error("intro-invalid-request");
  let decoded = secret; try { decoded = decodeURIComponent(secret); } catch { /* raw key */ }
  const url = new URL(INTRO.endpoint);
  for (const [k, v] of Object.entries({ serviceKey: decoded, MobileOS: "ETC", MobileApp: "pickDday", _type: "json", contentId, contentTypeId: "15" })) url.searchParams.set(k, v);
  let response: Response, body: string;
  try {
    response = await fetcher(url, { signal: AbortSignal.timeout(30_000), redirect: "error", cache: "no-store" });
    body = await response.text();
  } catch { throw new Error("intro-network-error"); }
  if (body.length > INTRO.maxBodyChars) throw new Error("intro-provider-error");
  const wire = parseKtoWire(body);
  if ([401, 403, 429].includes(response.status) || ACCESS_STOP.has(wire.gatewayCode ?? wire.resultCode ?? "")) throw new Error("intro-access-or-quota-stop");
  if (!response.ok || wire.gatewayCode || wire.contractError || !isKtoSuccessCode(wire.resultCode)) throw new Error("intro-provider-error");
  if (!wire.items.length) return null;
  const row = wire.items[0];
  if (wire.items.length !== 1 || String(row.contentid ?? "") !== contentId
    || (row.contenttypeid !== undefined && row.contenttypeid !== null && String(row.contenttypeid) !== "15")) throw new Error("intro-row-contract-error");
  return { program: introText(row.program, INTRO_FIELD_MAX.program), subevent: introText(row.subevent, INTRO_FIELD_MAX.subevent),
    agelimit: introText(row.agelimit, INTRO_FIELD_MAX.agelimit), fee: introText(row.usetimefestival, INTRO_FIELD_MAX.fee) };
}

const text = (v: unknown, max: number) => typeof v === "string" && v.length <= max;
export function validateIntroStore(value: unknown): IntroStore {
  if (!isRecord(value) || !isTimestamp(value.updatedAt) || !isRecord(value.entries)) throw new Error("invalid-intro-store");
  const entries = Object.entries(value.entries);
  if (entries.length > INTRO.maxEntries) throw new Error("invalid-intro-store");
  for (const [k, e] of entries) {
    if (!isRecord(e) || typeof e.contentId !== "string" || !/^\d{1,20}$/.test(e.contentId) || typeof e.regionCode !== "string" || !/^\d{5,10}$/.test(e.regionCode)
      || k !== introKey(e.regionCode, e.contentId) || !isTimestamp(e.collectedAt) || typeof e.found !== "boolean"
      || !(e.sourceModifiedAt === null || (typeof e.sourceModifiedAt === "string" && /^\d{14}$/.test(e.sourceModifiedAt)))
      || !text(e.program, INTRO_FIELD_MAX.program) || !text(e.subevent, INTRO_FIELD_MAX.subevent) || !text(e.agelimit, INTRO_FIELD_MAX.agelimit) || !text(e.fee, INTRO_FIELD_MAX.fee)
      || (!e.found && (e.program || e.subevent || e.agelimit || e.fee))) throw new Error("invalid-intro-store");
  }
  return value as IntroStore;
}
export async function readIntroStore(dir: string): Promise<IntroStore | null> {
  return readCurrentOrPrevious(storePath(dir), validateIntroStore, INTRO.storeMaxBytes);
}

/**
 * Who to read next. Only rows of a complete sweep with a verified region. Order: festivals not read yet that are
 * upcoming or undated (soonest first), then past festivals not read yet (latest first), then read ones whose
 * registration changed since, then upcoming ones read long ago, and last performances/events not read yet.
 */
export function introCandidates(snapshot: RegistrySnapshot, store: IntroStore | null, day: string): IntroCandidate[] {
  const rows = snapshot.items.filter((r): r is RegistryRow & { regionCode: string } => !!r.regionCode);
  const entry = (r: RegistryRow & { regionCode: string }) => store?.entries[introKey(r.regionCode, r.contentId)];
  const festival = (r: RegistryRow) => !r.type || r.type.startsWith("EV01"), upcoming = (r: RegistryRow) => !r.end || r.end >= day;
  const soonest = (a: RegistryRow, b: RegistryRow) => (a.start ?? "9999-12-31").localeCompare(b.start ?? "9999-12-31") || a.contentId.localeCompare(b.contentId);
  const latest = (a: RegistryRow, b: RegistryRow) => (b.end ?? "").localeCompare(a.end ?? "") || a.contentId.localeCompare(b.contentId);
  const stale = shiftDay(day, -INTRO.refreshDays);
  const tiers = [
    rows.filter(r => festival(r) && !entry(r) && upcoming(r)).sort(soonest),
    rows.filter(r => festival(r) && !entry(r) && !upcoming(r)).sort(latest),
    rows.filter(r => { const e = entry(r); return !!e && !!r.modifiedAt && e.sourceModifiedAt !== r.modifiedAt; }).sort(soonest),
    rows.filter(r => { const e = entry(r); return !!e && upcoming(r) && koreaDay(e.collectedAt) < stale; }).sort((a, b) => entry(a)!.collectedAt.localeCompare(entry(b)!.collectedAt)),
    rows.filter(r => !festival(r) && !entry(r) && upcoming(r)).sort(soonest),
  ];
  const seen = new Set<string>(), out: IntroCandidate[] = [];
  for (const r of tiers.flat()) {
    const key = introKey(r.regionCode, r.contentId);
    if (!seen.has(key)) { seen.add(key); out.push({ key, contentId: r.contentId, regionCode: r.regionCode, modifiedAt: r.modifiedAt }); }
  }
  return out;
}

/** Keep the most recently read entries within the bound. */
function bounded(store: IntroStore, now: string): IntroStore {
  const entries = Object.entries(store.entries).sort((a, b) => b[1].collectedAt.localeCompare(a[1].collectedAt) || a[0].localeCompare(b[0])).slice(0, INTRO.maxEntries);
  return { updatedAt: now, entries: Object.fromEntries(entries.sort((a, b) => a[0].localeCompare(b[0]))) };
}

export type IntroOutcome = { status: "ok" | "partial" | "idle" | "failed"; collected: number; error: string | null };
const SAFE = /^(intro|sources|invalid)-[a-z-]+$/;
/** Read introductions within the budget. A quota or access stop ends the run; three provider failures in a row end it too. */
export async function collectIntros(ctx: CollectContext): Promise<IntroOutcome> {
  const snapshot = await readRegistrySnapshot(ctx.dir);
  if (!snapshot) return { status: "failed", collected: 0, error: "intro-registry-missing" };
  let store = (await readIntroStore(ctx.dir)) ?? { updatedAt: ctx.now, entries: {} };
  let collected = 0, unsaved = 0, streak = 0, error: string | null = null;
  const save = async () => { store = bounded(store, ctx.now); await writeRotating(storePath(ctx.dir), store, validateIntroStore, INTRO.storeMaxBytes); unsaved = 0; };
  for (const c of introCandidates(snapshot, store, ctx.day)) {
    const id = `intro-${c.regionCode}-${c.contentId}`;
    if (ctx.attempts.has(id)) continue;
    if (ctx.remaining("intro") < 1 || !await ctx.spend("intro", id)) break;
    try {
      const intro = await fetchIntro(c.contentId, ctx.key, ctx.fetch);
      store.entries[c.key] = { contentId: c.contentId, regionCode: c.regionCode, collectedAt: ctx.now, sourceModifiedAt: c.modifiedAt, found: !!intro, ...(intro ?? EMPTY) };
      collected++; unsaved++; streak = 0;
      if (unsaved >= INTRO.saveEvery) await save();
    } catch (cause) {
      error = cause instanceof Error && SAFE.test(cause.message) ? cause.message : "intro-processing-failed";
      if (error === "intro-access-or-quota-stop" || ++streak >= INTRO.failureStreak) break;
    }
    await ctx.pause();
  }
  if (unsaved) await save();
  return { status: error ? (collected ? "partial" : "failed") : collected ? "ok" : "idle", collected, error };
}
