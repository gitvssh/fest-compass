"use client";
import dynamic from "next/dynamic";
import { useState } from "react";
import type { Bounds } from "@/lib/region/map-view";
import type { Resource } from "@/lib/region/types";
import { RegionOutlineMap } from "./RegionOutlineMap";
export type { Bounds } from "@/lib/region/map-view";
export type RegionMapProps = { province: string; resources: Resource[]; selected: string; appliedBounds?: Bounds | null; onProvince: (code: string) => void; onResource: (id: string) => void; onBounds: (bounds: Bounds | null) => void };
const StreetMap = dynamic(() => import("./RegionStreetMap"), { ssr: false, loading: () => <p role="status" className="region-card">지도를 준비하고 있습니다. 지역 목록도 사용할 수 있습니다.</p> });
export function RegionMap(props: RegionMapProps) {
  const [simple, setSimple] = useState(false);
  return <section aria-label="관광지도" className="min-w-0 space-y-2">
    <div className="flex flex-wrap items-center justify-between gap-2"><strong className="text-sm">{props.province ? "선택 지역 관광지도" : "전국 관광지도"}</strong><div className="flex gap-2"><button className="region-button" aria-pressed={!simple} onClick={() => setSimple(false)}>도로 지도</button><button className="region-button" aria-pressed={simple} onClick={() => setSimple(true)}>간단 지도</button></div></div>
    {simple ? <RegionOutlineMap {...props} /> : <StreetMap {...props} onFallback={() => setSimple(true)} />}
  </section>;
}
