"use client";
import type { RefObject } from "react";
import { RelatedSearch } from "@/components/related/RelatedSearch";
import { introKey, ResourceIntro } from "@/components/resources/ResourceIntro";
import { DetailFrame, Facts } from "@/components/resources/ResourceWorkspace";
import type { RegionRef, ResourceItem } from "@/lib/existing/types";
import { RESOURCE_TOPICS } from "@/lib/related-search/query";
import { distanceText, KIND_LABEL, sourceDate } from "./resource-labels";

/**
 * Facts of one listed resource. Name/type/address/position come from the list; the introduction is a separate
 * detail request. Opening a detail never sets the distance anchor and never adds it to the comparison.
 */
export function ResourceDetailPanel({ region, item, heading, distance, anchored, hidden, isAnchor, compared, onAnchor, onCompare, onClose }: {
  region: RegionRef; item: ResourceItem; heading: RefObject<HTMLHeadingElement | null>; distance: number | null; anchored: boolean; hidden: boolean;
  isAnchor: boolean; compared: boolean; onAnchor: () => void; onCompare: () => void; onClose: () => void;
}) {
  const modified = sourceDate(item.modifiedAt);
  return <DetailFrame id="new-resource-detail-heading" heading={heading} title={item.title} onClose={onClose}
    note={hidden ? "지금 목록 조건에서는 보이지 않는 자원이에요." : null}>
    <Facts>
      <dt className="text-muted">유형</dt><dd>{KIND_LABEL[item.kind]}</dd>
      <dt className="text-muted">주소</dt><dd>{item.address || "주소 정보 없음"}</dd>
      <dt className="text-muted">지도 위치</dt><dd>{item.point ? "있음" : "없음 · 거리를 계산할 수 없어요"}</dd>
      {anchored && <><dt className="text-muted">기준점</dt><dd className="font-bold tabular-nums">{distanceText(distance)}</dd></>}
      {modified && <><dt className="text-muted">목록 원천 수정일</dt><dd className="tabular-nums">{modified}</dd></>}
    </Facts>
    <div className="flex flex-wrap gap-2">
      <button type="button" className={`region-button min-h-11 ${compared ? "border-blue text-blue" : ""}`} onClick={onCompare}>{compared ? "함께 보기에서 빼기" : "함께 보기에 추가"}</button>
      {item.point && <button type="button" className="region-button min-h-11" disabled={isAnchor} onClick={onAnchor}>{isAnchor ? "현재 기준점이에요" : "이 자원을 기준점으로"}</button>}
      {item.title.trim() && <RelatedSearch key={`${region.code}-${item.kind}-${item.id}`} target={item.title} subject={item.title} region={region}
        topics={RESOURCE_TOPICS} buttonClassName="region-button min-h-11" />}
    </div>
    <ResourceIntro key={introKey(region, item)} region={region} item={item} />
  </DetailFrame>;
}
