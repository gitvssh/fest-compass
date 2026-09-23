import test from "node:test";
import assert from "node:assert/strict";
import bundled from "../../data/region-history.json";
import expanded from "../../data/regional-history-expanded.json";
import type { Dataset } from "../region/model";
import { createArchiveLoader, validRuntimeDataset, type RuntimeRead } from "./archive";
import { parseFestivalSearch, parseHistory } from "./request";
import { createExistingService } from "./server";
import type { TourCall } from "./tour";

const bundles: Dataset[] = [...bundled, ...expanded.datasets];
const BUNDLE_NEWEST = "2026-09-10T09:15:37.552Z"; // original collection time of the expanded archive
const NONSAN_BUNDLE = "2026-09-07T09:27:51.234Z"; // newest original Nonsan bundle collection (2025-12..2026-09 file)
const GONGJU_IMSIL_BUNDLE = BUNDLE_NEWEST;       // Gongju/Imsil come only from the expanded archive
const noTour: TourCall = async () => { throw new Error("no tour in history tests"); };
const q = (s: string) => parseHistory(new URLSearchParams(s));
// A runtime snapshot re-collected for Nonsan: the given rows override older bundle rows for the same dates.
const runtime = (collectedAt: string, points: Dataset["points"], code = "44230", name = "논산시"): Dataset => ({ snapshotId: `internal-${collectedAt}`, collectedAt, source: "s", region: { code, name }, points });

/** Scripted reader: each call consumes the next outcome (a dataset list, "not-configured" or an Error). */
function scripted(outcomes: (Dataset[] | "not-configured" | Error)[]) {
  let calls = 0;
  const readRuntime = async (): Promise<RuntimeRead> => {
    const o = outcomes[Math.min(calls++, outcomes.length - 1)];
    if (o instanceof Error) throw o;
    return o === "not-configured" ? { kind: "not-configured" } : { kind: "ok", datasets: o };
  };
  return { readRuntime, calls: () => calls };
}
function harness(outcomes: (Dataset[] | "not-configured" | Error)[]) {
  let clock = Date.parse("2026-09-23T03:00:00.000Z");
  const s = scripted(outcomes);
  // Same coverage as production: the runtime daily collector targets Nonsan only.
  const load = createArchiveLoader({ bundles, readRuntime: s.readRuntime, runtimeTargets: ["44230"], now: () => clock, successMs: 60_000, failureMs: 30_000 });
  const svc = createExistingService({ archive: load, regionList: async () => { throw new Error("no resources"); }, tour: noTour, now: () => new Date(clock).toISOString() });
  return { load, svc, calls: s.calls, advance: (ms: number) => { clock += ms; } };
}
const festivalDay = (h: Awaited<ReturnType<ReturnType<typeof createExistingService>["loadHistory"]>>, date: string) => h.editions[0].points.find(p => p.date === date)!;

test("validated runtime null survives a later refresh failure; older bundle values never come back", async () => {
  const snap = runtime("2026-09-20T00:00:00.000Z", [{ date: "2025-03-29", value: null, quality: "missing" }, { date: "2025-03-28", value: 0, quality: "complete" }]);
  const h = harness([[snap], new Error("checksum mismatch /data/snapshots/x.json")]);
  const first = await h.svc.loadHistory(q("festival=nonsan-strawberry&editions=nonsan-strawberry-2025"));
  assert.deepEqual(first.freshness, { mode: "runtime", collectedAt: snap.collectedAt, runtimeCollectedAt: snap.collectedAt, refresh: { status: "ok", retryable: false } });
  assert.deepEqual([festivalDay(first, "2025-03-29").value, festivalDay(first, "2025-03-29").collectedAt], [null, snap.collectedAt]);
  assert.equal(festivalDay(first, "2025-03-28").value, 0, "a real zero stays a value");
  assert.equal(first.editions[0].summary.status, "incomplete", "a missing festival day withholds the mean");
  h.advance(61_000);
  const second = await h.svc.loadHistory(q("festival=nonsan-strawberry&editions=nonsan-strawberry-2025"));
  assert.deepEqual(second.freshness, { mode: "runtime-stale", collectedAt: snap.collectedAt, runtimeCollectedAt: snap.collectedAt, refresh: { status: "failed", retryable: true } });
  assert.deepEqual([festivalDay(second, "2025-03-29").value, festivalDay(second, "2025-03-29").collectedAt], [null, snap.collectedAt], "preserved null, not the older 113466.5");
  assert.equal(second.editions[0].summary.status, "incomplete");
  for (const leak of ["/data/snapshots", "checksum", "internal-", "snapshotId"]) assert.ok(!JSON.stringify(second).includes(leak), leak);
});

