"use client";
import { useEffect, useRef, useState } from "react";
import type * as Leaflet from "leaflet";
import "leaflet/dist/leaflet.css";
import { REGIONS } from "@/lib/region/model";
import { groupResources, hasPosition, NATIONAL_BOUNDS, PROVINCE_ANCHORS, resourceBounds, type Bounds } from "@/lib/region/map-view";
import type { RegionMapProps } from "./RegionMap";

const corners = (b: Bounds): Leaflet.LatLngBoundsExpression => [[b[1], b[0]], [b[3], b[2]]];
const offsets: Record<string, [number, number]> = { "11": [20, -17], "28": [-24, 0], "41": [24, -4], "36110": [-14, -9], "30": [19, 9], "44": [-24, 0], "26": [19, 10], "31": [24, -8], "48": [-15, 6], "52": [-10, -5] };
type Engine = { L: typeof Leaflet; map: Leaflet.Map; tiles: Leaflet.TileLayer };
export default function RegionStreetMap(props: RegionMapProps & { onFallback: () => void }) {
  const element = useRef<HTMLDivElement>(null), latest = useRef(props), fitting = useRef(false);
  latest.current = props;
  const [engine, setEngine] = useState<Engine | null>(null), [changed, setChanged] = useState(false), [tileError, setTileError] = useState(false), [loadError, setLoadError] = useState(false);
  const [zoom, setZoom] = useState(6);
  const selectedMarker = useRef<Leaflet.Marker | null>(null);
  useEffect(() => {
    let cancelled = false, instance: Leaflet.Map | undefined;
    import("leaflet").then(L => {
      if (cancelled || !element.current) return;
      const map = L.map(element.current, { center: [36, 128], zoom: 6, zoomSnap: .25, minZoom: 5, maxZoom: 18, zoomControl: false,
        scrollWheelZoom: false, fadeAnimation: false, maxBounds: [[30, 120], [41, 136]], maxBoundsViscosity: .8, attributionControl: true });
      instance = map;
      map.fitBounds(corners(latest.current.province ? resourceBounds(latest.current.resources, latest.current.province) : NATIONAL_BOUNDS), { padding: [22, 22], maxZoom: 14, animate: false });
      const tiles = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, noWrap: true, keepBuffer: 0, updateWhenIdle: true, updateWhenZooming: false,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors' });
      tiles.on("tileerror", () => setTileError(true));
      tiles.addTo(map); L.control.scale({ imperial: false, position: "bottomleft" }).addTo(map);
      map.on("moveend", () => { if (!fitting.current) setChanged(true); setZoom(map.getZoom()); });
      setEngine({ L, map, tiles });
    }).catch(() => { if (!cancelled) setLoadError(true); });
    return () => { cancelled = true; instance?.remove(); };
  }, []);
  function fit() {
    if (!engine) return;
    fitting.current = true;
    engine.map.fitBounds(corners(props.province ? resourceBounds(props.resources, props.province) : NATIONAL_BOUNDS), { padding: [22, 22], maxZoom: 14, animate: false });
    fitting.current = false; setChanged(false);
  }
  useEffect(() => { fit(); /* New query results or province changes reset the view. */ }, [engine, props.province, props.resources]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!engine) return;
    const observer = new ResizeObserver(() => engine.map.invalidateSize({ pan: false }));
    if (element.current) observer.observe(element.current);
    return () => observer.disconnect();
  }, [engine]);
  useEffect(() => {
    if (!engine) return;
    const { L, map } = engine, layers = L.layerGroup().addTo(map);
    function draw() {
      layers.clearLayers(); selectedMarker.current = null;
      if (!props.province) {
        const placed: Leaflet.Point[] = [];
        for (const [code, name] of new Map(REGIONS.map(r => [r.provinceCode, r.provinceName]))) {
          const a = PROVINCE_ANCHORS[code]; if (!a) continue;
          const offset = offsets[code] ?? [0, 0], anchor = map.latLngToLayerPoint([a[1], a[0]]), preferred = anchor.add(offset);
          let point = preferred;
          // Keep short labels apart at narrow viewport sizes without changing their anchors.
          const candidates = [L.point(0, 0)];
          for (let x = -5; x <= 5; x++) for (let y = -5; y <= 5; y++) candidates.push(L.point(x * 58, y * 36));
          candidates.sort((a, b) => a.distanceTo([0, 0]) - b.distanceTo([0, 0]));
          for (const delta of candidates) {
            const candidate = preferred.add(delta);
            if (placed.every(p => Math.abs(p.x - candidate.x) >= 58 || Math.abs(p.y - candidate.y) >= 36)) { point = candidate; break; }
          }
          placed.push(point);
          const position = map.layerPointToLatLng(point);
          const button = document.createElement("button"); button.type = "button"; button.className = "map-province"; button.textContent = a[2]; button.setAttribute("aria-label", `${name} 선택`);
          button.addEventListener("click", () => latest.current.onProvince(code));
          if (!point.equals(anchor)) L.polyline([[a[1], a[0]], position], { color: "#233d57", weight: 1, interactive: false }).addTo(layers);
          L.marker(position, { icon: L.divIcon({ html: button, className: "map-label-container", iconSize: [52, 30], iconAnchor: [26, 15] }), keyboard: false }).addTo(layers);
        }
        return;
      }
      const groups = groupResources(props.resources, (lon, lat) => map.project([lat, lon]));
      for (const rows of groups) {
        const lat = rows.reduce((v, r) => v + r.resource.latitude, 0) / rows.length, lon = rows.reduce((v, r) => v + r.resource.longitude, 0) / rows.length;
        const selected = rows.some(r => r.resource.id === props.selected), group = rows.length > 1;
        const button = document.createElement("button"); button.type = "button"; button.className = `map-resource ${group ? "map-resource-group" : ""} ${selected ? "is-selected" : ""}`;
        button.textContent = group ? `${rows.length}건` : String(rows[0].number);
        button.setAttribute("aria-label", group ? `가까운 관광자료 ${rows.length}건 펼치기` : `지도에서 ${rows[0].resource.title} 상세`);
        button.setAttribute("aria-pressed", String(selected));
        const body = document.createElement("div"); body.className = "map-popup-list";
        for (const row of rows) {
          const item = document.createElement("button"); item.type = "button"; item.className = "map-popup-item";
          item.textContent = `${row.number}. ${row.resource.title}`; item.setAttribute("aria-pressed", String(row.resource.id === props.selected));
          item.addEventListener("click", () => latest.current.onResource(row.resource.id)); body.append(item);
          const address = document.createElement("p"); address.textContent = row.resource.address || "주소 미확보"; body.append(address);
        }
        const marker = L.marker([lat, lon], { icon: L.divIcon({ html: button, className: "map-label-container", iconSize: [40, 40], iconAnchor: [20, 20] }), keyboard: false }).addTo(layers).bindPopup(body, { maxWidth: 280, maxHeight: 220 });
        button.addEventListener("click", event => { event.stopPropagation(); marker.openPopup(); if (!group) latest.current.onResource(rows[0].resource.id); });
        if (selected) selectedMarker.current = marker;
      }
    }
    draw(); map.on("zoomend resize", draw);
    return () => { map.off("zoomend resize", draw); layers.remove(); };
  }, [engine, props.province, props.resources, props.selected]);
  useEffect(() => {
    if (!engine || !props.selected) return;
    const r = props.resources.find(r => r.id === props.selected);
    if (r && hasPosition(r)) { engine.map.panInside([r.latitude, r.longitude], { padding: [45, 45], animate: false }); selectedMarker.current?.openPopup(); }
  }, [engine, props.selected, props.resources]);
  useEffect(() => {
    if (!engine || !props.appliedBounds) return;
    const rectangle = engine.L.rectangle(corners(props.appliedBounds), { color: "#ae2e20", weight: 2, dashArray: "6 5", fillOpacity: .025, interactive: false }).addTo(engine.map);
    return () => { rectangle.remove(); };
  }, [engine, props.appliedBounds]);
  function applyBounds() { if (engine) { const b = engine.map.getBounds(); props.onBounds([b.getWest(), b.getSouth(), b.getEast(), b.getNorth()]); setChanged(false); } }
  return <div className="relative isolate overflow-hidden rounded-2xl border border-ink/15 bg-[#e9f1f4]">
    <div className="flex flex-wrap items-center justify-between gap-2 bg-white p-3"><span className="text-xs font-bold">{props.province ? "자료 좌표 · 주변 도로" : "전국 · 시도 표식 선택"}</span><div className="flex flex-wrap gap-1"><button className="region-button" aria-label="확대" disabled={!engine || zoom >= 18} onClick={() => engine?.map.zoomIn()}>＋</button><button className="region-button" aria-label="축소" disabled={!engine || zoom <= 5} onClick={() => engine?.map.zoomOut()}>−</button><button className="region-button" disabled={!engine} onClick={fit}>{props.province ? "조회 자료에 맞추기" : "전국 범위로 맞추기"}</button></div></div>
    <div ref={element} role="group" aria-label="전국 지역 탐색 지도" className="region-street-map h-[420px] w-full sm:h-[510px]" />
    <div className="space-y-2 bg-white p-3 text-xs leading-5 text-muted">
      {(tileError || loadError) && <p role="status" className="rounded-lg bg-amber-50 p-2 text-amber-950">배경 지도를 불러오지 못한 부분이 있습니다. 자료 목록은 계속 사용할 수 있습니다. <button className="underline" onClick={props.onFallback}>간단 지도로 보기</button></p>}
      {props.province && <div className="flex flex-wrap gap-2"><button className="region-button" disabled={!engine || !changed} onClick={applyBounds}>이 영역의 자료 보기</button><button className="region-button" onClick={() => { props.onBounds(null); setChanged(false); }}>공간 필터 해제</button></div>}
      <p>{props.appliedBounds ? "붉은 점선: 적용한 조회 영역. " : ""}지도 이동만으로 조회 조건은 바뀌지 않습니다. 드래그·두 손가락 확대 또는 지도에 초점을 두고 방향키·+/−로 이동하세요. 마우스 휠은 페이지를 스크롤합니다.</p>
      <p>묶음 숫자는 가까운 자료 건수입니다. 시도 표식은 선택용이며 행정경계가 아닙니다. 배경의 도로·경계와 관광자료의 기준일은 다를 수 있고 장소 사용 가능 여부는 별도 확인이 필요합니다.</p>
      <p><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" className="underline">© OpenStreetMap contributors</a> · <a href="https://www.openstreetmap.org/fixthemap" target="_blank" rel="noreferrer" className="underline">배경지도 오류 안내</a></p>
    </div>
  </div>;
}
