import test from "node:test";
import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { clusterRows, createProjectionCache, findOverlap, geometrySignature, MARKER_BOX, slotsOverlap, type MarkerCluster, type Project } from "./resource-map-clusters";

type Row = { id: string; number: number; title: string; point: { latitude: number; longitude: number } };
const CW = MARKER_BOX.width + MARKER_BOX.gap, CH = MARKER_BOX.height + MARKER_BOX.gap;
/** Rows placed directly in screen pixels; x/y double as longitude/latitude for an identity projection. */
const at = (coords: [number, number][], first = 1): { rows: Row[]; points: Float64Array } => ({
  rows: coords.map(([x, y], i) => ({ id: `r${first + i}`, number: first + i, title: `장소 ${first + i}`, point: { latitude: y, longitude: x } })),
  points: Float64Array.from(coords.flat()),
});
function random(seed: number) {
  return () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
/** Every input id appears exactly once with its own number, members stay in catalogue order, keys match members. */
function assertIdentity(rows: Row[], clusters: MarkerCluster<Row>[]) {
  const seen = new Map<string, number>();
  for (const c of clusters) {
    assert.ok(c.rows.length > 0);
    assert.equal(c.key, c.rows.map(r => r.id).sort().join("\u001f"));
    for (let i = 1; i < c.rows.length; i++) assert.ok(c.rows[i - 1].number < c.rows[i].number, "members ordered by number");
    for (const r of c.rows) { assert.ok(!seen.has(r.id), `duplicate ${r.id}`); seen.set(r.id, r.number); }
  }
  assert.equal(seen.size, rows.length, "no missing ids");
  for (const r of rows) assert.equal(seen.get(r.id), r.number, "original number kept");
}
/** Exhaustive pairwise check, independent of the grid used by the implementation. */
function assertSeparated(clusters: MarkerCluster<Row>[]) {
  for (let i = 0; i < clusters.length; i++) for (let j = i + 1; j < clusters.length; j++)
    assert.ok(!slotsOverlap(clusters[i], clusters[j]), `slots ${clusters[i].key} and ${clusters[j].key} overlap`);
  assert.equal(findOverlap(clusters), null);
}
/** Centre is the mean of member positions, so it stays inside the members' bounding box. */
function assertCentroids(clusters: MarkerCluster<Row>[]) {
  for (const c of clusters) {
    const xs = c.rows.map(r => r.point.longitude), ys = c.rows.map(r => r.point.latitude);
    assert.ok(Math.abs(c.x - xs.reduce((a, b) => a + b, 0) / xs.length) < 1e-6);
    assert.ok(Math.abs(c.y - ys.reduce((a, b) => a + b, 0) / ys.length) < 1e-6);
  }
}
const mercator: Project = (lat, lon, zoom) => {
  const scale = 256 * 2 ** zoom, s = Math.sin(lat * Math.PI / 180);
  return { x: scale * (lon + 180) / 360, y: scale * (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) };
};

test("empty input gives no markers and a single row keeps its identity", () => {
  assert.deepEqual(clusterRows([], new Float64Array()), []);
  const { rows, points } = at([[100.5, 200.25]], 7);
  const [only, ...rest] = clusterRows(rows, points);
  assert.equal(rest.length, 0);
  assert.deepEqual(only, { key: "r7", rows: [rows[0]], x: 100.5, y: 200.25 });
  assert.throws(() => clusterRows(rows, new Float64Array(1)));
});

test("rows at exactly the same coordinate always form one selectable group", () => {
  // Numbers deliberately out of input order: the group lists them in catalogue order.
  const rows: Row[] = [5, 2, 9].map(n => ({ id: `same-${n}`, number: n, title: "같은 위치", point: { latitude: 10, longitude: 10 } }));
  const clusters = clusterRows(rows, Float64Array.from([10, 10, 10, 10, 10, 10]));
  assert.equal(clusters.length, 1);
  assert.deepEqual(clusters[0].rows.map(r => r.number), [2, 5, 9]);
  assertIdentity(rows, clusters);
  // Re-numbering the same members (a different list sort) keeps the group identity.
  const renumbered = clusterRows(rows.map(r => ({ ...r, number: 10 - r.number })), Float64Array.from([10, 10, 10, 10, 10, 10]));
  assert.equal(renumbered[0].key, clusters[0].key);
  assert.deepEqual(renumbered[0].rows.map(r => r.number), [1, 5, 8]);
});

test("near points on either side of a grid edge merge; points one slot apart stay single", () => {
  const edge = at([[CW - 0.5, 10], [CW + 0.5, 10]]);
  assert.equal(clusterRows(edge.rows, edge.points).length, 1, "horizontal edge");
  const vertical = at([[10, CH - 0.1], [10, CH + 0.1]]);
  assert.equal(clusterRows(vertical.rows, vertical.points).length, 1, "vertical edge");
  const corner = at([[CW - 1, CH - 1], [CW + 1, CH + 1], [CW - 1, CH + 1], [CW + 1, CH - 1]]);
  const merged = clusterRows(corner.rows, corner.points);
  assert.equal(merged.length, 1, "four cells meeting at a corner");
  assert.deepEqual(merged[0].rows.map(r => r.number), [1, 2, 3, 4]);
  // Exactly one slot plus gap apart is touching-free, so both stay individually selectable.
  const apart = at([[0, 0], [CW, 0], [0, CH]]);
  const singles = clusterRows(apart.rows, apart.points);
  assert.equal(singles.length, 3);
  assertSeparated(singles);
});

test("a merge that moves a centre into a third marker keeps merging until nothing overlaps", () => {
  // A and B overlap each other; C is exactly clear of A (in x) and of B (in y) but overlaps their mean.
  const A = { x: -CW, y: -0.2 * CH }, B = { x: -0.2 * CW, y: -CH }, C = { x: 0, y: 0 };
  assert.ok(slotsOverlap(A, B) && !slotsOverlap(A, C) && !slotsOverlap(B, C));
  assert.ok(slotsOverlap({ x: (A.x + B.x) / 2, y: (A.y + B.y) / 2 }, C));
  for (const order of [[A, B, C], [C, A, B], [B, C, A]]) {
    const { rows, points } = at(order.map(p => [p.x, p.y] as [number, number]));
    const clusters = clusterRows(rows, points);
    assert.equal(clusters.length, 1, "the moved centre absorbs C regardless of input order");
    assertIdentity(rows, clusters); assertCentroids(clusters);
  }
});

test("adversarial chains spaced just inside and just outside a slot stay complete and separated", () => {
  for (const spacing of [0.99, 0.51, 0.5, 1.0, 1.01]) {
    const coords: [number, number][] = Array.from({ length: 400 }, (_, i) => [i * CW * spacing, (i % 2) * CH * 0.3]);
    const { rows, points } = at(coords);
    const clusters = clusterRows(rows, points);
    assertIdentity(rows, clusters); assertSeparated(clusters); assertCentroids(clusters);
    if (spacing >= 1) assert.equal(clusters.length, rows.length, `spacing ${spacing} needs no grouping`);
    else assert.ok(clusters.length < rows.length, `spacing ${spacing} must group`);
  }
  // A diagonal staircase crosses a cell corner at every step.
  const stairs = at(Array.from({ length: 300 }, (_, i): [number, number] => [i * CW * 0.7, i * CH * 0.7]));
  const clusters = clusterRows(stairs.rows, stairs.points);
  assertIdentity(stairs.rows, clusters); assertSeparated(clusters); assertCentroids(clusters);
});

test("randomised layouts never lose, duplicate or renumber rows and never leave overlapping slots", () => {
  for (let seed = 1; seed <= 40; seed++) {
    const next = random(seed), n = 50 + Math.floor(next() * 400), span = 50 + next() * 3000;
    const coords: [number, number][] = Array.from({ length: n }, () => next() < 0.15 ? [span / 2, span / 2] : [next() * span, next() * span * 0.7]);
    const { rows, points } = at(coords);
    const clusters = clusterRows(rows, points);
    assertIdentity(rows, clusters); assertSeparated(clusters); assertCentroids(clusters);
  }
});

test("projection cache projects each row once per zoom and resets for a new rows array", () => {
  let calls = 0;
  const cache = createProjectionCache((lat, lon, zoom) => { calls++; return mercator(lat, lon, zoom); }, 2);
  const { rows } = at([[127, 37], [127.001, 37.001], [128, 36]]);
  const z10 = cache.points(rows, 10);
  assert.equal(calls, 3);
  assert.equal(cache.points(rows, 10), z10, "same array instance returned");
  assert.equal(calls, 3);
  const expected = mercator(37, 127, 10);
  assert.deepEqual([z10[0], z10[1]], [expected.x, expected.y]);
  cache.points(rows, 11); assert.equal(calls, 6);
  cache.points(rows, 10); assert.equal(calls, 6, "returning to a cached zoom reuses it");
  cache.points(rows, 12); assert.equal(calls, 9);
  cache.points(rows, 10); assert.equal(calls, 9, "recently used zoom 10 survived; zoom 11 was evicted");
  cache.points(rows, 11); assert.equal(calls, 12, "evicted zoom is projected again");
  cache.points(rows, 10); assert.equal(calls, 12);
  cache.points([...rows], 10); assert.equal(calls, 15, "a new rows array is projected again");
});

test("map fit signature ignores list order, numbers and titles but not the located resource set", () => {
  const { rows } = at([[127, 37], [127.5, 36.5], [128, 36]]);
  const base = geometrySignature(rows);
  const resorted = [rows[2], rows[0], rows[1]].map((r, i) => ({ ...r, number: i + 1, title: `다른 이름 ${i}` }));
  assert.equal(geometrySignature(resorted), base, "re-sorting and re-numbering keep the viewport");
  assert.notEqual(geometrySignature(rows.slice(0, 2)), base, "a removed resource refits");
  assert.notEqual(geometrySignature([...rows, { ...rows[0], id: "r9" }]), base, "an added resource refits");
  assert.notEqual(geometrySignature(rows.map((r, i) => i === 1 ? { ...r, point: { latitude: 36.6, longitude: 127.5 } } : r)), base, "a moved resource refits");
  // Same coordinates, swapped ids: a different set of located resources.
  const swapped = rows.map((r, i) => ({ ...r, id: rows[(i + 1) % rows.length].id, point: r.point }));
  assert.notEqual(geometrySignature(swapped), base);
});

function measure(label: string, rows: Row[], zooms: number[], t: { diagnostic(msg: string): void }) {
  let calls = 0;
  const cache = createProjectionCache((lat, lon, z) => { calls++; return mercator(lat, lon, z); });
  const costs: string[] = [];
  for (const zoom of zooms) {
    const started = performance.now();
    const points = cache.points(rows, zoom), projected = performance.now();
    const clusters = clusterRows(rows, points), done = performance.now();
    assertIdentity(rows, clusters);
    assert.equal(findOverlap(clusters), null, `${label} z${zoom}`);
    costs.push(`z${zoom}: ${clusters.length} markers, project ${(projected - started).toFixed(1)}ms, group ${(done - projected).toFixed(1)}ms`);
  }
  const again = performance.now(); clusterRows(rows, cache.points(rows, zooms[0])); const cached = performance.now() - again;
  assert.equal(calls, rows.length * zooms.length, "each zoom projected once");
  t.diagnostic(`${label} (${rows.length} rows): ${costs.join("; ")}; cached z${zooms[0]} regroup ${cached.toFixed(1)}ms`);
  return clusterRows(rows, cache.points(rows, zooms.at(-1)!));
}
const geo = (points: [number, number][]): Row[] => points.map(([lat, lon], i) => ({ id: `kto-${i}`, number: i + 1, title: `자원 ${i + 1}`, point: { latitude: lat, longitude: lon } }));

test("8,000 dense rows in one district, including repeated coordinates, group within budget", t => {
  const next = random(8000);
  const rows = geo(Array.from({ length: 8000 }, (_, i): [number, number] => i % 10 === 0 ? [36.2, 127.1] : [36.15 + next() * 0.12, 127.05 + next() * 0.12]));
  const started = performance.now();
  const last = measure("dense", rows, [7, 10, 13, 15, 18], t);
  assert.ok(performance.now() - started < 5000, "dense grouping stays interactive");
  assertSeparated(last);
  const sameSpot = last.find(c => c.rows.some(r => r.id === "kto-0"))!;
  assert.ok(sameSpot.rows.length >= 800, "all rows at one coordinate stay together at maximum zoom");
});

test("8,000 sparse rows across the country mostly stay single without overlaps", t => {
  const next = random(42);
  const rows = geo(Array.from({ length: 8000 }, (): [number, number] => [33.2 + next() * 5.3, 126 + next() * 3.4]));
  const started = performance.now();
  const last = measure("sparse", rows, [7, 10, 13, 16, 18], t);
  assert.ok(performance.now() - started < 5000, "sparse grouping stays interactive");
  assert.ok(last.length > 7900, "at street zoom nearly every row is its own marker");
  assertSeparated(last);
});

test("worst case of 8,000 rows on one chained line still converges near-linearly", t => {
  const coords: [number, number][] = Array.from({ length: 8000 }, (_, i) => [i * CW * 0.95, (i % 3) * CH * 0.4]);
  const { rows, points } = at(coords);
  const started = performance.now();
  const result = clusterRows(rows, points);
  const cost = performance.now() - started;
  t.diagnostic(`chain (8000 rows): ${result.length} markers in ${cost.toFixed(1)}ms`);
  assertIdentity(rows, result); assertSeparated(result); assertCentroids(result);
  assert.ok(cost < 2000);
});
