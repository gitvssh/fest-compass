"use client";
import { useId, useState, type FormEvent } from "react";
import { MAX_EDITIONS } from "@/lib/existing/identity";
import type { ArchiveEditionRef, EditionHistory, Range } from "@/lib/existing/types";
import { daysBetween, editionLabel, validDay } from "./format";

export const DEFAULT_PAD = 7, WINDOW_MAX_DAYS = 120;
export type Pads = { before: number; after: number };

/** Editions to compare (1–3) and the default days shown around each festival. Applied with one button. */
export function EditionPicker({ editions, applied, pads, onApply }: { editions: ArchiveEditionRef[]; applied: string[]; pads: Pads; onApply: (editions: string[], pads: Pads) => void }) {
  const [draft, setDraft] = useState(applied), [before, setBefore] = useState(String(pads.before)), [after, setAfter] = useState(String(pads.after));
  const [error, setError] = useState(""), ids = useId(), full = draft.length >= MAX_EDITIONS;
  function submit(event: FormEvent) {
    event.preventDefault();
    const valid = (v: string) => /^\d{1,2}$/.test(v) && Number(v) <= 30;
    if (!draft.length) { setError("비교할 회차를 하나 이상 골라 주세요."); return; }
    if (!valid(before) || !valid(after)) { setError("개최 전후 표시 일수는 0~30일로 입력해 주세요."); return; }
    setError(""); onApply(draft, { before: Number(before), after: Number(after) });
  }
  const changed = draft.join(",") !== applied.join(",") || before !== String(pads.before) || after !== String(pads.after);
  return <form onSubmit={submit} className="region-card space-y-2" noValidate>
    <fieldset>
      <legend id="edition-picker" tabIndex={-1} className="text-sm font-extrabold">비교할 회차 <span className="font-normal text-muted">{draft.length}/{MAX_EDITIONS}개 선택</span></legend>
      {editions.length === 0 ? <p className="mt-2 text-sm text-muted">회차 목록을 불러오고 있어요…</p> :
        <ul className="mt-2 flex flex-wrap gap-2">{editions.map(e => {
          const checked = draft.includes(e.editionId), locked = !checked && full;
          return <li key={e.editionId}><label className={`inline-flex min-h-10 items-center gap-2 rounded-xl border px-3 py-2 text-sm ${checked ? "border-blue bg-blue-soft font-bold" : "border-ink/15 bg-white"} ${locked ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}>
            <input type="checkbox" checked={checked} disabled={locked} aria-describedby={locked ? `${ids}-full` : undefined}
              onChange={() => setDraft(d => checked ? d.filter(x => x !== e.editionId) : [...d, e.editionId])} />
            {editionLabel(e)}{e.cancelled ? " · 취소" : ""}
          </label></li>;
        })}</ul>}
      {full && <p id={`${ids}-full`} className="mt-1 text-xs text-muted">다른 회차를 보려면 하나를 해제하세요.</p>}
    </fieldset>
    <div className="flex flex-wrap items-end gap-2">
      <label className="text-xs font-bold">개최 전 표시<input className="workspace-input mt-1 w-20" inputMode="numeric" value={before} onChange={e => setBefore(e.target.value)} aria-describedby={`${ids}-unit`} /></label>
      <label className="text-xs font-bold">종료 후 표시<input className="workspace-input mt-1 w-20" inputMode="numeric" value={after} onChange={e => setAfter(e.target.value)} aria-describedby={`${ids}-unit`} /></label>
      <span id={`${ids}-unit`} className="pb-3 text-xs text-muted">일</span>
      <button type="submit" className="region-primary" disabled={!changed}>적용</button>
    </div>
    {error && <p role="alert" className="text-sm font-bold text-red-800">{error}</p>}
  </form>;
}

/** Optional absolute chart range for one edition. Invalid input stays in the form; the applied chart is kept. */
export function WindowForm({ edition, custom, onApply }: { edition: EditionHistory; custom: boolean; onApply: (range: Range | null) => void }) {
  const [open, setOpen] = useState(false), [start, setStart] = useState(edition.window?.start ?? ""), [end, setEnd] = useState(edition.window?.end ?? "");
  const [error, setError] = useState(""), ids = useId();
  if (!edition.start || !edition.end || !edition.window) return null;
  function submit(event: FormEvent) {
    event.preventDefault();
    if (!validDay(start) || !validDay(end)) { setError("표시 시작일과 종료일을 날짜로 입력해 주세요."); return; }
    if (end < start) { setError("종료일은 시작일과 같거나 뒤여야 해요."); return; }
    if (daysBetween(start, end) > WINDOW_MAX_DAYS) { setError(`표시 기간은 ${WINDOW_MAX_DAYS}일 이내로 골라 주세요.`); return; }
    setError(""); setOpen(false); onApply({ start, end });
  }
  return <div className="text-sm">
    <div className="flex flex-wrap gap-2">
      <button type="button" className="region-button min-h-8 px-2 py-1 text-xs" aria-expanded={open} aria-controls={`${ids}-form`} onClick={() => setOpen(o => !o)}>표시 기간 바꾸기</button>
      {custom && <button type="button" className="region-button min-h-8 px-2 py-1 text-xs" onClick={() => onApply(null)}>기본 표시 기간으로</button>}
    </div>
    {open && <form id={`${ids}-form`} onSubmit={submit} className="mt-2 flex flex-wrap items-end gap-2" noValidate>
      <label className="text-xs font-bold">표시 시작일<input type="date" className="workspace-input mt-1" value={start} onChange={e => setStart(e.target.value)} aria-invalid={!!error || undefined} aria-describedby={error ? `${ids}-error` : undefined} /></label>
      <label className="text-xs font-bold">표시 종료일<input type="date" className="workspace-input mt-1" value={end} onChange={e => setEnd(e.target.value)} aria-invalid={!!error || undefined} aria-describedby={error ? `${ids}-error` : undefined} /></label>
      <button type="submit" className="region-button">적용</button>
      {error && <p id={`${ids}-error`} role="alert" className="basis-full text-xs font-bold text-red-800">{error}</p>}
    </form>}
  </div>;
}
