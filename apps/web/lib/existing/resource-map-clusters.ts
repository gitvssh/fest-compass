/**
 * Screen-space grouping for the shared tourism-resource map (design 20). Pure and dependency-free so
 * the separation, identity and cost guarantees are testable without Leaflet or a DOM.
 *
 * Coordinates are world pixels at one zoom level (`map.project(latlng, zoom)`), which only translate
 * when the map pans. Groups therefore change with zoom or data, never with moving or resizing.
 */
export type ScreenPoint = { x: number; y: number };
/** Axis-aligned slot every marker button must fit inside, plus the minimum clear gap between slots. */
export type MarkerBox = { width: number; height: number; gap: number };
/**
 * 44px-high buttons up to 84px wide: the widest label "✓8,000곳" at 13px (~60px) plus 10px padding and a
 * 4px comparison border on each side (~78px). The gap leaves room for 3px rings on both neighbours.
 */
export const MARKER_BOX: MarkerBox = { width: 84, height: 44, gap: 8 };

export type ClusterRow = { id: string; number: number };
export type MarkerCluster<R extends ClusterRow> = {
  /** Sorted member ids: identical membership gives an identical key across regroupings and re-numbering. */
  key: string;
  /** Every member exactly once, ordered by the original catalogue number. */
  rows: R[];
  /** Mean member position in the same world-pixel space as the input. */
  x: number; y: number;
};

/**
 * Identity of the located resource set: which ids sit at which coordinates. Independent of row order,
 * numbers and titles, so re-sorting or re-numbering the list never refits the map.
 */
export function geometrySignature(rows: readonly { id: string; point: { latitude: number; longitude: number } }[]) {
  return rows.map(r => `${r.id}@${r.point.latitude},${r.point.longitude}`).sort().join("\u001e");
}

export type Project = (latitude: number, longitude: number, zoom: number) => ScreenPoint;
export type ProjectionCache = {
  /** Interleaved [x0, y0, x1, y1, ...] for `rows` at `zoom`. Reuses results for the same array and zoom. */
  points(rows: readonly { point: { latitude: number; longitude: number } }[], zoom: number): Float64Array;
};

/**
 * Caches projections per zoom for one rows array. Callers keep the array identity stable while its
 * coordinates are unchanged; a different array clears every cached zoom. At most `limit` zooms are
 * kept (least recently used evicted), each costing 16 bytes per row.
 */
export function createProjectionCache(project: Project, limit = 20): ProjectionCache {
  let source: readonly unknown[] | null = null;
  const byZoom = new Map<number, Float64Array>();
  return {
    points(rows, zoom) {
      if (rows !== source) { source = rows; byZoom.clear(); }
      const hit = byZoom.get(zoom);
      if (hit) { byZoom.delete(zoom); byZoom.set(zoom, hit); return hit; }
      const out = new Float64Array(rows.length * 2);
      for (let i = 0; i < rows.length; i++) {
        const p = project(rows[i].point.latitude, rows[i].point.longitude, zoom);
        out[2 * i] = p.x; out[2 * i + 1] = p.y;
      }
      byZoom.set(zoom, out);
      if (byZoom.size > limit) byZoom.delete(byZoom.keys().next().value!);
      return out;
    },
  };
}

/** True when two marker slots centred at a and b would touch or overlap (gap included). */
export function slotsOverlap(a: ScreenPoint, b: ScreenPoint, box: MarkerBox = MARKER_BOX) {
  return Math.abs(a.x - b.x) < box.width + box.gap && Math.abs(a.y - b.y) < box.height + box.gap;
}

// Cell keys stay exact numbers for |cell| < 2^21; farther cells only share buckets, which costs time
// but never hides a neighbour because every candidate is still checked geometrically.
const OFFSET = 2 ** 21, STRIDE = 2 ** 23;
const cellKey = (cx: number, cy: number) => (cx + OFFSET) * STRIDE + (cy + OFFSET);

type Work = { members: number[]; sx: number; sy: number; alive: boolean; cell: number };

/**
 * Groups rows so that no two resulting marker slots overlap. Rows sharing a grid cell start together;
 * overlapping neighbours (including across cell edges) are then merged nearest-first until none
 * remain. A merge removes one group and re-checks only the moved group's 3x3 neighbourhood, and the
 * smaller member list is appended to the larger, so dense and sparse inputs stay near-linear instead
 * of the legacy restart-after-every-merge pairwise scan.
 *
 * Guarantee: after the queue drains every group was checked after its final move, so a pair left
 * overlapping would have been found by whichever of the two moved last.
 */
