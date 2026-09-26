"use client";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import type * as Leaflet from "leaflet";
import "leaflet/dist/leaflet.css";
import "./resource-map.css";
import type { Point } from "@/lib/existing/types";
import { clusterRows, createProjectionCache, geometrySignature, MARKER_BOX, type MarkerCluster } from "@/lib/existing/resource-map-clusters";

export type MapRow = { id: string; number: number; title: string; point: Point };
export type ResourceMapProps = {
  rows: MapRow[]; selectedId: string | null; anchor: Point | null; radiusKm: number | null;
  onSelect: (id: string) => void; onCenter: (point: Point) => void; onFailure: () => void;
  /** Optional extra marking (e.g. resources chosen for side-by-side reading); detail selection stays `selectedId`. */
  highlightedIds?: readonly string[];
  highlightLabel?: string;
};
type Engine = { L: typeof Leaflet; map: Leaflet.Map };
type Cluster = MarkerCluster<MapRow>;
type Grouping = { zoom: number; clusters: Cluster[]; byKey: Map<string, Cluster> };
type Entry = { marker: Leaflet.Marker; button: HTMLButtonElement; cluster: Cluster };
const PANE = "resourceMarkers";
const count = (n: number) => n.toLocaleString("ko-KR");

/**
 * Street map of the listed resources only. The view is fitted to the actual resource coordinates; no
 * venue or district centre is assumed. Moving the map never changes the query; the centre becomes a
 * distance anchor only through the explicit button.
 *
 * Nearby resources share one marker ("N곳") whose button opens a list of every member, so resources at
 * the same coordinate stay selectable. Grouping is recomputed only for new zoom levels or resource
 * data; panning and resizing only add or remove markers entering or leaving the view.
 */
