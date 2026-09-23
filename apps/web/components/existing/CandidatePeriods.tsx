"use client";
import { useId, useRef, useState, type FormEvent } from "react";
import { parseSchedule, scheduleKey } from "@/lib/existing/request";
import type { RegionRef, ScheduleResponse } from "@/lib/existing/types";
import { isStale } from "./blocks";
import { daysBetween, fullDate, periodLabel, timeLabel, validDay } from "./format";
import type { Candidate } from "./memory";
import { eventStatusLabel, HolidaySources, mergeSchedule } from "./ScheduleCalendar";
import { InfoDialog, LoadState } from "./ui";
import { useKeyedRequest } from "./useKeyedRequest";

export const MAX_CANDIDATES = 2;
const LETTERS = ["A", "B"];

/**
 * Zero to two optional start/end periods. Each is checked over its whole range; counts appear only when
 * that whole range was queried successfully. No scores, forecasts or recommendations.
 */
export function CandidatePeriods({ region, candidates, onChange, onShowMonth }: {
  region: RegionRef; candidates: Candidate[]; onChange: (next: Candidate[]) => void; onShowMonth: (month: string) => void;
}) {
  const [start, setStart] = useState(""), [end, setEnd] = useState(""), [error, setError] = useState<{ field: "start" | "end"; text: string } | null>(null);
  const ids = useId(), cards = useRef<HTMLDivElement>(null), full = candidates.length >= MAX_CANDIDATES;
  function focusCard(id: string) { requestAnimationFrame(() => cards.current?.querySelector<HTMLElement>(`[data-candidate="${id}"]`)?.focus()); }
  function add(event: FormEvent) {
    event.preventDefault();
    if (!validDay(start) || start < "2000-01-01" || start > "2035-12-31") { setError({ field: "start", text: "시작일을 날짜로 입력해 주세요." }); return; }
    if (!validDay(end) || end > "2035-12-31") { setError({ field: "end", text: "종료일을 날짜로 입력해 주세요." }); return; }
    if (end < start) { setError({ field: "end", text: "종료일은 시작일과 같거나 뒤여야 해요." }); return; }
    if (daysBetween(start, end) > 366) { setError({ field: "end", text: "후보 기간은 366일 이내로 골라 주세요." }); return; }
    const same = candidates.find(c => c.start === start && c.end === end);
    if (same) { setError(null); focusCard(same.id); return; }
    if (full) return;
    const id = LETTERS.find(l => !candidates.some(c => c.id === l))!;
    setError(null); setStart(""); setEnd("");
    onChange([...candidates, { id, start, end }].sort((a, b) => a.id.localeCompare(b.id)));
    focusCard(id);
  }
  const described = (field: "start" | "end") => error?.field === field ? `${ids}-error` : undefined;
  return <section aria-labelledby="candidates-heading" className="region-card space-y-3">
    <h3 id="candidates-heading" tabIndex={-1} className="text-lg font-extrabold">후보 기간 살펴보기 <span className="text-sm font-normal text-muted">선택 사항 · 최대 {MAX_CANDIDATES}개</span></h3>
    <form onSubmit={add} className="flex flex-wrap items-end gap-2" noValidate>
      <label className="text-xs font-bold">시작일<input type="date" className="workspace-input mt-1" min="2000-01-01" max="2035-12-31" value={start} onChange={e => setStart(e.target.value)} aria-invalid={error?.field === "start" || undefined} aria-describedby={described("start")} /></label>
      <label className="text-xs font-bold">종료일<input type="date" className="workspace-input mt-1" min="2000-01-01" max="2035-12-31" value={end} onChange={e => setEnd(e.target.value)} aria-invalid={error?.field === "end" || undefined} aria-describedby={described("end")} /></label>
      <button type="submit" className="region-primary" disabled={full} aria-describedby={full ? `${ids}-full` : undefined}>후보 기간 추가</button>
    </form>
    {full && <p id={`${ids}-full`} className="text-xs text-muted">후보는 {MAX_CANDIDATES}개까지 비교할 수 있어요. 다른 기간을 보려면 후보 하나를 지워 주세요.</p>}
    {error && <p id={`${ids}-error`} role="alert" className="text-sm font-bold text-red-800">{error.text}</p>}
    <div ref={cards} className={`grid gap-3 ${candidates.length > 1 ? "md:grid-cols-2" : ""}`}>
      {candidates.map(c => <CandidateCard key={`${c.id}-${c.start}-${c.end}`} region={region} candidate={c} onShowMonth={onShowMonth}
        onRemove={() => { onChange(candidates.filter(x => x.id !== c.id)); requestAnimationFrame(() => document.getElementById("candidates-heading")?.focus()); }} />)}
    </div>
  </section>;
}

