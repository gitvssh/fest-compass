"use client";
import { useId, useState } from "react";
import { timeLabel } from "@/components/existing/format";
import type { ResourcePhoto, ResourceSectionStatus } from "@/lib/resources/types";
import styles from "./ResourceWorkspace.module.css";

/** Original photographs keep their full frame, including photographs licensed without modification. */
export function ResourceThumbnail({ photo, className = "" }: { photo: ResourcePhoto | null | undefined; name?: string; className?: string }) {
  const [failed, setFailed] = useState<string | null>(null);
  const src = photo?.thumbnailUrl || photo?.url;
  if (!src || failed === src) return null;
  // Native images preserve the source URL and pixels; no optimizer, crop or transformation is applied.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" width={64} height={64} loading="lazy" decoding="async"
    className={`${styles.thumbnail} ${className}`} onError={() => setFailed(src)} />;
}

export function ResourcePhotoCredit({ photo, className = "" }: { photo: ResourcePhoto; className?: string }) {
  const type = photo.license === "Type3" ? 3 : 1;
  return <span className={`${styles.photoCredit} ${className}`}>
    <a href={photo.sourceUrl} target="_blank" rel="noreferrer" className="underline underline-offset-2">사진: 한국관광공사</a>
    <span aria-hidden="true"> · </span>
    <a href={`https://www.kogl.or.kr/info/licenseType${type}.do`} target="_blank" rel="noreferrer" className="underline underline-offset-2">공공누리 제{type}유형</a>
  </span>;
}

/** Inline gallery; only the selected URL changes, leaving the resource selection and detail focus untouched. */
export function ResourceGallery({ name, photos, status, loading = false, onRetry, retainedAt, refreshFailed = false }: {
  name: string; photos: ResourcePhoto[]; status?: ResourceSectionStatus; loading?: boolean; onRetry?: () => void; retainedAt?: string; refreshFailed?: boolean;
}) {
  const id = useId(), [selected, setSelected] = useState<string | null>(null);
  const [failed, setFailed] = useState<ReadonlySet<string>>(() => new Set());
  const [attempt, setAttempt] = useState(0);
  const selectedIndex = photos.findIndex(photo => photo.url === selected);
  const index = selectedIndex < 0 ? 0 : selectedIndex, photo = photos[index];
  const failedPhoto = !!photo && failed.has(photo.url);
  if (!photo && !loading && status !== "unavailable") return null;
  const move = (step: number) => setSelected(photos[(index + step + photos.length) % photos.length].url);
  const retryPhoto = () => {
    if (!photo) return;
    setFailed(previous => { const next = new Set(previous); next.delete(photo.url); return next; });
    setAttempt(previous => previous + 1);
  };
  return <section aria-label={`${name} 사진`} data-resource-gallery className="min-w-0 space-y-2">
    {photo ? <figure className="min-w-0 space-y-2">
      {failedPhoto ? <p role="status" className="flex flex-wrap items-center gap-2 rounded-lg bg-paper p-3 text-sm text-muted">
        사진을 불러오지 못했어요.
        <button type="button" className="region-button min-h-11" aria-label={`${name} 사진 다시 불러오기`} onClick={retryPhoto}>다시 불러오기</button>
      </p>
        // eslint-disable-next-line @next/next/no-img-element
        : <img key={`${photo.url}-${attempt}`} id={id} data-resource-photo src={photo.url} alt={photo.title || `${name} 사진`}
          width={960} height={640} decoding="async" className={styles.galleryPhoto}
          onError={() => setFailed(previous => new Set(previous).add(photo.url))} />}
      <figcaption className="space-y-1">
        {photo.title && <p className="break-words text-sm leading-5">{photo.title}</p>}
        <ResourcePhotoCredit photo={photo} />
        <a href={photo.url} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center text-sm font-bold text-blue underline underline-offset-4">원본 크기로 보기 ↗</a>
      </figcaption>
    </figure> : loading ? <p role="status" className="text-sm text-muted">사진을 확인하고 있어요…</p> : null}
    {photos.length > 1 && <>
      <div className="flex items-center justify-between gap-2">
        <button type="button" className="region-button min-h-11" aria-label={`${name} 이전 사진`} aria-controls={failedPhoto ? undefined : id} onClick={() => move(-1)}>← 이전</button>
        <p role="status" className="text-sm font-bold tabular-nums">{index + 1} / {photos.length}</p>
        <button type="button" className="region-button min-h-11" aria-label={`${name} 다음 사진`} aria-controls={failedPhoto ? undefined : id} onClick={() => move(1)}>다음 →</button>
      </div>
      <div role="group" aria-label={`${name} 사진 선택`} className={styles.galleryThumbnails}>
        {photos.map((entry, position) => <button key={entry.url} type="button" className={styles.galleryThumbnail}
          aria-label={`${name} 사진 ${position + 1} 보기`} aria-pressed={position === index} onClick={() => setSelected(entry.url)}>
          <ResourceThumbnail photo={entry} className={styles.galleryThumbnailImage} />
          <span className={styles.galleryThumbnailNumber}>{position + 1}</span>
        </button>)}
      </div>
    </>}
    {status === "unavailable" && <p role={loading ? "status" : "alert"} className="flex flex-wrap items-center gap-2 text-sm text-muted">
      {loading ? "사진 목록을 다시 확인하고 있어요…" : refreshFailed || retainedAt ? "사진 목록을 새로 확인하지 못했어요." : photo ? "추가 사진을 불러오지 못했어요." : "사진 목록을 불러오지 못했어요."}
      {onRetry && <button type="button" className="region-button min-h-11" disabled={loading} aria-label={`${name} 사진 목록 다시 불러오기`} onClick={onRetry}>{loading ? "확인 중…" : "다시 불러오기"}</button>}
    </p>}
    {retainedAt && <p className="text-sm text-muted">{timeLabel(retainedAt)}에 확인한 사진 목록이에요.</p>}
  </section>;
}