test("first runtime failure falls back to bundles with their ORIGINAL collection time; failure is retried after a short wait", async () => {
  const h = harness([new Error("unreadable"), new Error("unreadable")]);
  const st = await h.load();
  assert.deepEqual(st.freshness, { mode: "archive-fallback", collectedAt: BUNDLE_NEWEST, runtimeCollectedAt: null, refresh: { status: "failed", retryable: true } });
  assert.equal(st.datasets.length, bundles.length);
  const hist = await h.svc.loadHistory(q("festival=nonsan-strawberry&editions=nonsan-strawberry-2025"));
  assert.equal(hist.editions[0].summary.status === "available" && hist.editions[0].summary.mean, 85212.75, "bundles stay usable");
  assert.notEqual(hist.freshness.collectedAt, hist.retrievedAt, "no present-time collection timestamp");
  assert.equal(h.calls(), 1, "failure cached briefly");
  h.advance(31_000); await h.load(); assert.equal(h.calls(), 2, "failure retried after the short wait");
});

test("a newer runtime correction replaces the previous snapshot; success is cached", async () => {
  const a = runtime("2026-09-20T00:00:00.000Z", [{ date: "2025-03-29", value: 100000, quality: "complete" }]);
  const b = runtime("2026-09-21T00:00:00.000Z", [{ date: "2025-03-29", value: 120000, quality: "complete" }]);
  const h = harness([[a], [b]]);
  const one = await h.svc.loadHistory(q("festival=nonsan-strawberry&editions=nonsan-strawberry-2025"));
  h.advance(10_000); await h.load(); assert.equal(h.calls(), 1, "success cached");
  h.advance(60_000);
  const two = await h.svc.loadHistory(q("festival=nonsan-strawberry&editions=nonsan-strawberry-2025"));
  const mean = (x: typeof one) => x.editions[0].summary.status === "available" ? x.editions[0].summary.mean : null;
  const others = 85212.75 * 4 - 113466.5;
  assert.equal(mean(one), (others + 100000) / 4);
  assert.equal(mean(two), (others + 120000) / 4);
  assert.equal(two.freshness.runtimeCollectedAt, b.collectedAt);
  assert.equal(two.editions[0].state, "available", "same-definition corrections are not incompatibility");
});

