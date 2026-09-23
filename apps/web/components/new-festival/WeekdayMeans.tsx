"use client";
import { niceMax } from "@/components/existing/EditionChart";
import { number, rawNumber } from "@/components/existing/format";
import { Disclosure } from "@/components/existing/ui";
import type { WeekdayMean } from "@/lib/new-festival/types";
import { ScrollRegion } from "./ScrollRegion";

const compact = new Intl.NumberFormat("ko-KR", { notation: "compact", maximumFractionDigits: 1 });
const W = 360, H = 200, L = 40, R = 6, T = 18, B = 26, PLOT_H = H - T - B;
/** Calendar order Monday → Sunday; never re-ordered by value. */
export const mondayFirst = (items: WeekdayMean[]) => [...items].sort((a, b) => (a.weekday + 6) % 7 - (b.weekday + 6) % 7);

/** Weekday daily means of a fully observed year: sum of that weekday's days ÷ its actual number of days. */
export function WeekdayMeans({ year, items, tableOpen, onTable }: { year: number; items: WeekdayMean[]; tableOpen: boolean; onTable: (open: boolean) => void }) {
  const ordered = mondayFirst(items), max = niceMax(Math.max(0, ...ordered.map(w => w.mean ?? 0)));
  const slot = (W - L - R) / 7, y = (v: number) => T + (1 - v / max) * PLOT_H;
  return <div className="space-y-2">
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="block w-full min-w-[300px] max-w-2xl" role="img"
        aria-label={`${year}년 요일별 일평균 막대그래프, 월요일부터 일요일 순. 요일별 값과 날짜 수는 수치 표에서 볼 수 있어요.`}>
        {[0, 0.5, 1].map(r => <g key={r}><line x1={L} x2={W - R} y1={y(max * r)} y2={y(max * r)} stroke="#d5dce3" /><text x={L - 4} y={y(max * r) + 4} fontSize={10} textAnchor="end" fill="#4b5b6d">{compact.format(max * r)}</text></g>)}
        {ordered.map((w, i) => {
          const x = L + i * slot;
          return <g key={w.weekday}>
            {w.mean !== null ? <>
              <rect x={x + slot * 0.2} width={slot * 0.6} y={y(w.mean)} height={Math.max(0, y(0) - y(w.mean))} fill="#071a33" />
              <text x={x + slot / 2} y={y(w.mean) - 4} fontSize={9} textAnchor="middle" fill="#071a33">{compact.format(w.rounded ?? w.mean)}</text>
            </> : <text x={x + slot / 2} y={y(0) - 4} fontSize={9} textAnchor="middle" fill="#65738a">—</text>}
            <text x={x + slot / 2} y={H - 9} fontSize={10} textAnchor="middle" fill="#4b5b6d">{w.label}</text>
          </g>;
        })}
      </svg>
    </div>
    <Disclosure label="요일별 수치 표 보기" open={tableOpen} onToggle={onTable}>
      <ScrollRegion label="요일별 일평균 수치 표">
        <table className="w-full min-w-[420px] border-collapse text-sm">
          <caption className="px-3 py-2 text-left font-bold">{year}년 요일별 일평균 · 명/일 · 추정</caption>
          <thead><tr className="bg-paper text-left"><th scope="col" className="px-3 py-2">요일</th><th scope="col" className="px-3 py-2 text-right">날짜 수</th>
            <th scope="col" className="px-3 py-2 text-right">합계(명)</th><th scope="col" className="px-3 py-2 text-right">일평균</th><th scope="col" className="px-3 py-2 text-right">값 0인 날</th></tr></thead>
          <tbody>{ordered.map(w => <tr key={w.weekday} className="border-t border-ink/10">
            <th scope="row" className="px-3 py-1.5 text-left font-normal">{w.label}요일</th>
            <td className="px-3 py-1.5 text-right tabular-nums">{w.days}일</td>
            <td className="px-3 py-1.5 text-right tabular-nums">{w.sum === null ? "—" : rawNumber(w.sum)}</td>
            <td className="px-3 py-1.5 text-right tabular-nums">{w.rounded === null ? "—" : number(w.rounded)}</td>
            <td className="px-3 py-1.5 text-right tabular-nums">{w.zeroDays}일</td>
          </tr>)}</tbody>
        </table>
      </ScrollRegion>
    </Disclosure>
  </div>;
}
