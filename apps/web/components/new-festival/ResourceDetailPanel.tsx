"use client";
import type { RefObject } from "react";
import { RelatedSearch } from "@/components/related/RelatedSearch";
import type { RegionRef, ResourceItem } from "@/lib/existing/types";
import { RESOURCE_TOPICS } from "@/lib/related-search/query";
import { distanceText, KIND_LABEL, sourceDate } from "./resource-labels";
import { ResourceIntro } from "./ResourceIntro";

/**
 * Facts of one listed resource. Name/type/address/position come from the list; the introduction is a separate
 * detail request. Opening a detail never sets the distance anchor and never adds it to the comparison.
 */
export function ResourceDetailPanel({ region, item, heading, distance, anchored, hidden, isAnchor, compared, onAnchor, onCompare, onClose }: {
  region: RegionRef; item: ResourceItem; heading: RefObject<HTMLHeadingElement | null>; distance: number | null; anchored: boolean; hidden: boolean;
  isAnchor: boolean; compared: boolean; onAnchor: () => void; onCompare: () => void; onClose: () => void;
}) {
  const modified = sourceDate(item.modifiedAt);
  return <aside aria-labelledby="new-resource-detail-heading" className="region-card space-y-3 text-sm">
    <div className="flex items-start justify-between gap-3">
      <h3 id="new-resource-detail-heading" ref={heading} tabIndex={-1} className="min-w-0 break-words text-lg font-extrabold">{item.title}</h3>
      <button type="button" className="region-button shrink-0" onClick={onClose}>상세 닫기</button>
    </div>
    {hidden && <p className="text-xs text-muted">지금 목록 조건에서는 보이지 않는 자원이에요.</p>}
    <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1">
      <dt className="text-muted">유형</dt><dd>{KIND_LABEL[item.kind]}</dd>
      <dt className="text-muted">주소</dt><dd className="break-words">{item.address || "주소 정보 없음"}</dd>
      <dt className="text-muted">지도 위치</dt><dd>{item.point ? "있음" : "없음 · 거리를 계산할 수 없어요"}</dd>
      {anchored && <><dt className="text-muted">기준점</dt><dd>{distanceText(distance)}</dd></>}
      {modified && <><dt className="text-muted">목록 원천 수정일</dt><dd>{modified}</dd></>}
    </dl>
    <div className="flex flex-wrap gap-2">
      <button type="button" className="region-button" onClick={onCompare}>{compared ? "함께 보기에서 빼기" : "함께 보기에 추가"}</button>
      {item.point && <button type="button" className="region-button" disabled={isAnchor} onClick={onAnchor}>{isAnchor ? "현재 기준점이에요" : "이 자원을 기준점으로"}</button>}
      {item.title.trim() && <RelatedSearch key={`${region.code}-${item.kind}-${item.id}`} target={item.title} subject={item.title} region={region}
        topics={RESOURCE_TOPICS} buttonClassName="region-button" />}
    </div>
    <ResourceIntro key={`${item.kind}-${item.id}`} region={region} item={item} />
  </aside>;
}
