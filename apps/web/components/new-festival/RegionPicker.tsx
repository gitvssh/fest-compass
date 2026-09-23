"use client";
import { useId, useState, type FormEvent } from "react";
import { REGIONS } from "@/lib/region/model";
import { routeCode } from "./region-route";

const PROVINCES = [...new Map(REGIONS.map(r => [r.provinceCode, r.provinceName])).entries()];

/**
 * 시도 → 시군구 selection from the verified region catalogue. Nothing is preselected unless the caller passes the
 * region already being explored. Only an exact catalogue pair is submitted (as its route code).
 */
export function RegionPicker({ initial = null, submitLabel, onPick }: {
  initial?: { province: string; district: string } | null; submitLabel: string; onPick: (code: string) => void;
}) {
  const [province, setProvince] = useState(initial?.province ?? ""), [district, setDistrict] = useState(initial?.district ?? "");
  const [error, setError] = useState<{ field: "province" | "district"; text: string } | null>(null);
  const ids = useId(), districts = REGIONS.filter(r => r.provinceCode === province);
  const provinceName = PROVINCES.find(([code]) => code === province)?.[1] ?? "";
  function submit(event: FormEvent) {
    event.preventDefault();
    if (!province) { setError({ field: "province", text: "시도를 골라 주세요." }); document.getElementById(`${ids}-province`)?.focus(); return; }
    const region = districts.find(r => r.districtCode === district);
    if (!region) { setError({ field: "district", text: "시군구까지 골라 주세요." }); document.getElementById(`${ids}-district`)?.focus(); return; }
    setError(null);
    onPick(routeCode({ province: region.provinceCode, district: region.districtCode }));
  }
  const described = (field: "province" | "district") => error?.field === field ? `${ids}-error` : undefined;
  return <form onSubmit={submit} noValidate className="space-y-2">
    <div className="flex flex-wrap items-end gap-3">
      <label className="text-sm font-bold" htmlFor={`${ids}-province`}>시도
        <select id={`${ids}-province`} className="workspace-input mt-1 block min-w-40" value={province}
          aria-invalid={error?.field === "province" || undefined} aria-describedby={described("province")}
          onChange={e => { setProvince(e.target.value); setDistrict(""); setError(null); }}>
          <option value="">시도 선택</option>{PROVINCES.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
        </select>
      </label>
      <label className="text-sm font-bold" htmlFor={`${ids}-district`}>시군구
        <select id={`${ids}-district`} className="workspace-input mt-1 block min-w-40" value={district} disabled={!province}
          aria-invalid={error?.field === "district" || undefined} aria-describedby={described("district")}
          onChange={e => { setDistrict(e.target.value); setError(null); }}>
          <option value="">{province ? "시군구 선택" : "시도를 먼저 고르세요"}</option>
          {districts.map(r => <option key={r.districtCode} value={r.districtCode}>{r.districtName}</option>)}
        </select>
      </label>
      <button type="submit" className="region-primary">{submitLabel}</button>
    </div>
    <p aria-live="polite" className="sr-only">{province ? `${provinceName} 시군구 ${districts.length}곳을 고를 수 있어요.` : ""}</p>
    {error && <p id={`${ids}-error`} role="alert" className="text-sm font-bold text-red-800">{error.text}</p>}
  </form>;
}
