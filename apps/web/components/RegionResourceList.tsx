"use client";
import type { RefObject } from "react";
import type { Resource } from "@/lib/region/types";
import { ResourcePhotoCredit, ResourceThumbnail } from "./resources/ResourceGallery";

export function RegionResourceList({ resources, visible, selected, listRef, onSelect }: {
  resources: Resource[]; visible: Resource[]; selected: string; listRef: RefObject<HTMLDivElement | null>; onSelect: (id: string) => void;
}) {
  return <div ref={listRef} className="max-h-96 space-y-2 overflow-auto">
    {visible.map(resource => <div key={resource.id} className={`rounded-xl border ${resource.id === selected ? "border-blue bg-blue-soft" : "border-ink/10"}`}>
      <button type="button" aria-pressed={resource.id === selected} data-resource-id={resource.id}
        className="flex min-h-11 w-full items-start gap-3 rounded-xl p-3 text-left text-sm hover:bg-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-blue"
        onClick={() => onSelect(resource.id)}>
        <ResourceThumbnail photo={resource.photo} />
        <span className="min-w-0 flex-1">
          <span className="break-words font-bold">{resources.indexOf(resource) + 1}. {resource.title}</span>
          <span className="mt-1 block break-words text-xs text-muted">{resource.address || "주소 미확보"}{resource.longitude === null ? " · 좌표 미확보" : ""}{resource.start ? ` · ${resource.start} ~ ${resource.end}` : ""}</span>
        </span>
      </button>
      {resource.photo && <ResourcePhotoCredit photo={resource.photo} className="px-3 pb-2" />}
    </div>)}
  </div>;
}
