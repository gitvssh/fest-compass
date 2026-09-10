import { access, appendFile, mkdir, open, readFile, unlink, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { hash, monthWindows, validateHistoryWindow, type HistoryPage } from "../lib/kto/history";
import { fetchRegionalPage, regionalDatasets } from "../lib/region/history-collection";
import { scrubSecret } from "../lib/kto/security";
const exists = (path: string) => access(path).then(() => true, () => false);
async function main() {
  const { values } = parseArgs({ options: { cache: { type: "string" }, output: { type: "string" } } });
  const key = process.env.TOUR_API_KEY?.trim();
  if (!key || !values.cache || !values.output) throw Error("invalid-arguments");
  const cache = resolve(values.cache), output = resolve(values.output), budget = 150;
  if (await exists(output)) throw Error("output-already-exists");
  await mkdir(cache, { recursive: true, mode: 0o700 });
  const lock = resolve(cache, "collector.lock"), handle = await open(lock, "wx", 0o600);
  try {
    const config = { version: 1, start: "2023-01-01", end: "2025-12-31", regions: ["44150", "45750", "52750"], pageSize: 10000, budget };
    const configPath = resolve(cache, "config.json");
    if (await exists(configPath)) { if (JSON.stringify(JSON.parse(await readFile(configPath, "utf8"))) !== JSON.stringify(config)) throw Error("cache-config-mismatch"); }
    else await writeFile(configPath, JSON.stringify(config), { flag: "wx", mode: 0o600 });
    const attempts = resolve(cache, "attempts.jsonl");
    let calls = await exists(attempts) ? (await readFile(attempts, "utf8")).trim().split("\n").filter(Boolean).length : 0;
    const windows = monthWindows(config.start, config.end), pages: HistoryPage[] = [];
    for (const window of windows) {
      let count = 1, size = config.pageSize;
      for (let pageNo = 1; pageNo <= count; pageNo++) {
        const path = resolve(cache, `${window.start}-${pageNo}.json`);
        let page: HistoryPage;
        if (await exists(path)) {
          const saved = JSON.parse(await readFile(path, "utf8"));
          if (hash(JSON.stringify(saved.page)) !== saved.checksum) throw Error("cache-checksum-mismatch");
          page = saved.page;
        } else {
          if (calls >= budget) throw Error("history-call-budget-stop");
          await appendFile(attempts, JSON.stringify({ ...window, pageNo, at: new Date().toISOString() }) + "\n", { mode: 0o600 }); calls++;
          page = JSON.parse(scrubSecret(JSON.stringify(await fetchRegionalPage({ ...window, pageNo, pageSize: size }, key)), key)) as HistoryPage;
          await writeFile(path, JSON.stringify({ page, checksum: hash(JSON.stringify(page)) }), { flag: "wx", mode: 0o600 });
          await new Promise(done => setTimeout(done, 250));
        }
        if (page.start !== window.start || page.end !== window.end || page.pageNo !== pageNo) throw Error("cache-request-mismatch");
        pages.push(page);
        if (pageNo === 1) { size = page.pageSize; count = Math.max(1, Math.ceil(page.totalCount / size)); }
      }
      validateHistoryWindow(pages.filter(p => p.start === window.start), window.start, window.end);
      console.log(`${window.start.slice(0, 7)} 전체 페이지 확인 · 누적 ${calls}/${budget}회`);
    }
    const datasets = regionalDatasets(pages, windows);
    const quality = datasets.map(d => ({ region: d.region, complete: d.points.filter(p => p.quality === "complete").length, missing: d.points.filter(p => p.quality === "missing").length, invalid: d.points.filter(p => p.quality === "invalid").length }));
    await writeFile(output, JSON.stringify({ version: 1, collectedAt: new Date().toISOString(), range: { start: config.start, end: config.end }, calls, quality, pages: pages.map(({ keys: _keys, selected: _selected, ...p }) => p), datasets }, null, 2) + "\n", { flag: "wx", mode: 0o600 });
    console.log(JSON.stringify(quality));
    if (quality.some(q => q.invalid || q.missing)) process.exitCode = 1;
  } finally { await handle.close(); await unlink(lock); }
}
main().catch((error: unknown) => { const message = error instanceof Error && /^(history-[a-z-]+|invalid-arguments|cache-[a-z-]+|output-already-exists)$/.test(error.message) ? error.message : "collection-failed"; console.error(message); process.exitCode = 1; });
