"use client";
import type { RefObject } from "react";
import type { Anchor } from "@/components/existing/memory";
import type { ResourceItem, ResourceRow } from "@/lib/existing/types";
import { distanceText, KIND_LABEL, RADII } from "./resource-labels";

export type NumberedRow = ResourceRow & { number: number };

/** Name-ordered list (distance order only after an explicit anchor). Items without coordinates stay listed. */
export function ResourceList({ rows, listRef, detailId, comparedIds, anchored, onOpen, onCompare }: {
  rows: NumberedRow[]; listRef: RefObject<HTMLUListElement | null>; detailId: string | null; comparedIds: Set<string>; anchored: boolean;
  onOpen: (item: ResourceItem) => void; onCompare: (item: ResourceItem) => void;
}) {
  return <ul ref={listRef} aria-label="관광자원 목록" tabIndex={-1} className="max-h-[36rem] space-y-2 overflow-y-auto pr-1">
    {rows.map(r => {
      const inCompare = comparedIds.has(r.item.id), open = r.item.id === detailId;
      return <li key={r.item.id} className={`rounded-xl border ${open ? "border-blue bg-blue-soft" : "border-ink/10 bg-white"}`}>
        <button type="button" data-resource-id={r.item.id} aria-pressed={open} onClick={() => onOpen(r.item)} className="block w-full rounded-xl p-3 pb-1 text-left text-sm hover:bg-paper/60">
          <span className="break-words font-bold">{r.number}. {r.item.title}</span>
          <span className="mt-1 block break-words text-xs text-muted">{KIND_LABEL[r.item.kind]} · {r.item.address || "주소 정보 없음"}{r.item.point ? "" : " · 지도 위치 없음"}</span>
          {anchored && <span className="mt-1 block text-xs font-bold">{distanceText(r.distanceKm)}</span>}
        </button>
        <div className="flex flex-wrap items-center gap-2 px-3 pb-2">
          <button type="button" className={`region-button min-h-8 px-2 py-1 text-xs ${inCompare ? "border-blue font-extrabold text-blue" : ""}`}
            aria-label={`${r.item.title} ${inCompare ? "함께 보기에서 빼기" : "함께 보기에 추가"}`} onClick={() => onCompare(r.item)}>
            {inCompare ? "✓ 함께 보기에서 빼기" : "함께 보기에 추가"}
          </button>
        </div>
      </li>;
    })}
  </ul>;
}

export function AnchorControls({ anchor, radiusKm, sort, onClear, onRadius, onSort }: {
  anchor: Anchor | null; radiusKm: number | null; sort: "name" | "distance"; onClear: () => void; onRadius: (r: number | null) => void; onSort: (s: "name" | "distance") => void;
}) {
  if (!anchor) return <p className="text-xs text-muted">거리는 자원 상세의 ‘이 자원을 기준점으로’ 또는 지도의 ‘지도 중심을 기준점으로’를 고른 뒤에 보여요.</p>;
  return <div className="flex flex-wrap items-end gap-3 rounded-xl bg-paper p-3 text-sm">
    <p className="min-w-0 basis-full break-words"><strong>기준점</strong> {anchor.label}</p>
    <label className="text-xs font-bold">반경<select className="workspace-input mt-1 block" value={radiusKm ?? ""} onChange={e => onRadius(e.target.value ? Number(e.target.value) : null)}>
      <option value="">제한 없음</option>{RADII.map(r => <option key={r} value={r}>{r}km 안</option>)}
    </select></label>
    <label className="text-xs font-bold">정렬<select className="workspace-input mt-1 block" value={sort} onChange={e => onSort(e.target.value as "name" | "distance")}>
      <option value="name">이름순</option><option value="distance">가까운 순</option>
    </select></label>
    <button type="button" className="region-button" onClick={onClear}>기준점 해제</button>
  </div>;
}
