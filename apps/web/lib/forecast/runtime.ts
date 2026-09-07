import "server-only";
import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import bundled from "../../data/nonsan-prospective-summary.json";
import { hash } from "../kto/history";
import type { publicSummary } from "./summary";
import type { DailyResult } from "./daily";
import type { TrialSummary } from "./calendar-trial";

export type RuntimeSummary = ReturnType<typeof publicSummary> & { calendarTrial?: TrialSummary | null; calendarTrialError?: string | null;
  automation?: DailyResult & { mode: "daily"; schedule: { requestId: string; start: string; horizonDays: number; dueDate: string; status: string }[] } };
export async function loadRuntimeSummary(directory = process.env.FORECAST_DATA_DIR, now = Date.now()): Promise<{ summary: RuntimeSummary; source: "bundled" | "live" | "unavailable"; workerAlive: boolean }> {
  if (!directory) return { summary: bundled as RuntimeSummary, source: "bundled", workerAlive: false };
  let workerAlive = false;
  try {
    const pulse = JSON.parse(await readFile(join(directory, "heartbeat.json"), "utf8")), age = now - Date.parse(pulse.at);
    workerAlive = Number.isFinite(age) && age >= -60_000 && age <= 180_000;
  } catch { /* The last intact data can still be shown with an explicit stopped-worker status. */ }
  try {
    const path = join(directory, "public-summary.json");
    if ((await stat(path)).size > 8 * 1024 * 1024) throw new Error("summary-too-large");
    const data = JSON.parse(await readFile(path, "utf8")), payload = data.payload as RuntimeSummary;
    if (data.schemaVersion !== 1 || hash(JSON.stringify(payload)) !== data.checksum || payload.schemaVersion !== 1
      || !Array.isArray(payload.records) || !payload.monitor?.coverage || payload.automation?.mode !== "daily"
      || !Number.isFinite(Date.parse(payload.generatedAt)) || Date.parse(payload.generatedAt) > now + 60_000) throw new Error("invalid-runtime-summary");
    return { summary: payload, source: "live", workerAlive };
  } catch { return { summary: bundled as RuntimeSummary, source: "unavailable", workerAlive }; }
}
