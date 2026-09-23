"use client";
import { useEffect, useState, type FormEvent, type RefObject } from "react";
import type { RegionRef, ScheduleEvent, ScheduleResponse, SourceRef } from "@/lib/existing/types";
import { monthDays, WEEKDAYS } from "@/lib/region/calendar";
import { SOURCE } from "@/lib/region/model";
import { isStale, keepBlock } from "./blocks";
import { addMonth, dateOnly, fullDate, koreaToday, monthTitle, periodLabel, shortDate, timeLabel } from "./format";
import { InfoDialog, LoadState, TableScroll } from "./ui";
import type { KeyedState } from "./useKeyedRequest";

/** Same period refresh: keep the earlier successful event list (and its counts) when only the event source failed. */
export function mergeSchedule(previous: ScheduleResponse, next: ScheduleResponse): ScheduleResponse {
  const events = keepBlock(previous.events, next.events);
  return { ...next, events, summary: { ...next.summary, events: isStale(events) ? previous.summary.events : next.summary.events } };
}
/** Dated, not-cancelled registrations on a day. Cancelled or undated ones stay in the list with their status. */
export const eventsOnDay = (items: ScheduleEvent[], date: string) => items.filter(e => e.datesKnown && e.scheduleStatus !== "cancelled" && e.start && e.end && e.start <= date && e.end >= date);
export function eventStatusLabel(e: ScheduleEvent): string {
  if (e.scheduleStatus === "cancelled") return "취소";
  if (!e.datesKnown || !e.start || !e.end) return "일정 미확인";
  return `${fullDate(e.start)} ~ ${shortDate(e.end)}`;
}

const MAX_IN_CELL = 2;

