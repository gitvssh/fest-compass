"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { monthlyKey, parseMonthly, parseSchedule, scheduleKey } from "@/lib/existing/request";
import type { MonthlyResponse, ScheduleResponse } from "@/lib/existing/types";
import { rememberView, writeAddress } from "./address";
import { CandidatePeriods } from "./CandidatePeriods";
import { FestivalPending, useFestival, useViewHeadingFocus } from "./ExistingShell";
import { koreaToday, monthRange, validMonth } from "./format";
import { festivalMemory, shared, viewHref, type Candidate } from "./memory";
import { ObservedMonths } from "./ObservedMonths";
import { one } from "./route-params";
import { mergeSchedule, ScheduleCalendar } from "./ScheduleCalendar";
import { useKeyedRequest } from "./useKeyedRequest";

type Applied = { year: number | null; month: string | null };
const safeKey = (build: () => string) => { try { return build(); } catch { return null; } };
function readApplied(params: URLSearchParams): Applied {
  const year = one(params, "year"), month = one(params, "month");
  return { year: year && /^\d{4}$/.test(year) && Number(year) >= 2000 && Number(year) <= 2035 ? Number(year) : null, month: validMonth(month) ? month : null };
}
function addressOf(a: { year: number | null; month: string }): URLSearchParams {
  const params = new URLSearchParams();
  if (a.year !== null) params.set("year", String(a.year));
  params.set("month", a.month);
  return params;
}

/**
 * Past observations (monthly means of an observation year) and the calendar of a chosen month are separate
 * areas: changing the calendar never changes the observation year or the candidates, and vice versa.
 */
export function TimingPanel() {
  const festival = useFestival(), heading = useRef<HTMLHeadingElement>(null), calendarHeading = useRef<HTMLHeadingElement>(null);
  useViewHeadingFocus(festival.id, "timing", heading);
  const params = useSearchParams(), address = params.toString();
  const applied = useMemo(() => readApplied(new URLSearchParams(address)), [address]);
  const memory = festivalMemory(festival.id).timing;
  const month = applied.month ?? (validMonth(shared.month) ? shared.month : koreaToday().slice(0, 7));
  const [candidates, setCandidates] = useState<Candidate[]>(memory.candidates);
  const [observedMonth, setObservedMonth] = useState<string | null>(memory.observedMonth);
  const [tableOpen, setTableOpen] = useState(!!festivalMemory(festival.id).open["monthly-table"]);
  useEffect(() => { memory.candidates = candidates; }, [memory, candidates]);
  useEffect(() => { memory.observedMonth = observedMonth; }, [memory, observedMonth]);

  // The calendar month always sits in the address so a pushed month link can be undone with Back.
  useEffect(() => {
    const next = addressOf({ year: applied.year, month });
    rememberView(festival.id, "timing", next); shared.month = month; shared.year = applied.year === null ? null : String(applied.year);
    if (!applied.month) writeAddress(next);
  }, [festival.id, applied.year, applied.month, month]);

  // Back from a past-month link: restore focus to the month that opened it.
  useEffect(() => {
    const target = memory.returnTo;
    if (target && target.month === month) { memory.returnTo = null; requestAnimationFrame(() => document.getElementById(target.focusId)?.focus()); }
  }, [memory, month]);

  const region = festival.region;
  const monthlyParams = region ? new URLSearchParams({ province: region.province, district: region.district, ...(applied.year !== null ? { year: String(applied.year) } : {}) }) : null;
  const monthlyKeyValue = monthlyParams ? safeKey(() => monthlyKey(parseMonthly(monthlyParams))) : null;
  const monthly = useKeyedRequest<MonthlyResponse>(monthlyKeyValue ? `/api/existing/monthly?${monthlyParams}` : null, undefined, monthlyKeyValue);
  const range = monthRange(month);
  const scheduleParams = region ? new URLSearchParams({ province: region.province, district: region.district, start: range.start, end: range.end }) : null;
  const scheduleKeyValue = scheduleParams ? safeKey(() => scheduleKey(parseSchedule(scheduleParams))) : null;
  const schedule = useKeyedRequest<ScheduleResponse>(scheduleKeyValue ? `/api/existing/schedule?${scheduleParams}` : null, mergeSchedule, scheduleKeyValue);

  // An observed month belongs to its observation year.
  const shownYear = monthly.data?.year ?? applied.year;
  useEffect(() => { if (observedMonth && shownYear !== null && !observedMonth.startsWith(String(shownYear))) setObservedMonth(null); }, [observedMonth, shownYear]);

  function setMonth(next: string) { memory.returnTo = null; writeAddress(addressOf({ year: applied.year, month: next })); }
  function openPastMonth(target: string) {
    memory.returnTo = { month, focusId: `observed-month-${target}` };
    writeAddress(addressOf({ year: applied.year, month: target }), "push");
    requestAnimationFrame(() => calendarHeading.current?.focus());
  }
  function setYear(year: number) { setObservedMonth(null); writeAddress(addressOf({ year, month })); }

  return <section aria-labelledby="timing-heading" className="space-y-4">
    <h2 id="timing-heading" ref={heading} tabIndex={-1} className="text-2xl font-extrabold">개최 시기</h2>
    {!region ? <FestivalPending /> : <>
      <ObservedMonths region={region} result={monthly} year={applied.year} onYear={setYear} selectedMonth={observedMonth} onSelectMonth={setObservedMonth}
        onOpenCalendar={openPastMonth} tableOpen={tableOpen} onTable={open => { setTableOpen(open); festivalMemory(festival.id).open["monthly-table"] = open; }} />
      <ScheduleCalendar region={region} month={month} result={schedule} onMonth={setMonth} heading={calendarHeading} />
      <CandidatePeriods region={region} candidates={candidates} onChange={setCandidates} onShowMonth={m => { setMonth(m); requestAnimationFrame(() => calendarHeading.current?.focus()); }} />
      <div className="flex flex-wrap gap-2">
        <Link className="region-button" href={viewHref(festival.id, "visits")}>과거 방문 흐름 보기</Link>
        <Link className="region-button" href={viewHref(festival.id, "resources")}>주변 관광자원 보기</Link>
      </div>
    </>}
  </section>;
}
