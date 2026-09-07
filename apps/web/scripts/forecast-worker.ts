import { mkdir, readFile } from "node:fs/promises";
import { join, isAbsolute } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { atomicJson, bootstrap, dueDay, nextRunAt, runDaily, validatePlan } from "../lib/forecast/daily";
import type { Request } from "../lib/forecast/prospective";

async function main() {
  const store = process.env.FORECAST_DATA_DIR;
  if (!store || !isAbsolute(store)) throw new Error("invalid-worker-directory");
  const heartbeat = join(store, "heartbeat.json");
  if (process.argv.includes("--health")) {
    const data = JSON.parse(await readFile(heartbeat, "utf8")), age = Date.now() - Date.parse(data.at);
    if (!Number.isFinite(age) || age < -60_000 || age > 180_000) throw new Error("worker-heartbeat-stale");
    return;
  }
  // The shipped shell entry point holds flock for this entire process, including bootstrap and idle time.
  if (process.env.FORECAST_WORKER_LOCKED !== "1") throw new Error("worker-lock-required");
  await mkdir(store, { recursive: true, mode: 0o700 });
  const plan = JSON.parse(await readFile(process.env.FORECAST_PLAN_PATH ?? "/app/data/forecast-plan.json", "utf8"));
  if (plan.schemaVersion !== 1) throw new Error("invalid-daily-plan");
  const requests = plan.requests as Request[]; validatePlan(requests);
  await bootstrap(store, await readFile(process.env.FORECAST_SEED_PATH ?? "/app/data/forecast-seed.json.gz"));
  const controller = new AbortController();
  process.on("SIGTERM", () => controller.abort()); process.on("SIGINT", () => controller.abort());
  let lastDate: string | null = null;
  const pulse = () => atomicJson(heartbeat, { at: new Date().toISOString(), nextRunAt: nextRunAt(new Date().toISOString()) });
  await pulse();
  const timer = setInterval(() => { void pulse().catch(() => controller.abort()); }, 30_000);
  try {
    do {
      const date = dueDay(new Date().toISOString());
      if (date && date !== lastDate) {
        const result = await runDaily(store, requests, process.env.TOUR_API_KEY ?? "");
        if (result) {
          console.log(JSON.stringify({ event: "daily-forecast", date: result.date, status: result.status, calls: result.calls, error: result.error })); lastDate = result.date;
          if (process.argv.includes("--once") && result.status === "failed") process.exitCode = 1;
        }
      }
      if (process.argv.includes("--once")) break;
      await sleep(30_000, undefined, { signal: controller.signal }).catch(() => {});
    } while (!controller.signal.aborted);
  } finally { clearInterval(timer); }
}
main().catch(() => { console.error("forecast-worker-failed; inspect the preserved daily status"); process.exitCode = 1; });
