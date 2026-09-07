import { readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { hash } from "../lib/kto/history";
import { verifyStore } from "../lib/forecast/store";
import type { Seed } from "../lib/forecast/daily";

async function main() {
  const store = "../../docs/validation/evidence/prospective", verified = await verifyStore(store), files: Seed["files"] = [];
  for (const directory of ["snapshots", "forecasts", "assessments"]) for (const name of (await readdir(join(store, directory))).filter((f) => f.endsWith(".json")).sort()) {
    const path = `${directory}/${name}`, content = await readFile(join(store, path), "utf8");
    files.push({ path, content, hash: hash(content) });
  }
  await writeFile("data/forecast-seed.json.gz", gzipSync(JSON.stringify({ schemaVersion: 1, files })), { flag: "wx" });
  console.log(JSON.stringify({ forecasts: verified.receipts.length, assessments: verified.assessments.length, files: files.length }));
}
main().catch(() => { console.error("forecast-seed-build-failed"); process.exitCode = 1; });