export default function ResourceMap({ rows, selectedId, anchor, radiusKm, onSelect, onCenter, onFailure, highlightedIds, highlightLabel }: ResourceMapProps) {
  const element = useRef<HTMLDivElement>(null), latest = useRef({ onSelect, onFailure });
  latest.current = { onSelect, onFailure };
  const [engine, setEngine] = useState<Engine | null>(null), [zoom, setZoom] = useState<number | null>(null);
  const [open, setOpen] = useState<{ key: string; rows: MapRow[] } | null>(null);
  const panelId = useId(), panel = useRef<HTMLDivElement>(null), panelHeading = useRef<HTMLHeadingElement>(null), focusPanel = useRef(false);
  // Cluster key whose button should regain focus once a close commits and the canvas is no longer inert.
  const restoreFocus = useRef<string | null>(null);
  const markers = useRef(new Map<string, Entry>()), reconcile = useRef<() => void>(() => {});

  // Parents rebuild `rows` on every render; keep one array per real content so projections stay cached.
  const content = rows.map(r => `${r.id}\u001f${r.number}\u001f${r.title}\u001f${r.point.latitude},${r.point.longitude}`).join("\u001e");
  const stableRows = useMemo(() => rows, [content]); // eslint-disable-line react-hooks/exhaustive-deps
  const geometry = useMemo(() => geometrySignature(stableRows), [stableRows]);
  const highlighted = (highlightedIds ?? []).join("\u001f");
  const marked = useMemo(() => new Set(highlighted ? highlighted.split("\u001f") : []), [highlighted]);
  const cache = useMemo(() => engine && createProjectionCache((lat, lon, z) => engine.map.project([lat, lon], z)), [engine]);
  const grouping = useMemo<Grouping | null>(() => {
    if (!cache || zoom === null) return null;
    const clusters = clusterRows(stableRows, cache.points(stableRows, zoom));
    return { zoom, clusters, byKey: new Map(clusters.map(c => [c.key, c])) };
  }, [cache, stableRows, zoom]);
  const view = useRef({ grouping, selectedId, marked, highlightLabel, openKey: open?.key ?? null });
  view.current = { grouping, selectedId, marked, highlightLabel, openKey: open?.key ?? null };
  const actions = useRef({ activate: (_: Cluster) => {} });
  actions.current.activate = cluster => {
    if (cluster.rows.length === 1) { latest.current.onSelect(cluster.rows[0].id); return; }
    if (open?.key === cluster.key) { closeList(true); return; }
    restoreFocus.current = null; focusPanel.current = true; setOpen({ key: cluster.key, rows: cluster.rows });
  };

  useEffect(() => {
    let cancelled = false, instance: Leaflet.Map | undefined;
    const placed = markers.current;
    import("leaflet").then(L => {
      if (cancelled || !element.current) return;
      const map = L.map(element.current, { center: [36, 127.5], zoom: 7, minZoom: 5, maxZoom: 18, zoomControl: true, scrollWheelZoom: false, attributionControl: true, maxBounds: [[30, 120], [41, 136]] });
      instance = map;
      map.createPane(PANE).style.zIndex = "610";
      const tiles = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, noWrap: true, keepBuffer: 0,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors' });
      let errors = 0;
      tiles.on("tileerror", () => { if (++errors >= 3) latest.current.onFailure(); });
      tiles.addTo(map); L.control.scale({ imperial: false, position: "bottomleft" }).addTo(map);
      map.on("zoomend", () => setZoom(map.getZoom()));
      map.on("moveend resize", () => reconcile.current());
      setZoom(map.getZoom()); setEngine({ L, map });
    }).catch(() => { if (!cancelled) latest.current.onFailure(); });
    return () => { cancelled = true; placed.clear(); instance?.remove(); };
  }, []);
  // Viewport changes wait while the map has no size (small screens may mount it inside a hidden tab);
  // fitting a zero-sized map would pick a meaningless zoom. They apply once the map becomes visible.
  const pending = useRef<{ bounds: Leaflet.LatLngBoundsLiteral | null; reveal: Point | null }>({ bounds: null, reveal: null });
  const settle = useRef(() => {});
  settle.current = () => {
    const el = element.current, p = pending.current;
    if (!engine || !el || !el.clientWidth || !el.clientHeight || (!p.bounds && !p.reveal)) return;
    const { bounds, reveal } = p;
    pending.current = { bounds: null, reveal: null };
    engine.map.invalidateSize({ pan: false });
    if (bounds) engine.map.fitBounds(bounds, { padding: [24, 24], maxZoom: 14, animate: false });
    if (reveal) engine.map.panInside([reveal.latitude, reveal.longitude], { padding: [40, 40], animate: false });
  };
  useEffect(() => {
    if (!engine || !element.current) return;
    const observer = new ResizeObserver(() => { engine.map.invalidateSize({ pan: false }); settle.current(); });
    observer.observe(element.current);
    return () => observer.disconnect();
  }, [engine]);
  useEffect(() => {
    // Refit only when the set of located resources or their coordinates change, not on sorting,
    // re-numbering, selection or comparison updates.
    if (!engine || !stableRows.length) return;
    let south = Infinity, west = Infinity, north = -Infinity, east = -Infinity;
    for (const { point } of stableRows) {
      south = Math.min(south, point.latitude); north = Math.max(north, point.latitude);
      west = Math.min(west, point.longitude); east = Math.max(east, point.longitude);
    }
    const pad = 0.01;
    pending.current.bounds = [[south - pad, west - pad], [north + pad, east + pad]];
    settle.current();
  }, [engine, geometry]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!engine) return;
    const { L, map } = engine, placed = markers.current, pane = map.getPane(PANE)!;
    function paint({ marker, button, cluster }: Entry) {
      const v = view.current, members = cluster.rows, group = members.length > 1;
      const selected = v.selectedId === null ? undefined : members.find(r => r.id === v.selectedId);
      const extra = v.marked.size ? members.filter(r => v.marked.has(r.id)).length : 0;
      button.className = `rmap-marker${group ? " rmap-group" : ""}${selected ? " is-selected" : ""}${extra ? " is-marked" : ""}`;
      button.textContent = `${selected ? "✓" : ""}${group ? `${count(members.length)}곳` : members[0].number}`;
      if (group) {
        const expanded = v.openKey === cluster.key;
        button.setAttribute("aria-label", `가까운 장소 ${count(members.length)}곳 목록 보기${selected ? `, 선택한 ${selected.number}. ${selected.title} 포함` : ""}${extra && v.highlightLabel ? `, ${v.highlightLabel} ${count(extra)}곳 포함` : ""}`);
        button.setAttribute("aria-haspopup", "dialog"); button.setAttribute("aria-expanded", String(expanded));
        if (expanded) button.setAttribute("aria-controls", panelId); else button.removeAttribute("aria-controls");
      } else {
        button.setAttribute("aria-label", `지도에서 ${members[0].number}. ${members[0].title} 상세 보기${extra && v.highlightLabel ? `, ${v.highlightLabel}` : ""}`);
        button.setAttribute("aria-pressed", String(!!selected));
      }
      marker.setZIndexOffset(selected ? 1000 : extra ? 500 : 0);
    }
    reconcile.current = () => {
      const g = view.current.grouping;
      // A zoom change regroups on the next render; keep the old markers until then.
      if (!g || map.getZoom() !== g.zoom) return;
      const { min, max } = map.getPixelBounds();
      const visible = g.clusters.filter(c => c.x >= min!.x && c.x <= max!.x && c.y >= min!.y && c.y <= max!.y);
      const wanted = new Set(visible.map(c => c.key)), active = document.activeElement;
      let lost = false;
      for (const [key, entry] of placed) if (!wanted.has(key)) {
        if (active && entry.button.contains(active)) lost = true;
        entry.marker.remove(); placed.delete(key);
      }
      for (const cluster of visible) {
        const at = map.unproject([cluster.x, cluster.y], g.zoom);
        let entry = placed.get(cluster.key);
        if (entry) { entry.cluster = cluster; if (!entry.marker.getLatLng().equals(at)) entry.marker.setLatLng(at); }
        else {
          const button = document.createElement("button"), marker = L.marker(at, { pane: PANE, keyboard: false,
            icon: L.divIcon({ html: button, className: "rmap-slot", iconSize: [MARKER_BOX.width, MARKER_BOX.height], iconAnchor: [MARKER_BOX.width / 2, MARKER_BOX.height / 2] }) });
          const created: Entry = { marker, button, cluster };
          button.type = "button";
          // Membership is fixed by the key, so identity attributes are set once (ids in key order).
          const ids = cluster.rows.map(r => r.id).sort();
          button.dataset.resourceCount = String(ids.length);
          if (ids.length === 1) button.dataset.resourceId = ids[0]; else button.dataset.resourceIds = JSON.stringify(ids);
          button.addEventListener("click", event => { event.stopPropagation(); actions.current.activate(created.cluster); });
          marker.addTo(map); placed.set(cluster.key, entry = created);
        }
        paint(entry);
      }
      // Keep Tab order equal to catalogue order as markers enter the view.
      let cursor = pane.firstChild;
      for (const cluster of visible) {
        const icon = placed.get(cluster.key)!.marker.getElement();
        if (!icon) continue;
        if (icon === cursor) cursor = cursor.nextSibling; else pane.insertBefore(icon, cursor);
      }
      // While the list is open the canvas is inert; focus there is impossible and closing restores it.
      if (view.current.openKey !== null) return;
      if (lost) element.current?.focus({ preventScroll: true });
      else if (active instanceof HTMLElement && pane.contains(active) && document.activeElement !== active) active.focus({ preventScroll: true });
    };
    return () => { reconcile.current = () => {}; };
  }, [engine, panelId]);
  useEffect(() => { reconcile.current(); }, [engine, grouping, selectedId, marked, highlightLabel, open?.key]);

  useEffect(() => {
    // Regrouping (zoom or data) may dissolve the open group; close it without stranding focus.
    if (!open || !grouping || grouping.byKey.has(open.key)) return;
    restoreFocus.current = panel.current?.contains(document.activeElement) ? open.key : null;
    setOpen(null);
  }, [grouping, open]);
  useEffect(() => {
    if (open && focusPanel.current) { focusPanel.current = false; panelHeading.current?.focus(); }
  }, [open]);
  useEffect(() => {
    // Runs after the close has committed (inert removed) and after `reconcile` updated the markers.
    const key = restoreFocus.current;
    if (open || key === null) return;
    restoreFocus.current = null;
    const current = document.activeElement;
    if (current && current !== document.body) return; // focus already moved somewhere visible
    const shown = (el: HTMLElement | null | undefined): el is HTMLElement => !!el?.isConnected && el.getClientRects().length > 0 && !el.closest("[inert]");
    const button = markers.current.get(key)?.button, host = element.current;
    (shown(button) ? button : shown(host) ? host : null)?.focus({ preventScroll: true });
  }, [open]);
  function closeList(restore: boolean) {
    restoreFocus.current = restore && open ? open.key : null;
    setOpen(null);
  }

  useEffect(() => {
    if (!engine || !anchor) return;
    const { L, map } = engine, layer = L.layerGroup().addTo(map), mark = document.createElement("span");
    mark.className = "rmap-anchor"; mark.textContent = "기준";
    L.marker([anchor.latitude, anchor.longitude], { icon: L.divIcon({ html: mark, className: "rmap-slot", iconSize: [44, 28], iconAnchor: [22, 14] }), keyboard: false, interactive: false }).addTo(layer);
    if (radiusKm) L.circle([anchor.latitude, anchor.longitude], { radius: radiusKm * 1000, color: "#071a33", weight: 2, dashArray: "6 5", fillOpacity: 0.03, interactive: false }).addTo(layer);
    return () => { layer.remove(); };
  }, [engine, anchor?.latitude, anchor?.longitude, radiusKm]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const row = stableRows.find(r => r.id === selectedId);
    if (!engine || !row) return;
    pending.current.reveal = row.point;
    settle.current();
  }, [engine, selectedId]); // eslint-disable-line react-hooks/exhaustive-deps
  function applyCenter() {
    if (!engine) return;
    const c = engine.map.getCenter();
    onCenter({ latitude: Number(c.lat.toFixed(6)), longitude: Number(c.lng.toFixed(6)) });
  }

  const members = open ? grouping?.byKey.get(open.key)?.rows ?? open.rows : [];
  return <div className="rmap-root overflow-hidden rounded-2xl border border-ink/15 bg-white">
    <div className="relative isolate">
      <div ref={element} role="group" aria-label="관광자원 지도. 지도에 초점을 두고 방향키로 이동할 수 있어요." className="rmap-canvas h-[360px] w-full sm:h-[440px]" inert={open !== null} />
      {open && <div ref={panel} id={panelId} role="dialog" aria-modal="false" aria-labelledby={`${panelId}-title`} className="rmap-panel"
        onKeyDown={event => { if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); closeList(true); } }}>
        <div className="rmap-panel-head">
          <h3 id={`${panelId}-title`} ref={panelHeading} tabIndex={-1} className="rmap-panel-title">가까운 장소 {count(members.length)}곳</h3>
          <button type="button" className="rmap-close" aria-label="가까운 장소 목록 닫기" onClick={() => closeList(true)}>닫기</button>
        </div>
        <ul className="rmap-list" aria-labelledby={`${panelId}-title`}>
          {members.map(row => {
            const selected = row.id === selectedId, extra = marked.has(row.id);
            return <li key={row.id}>
              <button type="button" className="rmap-item" aria-pressed={selected} onClick={() => latest.current.onSelect(row.id)}>
                <span><span className="rmap-item-number">{row.number}.</span> {row.title}</span>
                {selected && <span className="rmap-tag">✓ 상세 보는 중</span>}
                {extra && highlightLabel && <span className="rmap-tag is-marked">{highlightLabel}</span>}
              </button>
            </li>;
          })}
        </ul>
      </div>}
    </div>
    <div className="space-y-2 p-3 text-[13px] leading-5 text-muted">
      <div className="flex flex-wrap gap-2">
        <button type="button" className="region-button min-h-11" disabled={!engine} onClick={applyCenter}>지도 중심을 기준점으로</button>
      </div>
      <p><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" className="underline">© OpenStreetMap contributors</a></p>
    </div>
  </div>;
}
