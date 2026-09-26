import { createHash, randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdir, open, readFile, readdir, rename, rm, stat, statfs, unlink } from "node:fs/promises";
import { join } from "node:path";

// Durable, bounded file store for the festival source collector. Every payload is wrapped in a checksum envelope;
// a replaced file keeps its last valid version as `<name>.prev.json`, so a reader always finds one valid copy.
// Readers never write. Error messages are fixed codes: no paths, URLs, keys or upstream text.
export const STORE_LIMITS = { maxStoredBytes: 128 * 1024 * 1024, minFreeBytes: 64 * 1024 * 1024, attemptRetentionDays: 40 } as const;
export const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");
export const koreaDay = (timestamp: string) => new Date(Date.parse(timestamp) + 9 * 3_600_000).toISOString().slice(0, 10);
export const shiftDay = (day: string, delta: number) => new Date(Date.parse(`${day}T00:00:00Z`) + delta * 86_400_000).toISOString().slice(0, 10);
export const isTimestamp = (value: unknown): value is string => typeof value === "string" && /^\d{4}-\d\d-\d\dT[\d:.]+Z$/.test(value) && Number.isFinite(Date.parse(value));
export const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);

const previousPath = (path: string) => path.replace(/\.json$/, ".prev.json");
const missing = (error: unknown) => (error as NodeJS.ErrnoException)?.code === "ENOENT";

async function writeAtomic(path: string, text: string) {
  const temporary = `${path}.${randomUUID()}.tmp`, file = await open(temporary, "wx", 0o600);
  try { await file.writeFile(text); await file.sync(); } finally { await file.close(); }
  await rename(temporary, path);
}

/** Null when absent or invalid (size, JSON, checksum or `validate` failure); other IO errors propagate. */
export async function readVerified<T>(path: string, validate: (payload: unknown) => T, maxBytes: number): Promise<T | null> {
  let text: string;
  try {
    if ((await stat(path)).size > maxBytes) return null;
    text = await readFile(path, "utf8");
  } catch (error) { if (missing(error)) return null; throw error; }
  try {
    const envelope = JSON.parse(text);
    if (!isRecord(envelope) || envelope.schemaVersion !== 1 || typeof envelope.checksum !== "string"
      || sha256(JSON.stringify(envelope.payload)) !== envelope.checksum) return null;
    return validate(envelope.payload);
  } catch { return null; }
}

/** The current file if valid, else its preserved previous version, else null. */
export async function readCurrentOrPrevious<T>(path: string, validate: (payload: unknown) => T, maxBytes: number): Promise<T | null> {
  return (await readVerified(path, validate, maxBytes)) ?? readVerified(previousPath(path), validate, maxBytes);
}

/**
 * Replace `path` with a validated payload. A valid current file first becomes the previous version; an invalid one is
 * overwritten without touching the preserved previous version. Between the two renames readers fall back to previous.
 */
export async function writeRotating<T>(path: string, payload: T, validate: (payload: unknown) => T, maxBytes: number) {
  validate(JSON.parse(JSON.stringify(payload)));
  const text = `${JSON.stringify({ schemaVersion: 1, checksum: sha256(JSON.stringify(payload)), payload })}\n`;
  if (Buffer.byteLength(text) > maxBytes) throw new Error("sources-file-too-large");
  if (await readVerified(path, validate, maxBytes) !== null) await rename(path, previousPath(path));
  await writeAtomic(path, text);
}

/** Transient single-version file (page caches, counters). */
export async function writeChecked(path: string, payload: unknown) {
  await writeAtomic(path, `${JSON.stringify({ schemaVersion: 1, checksum: sha256(JSON.stringify(payload)), payload })}\n`);
}

async function storedBytes(directory: string): Promise<number> {
  let total = 0;
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) throw new Error("sources-store-symlink");
    total += entry.isDirectory() ? await storedBytes(join(directory, entry.name)) : (await stat(join(directory, entry.name))).size;
  }
  return total;
}
export async function checkStorage(dir: string) {
  const usage = await storedBytes(dir), fs = await statfs(dir);
  if (usage > STORE_LIMITS.maxStoredBytes || fs.bavail * fs.bsize < STORE_LIMITS.minFreeBytes) throw new Error("sources-storage-limit");
}