export function clusterRows<R extends ClusterRow>(rows: readonly R[], points: ArrayLike<number>, box: MarkerBox = MARKER_BOX): MarkerCluster<R>[] {
  if (points.length < rows.length * 2) throw new Error("points must hold x,y for every row");
  const cw = box.width + box.gap, ch = box.height + box.gap;
  const cellOf = (x: number, y: number) => cellKey(Math.floor(x / cw), Math.floor(y / ch));
  const work: Work[] = [], seed = new Map<number, number>(), grid = new Map<number, number[]>();
  for (let i = 0; i < rows.length; i++) {
    const x = points[2 * i], y = points[2 * i + 1], key = cellOf(x, y);
    let w = seed.get(key);
    if (w === undefined) { w = work.length; seed.set(key, w); work.push({ members: [], sx: 0, sy: 0, alive: true, cell: key }); }
    const g = work[w]; g.members.push(i); g.sx += x; g.sy += y;
  }
  const place = (w: number) => {
    const g = work[w]; g.cell = cellOf(g.sx / g.members.length, g.sy / g.members.length);
    const bucket = grid.get(g.cell); if (bucket) bucket.push(w); else grid.set(g.cell, [w]);
  };
  const unplace = (w: number) => {
    const bucket = grid.get(work[w].cell)!, at = bucket.indexOf(w);
    bucket[at] = bucket[bucket.length - 1]; bucket.pop();
    if (!bucket.length) grid.delete(work[w].cell);
  };
  for (let w = 0; w < work.length; w++) place(w);
  const queue = work.map((_, w) => w);
  for (let head = 0; head < queue.length; head++) {
    const w = queue[head], g = work[w];
    if (!g.alive) continue;
    const x = g.sx / g.members.length, y = g.sy / g.members.length;
    const cx = Math.floor(x / cw), cy = Math.floor(y / ch);
    let nearest = -1, best = Infinity;
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
      const bucket = grid.get(cellKey(cx + dx, cy + dy));
      if (!bucket) continue;
      for (const other of bucket) {
        if (other === w) continue;
        const o = work[other], ox = o.sx / o.members.length, oy = o.sy / o.members.length;
        if (Math.abs(ox - x) >= cw || Math.abs(oy - y) >= ch) continue;
        const d = (ox - x) ** 2 + (oy - y) ** 2;
        if (d < best || (d === best && other < nearest)) { best = d; nearest = other; }
      }
    }
    if (nearest < 0) continue;
    const [keep, drop] = work[nearest].members.length > g.members.length ? [nearest, w] : [w, nearest];
    const k = work[keep], d = work[drop];
    unplace(keep); unplace(drop);
    for (const m of d.members) k.members.push(m);
    k.sx += d.sx; k.sy += d.sy; d.alive = false; d.members = [];
    place(keep); queue.push(keep);
  }
  const out: MarkerCluster<R>[] = [];
  for (const g of work) {
    if (!g.alive) continue;
    const members = g.members.map(i => rows[i]).sort((a, b) => a.number - b.number || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    out.push({ key: members.map(r => r.id).sort().join("\u001f"), rows: members, x: g.sx / g.members.length, y: g.sy / g.members.length });
  }
  return out.sort((a, b) => a.rows[0].number - b.rows[0].number);
}

/** First pair of overlapping slots, or null. Grid-indexed so it can verify thousands of markers. */
export function findOverlap(clusters: readonly ScreenPoint[], box: MarkerBox = MARKER_BOX): [number, number] | null {
  const cw = box.width + box.gap, ch = box.height + box.gap, grid = new Map<number, number[]>();
  clusters.forEach((c, i) => {
    const key = cellKey(Math.floor(c.x / cw), Math.floor(c.y / ch)), bucket = grid.get(key);
    if (bucket) bucket.push(i); else grid.set(key, [i]);
  });
  for (let i = 0; i < clusters.length; i++) {
    const cx = Math.floor(clusters[i].x / cw), cy = Math.floor(clusters[i].y / ch);
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++)
      for (const j of grid.get(cellKey(cx + dx, cy + dy)) ?? []) if (j > i && slotsOverlap(clusters[i], clusters[j], box)) return [i, j];
  }
  return null;
}
