"use client";
import { Info, X } from "lucide-react";
import { useId, useRef, useState, type MouseEvent, type PointerEvent, type ReactNode } from "react";
import type { DataFreshness } from "@/lib/existing/types";
import { timeLabel } from "./format";

/** Short loading / failure / stale-refresh line for one result area. */
export function LoadState({ loading, failure, hasData, retrievedAt, subject, onRetry, retryLabel = "다시 불러오기" }: {
  loading: boolean; failure: "network" | "invalid" | "notfound" | null; hasData: boolean; retrievedAt?: string | null; subject: string; onRetry: () => void;
  /** Name of the retry button; give each block its own when several can fail on one screen. */
  retryLabel?: string;
}) {
  if (failure === "invalid") return <p role="alert" className="rounded-xl bg-coral-soft p-3 text-sm">조회 조건을 확인하지 못했어요. 조건을 바꿔 다시 선택해 주세요.</p>;
  if (failure === "notfound") return <p role="alert" className="rounded-xl bg-paper p-3 text-sm">선택한 대상의 자료를 찾지 못했어요.</p>;
  if (failure && hasData) return <p role="alert" className="flex flex-wrap items-center gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-950">
    새 자료를 불러오지 못했어요. {timeLabel(retrievedAt ?? null)}에 조회한 결과를 보여드리고 있어요.
    <button type="button" className="region-button" onClick={onRetry}>{retryLabel}</button>
  </p>;
  if (failure) return <p role="alert" className="flex flex-wrap items-center gap-2 rounded-xl bg-coral-soft p-3 text-sm">
    {subject} 불러오지 못했어요.<button type="button" className="region-button" onClick={onRetry}>{retryLabel}</button>
  </p>;
  if (loading) return <p role="status" className="text-sm text-muted">{hasData ? "새 자료를 확인하고 있어요…" : `${subject} 불러오고 있어요…`}</p>;
  return null;
}

/** Shared header of every modal dialog: an optional badge, the title and a round close button named 닫기. */
export function DialogHeader({ titleId, title, icon, onClose }: { titleId: string; title: ReactNode; icon?: ReactNode; onClose: () => void }) {
  return <div className="ui-dialog-header">
    {icon && <span aria-hidden="true" className="ui-dialog-badge">{icon}</span>}
    <h2 id={titleId} className="ui-dialog-title">{title}</h2>
    <button type="button" className="ui-icon-button" aria-label="닫기" title="닫기" onClick={onClose}><X size={20} aria-hidden="true" /></button>
  </div>;
}

/** Closes a modal dialog on a press that starts and ends on its backdrop (a text selection dragged outside never closes it). */
export function useBackdropClose() {
  const started = useRef(false);
  return {
    onPointerDown: (e: PointerEvent<HTMLDialogElement>) => { started.current = e.target === e.currentTarget; },
    onClick: (e: MouseEvent<HTMLDialogElement>) => { if (started.current && e.target === e.currentTarget) e.currentTarget.close(); started.current = false; },
  };
}

/**
 * Native modal dialog; closing (button, Esc, backdrop) returns focus to the button that opened it. `buttonLabel` names a
 * repeated opener. `onOpen` runs just before it opens. `buttonIcon` sits before the visible label (decorative).
 */
export function InfoDialog({ label, title, children, buttonClassName = "region-button", buttonLabel, buttonIcon, icon, onOpen }: {
  label: string; title: string; children: ReactNode; buttonClassName?: string; buttonLabel?: string; buttonIcon?: ReactNode; icon?: ReactNode; onOpen?: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null), opener = useRef<HTMLButtonElement>(null), id = useId(), backdrop = useBackdropClose();
  return <>
    <button ref={opener} type="button" className={buttonClassName} aria-haspopup="dialog" aria-label={buttonLabel} onClick={() => { onOpen?.(); dialog.current?.showModal(); }}>
      {buttonIcon && <span aria-hidden="true" className="inline-flex shrink-0">{buttonIcon}</span>}{label}
    </button>
    <dialog ref={dialog} aria-labelledby={`${id}-title`} onClose={() => opener.current?.focus()} className="ui-dialog" {...backdrop}>
      <DialogHeader titleId={`${id}-title`} title={title} icon={icon ?? <Info size={18} />} onClose={() => dialog.current?.close()} />
      <div className="ui-dialog-body space-y-3">{children}</div>
    </dialog>
  </>;
}

/** Show/hide an equivalent table. Closing from inside returns focus to the toggle. */
export function Disclosure({ label, children, open: initial = false, onToggle, icon }: { label: string; children: ReactNode; open?: boolean; onToggle?: (open: boolean) => void; icon?: ReactNode }) {
  const [open, setOpen] = useState(initial), button = useRef<HTMLButtonElement>(null), id = useId();
  const set = (value: boolean) => { setOpen(value); onToggle?.(value); };
  return <div className="min-w-0">
    <button ref={button} type="button" className="region-button" aria-expanded={open} aria-controls={id} onClick={() => set(!open)}>
      {icon && <span aria-hidden="true" className="inline-flex shrink-0">{icon}</span>}{open ? `${label} 닫기` : label}
    </button>
    <div id={id} hidden={!open} className="mt-3 min-w-0">
      {open && <>
        {children}
        <button type="button" className="region-button mt-3" onClick={() => { set(false); button.current?.focus(); }}>{label} 닫기</button>
      </>}
    </div>
  </div>;
}

/** Visit data collection time, and a retry when the latest collection could not be refreshed. */
export function FreshnessNote({ freshness, retrievedAt, onRetry }: { freshness: DataFreshness | null | undefined; retrievedAt: string; onRetry: () => void }) {
  const failed = freshness?.refresh.status === "failed";
  return <div className="space-y-1 text-xs text-muted">
    {failed && <p role="alert" className="flex flex-wrap items-center gap-2 rounded-xl bg-amber-50 p-2 text-sm text-amber-950">
      새 자료를 불러오지 못했어요. {timeLabel(freshness?.collectedAt ?? null)}에 수집한 자료를 보여드리고 있어요.
      {freshness?.refresh.retryable && <button type="button" className="region-button" onClick={onRetry}>다시 불러오기</button>}
    </p>}
    <p>자료 수집 {timeLabel(freshness?.collectedAt ?? null)} · {timeLabel(retrievedAt)} 조회</p>
  </div>;
}

/** Wide tables scroll inside their own box so the page itself never scrolls sideways. */
export function TableScroll({ label, children }: { label: string; children: ReactNode }) {
  return <div role="region" aria-label={label} tabIndex={0} className="max-w-full overflow-x-auto rounded-xl border border-ink/10 focus:outline-none focus:ring-2 focus:ring-blue/30">{children}</div>;
}