function CandidateCard({ region, candidate: c, onShowMonth, onRemove }: { region: RegionRef; candidate: Candidate; onShowMonth: (month: string) => void; onRemove: () => void }) {
  const params = new URLSearchParams({ province: region.province, district: region.district, start: c.start, end: c.end });
  const key = (() => { try { return scheduleKey(parseSchedule(params)); } catch { return null; } })();
  const result = useKeyedRequest<ScheduleResponse>(key ? `/api/existing/schedule?${params}` : null, mergeSchedule, key), data = result.data;
  const holidays = data?.summary.holidays, events = data?.events, counted = data?.summary.events;
  return <article data-candidate={c.id} tabIndex={-1} aria-labelledby={`candidate-${c.id}`} className="min-w-0 space-y-2 rounded-xl border border-ink/15 p-3 text-sm">
    <h4 id={`candidate-${c.id}`} className="font-extrabold">후보 {c.id} · {periodLabel(c.start, c.end)} · {daysBetween(c.start, c.end)}일</h4>
    <LoadState loading={result.loading} failure={result.failure} hasData={!!data} retrievedAt={data?.retrievedAt} subject="이 기간의 일정을" onRetry={result.retry} />
    {data && <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1">
      <dt className="text-muted">토·일요일</dt><dd>{data.summary.weekendDays}일</dd>
      <dt className="text-muted">공휴일</dt><dd>{holidays?.status === "complete"
        ? holidays.dates.length ? holidays.dates.map(d => `${fullDate(d.date)} ${d.labels.join("·")}`).join(", ") : "없음"
        : <>{holidays?.dates.length ? `${holidays.dates.map(d => `${fullDate(d.date)} ${d.labels.join("·")}`).join(", ")} · ` : ""}{holidays?.status === "partial" ? "일부 날짜의 공휴일 정보를 불러올 수 없어요" : "이 기간의 공휴일 정보를 불러올 수 없어요"}</>}</dd>
      <dt className="text-muted">등록 행사</dt><dd>
        {events?.status === "unavailable" ? <span role="alert" className="inline-flex flex-wrap items-center gap-2">행사 일정을 불러오지 못했어요.<button type="button" className="region-button" onClick={result.retry}>다시 불러오기</button></span>
          : counted && counted.count !== null ? <>{counted.count === 0 ? "이 기간에 등록된 행사가 없어요" : `기간과 겹치는 등록 행사 ${counted.overlapping ?? 0}건`}
            {(counted.cancelled ?? 0) + (counted.undated ?? 0) > 0 && <span className="block text-xs text-muted">취소 {counted.cancelled ?? 0}건 · 일정 미확인 {counted.undated ?? 0}건은 세지 않았어요</span>}
            {events && isStale(events) && <span role="alert" className="mt-1 flex flex-wrap items-center gap-2 text-amber-950">새 일정을 불러오지 못했어요. {timeLabel(events.collectedAt)} 기준이에요.<button type="button" className="region-button" onClick={result.retry}>다시 불러오기</button></span>}</>
          : "전체 기간의 일정을 확인하지 못해 개수를 세지 않았어요"}
      </dd>
    </dl>}
    {data && events && events.items.length > 0 && <ul className="space-y-1">{events.items.map(e => <li key={e.id} className="rounded-lg bg-paper p-2">
      <span className="font-bold">{e.title}</span>
      <span className="block text-xs text-muted">등록 일정 {eventStatusLabel(e)}{e.overlapDays !== null && e.scheduleStatus !== "cancelled" ? ` · 후보와 ${e.overlapDays}일 겹침` : ""}</span>
    </li>)}</ul>}
    <div className="flex flex-wrap gap-2">
      <button type="button" className="region-button" onClick={() => onShowMonth(c.start.slice(0, 7))}>달력에서 보기</button>
      {data && <InfoDialog label="출처 보기" title={`후보 ${c.id} 일정 출처`}>
        <HolidaySources sources={data.holidaySource.sources} />
        <p>등록 행사: 한국관광공사 축제·행사 정보에서 {periodLabel(data.events.range.start, data.events.range.end)}와 겹치는 {data.region.name} 일정을 조회했어요.{data.events.collectedAt ? ` · ${timeLabel(data.events.collectedAt)} 수집` : ""}</p>
        <p className="text-xs text-muted">{timeLabel(data.retrievedAt)} 조회</p>
      </InfoDialog>}
      <button type="button" className="region-button" onClick={onRemove}>후보 {c.id} 지우기</button>
    </div>
  </article>;
}
