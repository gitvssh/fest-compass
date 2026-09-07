import { access, appendFile, mkdir, open, readFile, unlink, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { parseArgs } from "node:util";
import { fetchHistoryPage, hash, makeHistoryDataset, monthWindows, validateHistoryWindow, type HistoryPage } from "../lib/kto/history";
import { validDate } from "../lib/kto/probe";
import { scrubSecret } from "../lib/kto/security";

const exists = (path: string) => access(path).then(() => true, (e: NodeJS.ErrnoException) => { if (e.code === "ENOENT") return false; throw e; });
async function main() {
  const { values } = parseArgs({ options: { start: { type: "string" }, end: { type: "string" },
    cache: { type: "string" }, output: { type: "string" }, "max-calls": { type: "string", default: "150" } } });
  const key = process.env.TOUR_API_KEY?.trim(), start = validDate(values.start), end = validDate(values.end);
  const budget = Number(values["max-calls"]);
  if (!key || !start || !end || start > end || end >= new Date().toISOString().slice(0, 10) || !values.cache || !values.output
    || !Number.isInteger(budget) || budget < 1 || budget > 200) throw new Error("invalid-arguments");
  const windows = monthWindows(start, end);
  if (windows.length > 36) throw new Error("history-range-limit");
  const cache = resolve(values.cache), output = resolve(values.output);
  if (await exists(output)) throw new Error("output-already-exists");
  await mkdir(cache, { recursive: true, mode: 0o700 });
  const lock = resolve(cache, "collector.lock"), handle = await open(lock, "wx", 0o600);
  try {
    const configPath = resolve(cache, "config.json"), config = { version: 1, start, end, requestedPageSize: 10_000 };
    if (await exists(configPath)) {
      if (JSON.stringify(JSON.parse(await readFile(configPath, "utf8"))) !== JSON.stringify(config)) throw new Error("cache-config-mismatch");
    } else await writeFile(configPath, JSON.stringify(config), { flag: "wx", mode: 0o600 });
    const attemptsPath = resolve(cache, "attempts.jsonl");
    let calls = await exists(attemptsPath) ? (await readFile(attemptsPath, "utf8")).trim().split("\n").filter(Boolean).length : 0;
    const pages: HistoryPage[] = [];
    for (const window of windows) {
      let count = 1, size = config.requestedPageSize;
      for (let pageNo = 1; pageNo <= count; pageNo++) {
        const file = resolve(cache, `${window.start}-${window.end}-${pageNo}.json`);
        let page: HistoryPage;
        if (await exists(file)) {
          const saved = JSON.parse(await readFile(file, "utf8"));
          if (hash(JSON.stringify(saved.page)) !== saved.checksum) throw new Error("cache-checksum-mismatch");
          page = saved.page;
        } else {
          if (calls >= budget) throw new Error("history-call-budget-stop");
          // An interrupted/failed request still spends the budget. Never retry automatically.
          await appendFile(attemptsPath, JSON.stringify({ ...window, pageNo, at: new Date().toISOString() }) + "\n", { mode: 0o600 });
          calls++;
          page = await fetchHistoryPage({ ...window, pageNo, pageSize: size }, key);
          const sanitized = JSON.parse(scrubSecret(JSON.stringify(page), key)) as HistoryPage;
          await writeFile(file, JSON.stringify({ page: sanitized, checksum: hash(JSON.stringify(sanitized)) }), { flag: "wx", mode: 0o600 });
          page = sanitized;
          await new Promise((done) => setTimeout(done, 250));
        }
        if (page.start !== window.start || page.end !== window.end || page.pageNo !== pageNo) throw new Error("cache-request-mismatch");
        pages.push(page);
        if (pageNo === 1) { size = page.pageSize; count = Math.max(1, Math.ceil(page.totalCount / size)); }
        if (count > 100) throw new Error("history-page-limit");
      }
      validateHistoryWindow(pages.filter((p) => p.start === window.start), window.start, window.end);
      console.log(`${window.start.slice(0, 7)} 수집: ${count}페이지, 누적 요청 ${calls}/${budget}`);
    }
    const dataset = makeHistoryDataset(pages, start, end);
    await mkdir(dirname(output), { recursive: true });
    // One record per line: reviewable public data without national rows or credentials.
    const { days, ...metadata } = dataset;
    const serialized = JSON.stringify(metadata, null, 2).slice(0, -2) + ',\n  "days": [\n'
      + days.map((day) => "    " + JSON.stringify(day)).join(",\n") + "\n  ]\n}";
    await writeFile(output, scrubSecret(serialized, key) + "\n", { flag: "wx", mode: 0o600 });
    console.log(`자료 저장: ${dataset.quality.completeDays}/${dataset.quality.expectedDays}일, 누락 ${dataset.quality.missingDates.length}, 오류 ${dataset.quality.invalidDates.length}`);
    if (dataset.quality.completeDays !== dataset.quality.expectedDays) process.exitCode = 1;
  } finally { await handle.close(); await unlink(lock); }
}
main().catch((error: unknown) => {
  // Only our fixed error codes are printable; never emit provider text, URLs or arbitrary filesystem errors.
  const code = error instanceof Error && /^(history-[a-z-]+|invalid-arguments|output-already-exists|cache-[a-z-]+)$/.test(error.message) ? error.message : "collection-failed";
  console.error(`수집 중단: ${code}. 캐시에 완료된 페이지를 보존했습니다. 같은 인수로 재개할 수 있습니다.`);
  process.exitCode = 1;
});
