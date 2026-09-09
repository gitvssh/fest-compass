"use client";
import { useEffect, useRef, useState } from "react";
import type * as Leaflet from "leaflet";
import type { FeatureCollection, Geometry } from "geojson";
import { BOUNDARIES, boundaryReference, boundaryRegion, type BoundaryReference } from "@/lib/region/boundaries";

type ShapeProperties = { id: string; name: string; aggregate: boolean };
export function RegionBoundaryLayer(props: { engine: { L: typeof Leaflet; map: Leaflet.Map } | null; province: string; district: string;
  onProvince: (code: string) => void; onDistrict: (code: string) => void; onBoundary: (value: BoundaryReference | null) => void }) {
  const latest = useRef(props); latest.current = props;
  const [visible, setVisible] = useState(true), [state, setState] = useState({ key: "", status: "loading" });
  const key = props.district ? `${props.province}:${props.district}` : props.province;
  const status = state.key === key ? state.status : "loading";
  useEffect(() => {
    const setStatus = (status: string) => setState({ key, status });
    latest.current.onBoundary(null);
    if (!visible || !props.engine) return;
    const { L, map } = props.engine, controller = new AbortController();
    const layers = L.layerGroup().addTo(map);
    if (!map.getPane("region-boundaries")) { const pane = map.createPane("region-boundaries"); pane.style.zIndex = "350"; }
    const available = !props.province || Object.keys(BOUNDARIES.regions).some(k => k.startsWith(`${props.province}:`) && BOUNDARIES.regions[k].status === "available");
    setStatus(available ? "loading" : "unavailable");
    if (available) fetch(`/data/boundaries/${BOUNDARIES.version}/${props.province ? `province-${props.province}` : "national"}.json`, { signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error("boundary fetch failed");
        const data = await response.json() as FeatureCollection<Geometry, ShapeProperties> & { version: string };
        if (data.version !== BOUNDARIES.version || data.type !== "FeatureCollection" || !Array.isArray(data.features)) throw new Error("boundary version mismatch");
        if (controller.signal.aborted) return;
        const features = data.features.filter(f => props.district ? f.properties.id === props.district : !f.properties.aggregate);
        for (const feature of features) {
          const p = feature.properties;
          const select = () => props.province ? latest.current.onDistrict(p.id) : latest.current.onProvince(p.id);
          L.geoJSON(feature, { pane: "region-boundaries", style: { color: props.district ? "#1645a8" : "#42657a", weight: props.district ? 2.5 : 1.4, fillColor: "#4e94d8", fillOpacity: props.district ? .12 : .07 },
            onEachFeature: (_, layer) => {
              layer.bindTooltip(`${p.name} · 2025년 참고 경계`, { sticky: true });
              layer.on("click", select);
              layer.on("add", () => {
                const element = (layer as Leaflet.Path).getElement();
                if (element) { element.setAttribute("role", "button"); element.setAttribute("tabindex", "0"); element.setAttribute("aria-label", `2025년 경계에서 ${p.name} 선택`);
                  element.addEventListener("keydown", event => { const e = event as KeyboardEvent; if (e.key === "Enter" || e.key === " ") { e.preventDefault(); select(); } }); }
              });
            } }).addTo(layers);
        }
        setStatus(features.length ? "ready" : "unavailable");
        if (props.district && features.length) latest.current.onBoundary(boundaryReference(props.province, props.district));
      }).catch(error => { if (!controller.signal.aborted && error.name !== "AbortError") { setStatus("error"); latest.current.onBoundary(null); } });
    return () => { controller.abort(); layers.remove(); latest.current.onBoundary(null); };
  }, [props.engine, props.province, props.district, visible]);
  const unavailable = props.district && boundaryRegion(props.province, props.district)?.status !== "available";
  return <div className="space-y-1 border-b border-ink/10 bg-white px-3 py-2 text-xs leading-5" data-boundary-scope={key}>
    <button className="region-button" aria-pressed={visible} onClick={() => { latest.current.onBoundary(null); setState({ key, status: "loading" }); setVisible(v => !v); }}>2025년 참고 경계 {visible ? "숨기기" : "보기"}</button>
    <p>경계 기준: {BOUNDARIES.boundaryDate} · SGIS. 현재 행정구역과 다를 수 있으며 자료 포함 판정·통계 배분에는 사용하지 않습니다.</p>
    {visible && <p role="status">{unavailable || status === "unavailable" ? "이 조회 지역에 맞는 경계는 확인 중입니다. 지역 목록과 관광자료 조회를 이용하세요." : status === "error" ? "경계 자료를 불러오지 못했습니다. 지역 목록과 관광자료 조회는 계속 사용할 수 있습니다." : status === "loading" ? "참고 경계를 불러오고 있습니다." : "푸른 영역: 공식 코드로 연결한 2025년 참고 경계. 영역을 선택하면 해당 지역을 조회합니다."}</p>}
    <a href={BOUNDARIES.source} target="_blank" rel="noreferrer" className="underline">SGIS 경계 원본 · 코드 연계 기준 {BOUNDARIES.crosswalkDate}</a>
  </div>;
}
