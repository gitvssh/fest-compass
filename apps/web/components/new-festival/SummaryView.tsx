"use client";
import { CalendarDays, ChartLine, ListChecks, MapPin, NotebookPen } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useMemo, useRef } from "react";
import { number, timeLabel } from "@/components/existing/format";
import { LoadState } from "@/components/existing/ui";
import { useKeyedRequest } from "@/components/existing/useKeyedRequest";
import { CandidateBrief, CheckList, MemoField, PlaceCard, SheetEmpty, SheetHeader, SheetSection, SourceLine } from "@/components/guide/SummarySheet";
import type { MonthMean } from "@/lib/existing/types";
import { NEW_GUIDE } from "@/lib/guide/content";
import { newVisitsKey, parseNewVisits } from "@/lib/new-festival/request";
import type { NewVisitsResponse } from "@/lib/new-festival/types";
import { readYear } from "./durable";
import { tab } from "./memory";
import { useNewRegion, useViewHeadingFocus } from "./NewShell";

/**
 * 모아 보기 of a new festival: the observation year's busiest and quietest months (values as observed), the places put
 * side by side in this tab, candidate periods with their neutral lookup, a screen-only memo and the next things to confirm.
 */
export function SummaryView() {
  const { region, memory, href } = useNewRegion(), heading = useRef<HTMLHeadingElement>(null);
  useViewHeadingFocus("summary", heading);
  const address = useSearchParams()?.toString() ?? "";
  const year = useMemo(() => readYear(new URLSearchParams(address)), [address]);
  const params = new URLSearchParams({ province: region.province, district: region.district, ...(year !== null ? { year: String(year) } : {}) });
  const key = (() => { try { return newVisitsKey(parseNewVisits(params)); } catch { return null; } })();
  const visits = useKeyedRequest<NewVisitsResponse>(key ? `/api/new/visits?${params}` : null, undefined, key), data = visits.data;
  const months = data && (data.status === "complete" || data.status === "partial") ? data.months : [];
  const compared = memory.resources.compared, candidates = tab.candidates;
  // The sheet appears in one piece once the visits answer settles, so it never pushes the parts below it; once shown it stays.
  const shown = useRef(false);
  if (data || visits.failure || !key) shown.current = true;

  return <section aria-labelledby="summary-heading" className="summary-sheet space-y-4">
    <SheetHeader heading={heading} title="모아 보기" subject={`${region.name} 새 축제`} />
    {!shown.current ? <p role="status" className="text-sm text-muted">모아 보기를 준비하고 있어요…</p> : <>
    <div className="grid items-start gap-4 lg:grid-cols-2">
      <SheetSection icon={ChartLine} title="방문 흐름">
        <LoadState loading={visits.loading} failure={visits.failure} hasData={!!data} retrievedAt={data?.retrievedAt} subject="방문 자료를" onRetry={visits.retry} />
        {data && (months.some(m => m.rounded !== null) && data.year !== null
          ? <>
            <MonthStrip year={data.year} months={months} />
            <SourceLine>{region.name} 전체 외지인 방문 · 월별 일평균 명/일 · 통신 기반 추정 · 지난 관측값
              {data.source ? ` · 자료 ${data.source.title}${data.source.collectedAt ? ` (${timeLabel(data.source.collectedAt)} 수집)` : ""}` : ""}</SourceLine>
          </>
          : <SheetEmpty text="이 연도의 월별 방문 자료가 없어요." href={href("visits")} label="방문 흐름 읽기" icon={ChartLine} />)}
      </SheetSection>
      <SheetSection icon={MapPin} title="소재·장소 후보">
        {compared.length ? <div className="space-y-2">{compared.map(item => <PlaceCard key={item.id} item={item} />)}</div>
          : <SheetEmpty text="함께 보기에 넣은 장소가 없어요." href={href("resources")} label="지역 자원 살펴보기" icon={MapPin} />}
        {compared.length > 0 && <SourceLine>한국관광공사 관광정보 · 현재 등록 정보 · 사용 허가와 수용 조건은 시설에 확인</SourceLine>}
      </SheetSection>
    </div>
    <SheetSection icon={CalendarDays} title="후보 기간">
      {candidates.length ? <div className={`grid gap-3 ${candidates.length > 1 ? "md:grid-cols-2" : ""}`}>{candidates.map(c => <CandidateBrief key={`${c.id}-${c.start}-${c.end}`} region={region} candidate={c} />)}</div>
        : <SheetEmpty text="아직 후보 기간이 없어요." href={href("timing")} label="개최 시기 검토하기" icon={CalendarDays} />}
      {candidates.length > 0 && <SourceLine>{region.name} · 한국관광공사 축제·행사 등록 일정(개최 확정 아님) · 공휴일 공표 자료</SourceLine>}
    </SheetSection>
    <div className="grid items-start gap-4 lg:grid-cols-2">
      <SheetSection icon={NotebookPen} tone="amber" title="판단 메모">
        <MemoField label="판단 메모" placeholder="우선 후보와 그 이유" value={memory.memo} onChange={value => { memory.memo = value; }} />
      </SheetSection>
      <SheetSection icon={ListChecks} tone="teal" title="다음에 확인할 일">
        <CheckList checks={NEW_GUIDE.checks} />
      </SheetSection>
    </div>
    </>}
  </section>;
}

/** Twelve monthly means from a zero baseline; the busiest and quietest observed months are named with their values. */
function MonthStrip({ year, months }: { year: number; months: MonthMean[] }) {
  const values = months.map(m => m.rounded).filter((v): v is number => v !== null);
  const max = Math.max(...values), min = Math.min(...values);
  const top = months.find(m => m.rounded === max)!, low = months.find(m => m.rounded === min)!;
  const label = (m: MonthMean) => `${Number(m.month.slice(5))}월`;
  const partial = months.some(m => m.rounded === null);
  return <div className="space-y-3">
    <div aria-hidden="true" className="flex h-24 items-end gap-1">
      {months.map(m => <div key={m.month} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1">
        {m.rounded !== null ? <span className={`block w-full rounded-t ${m === top ? "bg-blue" : m === low ? "bg-amber-400" : "bg-[#c6cfda]"}`} style={{ height: `${Math.max(3, (m.rounded / max) * 100)}%` }} />
          : <span className="block h-1 w-full rounded bg-ink/10" />}
        <span className="text-[10px] leading-none text-muted">{Number(m.month.slice(5))}</span>
      </div>)}
    </div>
    <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-sm">
      <dt className="inline-flex items-center gap-1.5 text-muted"><span aria-hidden="true" className="h-2.5 w-2.5 rounded-sm bg-blue" />가장 많은 달</dt>
      <dd><span className="font-bold">{year}년 {label(top)}</span> · {number(max)}명/일</dd>
      <dt className="inline-flex items-center gap-1.5 text-muted"><span aria-hidden="true" className="h-2.5 w-2.5 rounded-sm bg-amber-400" />가장 적은 달</dt>
      <dd><span className="font-bold">{year}년 {label(low)}</span> · {number(min)}명/일</dd>
    </dl>
    {partial && <p className="text-xs text-muted">값이 없는 날이 있는 달은 평균이 없어 비교에서 빠졌어요.</p>}
  </div>;
}
