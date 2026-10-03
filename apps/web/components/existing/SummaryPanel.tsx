"use client";
import { CalendarDays, ChartLine, ListChecks, MapPin, NotebookPen } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef } from "react";
import { CandidateBrief, CheckList, MemoField, PlaceCard, SheetEmpty, SheetHeader, SheetSection, SourceLine } from "@/components/guide/SummarySheet";
import { distanceKm, validPoint } from "@/lib/comparison/distance";
import { historyKey, parseHistory } from "@/lib/existing/request";
import type { HistoryResponse } from "@/lib/existing/types";
import { EXISTING_GUIDE } from "@/lib/guide/content";
import { rememberView } from "./address";
import { niceMax } from "./EditionChart";
import { FestivalPending, useFestival, useViewHeadingFocus } from "./ExistingShell";
import { editionLabel, timeLabel } from "./format";
import { EditionSummary } from "./HistoryPanel";
import { festivalMemory, viewHref } from "./memory";
import { LoadState } from "./ui";
import { useKeyedRequest } from "./useKeyedRequest";
import { historyRequest, readVisitsApplied, visitsAddress } from "./visits-address";

const km = (value: number) => `${value < 10 ? value.toFixed(1) : Math.round(value)}km`;

/**
 * 모아 보기 of an existing festival: the compared editions' observed means (address conditions, kept on reload), the place
 * chosen in this tab, candidate periods with their neutral lookup, a screen-only memo and the next things to confirm.
 */
export function SummaryPanel() {
  const festival = useFestival(), heading = useRef<HTMLHeadingElement>(null);
  useViewHeadingFocus(festival.id, "summary", heading);
  const memory = festivalMemory(festival.id);
  const address = useSearchParams()?.toString() ?? "";
  const applied = useMemo(() => readVisitsApplied(new URLSearchParams(address)), [address]);
  // Arriving by address alone: the visits view opens with the same compared editions.
  useEffect(() => { if (memory.search.visits === undefined && address) rememberView(festival.id, "visits", visitsAddress(applied)); }, [memory, festival.id, address, applied]);

  const hasRecord = festival.source === "archive" || !!festival.archive;
  const noRecord = festival.source === "current" && !!festival.current && !festival.current.linkedArchiveId;
  const request = historyRequest(festival.id, applied);
  const key = hasRecord ? (() => { try { return historyKey(parseHistory(request)); } catch { return null; } })() : null;
  const history = useKeyedRequest<HistoryResponse>(key ? `/api/existing/history?${request}` : null, undefined, key), data = history.data;
  const yMax = niceMax(data?.sharedYMax ?? 0);

  const place = memory.resources.selected, anchor = memory.resources.anchor, radius = memory.resources.radiusKm;
  const distance = place?.point && anchor && validPoint(anchor.point) && validPoint(place.point) ? distanceKm(anchor.point, place.point) : null;
  const candidates = memory.timing.candidates;
  const region = festival.region;
  // The sheet appears in one piece once its main numbers settle (an answer, a failure or nothing to wait for), so a late
  // answer never pushes the parts below it. Once shown it stays, also while a retry runs.
  const lookupEnded = !!festival.lookup.failure || festival.lookup.unavailable;
  const settled = noRecord || !!data || !!history.failure || (hasRecord && !key) || (!hasRecord && lookupEnded);
  const shown = useRef(false);
  if (settled) shown.current = true;

  return <section aria-labelledby="summary-heading" className="summary-sheet space-y-4">
    <SheetHeader heading={heading} title="모아 보기" subject={festival.name} />
    {!shown.current ? <p role="status" className="text-sm text-muted">모아 보기를 준비하고 있어요…</p> : <>
    <div className="grid items-start gap-4 lg:grid-cols-2">
      <SheetSection icon={ChartLine} title="방문 흐름">
        {noRecord ? <SheetEmpty text="지난 개최 기록이 연결되지 않은 축제예요." href={viewHref(festival.id, "visits")} label="방문 흐름 돌아보기" icon={ChartLine} />
          : !hasRecord ? <FestivalPending />
          : <>
            <LoadState loading={history.loading} failure={history.failure} hasData={!!data} retrievedAt={data?.retrievedAt} subject="방문 자료를" onRetry={history.retry} />
            {data && <>
              <ul className="space-y-3">{data.editions.map(e => <li key={e.editionId} className="space-y-2 rounded-xl border border-ink/10 p-3">
                <h4 className="text-sm font-extrabold">{editionLabel(e)}</h4>
                <EditionSummary edition={e} scaleMax={yMax} />
              </li>)}</ul>
              <SourceLine>{data.festival.region.name} 전체 외지인 방문 · 명/일 · 통신 기반 추정 · 축제장 입장객 수 아님 · 개최 전 {applied.before}일·종료 후 {applied.after}일 표시 기준
                {data.editions[0]?.source.visits ? ` · 자료 ${data.editions[0].source.visits.title}${data.editions[0].source.visits.collectedAt ? ` (${timeLabel(data.editions[0].source.visits.collectedAt)} 수집)` : ""}` : ""}</SourceLine>
            </>}
          </>}
      </SheetSection>
      <SheetSection icon={MapPin} title="연계 관광 후보">
        {place ? <PlaceCard item={place} note={anchor ? <>기준점 {anchor.label}{radius !== null ? ` · 반경 ${radius}km` : ""}{distance !== null ? ` · 직선거리 약 ${km(distance)}` : ""}</> : null} />
          : <SheetEmpty text="아직 고른 장소가 없어요." href={viewHref(festival.id, "resources")} label="연계 관광 찾기" icon={MapPin} />}
        {place && <SourceLine>한국관광공사 관광정보 · 현재 등록 정보 · 운영 여부와 이용 조건은 시설에 확인</SourceLine>}
      </SheetSection>
    </div>
    <SheetSection icon={CalendarDays} title="후보 기간">
      {!region ? <FestivalPending />
        : candidates.length ? <div className={`grid gap-3 ${candidates.length > 1 ? "md:grid-cols-2" : ""}`}>{candidates.map(c => <CandidateBrief key={`${c.id}-${c.start}-${c.end}`} region={region} candidate={c} />)}</div>
        : <SheetEmpty text="아직 후보 기간이 없어요." href={viewHref(festival.id, "timing")} label="개최 시기 검토하기" icon={CalendarDays} />}
      {region && candidates.length > 0 && <SourceLine>{region.name} · 한국관광공사 축제·행사 등록 일정(개최 확정 아님) · 공휴일 공표 자료</SourceLine>}
    </SheetSection>
    <div className="grid items-start gap-4 lg:grid-cols-2">
      <SheetSection icon={NotebookPen} tone="amber" title="판단 메모">
        <MemoField label="판단 메모" placeholder="유지할 점·바꿀 문제와 그 이유" value={memory.memo} onChange={value => { memory.memo = value; }} />
      </SheetSection>
      <SheetSection icon={ListChecks} tone="teal" title="다음에 확인할 일">
        <CheckList checks={EXISTING_GUIDE.checks} />
      </SheetSection>
    </div>
    </>}
  </section>;
}