/** Kernel lock: closing the pipe on exit/crash releases it, including across container restarts. */
export async function acquireLock(dir: string): Promise<() => Promise<void>> {
  const child = spawn("flock", ["-n", "-E", "75", join(dir, "run.lock"), "sh", "-c", "printf 'locked\\n'; cat >/dev/null"], { stdio: ["pipe", "pipe", "ignore"] });
  const exited = new Promise<void>(resolve => { child.once("exit", () => resolve()); child.once("error", () => resolve()); });
  child.stdin.on("error", () => {});
  await new Promise<void>((resolve, reject) => {
    let ready = false;
    child.stdout.once("data", () => { ready = true; resolve(); });
    child.once("error", () => reject(Error("sources-locked")));
    child.once("exit", () => { if (!ready) reject(Error("sources-locked")); });
  });
  return async () => { child.stdin.end(); await exited; };
}

export type Attempt = { id: string; source: "national" | "registry"; mode: "standard" | "backfill"; at: string };
/** What a source collector may use: the day's attempt log and a budget that records each call before it is sent. */
export type CollectContext = {
  dir: string; day: string; now: string; key: string; fetch: typeof fetch; attempts: AttemptLog;
  spend: (source: Attempt["source"], id: string) => Promise<boolean>; remaining: (source: Attempt["source"]) => number; pause: () => Promise<void>;
};
/**
 * Append-only attempt log per Korea day. An attempt is written and synced before its request is sent, so a crash never
 * hides a spent call; a request id attempted today is never sent again today. An unreadable log stops all requests.
 */
export class AttemptLog {
  private constructor(private readonly path: string, readonly entries: Attempt[]) {}
  static async open(dir: string, day: string): Promise<AttemptLog> {
    const directory = join(dir, "attempts"), path = join(directory, `${day}.jsonl`);
    await mkdir(directory, { recursive: true, mode: 0o700 });
    let text = "";
    try { text = await readFile(path, "utf8"); } catch (error) { if (!missing(error)) throw error; }
    const entries: Attempt[] = [];
    for (const line of text.split("\n").filter(Boolean)) {
      let value: unknown;
      try { value = JSON.parse(line); } catch { throw new Error("sources-attempt-log-corrupt"); }
      if (!isRecord(value) || typeof value.id !== "string" || !["national", "registry"].includes(String(value.source))
        || !["standard", "backfill"].includes(String(value.mode)) || !isTimestamp(value.at)) throw new Error("sources-attempt-log-corrupt");
      entries.push(value as Attempt);
    }
    return new AttemptLog(path, entries);
  }
  has(id: string) { return this.entries.some(a => a.id === id); }
  count(filter: (a: Attempt) => boolean) { return this.entries.filter(filter).length; }
  async record(attempt: Attempt) {
    const handle = await open(this.path, "a", 0o600);
    try { await handle.writeFile(`${JSON.stringify(attempt)}\n`); await handle.sync(); } finally { await handle.close(); }
    this.entries.push(attempt);
  }
}

/** Remove page caches of other days, attempt logs past retention and orphaned temporaries. Only names this module writes. */
export async function pruneDays(dir: string, day: string) {
  const pages = join(dir, "pages");
  for (const name of await readdir(pages).catch(() => [] as string[])) if (/^\d{4}-\d{2}-\d{2}$/.test(name) && name !== day) await rm(join(pages, name), { recursive: true, force: true });
  const oldest = shiftDay(day, -STORE_LIMITS.attemptRetentionDays);
  for (const name of await readdir(join(dir, "attempts")).catch(() => [] as string[])) {
    const match = /^(\d{4}-\d{2}-\d{2})\.jsonl$/.exec(name);
    if (match && match[1] < oldest) await unlink(join(dir, "attempts", name)).catch(() => undefined);
  }
  // Callers hold the run lock, so no writer owns these temporaries.
  for (const directory of [dir, join(dir, "national"), join(dir, "national", "months"), join(dir, "registry"), join(pages, day)]) {
    for (const name of await readdir(directory).catch(() => [] as string[])) {
      if (/\.json\.[0-9a-f-]{36}\.tmp$/.test(name)) await unlink(join(directory, name)).catch(() => undefined);
    }
  }
}
