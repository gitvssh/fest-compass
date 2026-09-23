"use client";
import Link from "next/link";
import { niceMax } from "@/components/existing/EditionChart";
import { monthTitle, number, rawNumber, WEEKDAY_SHORT } from "@/components/existing/format";
import type { DailyValue, MonthMean } from "@/lib/existing/types";
import { ScrollRegion } from "./ScrollRegion";

const compact = new Intl.NumberFormat("ko-KR", { notation: "compact", maximumFractionDigits: 1 });
const W = 360, H = 180, L = 40, R = 8, T = 12, B = 26, PLOT_H = H - T - B;

/**
 * Daily observed values of one month of the observation year. Missing days break the line and show `—` in the
 * table; a true zero stays on the baseline. The link opens the calendar of this actual year-month only.
 */
export function MonthDaily({ month, daily, calendarHref, onCalendar }: { month: MonthMean; daily: DailyValue[]; calendarHref: string; onCalendar: () => void }) {
  const title = monthTitle(month.month), max = niceMax(Math.max(0, ...daily.map(d => d.value ?? 0)));
  const slot = (W - L - R) / Math.max(1, daily.length), x = (i: number) => L + (i + 0.5) * slot, y = (v: number) => T + (1 - v / max) * PLOT_H;
  const segments: string[] = [];
  let current: string[] = [];
  daily.forEach((d, i) => {
    if (d.value === null) { if (current.length) segments.push(current.join(" ")); current = []; return; }
    current.push(`${current.length ? "L" : "M"}${x(i).toFixed(1)},${y(d.value).toFixed(1)}`);
  });
  if (current.length) segments.push(current.join(" "));
  const missing = daily.some(d => d.value === null);
  return <section aria-labelledby="new-month-daily-heading" className="space-y-2 rounded-xl bg-paper p-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div>
        <h4 id="new-month-daily-heading" className="font-extrabold">{title} 일별 방문</h4>
        <p className="text-sm">{month.rounded === null ? `일평균 없음 · ${month.observedDays}/${month.days}일 값 있음` : `일평균 ${number(month.rounded)}명/일`} · 명 · 추정</p>
      </div>
      <Link className="region-button" href={calendarHref} onClick={onCalendar}>{title} 일정 보기</Link>
    </div>
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="block w-full min-w-[300px] max-w-2xl" role="img"
        aria-label={`${title} 일별 외지인 방문 꺾은선그래프. ${missing ? "값이 없는 날은 선을 끊었어요. " : ""}날짜별 값은 아래 수치 표에서 볼 수 있어요.`}>
        {[0, 0.5, 1].map(r => <g key={r}><line x1={L} x2={W - R} y1={y(max * r)} y2={y(max * r)} stroke="#d5dce3" /><text x={L - 4} y={y(max * r) + 4} fontSize={10} textAnchor="end" fill="#4b5b6d">{compact.format(max * r)}</text></g>)}
        {segments.map((d, i) => <path key={i} d={d} fill="none" stroke="#071a33" strokeWidth={2} />)}
        {daily.map((d, i) => d.value === null ? null : <circle key={d.date} cx={x(i)} cy={y(d.value)} r={2} fill="#071a33" />)}
        {daily.map((d, i) => Number(d.date.slice(8)) % 7 === 1 ? <text key={`t-${d.date}`} x={x(i)} y={H - 9} fontSize={9} textAnchor="middle" fill="#4b5b6d">{Number(d.date.slice(8))}일</text> : null)}
      </svg>
      {missing && <p className="mt-1 text-xs text-muted">선이 끊긴 날: 값 없음</p>}
    </div>
    <ScrollRegion label={`${title} 일별 수치 표`} tall>
      <table className="w-full min-w-[280px] border-collapse bg-white text-sm">
        <caption className="px-3 py-2 text-left font-bold">{title} 일별 외지인 방문(명, 추정)</caption>
        <thead><tr className="bg-paper text-left"><th scope="col" className="px-3 py-2">날짜</th><th scope="col" className="px-3 py-2">요일</th><th scope="col" className="px-3 py-2 text-right">방문(명)</th></tr></thead>
        <tbody>{daily.map(d => <tr key={d.date} className="border-t border-ink/10">
          <th scope="row" className="px-3 py-1 text-left font-normal">{d.date}</th><td className="px-3 py-1">{WEEKDAY_SHORT[d.weekday]}</td>
          <td className="px-3 py-1 text-right tabular-nums">{d.value === null ? "—" : rawNumber(d.value)}</td>
        </tr>)}</tbody>
      </table>
    </ScrollRegion>
  </section>;
}
