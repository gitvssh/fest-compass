import { connectEvidence, copy } from "./model";
import type { PlanDraft, SourceCopy } from "./types";

/** Only a selected tourism/cultural resource can supply a venue input. */
export function venueResource(source: SourceCopy) {
  if (source.kind !== "region" || !["12", "14"].includes(source.value.result.query.kind) || !("resourceId" in source.value.selection)) return null;
  const id = source.value.selection.resourceId;
  const resource = source.value.result.resources.items.find(item => item.id === id);
  if (!resource?.title.trim()) return null;
  const venue = [resource.title.trim(), resource.address.trim()].filter(Boolean).join(" · ");
  return venue.length <= 2000 ? { resource, venue } : null;
}

export function applyVenueEvidence(draft: PlanDraft, optionId: string, source: SourceCopy, reason: string): PlanDraft {
  const selected = venueResource(source);
  if (!selected) throw new Error("장소로 입력할 관광지·문화시설 자료를 선택하세요.");
  const option = draft.options.find(o => o.id === optionId);
  if (!option) throw new Error("연결할 후보를 먼저 선택하세요.");
  if (option.venue === selected.venue) throw new Error("같은 장소가 입력되어 있습니다. 필요하면 일반 근거 연결을 사용하세요.");
  const existing = draft.evidence.find(e => e.key === source.key);
  if (existing && JSON.stringify(existing) !== JSON.stringify(source)) throw new Error("같은 근거 식별자의 내용이 다릅니다. 기존 사본을 확인하세요.");
  const next = option.links.some(l => l.sourceKey === source.key && l.field === "venue")
    ? copy(draft) : connectEvidence(draft, optionId, source, "venue", reason);
  next.options.find(o => o.id === optionId)!.venue = selected.venue;
  return next;
}
