"use client";
import { useId, useRef, useState, type KeyboardEvent } from "react";
import { InfoDialog } from "@/components/existing/ui";
import type { RegionRef } from "@/lib/existing/types";
import { buildQuery, QUERY_MAX, searchUrl } from "@/lib/related-search/query";

const pickYear = (years: readonly number[], year: number | null) => year !== null && years.includes(year) ? year : null;

/**
 * Opens a small search dialog that turns public names into a DuckDuckGo link opened in a new tab.
 * The query lives only in this component; every opening starts again from the current target and address.
 * Key the component by its target so another target never inherits the previous dialog.
 */
export function RelatedSearch({ target, subject, region, topics, years = [], defaultYear = null, buttonClassName = "region-button min-h-8 px-2 py-1 text-xs" }: {
  /** Visible target name used in the button's accessible name and the dialog title. */
  target: string;
  /** Public name placed before the region; omit when searching the region itself. */
  subject?: string | null;
  region: RegionRef;
  topics: readonly string[];
  /** Confirmed edition years; no year choice is shown when empty. */
  years?: readonly number[];
  defaultYear?: number | null;
  buttonClassName?: string;
}) {
  const id = useId(), input = useRef<HTMLInputElement>(null), link = useRef<HTMLAnchorElement>(null);
  const [topic, setTopic] = useState<string | null>(null);
  const [year, setYear] = useState<number | null>(() => pickYear(years, defaultYear));
  const [query, setQuery] = useState(() => buildQuery({ subject, region, year: pickYear(years, defaultYear) }));
  const standard = buildQuery({ subject, region, year, topic });
  const url = searchUrl(query);
  const name = `${target} 관련 자료 검색`;

  function choose(nextTopic: string | null, nextYear: number | null) {
    setTopic(nextTopic); setYear(nextYear);
    setQuery(buildQuery({ subject, region, year: nextYear, topic: nextTopic }));
  }
  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.nativeEvent.isComposing || e.keyCode === 229) return;
    // A search input consumes Escape to clear itself before the native dialog can cancel.
    // Keep this dialog's close-and-return-focus action consistent from the search field too.
    if (e.key === "Escape") {
      e.preventDefault();
      e.currentTarget.closest("dialog")?.close();
      return;
    }
    if (e.key !== "Enter") return;
    e.preventDefault();
    link.current?.click();
  }

  return <InfoDialog label="관련 자료 검색" title={name} buttonLabel={name} buttonClassName={buttonClassName}
    onOpen={() => choose(null, pickYear(years, defaultYear))}>
    <fieldset className="min-w-0 space-y-2">
      <legend className="font-bold">찾을 내용</legend>
      <div className="flex flex-wrap gap-x-4 gap-y-2">
        {[null, ...topics].map(t => <label key={t ?? ""} className="inline-flex min-h-8 items-center gap-2">
          <input type="radio" name={`${id}-topic`} checked={topic === t} onChange={() => choose(t, year)} />{t ?? "전체"}
        </label>)}
      </div>
    </fieldset>
    {years.length > 0 && <fieldset className="min-w-0 space-y-2">
      <legend className="font-bold">연도</legend>
      <div className="flex flex-wrap gap-x-4 gap-y-2">
        {[null, ...years].map(y => <label key={y ?? "all"} className="inline-flex min-h-8 items-center gap-2">
          <input type="radio" name={`${id}-year`} checked={year === y} onChange={() => choose(topic, y)} />{y === null ? "연도 전체" : `${y}년`}
        </label>)}
      </div>
    </fieldset>}
    <div className="min-w-0 space-y-2">
      <label htmlFor={`${id}-query`} className="block font-bold">검색어</label>
      <input ref={input} id={`${id}-query`} type="search" value={query} maxLength={QUERY_MAX} autoComplete="off" enterKeyHint="search"
        onChange={e => setQuery(e.target.value)} onKeyDown={onKeyDown}
        className="block w-full min-w-0 rounded-xl border border-ink/20 px-3 py-2" />
      {query !== standard && <button type="button" className="region-button min-h-8 px-2 py-1 text-xs"
        onClick={() => { setQuery(standard); input.current?.focus(); }}>기본 검색어로</button>}
    </div>
    {url ? <div className="space-y-1">
      <a ref={link} href={url} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" aria-describedby={`${id}-hint`}
        className="region-primary w-full sm:w-auto">DuckDuckGo에서 검색 ↗</a>
      <p id={`${id}-hint`} className="text-xs text-muted">새 탭에서 검색 결과가 열려요.</p>
    </div> : <p role="status" className="text-sm font-bold">검색어를 입력해 주세요.</p>}
  </InfoDialog>;
}
