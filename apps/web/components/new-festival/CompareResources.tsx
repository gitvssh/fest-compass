"use client";
import type { RefObject } from "react";
import { introKey, IntroCell } from "@/components/resources/ResourceIntro";
import { Facts } from "@/components/resources/ResourceWorkspace";
import type { RegionRef, ResourceItem } from "@/lib/existing/types";
import { distanceText, KIND_LABEL, MAX_COMPARED } from "./resource-labels";

/**
 * Up to two resources read side by side with the same fields in the same order. It is a factual reading aid:
 * no ranking, score or venue decision. Items hidden by the current filters stay here and can be removed.
 */
export function CompareResources({ region, items, hiddenIds, anchored, distances, notice, heading, onRemove, onOpen }: {
  region: RegionRef; items: ResourceItem[]; hiddenIds: Set<string>; anchored: boolean; distances: Map<string, number | null>;
  notice: string | null; heading: RefObject<HTMLHeadingElement | null>; onRemove: (item: ResourceItem) => void; onOpen: (item: ResourceItem) => void;
}) {
  return <section aria-labelledby="new-compare-heading" className="region-card space-y-3 text-[15px] leading-6">
    <h3 id="new-compare-heading" ref={heading} tabIndex={-1} className="text-xl font-extrabold">함께 보기 <span className="text-base font-bold tabular-nums text-muted">{items.length}/{MAX_COMPARED}</span></h3>
    {notice && <p role="alert" className="rounded-xl bg-amber-50 px-3 py-2 text-amber-950">{notice}</p>}
    {items.length === 0 ? <p className="text-sm text-muted">목록에서 ‘함께 보기에 추가’를 누르면 두 곳까지 나란히 볼 수 있어요.</p>
      : <div className={`grid gap-3 ${items.length > 1 ? "md:grid-cols-2" : ""}`}>
        {items.map(item => <article key={item.id} aria-labelledby={`new-compare-${item.id}`} className="min-w-0 space-y-3 rounded-xl border border-ink/15 p-4">
          <div className="flex items-start justify-between gap-3">
            <h4 id={`new-compare-${item.id}`} className="min-w-0 break-words text-base font-extrabold leading-snug">{item.title}</h4>
            <button type="button" className="region-button min-h-11 shrink-0" aria-label={`${item.title} 함께 보기에서 빼기`} onClick={() => onRemove(item)}>빼기</button>
          </div>
          {hiddenIds.has(item.id) && <p className="text-[13px] text-muted">지금 목록 조건에서는 보이지 않아요.</p>}
          <Facts>
            <dt className="text-muted">유형</dt><dd>{KIND_LABEL[item.kind]}</dd>
            <dt className="text-muted">주소</dt><dd>{item.address || "— 주소 정보 없음"}</dd>
            <dt className="text-muted">지도 위치</dt><dd>{item.point ? "있음" : "— 없음"}</dd>
            {anchored && <><dt className="text-muted">기준점</dt><dd className="font-bold tabular-nums">{distanceText(distances.get(item.id) ?? null)}</dd></>}
            <dt className="text-muted">소개</dt><dd><IntroCell key={introKey(region, item)} region={region} item={item} /></dd>
          </Facts>
          <button type="button" className="inline-flex min-h-11 items-center text-sm font-bold text-blue underline underline-offset-4" aria-label={`${item.title} 상세 보기`} onClick={() => onOpen(item)}>상세 보기</button>
        </article>)}
      </div>}
  </section>;
}