test("invalid runtime data is never merged or retained", async () => {
  const good = runtime("2026-09-20T00:00:00.000Z", [{ date: "2025-03-29", value: null, quality: "missing" }]);
  const invalid = [
    runtime("2099-01-01T00:00:00.000Z", [{ date: "2025-03-29", value: 1, quality: "complete" }]),       // future collection time
    runtime("2026-09-22T00:00:00.000Z", [{ date: "2025-03-29", value: -5, quality: "complete" }]),      // negative value
    runtime("2026-09-22T00:00:00.000Z", [{ date: "2025-03-29", value: null, quality: "complete" }]),    // complete without value
    runtime("2026-09-22T00:00:00.000Z", [{ date: "2025-02-30", value: 1, quality: "complete" }]),       // impossible date
    runtime("2026-09-22T00:00:00.000Z", [{ date: "2025-03-29", value: 1, quality: "complete" }], "44230", "공주시"), // region name mismatch
    runtime("2026-09-22T00:00:00.000Z", [{ date: "2025-03-29", value: 1, quality: "guess" }]),          // unknown quality
  ];
  for (const bad of invalid) assert.equal(validRuntimeDataset(bad, Date.parse("2026-09-23T03:00:00.000Z")), false, JSON.stringify(bad.points));
  assert.equal(validRuntimeDataset(good, Date.parse("2026-09-23T03:00:00.000Z")), true);
  const fresh = harness([[invalid[0]]]);
  assert.deepEqual([(await fresh.load()).freshness.mode, (await fresh.load()).datasets.length], ["archive-fallback", bundles.length]);
  const kept = harness([[good], [invalid[1]]]);
  await kept.load(); kept.advance(61_000);
  const st = await kept.load();
  assert.deepEqual([st.freshness.mode, st.freshness.runtimeCollectedAt, st.datasets.includes(invalid[1]), st.datasets.includes(good)], ["runtime-stale", good.collectedAt, false, true]);
});

test("no runtime collector configured is honest archive-only, not a failure; freshness reaches monthly and archive search", async () => {
  const h = harness(["not-configured"]);
  const m = await h.svc.loadMonthly({ province: "44", district: "230", year: 2025 });
  assert.deepEqual(m.freshness, { mode: "archive-only", collectedAt: NONSAN_BUNDLE, runtimeCollectedAt: null, refresh: { status: "not-configured", retryable: false } },
    "Nonsan's own bundle time, not the later Gongju/Imsil archive");
  const f = await h.svc.loadFestivals(parseFestivalSearch(new URLSearchParams("q=딸기"), "2026-09-23"));
  assert.deepEqual(f.archive.freshness, { ...m.freshness, collectedAt: NONSAN_BUNDLE });
  const lookup = await h.svc.loadFestivals(parseFestivalSearch(new URLSearchParams("id=current:44230:1"), "2026-09-23"));
  assert.equal(lookup.archive.freshness, null, "archive not queried for a current-id lookup");
});

