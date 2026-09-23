"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { CandidatePeriods } from "@/components/existing/CandidatePeriods";
import { koreaToday, monthRange } from "@/components/existing/format";
import type { Candidate } from "@/components/existing/memory";
import { mergeSchedule, ScheduleCalendar } from "@/components/existing/ScheduleCalendar";
import { useKeyedRequest } from "@/components/existing/useKeyedRequest";
import { parseSchedule, scheduleKey } from "@/lib/existing/request";
import type { ScheduleResponse } from "@/lib/existing/types";
import { setAddressParam } from "./address";
import { readMonth } from "./durable";
import { tab } from "./memory";
import { useNewRegion, useViewHeadingFocus } from "./NewShell";

/**
 * Calendar first: the actual month's weekdays, confirmed holidays and registered events of the selected district.
 * Candidate periods (0–2) are optional and region-independent; a region change keeps them and re-queries schedules.
 * No recommended date, forecast or score.
 */
export function TimingView() {
  const { region, href } = useNewRegion();
  const heading = useRef<HTMLHeadingElement>(null), calendarHeading = useRef<HTMLHeadingElement>(null);
  useViewHeadingFocus("timing", heading);
  const address = useSearchParams()?.toString() ?? "";
  const applied = useMemo(() => readMonth(new URLSearchParams(address)), [address]);
  const month = applied ?? koreaToday().slice(0, 7);
  // The calendar month always sits in the address, so a reload or another region keeps it.
  useEffect(() => { if (!applied) setAddressParam("month", month); }, [applied, month]);

  const [candidates, setCandidates] = useState<Candidate[]>(tab.candidates);
  useEffect(() => { tab.candidates = candidates; }, [candidates]);

  const range = monthRange(month);
  const params = new URLSearchParams({ province: region.province, district: region.district, start: range.start, end: range.end });
  const key = (() => { try { return scheduleKey(parseSchedule(params)); } catch { return null; } })();
  const schedule = useKeyedRequest<ScheduleResponse>(key ? `/api/existing/schedule?${params}` : null, mergeSchedule, key);

  function setMonth(next: string) { setAddressParam("month", next); }

  return <section aria-labelledby="new-timing-heading" className="space-y-4">
    <div>
      <h2 id="new-timing-heading" ref={heading} tabIndex={-1} className="text-xl font-extrabold">{region.districtName} 개최 시기</h2>
      <p className="text-sm text-muted">달력에서 요일·공휴일·등록 행사를 살펴봐요. 후보 기간은 필요할 때만 추가해요.</p>
    </div>
    <ScheduleCalendar region={region} month={month} result={schedule} onMonth={setMonth} heading={calendarHeading} />
    <CandidatePeriods region={region} candidates={candidates} onChange={setCandidates}
      onShowMonth={m => { setMonth(m); requestAnimationFrame(() => calendarHeading.current?.focus()); }} />
    <div className="flex flex-wrap gap-2">
      <Link className="region-button" href={href("visits")}>지역 방문 흐름 보기</Link>
      <Link className="region-button" href={href("resources")}>지역 관광자원 보기</Link>
    </div>
  </section>;
}
