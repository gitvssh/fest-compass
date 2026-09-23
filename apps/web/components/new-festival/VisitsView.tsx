"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { dateOnly, timeLabel } from "@/components/existing/format";
import { MonthChart, MonthTable } from "@/components/existing/ObservedMonths";
import { Disclosure, FreshnessNote, InfoDialog, LoadState } from "@/components/existing/ui";
import { useKeyedRequest } from "@/components/existing/useKeyedRequest";
import { newVisitsKey, parseNewVisits } from "@/lib/new-festival/request";
import type { NewVisitsResponse } from "@/lib/new-festival/types";
import { setAddressParam } from "./address";
import { readYear } from "./durable";
import { tab } from "./memory";
import { MonthDaily } from "./MonthDaily";
import { useNewRegion, useViewHeadingFocus } from "./NewShell";
import { mondayFirst, WeekdayMeans } from "./WeekdayMeans";

const YEAR_SELECT = "new-visits-year";

/**
 * Past observed visits of the whole district in one observation year: monthly and weekday daily means and the
 * daily values of a chosen month. Retrospective observations only — not a forecast or a festival audience.
 * The observation year is independent of the calendar month and future candidate periods.
 */
export function VisitsView() {
  const { region, memory, href } = useNewRegion(), saved = memory.visits;
  const heading = useRef<HTMLHeadingElement>(null);
  useViewHeadingFocus("visits", heading);
  const address = useSearchParams()?.toString() ?? "";
  const year = useMemo(() => readYear(new URLSearchParams(address)), [address]);
  const params = new URLSearchParams({ province: region.province, district: region.district, ...(year !== null ? { year: String(year) } : {}) });
  const key = (() => { try { return newVisitsKey(parseNewVisits(params)); } catch { return null; } })();
  const result = useKeyedRequest<NewVisitsResponse>(key ? `/api/new/visits?${params}` : null, undefined, key);

  // The first answer without a year carries the server's default year. Writing that year into the address makes it
  // the applied condition (kept across menus and region changes). While that same region-year is re-requested, or if
  // that request fails, keep showing the answer already shown (with its own time and a retry). Any other region or
  // year never reuses it.
  const shownBefore = useRef<NewVisitsResponse | null>(null);
  if (result.data) shownBefore.current = result.data;
  const kept = shownBefore.current, data = result.data
    ?? (kept && (result.loading || result.failure) && year !== null && kept.region.code === region.code && kept.year === year ? kept : null);
  useEffect(() => {
    if (year === null && result.data && result.data.request.year === null && result.data.year !== null) setAddressParam("year", String(result.data.year));
  }, [year, result.data]);

  const shownYear = data?.year ?? year;
  const [observedMonth, setObservedMonth] = useState<string | null>(saved.observedMonth);
  const [open, setOpen] = useState(saved.open);
  useEffect(() => { saved.observedMonth = observedMonth; }, [saved, observedMonth]);
  useEffect(() => { saved.open = open; }, [saved, open]);
  // A chosen month belongs to its observation year.
  useEffect(() => { if (observedMonth && shownYear !== null && !observedMonth.startsWith(`${shownYear}-`)) setObservedMonth(null); }, [observedMonth, shownYear]);

  // Back from a month's calendar link: restore that month and focus its button once the data is shown.
  useEffect(() => {
    const target = saved.returnFocus;
    if (!target || !data) return;
    const element = document.getElementById(target);
    if (element) { saved.returnFocus = null; element.focus(); }
  }, [saved, data]);

  const years = data?.years ?? [];
  const options = [...years.map(y => ({ year: y.year, label: `${y.year}년${y.complete ? "" : ` (${y.observedDays}/${y.days}일 값 있음)`}` }))];
  if (shownYear !== null && !years.some(y => y.year === shownYear)) options.push({ year: shownYear, label: `${shownYear}년 (자료 없음)` });
  options.sort((a, b) => a.year - b.year);
  const [draft, setDraft] = useState(shownYear === null ? "" : String(shownYear));
  useEffect(() => { setDraft(shownYear === null ? "" : String(shownYear)); }, [shownYear]);
  function submitYear(event: FormEvent) {
    event.preventDefault();
    if (!/^\d{4}$/.test(draft) || Number(draft) === year) return;
    setObservedMonth(null);
    setAddressParam("year", draft);
  }
  const focusYear = () => document.getElementById(YEAR_SELECT)?.focus();
  const changeYear = years.length > 0 ? <button type="button" className="region-button" onClick={focusYear}>연도 바꾸기</button> : null;
  const otherViews = <>
    <Link className="region-button" href={href("resources")}>지역 관광자원 보기</Link>
    <Link className="region-button" href={href("timing")}>개최 시기 보기</Link>
  </>;

  const months = data?.months ?? [];
  const selected = observedMonth ? months.find(m => m.month === observedMonth) ?? null : null;
  const hasValues = !!data && (data.status === "complete" || data.status === "partial") && months.length > 0;
  const weekdays = data?.weekdays;

  return <section aria-labelledby="new-visits-heading" className="space-y-4">
    <div>
      <h2 id="new-visits-heading" ref={heading} tabIndex={-1} className="text-xl font-extrabold">{region.districtName} 방문 흐름</h2>
      <p className="text-sm text-muted">{region.name} 전체 외지인 방문 · 일평균 명/일 · 통신 기반 추정 · 지난 관측값</p>
    </div>
    {options.length > 0 && <form onSubmit={submitYear} className="flex flex-wrap items-end gap-2">
      <label className="text-sm font-bold" htmlFor={YEAR_SELECT}>관측연도
        <select id={YEAR_SELECT} className="workspace-input mt-1 block" value={draft} onChange={e => setDraft(e.target.value)}>
          {draft === "" && <option value="">연도 선택</option>}
          {options.map(o => <option key={o.year} value={o.year}>{o.label}</option>)}
        </select>
      </label>
      <button type="submit" className="region-button" disabled={!draft || Number(draft) === year}>연도 보기</button>
    </form>}
    <LoadState loading={result.loading} failure={result.failure} hasData={!!data} retrievedAt={data?.retrievedAt} subject="방문 자료를" onRetry={result.retry} />

    {data && !hasValues && <div className="region-card space-y-2 text-sm">
      <p>{data.status === "not-selected" ? "모든 날짜의 값이 있는 연도가 없어요. 볼 관측연도를 골라 주세요."
        : data.year !== null ? `${data.year}년 ${region.districtName} 방문 자료가 없어요.` : `${region.districtName}의 방문 자료가 없어요.`}</p>
      <div className="flex flex-wrap gap-2">{changeYear}{otherViews}</div>
    </div>}

    {data && hasValues && shownYear !== null && <>
      <section aria-labelledby="new-monthly-heading" className="region-card space-y-3">
        <div>
          <h3 id="new-monthly-heading" className="text-lg font-extrabold">{shownYear}년 월별 일평균</h3>
          <p className="text-sm text-muted">{region.districtName} 외지인 방문 · 명/일 · 추정{data.status === "partial" ? " · 값이 없는 날이 있는 연도" : ""}</p>
        </div>
        <MonthChart months={months} selected={observedMonth} onSelect={m => setObservedMonth(m)} />
        <div role="group" aria-label="일별 값을 볼 달" className="flex flex-wrap gap-1.5">
          {months.map(m => <button key={m.month} id={`new-observed-month-${m.month}`} type="button" className="region-button min-w-12 px-2" aria-pressed={m.month === observedMonth}
            aria-label={`${shownYear}년 ${Number(m.month.slice(5))}월 일별 값`} onClick={() => setObservedMonth(m.month === observedMonth ? null : m.month)}>{Number(m.month.slice(5))}월</button>)}
        </div>
        {selected && <MonthDaily month={selected} daily={data.daily.filter(d => d.date.startsWith(`${selected.month}-`))}
          calendarHref={href("timing", { month: selected.month })} onCalendar={() => { saved.returnFocus = `new-observed-month-${selected.month}`; tab.focusHeading = "timing"; }} />}
        <Disclosure label="월별 수치 표 보기" open={!!open["monthly-table"]} onToggle={v => setOpen(o => ({ ...o, "monthly-table": v }))}><MonthTable months={months} /></Disclosure>
      </section>

      <section aria-labelledby="new-weekday-heading" className="region-card space-y-3">
        <div>
          <h3 id="new-weekday-heading" className="text-lg font-extrabold">{shownYear}년 요일별 일평균</h3>
          <p className="text-sm text-muted">월요일부터 일요일 순 · 명/일 · 추정</p>
        </div>
        {weekdays && weekdays.yearComplete && weekdays.status === "complete" && weekdays.items.length === 7
          ? <WeekdayMeans year={shownYear} items={weekdays.items} tableOpen={!!open["weekday-table"]} onTable={v => setOpen(o => ({ ...o, "weekday-table": v }))} />
          : <div className="space-y-2 text-sm"><p>이 연도의 요일별 흐름을 불러올 수 없어요.</p>{changeYear}</div>}
      </section>

      <div className="flex flex-wrap gap-2">
        <InfoDialog label="출처·산식 보기" title="방문 자료 출처와 계산">
          <p>대상: {region.name} 전체의 날짜별 외지인 방문(통신 기반 추정). 지난 관측값이며 앞으로의 방문 전망이나 축제 관람객 수가 아니에요. 공휴일과 기존 행사 기간이 포함돼 있어요.</p>
          <p>월별 일평균 = 그 달 날짜별 값의 합 ÷ 그 달의 날짜 수. 값이 없는 날이 있는 달은 평균을 만들지 않아요.</p>
          <p>요일별 일평균 = 그 해 해당 요일 날짜의 값 합 ÷ 그 해 해당 요일의 날짜 수. 한 해 모든 날짜의 값이 있을 때만 만들어요.
            {weekdays?.items.length ? ` ${shownYear}년 날짜 수: ${mondayFirst(weekdays.items).map(w => `${w.label} ${w.days}일`).join(" · ")}.` : ""}</p>
          <p>값이 0인 날은 0으로 계산하고, 값이 없는 날은 0으로 채우지 않아요.</p>
          {data.source && <p>자료: <a className="font-bold text-blue underline" href={data.source.url} target="_blank" rel="noreferrer">{data.source.title} ↗</a>
            {data.source.collectedAt ? ` · 수집 ${timeLabel(data.source.collectedAt)}` : ""}{data.source.checkedAt ? ` · 확인 ${dateOnly(data.source.checkedAt)}` : ""}</p>}
          <p className="text-xs text-muted">{timeLabel(data.retrievedAt)} 조회</p>
        </InfoDialog>
        {otherViews}
      </div>
    </>}
    {data && <FreshnessNote freshness={data.freshness} retrievedAt={data.retrievedAt} onRetry={result.retry} />}
  </section>;
}
