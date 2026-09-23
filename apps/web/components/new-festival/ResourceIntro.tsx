"use client";
import { useId, useState } from "react";
import { isStale } from "@/components/existing/blocks";
import { dateOnly, timeLabel } from "@/components/existing/format";
import { InfoDialog } from "@/components/existing/ui";
import { useKeyedRequest, type KeyedState } from "@/components/existing/useKeyedRequest";
import type { RegionRef, ResourceItem } from "@/lib/existing/types";
import { parseResourceDetail, resourceDetailKey } from "@/lib/new-festival/request";
import type { ResourceDetailResponse } from "@/lib/new-festival/types";

const SHORT = 280;
const retrievable = (s: ResourceDetailResponse["status"]) => s === "complete" || s === "empty";
/** Same resource refresh: a provider failure keeps the earlier answer for this exact resource, marked as not refreshed. */
function merge(previous: ResourceDetailResponse, next: ResourceDetailResponse): ResourceDetailResponse {
  return next.status === "unavailable" && retrievable(previous.status) ? { ...previous, refreshFailed: true } as ResourceDetailResponse : next;
}

/** Provider introduction of one listed resource (same id + type + region). Independent of the list request. */
export function useResourceIntro(region: RegionRef, item: ResourceItem): KeyedState<ResourceDetailResponse> {
  const params = new URLSearchParams({ province: region.province, district: region.district, kind: item.kind, id: item.id });
  const key = (() => { try { return resourceDetailKey(parseResourceDetail(params)); } catch { return null; } })();
  return useKeyedRequest<ResourceDetailResponse>(key ? `/api/new/resource-detail?${params}` : null, merge, key);
}

export type IntroView =
  | { kind: "loading" }
  | { kind: "failed" }
  | { kind: "absent" }
  | { kind: "text"; data: ResourceDetailResponse & { detail: NonNullable<ResourceDetailResponse["detail"]> }; stale: boolean };
/**
 * complete → text; empty / not found / mismatch → absent (block omitted); provider or request failure → failed
 * (retry in place). A kept earlier answer without text whose refresh failed is a failure too, never a silent absence.
 */
export function introView(result: KeyedState<ResourceDetailResponse>): IntroView {
  const data = result.data;
  if (!data) return result.loading ? { kind: "loading" } : result.failure ? { kind: "failed" } : { kind: "absent" };
  if (data.status === "unavailable") return result.loading ? { kind: "loading" } : { kind: "failed" };
  const stale = isStale(data) || (!!result.failure && !result.loading);
  if (data.status === "complete" && data.detail && data.detail.overview.trim()) {
    return { kind: "text", data: data as ResourceDetailResponse & { detail: NonNullable<ResourceDetailResponse["detail"]> }, stale };
  }
  return stale ? { kind: "failed" } : { kind: "absent" };
}

/** Plain text only (rendered as a React text node, never as markup). Long text folds with an explicit toggle. */
export function IntroText({ text, truncated, name }: { text: string; truncated: boolean; name: string }) {
  const [open, setOpen] = useState(false), id = useId(), long = text.length > SHORT;
  const shown = long && !open ? `${text.slice(0, SHORT).trimEnd()}…` : text;
  return <div className="space-y-1">
    <p id={id} className="whitespace-pre-line break-words leading-6">{shown}</p>
    {open && truncated && <p className="text-xs text-muted">소개가 길어 앞부분만 보여드려요.</p>}
    {long && <button type="button" className="text-sm font-bold text-blue underline underline-offset-4" aria-expanded={open} aria-controls={id}
      aria-label={`${name} 소개 ${open ? "접기" : "더 보기"}`} onClick={() => setOpen(v => !v)}>{open ? "소개 접기" : "소개 더 보기"}</button>}
  </div>;
}

