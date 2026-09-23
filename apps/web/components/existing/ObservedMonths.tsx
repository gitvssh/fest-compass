"use client";
import { useEffect, useState, type FormEvent } from "react";
import type { MonthMean, MonthlyResponse, RegionRef } from "@/lib/existing/types";
import { niceMax } from "./EditionChart";
import { dateOnly, monthTitle, number, rawNumber, timeLabel, WEEKDAY_SHORT } from "./format";
import { Disclosure, FreshnessNote, InfoDialog, LoadState, TableScroll } from "./ui";
import type { KeyedState } from "./useKeyedRequest";

const compact = new Intl.NumberFormat("ko-KR", { notation: "compact", maximumFractionDigits: 1 });
const W = 360, H = 200, L = 40, R = 6, T = 12, B = 26, PLOT_H = H - T - B;

/**
 * Observed monthly daily means of the festival's district for one year. Only months with every day
 * observed get a bar; partial months stay in the table with their observed-day counts.
 */
export function ObservedMonths({ region, result, year, onYear, selectedMonth, onSelectMonth, onOpenCalendar, tableOpen, onTable }: {
  region: RegionRef; result: KeyedState<MonthlyResponse>; year: number | null; onYear: (year: number) => void;
  selectedMonth: string | null; onSelectMonth: (month: string | null) => void; onOpenCalendar: (month: string) => void;
  tableOpen: boolean; onTable: (open: boolean) => void;
}) {
  const data = result.data;
  const shownYear = data?.year ?? year;
  const fallbackYear = data?.years[0] ? String(data.years[0].year) : "";
  const [draftYear, setDraftYear] = useState(String(shownYear ?? fallbackYear));
  useEffect(() => { setDraftYear(String(shownYear ?? fallbackYear)); }, [shownYear, fallbackYear]);
  function submit(event: FormEvent) { event.preventDefault(); if (/^\d{4}$/.test(draftYear)) onYear(Number(draftYear)); }
  const months = data?.months ?? [];
  const selected = selectedMonth ? months.find(m => m.month === selectedMonth) ?? null : null;
  return <section aria-labelledby="observed-heading" className="region-card space-y-3">
    <div className="space-y-1">
      <h3 id="observed-heading" className="text-lg font-extrabold">{shownYear ? `${shownYear}년 ` : ""}{region.districtName} 월별 외지인 방문</h3>
      <p className="text-sm text-muted">월별 일평균 · 명/일 · 추정 · {region.name} 전체. 지난 관측값이며 앞으로의 방문 전망이 아니에요.</p>
    </div>
    {data && data.years.length > 0 && <form onSubmit={submit} className="flex flex-wrap items-end gap-2">
      <label className="text-xs font-bold">관측연도<select className="workspace-input mt-1" value={draftYear} onChange={e => setDraftYear(e.target.value)}>
        {data.years.map(y => <option key={y.year} value={y.year}>{y.year}년{y.complete ? "" : ` (${y.observedDays}/${y.days}일 값 있음)`}</option>)}
      </select></label>
      <button type="submit" className="region-button" disabled={draftYear === String(shownYear ?? "")}>연도 보기</button>
    </form>}
    <LoadState loading={result.loading} failure={result.failure} hasData={!!data} retrievedAt={data?.retrievedAt} subject="월별 방문 자료를" onRetry={result.retry} />
    {data && (data.status === "not-selected" ? <p className="text-sm">모든 날짜의 값이 있는 연도가 없어요. 볼 관측연도를 골라 주세요.</p>
      : data.status === "empty" || !months.length ? <p className="text-sm">이 기간의 방문 자료가 없어요.{data.years.length ? " 다른 관측연도를 골라 보세요." : ""}</p> : <>
      <MonthChart months={months} selected={selectedMonth} onSelect={m => onSelectMonth(m)} />
      <div role="group" aria-label="일별 값을 볼 달" className="flex flex-wrap gap-1.5">
        {months.map(m => <button key={m.month} id={`observed-month-${m.month}`} type="button" className="region-button min-w-12 px-2" aria-pressed={m.month === selectedMonth}
          onClick={() => onSelectMonth(m.month === selectedMonth ? null : m.month)}>{Number(m.month.slice(5))}월</button>)}
      </div>
      {selected && <MonthDetail month={selected} daily={data.daily.filter(d => d.date.startsWith(selected.month))} onOpenCalendar={onOpenCalendar} />}
      <div className="flex flex-wrap items-start gap-2">
        <Disclosure label="월별 수치 표 보기" open={tableOpen} onToggle={onTable}><MonthTable months={months} /></Disclosure>
        <InfoDialog label="출처·산식 보기" title="월별 방문 자료 출처와 계산">
          <p>월별 일평균 = 그 달 모든 날의 외지인 방문 추정 합계 ÷ 그 달의 날짜 수. 하루라도 값이 없는 달은 평균을 만들지 않아요.</p>
          <p>월 고유 방문객 수가 아니며, 공휴일과 기존 축제 기간이 포함된 관측값이에요.</p>
          {data.source ? <p>자료: <a className="font-bold text-blue underline" href={data.source.url} target="_blank" rel="noreferrer">{data.source.title} ↗</a>{data.source.collectedAt ? ` · 수집 ${timeLabel(data.source.collectedAt)}` : ""}{data.source.checkedAt ? ` · 확인 ${dateOnly(data.source.checkedAt)}` : ""}</p> : null}
          <p className="text-xs text-muted">{timeLabel(data.retrievedAt)} 조회</p>
        </InfoDialog>
      </div>
    </>)}
    {data && <FreshnessNote freshness={data.freshness} retrievedAt={data.retrievedAt} onRetry={result.retry} />}
  </section>;
}

