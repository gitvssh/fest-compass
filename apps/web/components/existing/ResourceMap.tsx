"use client";
import { useEffect, useRef, useState } from "react";
import type * as Leaflet from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Point } from "@/lib/existing/types";

export type MapRow = { id: string; number: number; title: string; point: Point };
export type ResourceMapProps = {
  rows: MapRow[]; selectedId: string | null; anchor: Point | null; radiusKm: number | null;
  onSelect: (id: string) => void; onCenter: (point: Point) => void; onFailure: () => void;
};
type Engine = { L: typeof Leaflet; map: Leaflet.Map };

/**
 * Street map of the listed resources only. The view is fitted to the actual resource coordinates; no
 * venue or district centre is assumed. Moving the map never changes the query; the centre becomes a
 * distance anchor only through the explicit button.
 */
export default function ResourceMap({ rows, selectedId, anchor, radiusKm, onSelect, onCenter, onFailure }: ResourceMapProps) {
  const element = useRef<HTMLDivElement>(null), latest = useRef({ onSelect, onFailure });
  latest.current = { onSelect, onFailure };
  const [engine, setEngine] = useState<Engine | null>(null);
  useEffect(() => {
    let cancelled = false, instance: Leaflet.Map | undefined;
    import("leaflet").then(L => {
      if (cancelled || !element.current) return;
      const map = L.map(element.current, { center: [36, 127.5], zoom: 7, minZoom: 5, maxZoom: 18, zoomControl: true, scrollWheelZoom: false, attributionControl: true, maxBounds: [[30, 120], [41, 136]] });
      instance = map;
      const tiles = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, noWrap: true, keepBuffer: 0,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors' });
      let errors = 0;
      tiles.on("tileerror", () => { if (++errors >= 3) latest.current.onFailure(); });
      tiles.addTo(map); L.control.scale({ imperial: false, position: "bottomleft" }).addTo(map);
      setEngine({ L, map });
    }).catch(() => { if (!cancelled) latest.current.onFailure(); });
    return () => { cancelled = true; instance?.remove(); };
  }, []);
  const signature = rows.map(r => r.id).join(",");
  useEffect(() => {
    // The map may start inside a hidden area (small screens show list or map); resize when it becomes visible.
    if (!engine || !element.current) return;
    const observer = new ResizeObserver(() => engine.map.invalidateSize({ pan: false }));
    observer.observe(element.current);
    return () => observer.disconnect();
  }, [engine]);
  useEffect(() => {
    if (!engine || !rows.length) return;
    const lats = rows.map(r => r.point.latitude), lons = rows.map(r => r.point.longitude);
    const pad = 0.01;
    engine.map.fitBounds([[Math.min(...lats) - pad, Math.min(...lons) - pad], [Math.max(...lats) + pad, Math.max(...lons) + pad]], { padding: [24, 24], maxZoom: 14, animate: false });
  }, [engine, signature]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!engine) return;
    const { L, map } = engine, layer = L.layerGroup().addTo(map);
    for (const row of rows) {
      const selected = row.id === selectedId, button = document.createElement("button");
      button.type = "button"; button.className = `map-resource ${selected ? "is-selected" : ""}`; button.textContent = String(row.number);
      button.setAttribute("aria-label", `지도에서 ${row.number}. ${row.title} 상세 보기`); button.setAttribute("aria-pressed", String(selected));
      button.addEventListener("click", event => { event.stopPropagation(); latest.current.onSelect(row.id); });
      L.marker([row.point.latitude, row.point.longitude], { icon: L.divIcon({ html: button, className: "map-label-container", iconSize: [36, 36], iconAnchor: [18, 18] }), keyboard: false, zIndexOffset: selected ? 1000 : 0 }).addTo(layer);
    }
    if (anchor) {
      const mark = document.createElement("span");
      mark.textContent = "기준"; mark.style.cssText = "display:inline-flex;align-items:center;justify-content:center;width:40px;height:26px;border-radius:8px;background:#071a33;color:#fff;font-size:11px;font-weight:800;border:2px solid #fff;box-shadow:0 1px 5px #10233d66";
      L.marker([anchor.latitude, anchor.longitude], { icon: L.divIcon({ html: mark, className: "map-label-container", iconSize: [40, 26], iconAnchor: [20, 13] }), keyboard: false, interactive: false }).addTo(layer);
      if (radiusKm) L.circle([anchor.latitude, anchor.longitude], { radius: radiusKm * 1000, color: "#071a33", weight: 2, dashArray: "6 5", fillOpacity: 0.03, interactive: false }).addTo(layer);
    }
    return () => { layer.remove(); };
  }, [engine, rows, selectedId, anchor, radiusKm]);
  useEffect(() => {
    const row = rows.find(r => r.id === selectedId);
    if (engine && row) engine.map.panInside([row.point.latitude, row.point.longitude], { padding: [40, 40], animate: false });
  }, [engine, selectedId]); // eslint-disable-line react-hooks/exhaustive-deps
  function applyCenter() {
    if (!engine) return;
    const c = engine.map.getCenter();
    onCenter({ latitude: Number(c.lat.toFixed(6)), longitude: Number(c.lng.toFixed(6)) });
  }
  return <div className="overflow-hidden rounded-2xl border border-ink/15 bg-white">
    <div ref={element} role="group" aria-label="관광자원 지도. 지도에 초점을 두고 방향키로 이동할 수 있어요." className="h-[360px] w-full sm:h-[440px]" />
    <div className="space-y-2 p-3 text-xs text-muted">
      <div className="flex flex-wrap gap-2">
        <button type="button" className="region-button" disabled={!engine} onClick={applyCenter}>지도 중심을 기준점으로</button>
      </div>
      <p><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" className="underline">© OpenStreetMap contributors</a></p>
    </div>
  </div>;
}
