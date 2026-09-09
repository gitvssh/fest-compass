"use client";
import { useEffect, useState } from "react";
import outline from "@/data/korea-outline.json";
import { REGIONS } from "@/lib/region/model";
import type { Resource } from "@/lib/region/types";
import { hasPosition, NATIONAL_BOUNDS as nationwide, PROVINCE_ANCHORS as anchors, resourceBounds, type Bounds } from "@/lib/region/map-view";
const cosine = Math.cos(36 * Math.PI / 180);
const project = (lon: number, lat: number) => [lon * cosine * 100, -lat * 100];
export function RegionOutlineMap({ province, resources, selected, onProvince, onResource, onBounds }: {
  province: string; resources: Resource[]; selected: string; onProvince: (code: string) => void; onResource: (id: string) => void; onBounds: (bounds: Bounds | null) => void;
}) {
  const [bounds, setBounds] = useState<Bounds>(nationwide), [changed, setChanged] = useState(false);
  useEffect(() => {
    setBounds(province ? resourceBounds(resources, province) : nationwide);
    setChanged(false);
  }, [province, resources]);
  function move(scale: number, dx = 0, dy = 0) {
    const [w, h] = [bounds[2] - bounds[0], bounds[3] - bounds[1]], cx = (bounds[0] + bounds[2]) / 2 + dx * w, cy = (bounds[1] + bounds[3]) / 2 + dy * h;
    if (w * scale < 0.025 || w * scale > 15) return;
    setBounds([cx - w * scale / 2, cy - h * scale / 2, cx + w * scale / 2, cy + h * scale / 2]); setChanged(true);
  }
  const [left, bottom] = project(bounds[0], bounds[1]), [right, top] = project(bounds[2], bounds[3]);
  const size = Math.max(right - left, bottom - top) / 42;
  const provinces = [...new Map(REGIONS.map(r => [r.provinceCode, r.provinceName])).entries()];
  return <div className="overflow-hidden rounded-2xl border border-ink/15 bg-[#e9f1f4]">
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink/10 bg-white/90 p-3 text-xs">
      <span className="font-bold">{province ? "선택 지역 · 자료 좌표" : "전국 · 시도 선택"}</span>
      <div className="flex gap-1">{[["확대", "+", () => move(.65)], ["축소", "−", () => move(1.5)], ["서쪽으로 이동", "←", () => move(1, -.25)], ["동쪽으로 이동", "→", () => move(1, .25)], ["북쪽으로 이동", "↑", () => move(1, 0, .25)], ["남쪽으로 이동", "↓", () => move(1, 0, -.25)]] .map(([label, symbol, action]) => <button key={String(label)} aria-label={String(label)} onClick={action as () => void} className="min-h-9 min-w-9 rounded-lg border border-ink/20 bg-white font-bold">{String(symbol)}</button>)}</div>
    </div>
    <svg role="group" aria-label="전국 지역 탐색 지도" className="h-[420px] w-full sm:h-[510px]" viewBox={`${left} ${top} ${right - left} ${bottom - top}`}>
      <title>전국 육지 윤곽과 지역 선택 표식</title>
      <path d={outline.path} fill="#fafcf8" stroke="#95a9ad" strokeWidth={.65} vectorEffect="non-scaling-stroke" fillRule="evenodd" />
      {!province && provinces.map(([code, name]) => { const anchor = anchors[code]; if (!anchor) return null; const [x, y] = project(anchor[0], anchor[1]); return <g key={code} role="button" tabIndex={0} aria-label={`${name} 선택`} onClick={() => onProvince(code)} onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onProvince(code); } }} className="cursor-pointer focus:outline-blue">
        <rect x={x - size * 1.65} y={y - size * .72} width={size * 3.3} height={size * 1.44} rx={size * .45} fill="#071a33" />
        <text x={x} y={y + size * .26} textAnchor="middle" fontSize={size * .75} fontWeight="700" fill="white">{anchor[2]}</text>
      </g>; })}
      {resources.map((r, i) => { if (!hasPosition(r)) return null; const [x, y] = project(r.longitude, r.latitude); return <g key={r.id} role="button" tabIndex={0} aria-label={`지도에서 ${r.title} 상세`} onClick={() => onResource(r.id)} onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onResource(r.id); } }} className="cursor-pointer">
        <circle cx={x} cy={y} r={size * .8} fill={selected === r.id ? "#ae2e20" : "#2667e8"} stroke="white" strokeWidth={size * .12} /><text x={x} y={y + size * .25} fill="white" fontSize={size * .68} textAnchor="middle" fontWeight="bold">{i + 1}</text><title>{r.title}</title>
      </g>; })}
      {!province && <text x={project(131.1, 37.4)[0]} y={project(131.1, 37.4)[1]} fontSize={size * .58} textAnchor="middle" fill="#334155">울릉도·독도</text>}
    </svg>
    <div className="space-y-2 bg-white/90 p-3 text-xs leading-5 text-muted">
      {province && <div className="flex flex-wrap gap-2"><button className="region-button" disabled={!changed} onClick={() => { onBounds(bounds); setChanged(false); }}>이 영역의 자료 보기</button><button className="region-button" onClick={() => onBounds(null)}>공간 필터 해제</button></div>}
      <p>지역 표식은 선택용이며 행정경계가 아닙니다. 확대 지도는 자료의 좌표를 보여주며, 도로·토지 이용과 장소 사용 가능 여부는 별도 확인이 필요합니다.</p>
      <a href="https://www.naturalearthdata.com/about/terms-of-use/" target="_blank" rel="noreferrer" className="underline">육지 윤곽: Natural Earth 5.1.2 · Public domain</a>
    </div>
  </div>;
}
