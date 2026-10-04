import { isAbsolute, join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { runFestivalIntros, runFestivalSources } from "../lib/festival-sources";

// Collect official festival sources into the persisted store. The key comes only from TOUR_API_KEY; output is one line
// of fixed status codes and counts (never the key, request URLs or upstream text). No git, publish or deploy steps.
async function main() {
  const { values } = parseArgs({ options: { dir: { type: "string" }, backfill: { type: "boolean", default: false }, intro: { type: "boolean", default: false }, "max-calls": { type: "string" } } });
  const fallback = process.env.SOURCE_DATA_DIR || (process.env.FORECAST_DATA_DIR ? join(process.env.FORECAST_DATA_DIR, "festival-sources") : "");
  const dir = values.dir ? resolve(values.dir) : fallback;
  const maxCalls = values["max-calls"] === undefined ? undefined : /^\d{1,3}$/.test(values["max-calls"]) ? Number(values["max-calls"]) : NaN;
  if (!dir || !isAbsolute(dir) || Number.isNaN(maxCalls) || (values.intro && values.backfill)) throw new Error("invalid-arguments");
  if (values.intro) {
    // Registration introductions only, within their own daily budget (the same lock and attempt rules).
    const intros = await runFestivalIntros(dir, process.env.TOUR_API_KEY ?? "", { maxCalls });
    console.log(JSON.stringify({ event: "festival-intros", ...intros }));
    if (intros.status === "failed") process.exitCode = 1;
    return;
  }
  const result = await runFestivalSources(dir, process.env.TOUR_API_KEY ?? "", { backfill: values.backfill, maxCalls });
  console.log(JSON.stringify({ event: "festival-sources", mode: values.backfill ? "backfill" : "standard", ...result }));
  if (result.status === "failed") process.exitCode = 1;
}
main().catch((error: unknown) => {
  console.error(error instanceof Error && error.message === "invalid-arguments" ? "invalid-arguments" : "festival-sources-failed");
  process.exitCode = 1;
});
