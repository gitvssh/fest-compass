import { mkdir, readFile } from "node:fs/promises";
import { isAbsolute, join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { atomicJson } from "../lib/forecast/daily";
import { runFestivalSources } from "../lib/festival-sources";

async function main() {
  const dir = process.env.SOURCE_DATA_DIR;
  if (!dir || !isAbsolute(dir)) throw Error("source-directory-required");
  const heartbeat = join(dir, "worker-heartbeat.json");
  if (process.argv.includes("--health")) {
    const h = JSON.parse(await readFile(heartbeat, "utf8")), age = Date.now() - Date.parse(h.at);
    if (!Number.isFinite(age) || age < -60000 || age > 180000) throw Error("source-worker-stale");
    return;
  }
  if (process.env.SOURCE_WORKER_LOCKED !== "1") throw Error("source-lock-required");
  await mkdir(dir, { recursive: true, mode: 0o700 });
  const stop = new AbortController();
  process.on("SIGTERM", () => stop.abort()); process.on("SIGINT", () => stop.abort());
  const pulse = () => atomicJson(heartbeat, { at: new Date().toISOString() });
  await pulse();
  const timer = setInterval(() => { void pulse().catch(() => stop.abort()); }, 30000);
  let attemptedDay = "";
  try {
    do {
      const day = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
      if (attemptedDay !== day) {
        attemptedDay = day;
        try {
          let bootstrapped = false;
          try { bootstrapped = JSON.parse(await readFile(join(dir, "bootstrap-complete.json"), "utf8")).version === 1; } catch { /* First collection resumes from the source store. */ }
          const result = await runFestivalSources(dir, process.env.TOUR_API_KEY ?? "", { backfill: !bootstrapped, maxCalls: bootstrapped ? 30 : 180 });
          console.log(JSON.stringify({ event: "festival-sources", day, ...result }));
          if (!bootstrapped && result.status === "success") await atomicJson(join(dir, "bootstrap-complete.json"), { version: 1, at: new Date().toISOString() });
          if (!bootstrapped) {
            const recent = await runFestivalSources(dir, process.env.TOUR_API_KEY ?? "", { maxCalls: 30 });
            console.log(JSON.stringify({ event: "festival-sources-recent", day, ...recent }));
          }
          if (result.status === "failed") process.exitCode = process.argv.includes("--once") ? 1 : undefined;
        } catch { console.error("festival-source-refresh-failed"); if (process.argv.includes("--once")) process.exitCode = 1; }
      }
      if (process.argv.includes("--once")) break;
      await sleep(30000, undefined, { signal: stop.signal }).catch(() => {});
    } while (!stop.signal.aborted);
  } finally { clearInterval(timer); }
}
main().catch(() => { console.error("festival-source-worker-failed"); process.exitCode = 1; });