export function IntroSource({ data, name }: { data: ResourceDetailResponse; name: string }) {
  const modified = data.detail?.modifiedAt && /^\d{8}/.test(data.detail.modifiedAt) ? `${data.detail.modifiedAt.slice(0, 4)}-${data.detail.modifiedAt.slice(4, 6)}-${data.detail.modifiedAt.slice(6, 8)}` : null;
  return <InfoDialog label="소개 출처" title={`${name} 소개 출처`} buttonLabel={`${name} 소개 출처 보기`} buttonClassName="region-button min-h-8 px-2 py-1 text-xs">
    <p>한국관광공사 국문 관광정보의 공통 소개예요.</p>
    {data.source && <p><a className="font-bold text-blue underline" href={data.source.url} target="_blank" rel="noreferrer">{data.source.title} ↗</a></p>}
    <p>소개 수집 {timeLabel(data.source?.collectedAt ?? null)}{modified ? ` · 소개 원천 수정일 ${modified}` : ""}{data.source?.checkedAt ? ` · 확인 ${dateOnly(data.source.checkedAt)}` : ""}</p>
    <p className="text-xs text-muted">{timeLabel(data.retrievedAt)} 조회</p>
  </InfoDialog>;
}

function RetryIntro({ name, onRetry, compact = false }: { name: string; onRetry: () => void; compact?: boolean }) {
  return <button type="button" className={`region-button ${compact ? "min-h-8 px-2 py-1 text-xs" : ""}`} aria-label={`${name} 소개 다시 불러오기`} onClick={onRetry}>다시 불러오기</button>;
}

/** Introduction block in the resource detail. Absence omits the block; failure retries only here. */
export function ResourceIntro({ region, item }: { region: RegionRef; item: ResourceItem }) {
  const result = useResourceIntro(region, item), view = introView(result);
  if (view.kind === "absent") return null;
  if (view.kind === "loading") return <p role="status" className="text-sm text-muted">소개를 불러오고 있어요…</p>;
  if (view.kind === "failed") return <p role="alert" className="flex flex-wrap items-center gap-2 rounded-xl bg-coral-soft p-3 text-sm">
    소개를 불러오지 못했어요.<RetryIntro name={item.title} onRetry={result.retry} />
  </p>;
  return <section aria-label={`${item.title} 소개`} className="space-y-2 border-t border-ink/10 pt-2">
    <h4 className="font-extrabold">소개</h4>
    {view.stale && <p role="alert" className="flex flex-wrap items-center gap-2 rounded-xl bg-amber-50 p-2 text-sm text-amber-950">
      새 소개를 불러오지 못했어요. {timeLabel(view.data.source?.collectedAt ?? view.data.retrievedAt)}에 수집한 소개예요.
      <RetryIntro name={item.title} onRetry={result.retry} />
    </p>}
    <IntroText text={view.data.detail.overview} truncated={view.data.detail.truncated} name={item.title} />
    <IntroSource data={view.data} name={item.title} />
  </section>;
}

/** Introduction cell of a compared resource; no text stays a plain dash, never an invented description. */
export function IntroCell({ region, item }: { region: RegionRef; item: ResourceItem }) {
  const result = useResourceIntro(region, item), view = introView(result);
  if (view.kind === "loading") return <span role="status" className="text-muted">불러오고 있어요…</span>;
  if (view.kind === "failed") return <span role="alert" className="inline-flex flex-wrap items-center gap-2">불러오지 못했어요.
    <RetryIntro name={item.title} onRetry={result.retry} compact /></span>;
  if (view.kind === "absent") return <span>—</span>;
  return <div className="space-y-1">
    {view.stale && <p role="alert" className="flex flex-wrap items-center gap-2 text-xs text-amber-950">새 소개를 불러오지 못해 {timeLabel(view.data.source?.collectedAt ?? view.data.retrievedAt)} 수집본이에요.
      <RetryIntro name={item.title} onRetry={result.retry} compact /></p>}
    <IntroText text={view.data.detail.overview} truncated={view.data.detail.truncated} name={item.title} />
    <IntroSource data={view.data} name={item.title} />
  </div>;
}
