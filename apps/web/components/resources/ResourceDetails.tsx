"use client";
import { Fragment, type ReactNode } from "react";
import { isStale } from "@/components/existing/blocks";
import { timeLabel } from "@/components/existing/format";
import type { RegionRef, ResourceItem } from "@/lib/existing/types";
import type { ResourcePhoto } from "@/lib/resources/types";
import { ResourceGallery } from "./ResourceGallery";
import { ResourceIntroContent, useResourceIntro } from "./ResourceIntro";
import { Facts } from "./ResourceWorkspace";

/** One detail request supplies the gallery, practical facts and introduction for either festival journey. */
export function ResourceDetails({ region, item, children, actions }: {
  region: RegionRef; item: ResourceItem; children?: ReactNode; actions?: ReactNode;
}) {
  const result = useResourceIntro(region, item), data = result.data, detail = data?.detail;
  const allowListPhoto = !data || data.status === "unavailable";
  const photos: ResourcePhoto[] = detail ? (detail.photos ?? []).slice(0, 20) : allowListPhoto && item.photo ? [item.photo] : [];
  const facts = detail?.facts ?? [], hasInfo = !!(facts.length || detail?.phone || detail?.website);
  const wholeStale = !!data && (isStale(data) || (!!result.failure && !result.loading));
  const retainedGalleryAt = data?.retainedGalleryAt ?? (wholeStale && detail?.photos?.length ? detail.galleryCollectedAt ?? undefined : undefined);
  const retainedInfoAt = data?.retainedInfoAt ?? (wholeStale && hasInfo ? detail?.infoCollectedAt ?? undefined : undefined);
  const infoFailed = wholeStale || detail?.infoStatus === "unavailable";
  const knownWithoutIntro = data?.status === "empty" || (data?.status === "complete" && !!detail && !detail.overview.trim());
  return <>
    <ResourceGallery name={item.title} photos={photos} loading={result.loading} onRetry={result.retry}
      retainedAt={retainedGalleryAt} refreshFailed={wholeStale}
      status={wholeStale ? "unavailable" : detail?.galleryStatus ?? (data?.status === "unavailable" || result.failure ? "unavailable" : undefined)} />
    {children}
    {(hasInfo || infoFailed) && <section aria-label={`${item.title} 이용정보`} className="space-y-2 border-t border-ink/10 pt-3">
      <h4 className="font-extrabold">이용정보</h4>
      {infoFailed && <p role={result.loading ? "status" : "alert"} className="flex flex-wrap items-center gap-2 text-sm text-muted">
        {result.loading ? "이용정보를 다시 확인하고 있어요…" : wholeStale || retainedInfoAt ? "이용정보를 새로 확인하지 못했어요." : "이용정보를 불러오지 못했어요."}
        <button type="button" className="region-button min-h-11" disabled={result.loading} aria-label={`${item.title} 이용정보 다시 불러오기`} onClick={result.retry}>{result.loading ? "확인 중…" : "다시 불러오기"}</button>
      </p>}
      {retainedInfoAt && <p className="text-sm text-muted">{timeLabel(retainedInfoAt)}에 확인한 이용정보예요.</p>}
      {hasInfo && <Facts>
        {facts.map((fact, index) => <Fragment key={`${fact.label}-${index}`}><dt>{fact.label}</dt><dd className="whitespace-pre-line">{fact.value}</dd></Fragment>)}
        {detail?.phone && <><dt>문의</dt><dd>{detail.phone}</dd></>}
        {detail?.website && <><dt>홈페이지</dt><dd><a href={detail.website} target="_blank" rel="noreferrer" className="font-bold text-blue underline underline-offset-4">홈페이지 열기 ↗</a></dd></>}
      </Facts>}
    </section>}
    {actions}
    {!knownWithoutIntro && <ResourceIntroContent item={item} result={result} />}
  </>;
}