test("Nonsan runtime state never labels Gongju/Imsil archives; Wonju without observations has no collection time", async () => {
  const snap = runtime("2026-09-20T00:00:00.000Z", [{ date: "2025-03-29", value: null, quality: "missing" }]);
  const archiveOnly = (collectedAt: string | null) => ({ mode: "archive-only", collectedAt, runtimeCollectedAt: null, refresh: { status: "not-configured", retryable: false } });
  const h = harness([[snap], new Error("runtime unreadable")]);
  const check = async (phase: string) => {
    const gongjuMonthly = await h.svc.loadMonthly({ province: "44", district: "150", year: 2024 });
    const gongjuHistory = await h.svc.loadHistory(q("festival=baekje-gongju"));
    const imsilHistory = await h.svc.loadHistory(q("festival=imsil-cheese&editions=imsil-cheese-2025"));
    for (const r of [gongjuMonthly, gongjuHistory, imsilHistory]) assert.deepEqual(r.freshness, archiveOnly(GONGJU_IMSIL_BUNDLE), phase);
    assert.equal(gongjuHistory.editions[0].summary.status === "available" && gongjuHistory.editions[0].summary.mean, 95441.88888888889, `${phase}: canonical Gongju mean`);
    const imsilSearch = await h.svc.loadFestivals(parseFestivalSearch(new URLSearchParams("q=치즈"), "2026-09-23"));
    assert.deepEqual(imsilSearch.archive.freshness, archiveOnly(GONGJU_IMSIL_BUNDLE), `${phase}: single-region search`);
    const nonsan = await h.svc.loadHistory(q("festival=nonsan-strawberry&editions=nonsan-strawberry-2025"));
    assert.deepEqual([festivalDay(nonsan, "2025-03-29").value, festivalDay(nonsan, "2025-03-29").collectedAt, nonsan.editions[0].summary.status], [null, snap.collectedAt, "incomplete"], phase);
    return nonsan.freshness;
  };
  assert.deepEqual(await check("runtime ok"), { mode: "runtime", collectedAt: snap.collectedAt, runtimeCollectedAt: snap.collectedAt, refresh: { status: "ok", retryable: false } });
  h.advance(61_000);
  assert.deepEqual(await check("runtime failed"), { mode: "runtime-stale", collectedAt: snap.collectedAt, runtimeCollectedAt: snap.collectedAt, refresh: { status: "failed", retryable: true } });
  // Nonsan monthly for a year the runtime row does not touch keeps its own bundle time but shares the Nonsan refresh state.
  const nonsan2024 = await h.svc.loadMonthly({ province: "44", district: "230", year: 2024 });
  assert.deepEqual([nonsan2024.freshness.collectedAt, nonsan2024.freshness.mode, nonsan2024.freshness.refresh.status], ["2026-09-07T08:58:14.039Z", "runtime-stale", "failed"]);
  const wonjuMonthly = await h.svc.loadMonthly({ province: "51", district: "130", year: null });
  const wonjuHistory = await h.svc.loadHistory(q("festival=wonju-peach"));
  assert.deepEqual([wonjuMonthly.status, wonjuMonthly.freshness, wonjuHistory.freshness], ["empty", archiveOnly(null), archiveOnly(null)]);
  const mixed = await h.svc.loadFestivals(parseFestivalSearch(new URLSearchParams(""), "2026-09-23"));
  assert.deepEqual([mixed.archive.freshness?.collectedAt, mixed.archive.freshness?.mode], [snap.collectedAt, "runtime-stale"], "all-region search reports the returned regions honestly");
  const firstFailure = harness([new Error("unreadable")]);
  assert.deepEqual((await firstFailure.svc.loadMonthly({ province: "44", district: "150", year: 2024 })).freshness, archiveOnly(GONGJU_IMSIL_BUNDLE));
  assert.deepEqual((await firstFailure.svc.loadMonthly({ province: "44", district: "230", year: 2024 })).freshness,
    { mode: "archive-fallback", collectedAt: "2026-09-07T08:58:14.039Z", runtimeCollectedAt: null, refresh: { status: "failed", retryable: true } });
});

test("window source, visit collection time and same-definition corrections in history", async () => {
  const snap = runtime("2026-09-20T00:00:00.000Z", [{ date: "2025-03-29", value: 100000, quality: "complete" }, { date: "2025-03-21", value: null, quality: "missing" }]);
  const h = harness([[snap]]);
  const padded = await h.svc.loadHistory(q("festival=nonsan-strawberry&editions=nonsan-strawberry-2025"));
  const e = padded.editions[0];
  assert.deepEqual([e.state, e.windowSource, e.window], ["available", "padding", { start: "2025-03-20", end: "2025-04-06" }]);
  assert.deepEqual([festivalDay(padded, "2025-03-29").value, festivalDay(padded, "2025-03-21").value], [100000, null], "latest values and explicit nulls win");
  const custom = await h.svc.loadHistory(q("festival=nonsan-strawberry&editions=nonsan-strawberry-2025&windows=nonsan-strawberry-2025:2022-01-01:2022-01-31"));
  const c = custom.editions[0];
  assert.deepEqual([c.windowSource, c.points.every(p => p.value === null && p.collectedAt === null), c.state], ["custom", true, "available"]);
  assert.deepEqual(c.summary, e.summary, "a chart window outside the data keeps the original festival mean");
  assert.equal(c.source.visits?.collectedAt, snap.collectedAt, "source time comes from the original period that was read");
  const imsil = await h.svc.loadHistory(q("festival=imsil-cheese&editions=imsil-cheese-2025&before=0&after=0"));
  assert.deepEqual([imsil.editions[0].windowSource, imsil.editions[0].points.length], ["padding", 5]);
});