export function ScheduleCalendar({ region, month, result, onMonth, heading }: {
  region: RegionRef; month: string; result: KeyedState<ScheduleResponse>; onMonth: (month: string) => void; heading: RefObject<HTMLHeadingElement | null>;
}) {
  const data = result.data, thisYear = Number(koreaToday().slice(0, 4));
  const [draftYear, setDraftYear] = useState(month.slice(0, 4)), [draftMonth, setDraftMonth] = useState(month.slice(5, 7));
  useEffect(() => { setDraftYear(month.slice(0, 4)); setDraftMonth(month.slice(5, 7)); }, [month]);
  const years = Array.from({ length: thisYear + 3 - 2020 + 1 }, (_, i) => 2020 + i);
  function jump(event: FormEvent) { event.preventDefault(); onMonth(`${draftYear}-${draftMonth}`); }
  const days = new Map(data?.days.map(d => [d.date, d]) ?? []);
  const events = data?.events.items ?? [];
  const holidays = data?.summary.holidays;
  return <section aria-labelledby="calendar-heading" className="region-card space-y-3">
    <h3 id="calendar-heading" ref={heading} tabIndex={-1} className="text-lg font-extrabold">{monthTitle(month)} · {region.districtName} 달력</h3>
    <div className="flex flex-wrap items-end gap-2">
      <button type="button" className="region-button" aria-label={`이전 달, ${monthTitle(addMonth(month, -1))} 보기`} disabled={month <= "2000-01"} onClick={() => onMonth(addMonth(month, -1))}>이전 달</button>
      <button type="button" className="region-button" aria-label={`다음 달, ${monthTitle(addMonth(month, 1))} 보기`} disabled={month >= "2035-12"} onClick={() => onMonth(addMonth(month, 1))}>다음 달</button>
      <form onSubmit={jump} className="flex flex-wrap items-end gap-2">
        <label className="text-xs font-bold">연도<select className="workspace-input mt-1" value={draftYear} onChange={e => setDraftYear(e.target.value)}>
          {(years.includes(Number(draftYear)) ? years : [Number(draftYear), ...years]).map(y => <option key={y} value={y}>{y}년</option>)}</select></label>
        <label className="text-xs font-bold">월<select className="workspace-input mt-1" value={draftMonth} onChange={e => setDraftMonth(e.target.value)}>
          {Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0")).map(m => <option key={m} value={m}>{Number(m)}월</option>)}</select></label>
        <button type="submit" className="region-button" disabled={`${draftYear}-${draftMonth}` === month}>이동</button>
      </form>
    </div>
    <LoadState loading={result.loading} failure={result.failure} hasData={!!data} retrievedAt={data?.retrievedAt} subject="달력 정보를" onRetry={result.retry} />
    {data && <>
      {holidays && holidays.status !== "complete" && <p className="rounded-xl bg-paper p-3 text-sm">
        {holidays.status === "unknown" ? "이 기간의 공휴일 정보를 불러올 수 없어요." : `일부 날짜(${holidays.uncovered.map(r => periodLabel(r.start, r.end)).join(", ")})의 공휴일 정보를 불러올 수 없어요.`}
      </p>}
      <TableScroll label={`${monthTitle(month)} 달력`}>
        <table className="w-full min-w-[36rem] table-fixed border-collapse text-xs">
          <caption className="sr-only">{monthTitle(month)} {region.districtName} 공휴일과 등록 행사</caption>
          <thead><tr>{WEEKDAYS.map(d => <th key={d} scope="col" className="py-1 font-bold text-muted">{d}</th>)}</tr></thead>
          <tbody>{monthDays(month).map((week, w) => <tr key={w}>{week.map((date, i) => {
            if (!date) return <td key={`pad-${i}`} className="border border-ink/5 bg-paper/60" />;
            const day = days.get(date), onDay = eventsOnDay(events, date);
            return <td key={date} className={`h-24 border border-ink/10 p-1 align-top ${day?.holidays.length ? "bg-coral-soft/40" : "bg-white"}`}>
              <span className={`block font-bold ${day?.weekend || day?.holidays.length ? "text-coral" : ""}`}>{Number(date.slice(8))}</span>
              {day?.holidays.map(h => <span key={h} className="block truncate font-bold text-coral" title={h}>{h}</span>)}
              {onDay.slice(0, MAX_IN_CELL).map(e => <span key={e.id} className="mt-0.5 block truncate rounded bg-blue-soft px-1 text-navy" title={e.title}>{e.title}</span>)}
              {onDay.length > MAX_IN_CELL && <span className="block text-muted">외 {onDay.length - MAX_IN_CELL}건</span>}
            </td>;
          })}</tr>)}</tbody>
        </table>
      </TableScroll>
      <EventList data={data} onRetry={result.retry} />
      <InfoDialog label="달력 출처 보기" title="공휴일·등록 행사 출처">
        <HolidaySources sources={data.holidaySource.sources} />
        <p>등록 행사: 한국관광공사 축제·행사 정보에서 {periodLabel(data.events.range.start, data.events.range.end)}와 겹치는 {data.region.name} 일정을 조회했어요. 등록되지 않은 행사는 포함되지 않아요.
          {data.events.collectedAt ? ` · ${timeLabel(data.events.collectedAt)} 수집` : ""}</p>
        <p><a className="font-bold text-blue underline" href={SOURCE} target="_blank" rel="noreferrer">공공데이터포털 관광정보 서비스 ↗</a></p>
        <p className="text-xs text-muted">{timeLabel(data.retrievedAt)} 조회</p>
      </InfoDialog>
    </>}
  </section>;
}

export function HolidaySources({ sources }: { sources: SourceRef[] }) {
  if (!sources.length) return <p>공휴일: 이 기간에 연결된 공휴일 자료가 없어요.</p>;
  return <ul className="list-disc space-y-1 pl-5">{sources.map(s => <li key={`${s.url}-${s.title}`}>공휴일: <a className="font-bold text-blue underline" href={s.url} target="_blank" rel="noreferrer">{s.title} ↗</a>{s.publishedAt ? ` · 공표 ${dateOnly(s.publishedAt)}` : ""}{s.checkedAt ? ` · 확인 ${dateOnly(s.checkedAt)}` : ""}</li>)}</ul>;
}

function EventList({ data, onRetry }: { data: ScheduleResponse; onRetry: () => void }) {
  const block = data.events;
  return <div className="space-y-2">
    <h4 className="font-extrabold">등록 행사</h4>
    {block.status === "unavailable" && <p role="alert" className="flex flex-wrap items-center gap-2 rounded-xl bg-coral-soft p-3 text-sm">행사 일정을 불러오지 못했어요.<button type="button" className="region-button" onClick={onRetry}>다시 불러오기</button></p>}
    {isStale(block) && <p role="alert" className="flex flex-wrap items-center gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-950">새 행사 일정을 불러오지 못했어요. {timeLabel(block.collectedAt)} 기준 일정이에요.<button type="button" className="region-button" onClick={onRetry}>다시 불러오기</button></p>}
    {block.status === "empty" && <p className="text-sm">이 기간에 등록된 행사가 없어요.</p>}
    {block.items.length > 0 && <ul className="space-y-1 text-sm">{block.items.map(e => <li key={e.id} className="rounded-xl border border-ink/10 p-2">
      <span className="font-bold">{e.title}</span>
      <span className="block break-words text-xs text-muted">{eventStatusLabel(e)}{e.address ? ` · ${e.address}` : ""}</span>
    </li>)}</ul>}
  </div>;
}