function MonthChart({ months, selected, onSelect }: { months: MonthMean[]; selected: string | null; onSelect: (month: string) => void }) {
  const max = niceMax(Math.max(0, ...months.map(m => m.mean ?? 0)));
  const slot = (W - L - R) / 12, y = (v: number) => T + (1 - v / max) * PLOT_H;
  const title = `${months[0]?.month.slice(0, 4) ?? ""}년 월별 일평균 막대그래프. 값이 없는 달은 막대를 그리지 않았어요. 월별 값은 수치 표에서 볼 수 있어요.`;
  return <div className="overflow-x-auto">
    <svg viewBox={`0 0 ${W} ${H}`} className="block w-full min-w-[300px] max-w-2xl" role="img" aria-label={title}>
      {[0, 0.5, 1].map(r => <g key={r}><line x1={L} x2={W - R} y1={y(max * r)} y2={y(max * r)} stroke="#d5dce3" /><text x={L - 4} y={y(max * r) + 4} fontSize={10} textAnchor="end" fill="#4b5b6d">{compact.format(max * r)}</text></g>)}
      {months.map(m => {
        const i = Number(m.month.slice(5)) - 1, x = L + i * slot, active = m.month === selected;
        return <g key={m.month}>
          {m.mean !== null ? <rect x={x + slot * 0.18} width={slot * 0.64} y={y(m.mean)} height={Math.max(0, y(0) - y(m.mean))} fill={active ? "#2667e8" : "#071a33"} className="cursor-pointer" onClick={() => onSelect(m.month)} />
            : <text x={x + slot / 2} y={y(0) - 4} fontSize={9} textAnchor="middle" fill="#65738a">—</text>}
          <text x={x + slot / 2} y={H - 9} fontSize={9} textAnchor="middle" fill={active ? "#2667e8" : "#4b5b6d"} fontWeight={active ? 700 : 400}>{i + 1}월</text>
        </g>;
      })}
    </svg>
    {months.some(m => m.mean === null) && <p className="mt-1 text-xs text-muted">‘—’: 값이 없는 날이 있어 평균을 만들지 않은 달</p>}
  </div>;
}

function MonthTable({ months }: { months: MonthMean[] }) {
  return <TableScroll label="월별 일평균 수치 표">
    <table className="w-full min-w-[420px] border-collapse text-sm">
      <caption className="px-3 py-2 text-left font-bold">월별 일평균 · 명/일 · 추정</caption>
      <thead><tr className="bg-paper text-left"><th scope="col" className="px-3 py-2">월</th><th scope="col" className="px-3 py-2 text-right">일평균</th><th scope="col" className="px-3 py-2 text-right">값 있는 날</th><th scope="col" className="px-3 py-2 text-right">값 0인 날</th></tr></thead>
      <tbody>{months.map(m => <tr key={m.month} className="border-t border-ink/10">
        <th scope="row" className="px-3 py-1.5 text-left font-normal">{monthTitle(m.month)}</th>
        <td className="px-3 py-1.5 text-right tabular-nums">{m.rounded === null ? "—" : number(m.rounded)}</td>
        <td className="px-3 py-1.5 text-right tabular-nums">{m.observedDays}/{m.days}일</td>
        <td className="px-3 py-1.5 text-right tabular-nums">{m.zeroDays}일</td>
      </tr>)}</tbody>
    </table>
  </TableScroll>;
}

function MonthDetail({ month, daily, onOpenCalendar }: { month: MonthMean; daily: { date: string; weekday: number; value: number | null }[]; onOpenCalendar: (month: string) => void }) {
  return <div className="space-y-2 rounded-xl bg-paper p-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="font-bold">{monthTitle(month.month)} · {month.rounded === null ? `일평균 없음 (${month.observedDays}/${month.days}일 값 있음)` : `일평균 ${number(month.rounded)}명/일`}</p>
      <button type="button" className="region-button" onClick={() => onOpenCalendar(month.month)}>{monthTitle(month.month)} 일정 보기</button>
    </div>
    <TableScroll label={`${monthTitle(month.month)} 일별 수치 표`}>
      <table className="w-full min-w-[300px] border-collapse bg-white text-sm">
        <caption className="px-3 py-2 text-left font-bold">{monthTitle(month.month)} 일별 외지인 방문(명, 추정)</caption>
        <thead><tr className="bg-paper text-left"><th scope="col" className="px-3 py-2">날짜</th><th scope="col" className="px-3 py-2">요일</th><th scope="col" className="px-3 py-2 text-right">방문(명)</th></tr></thead>
        <tbody>{daily.map(d => <tr key={d.date} className="border-t border-ink/10">
          <th scope="row" className="px-3 py-1 text-left font-normal">{d.date}</th><td className="px-3 py-1">{WEEKDAY_SHORT[d.weekday]}</td>
          <td className="px-3 py-1 text-right tabular-nums">{d.value === null ? "—" : rawNumber(d.value)}</td>
        </tr>)}</tbody>
      </table>
    </TableScroll>
  </div>;
}
