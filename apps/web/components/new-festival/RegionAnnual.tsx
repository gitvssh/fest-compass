"use client";
import { niceMax } from "@/components/existing/EditionChart";
import { Disclosure, InfoDialog, TableScroll } from "@/components/existing/ui";
import type { RegionAnnual as Annual } from "@/lib/new-festival/types";

const compact = new Intl.NumberFormat("ko-KR", { notation: "compact", maximumFractionDigits: 1 });
const count = (value: number | null) => value === null ? "값 없음" : value.toLocaleString("ko-KR");

/**
 * Whole-district yearly visit totals (명 per year), a different unit from the daily means above, so its own axis.
 * Only years that also have complete daily data get a button that switches the monthly view.
 */
export function RegionAnnual({ annual, districtName, selectedYear, viewedYear, monthlyYears, onYear, tableOpen, onTable }: {
  annual: Annual; districtName: string; selectedYear: number | null; viewedYear: number | null; monthlyYears: number[]; onYear: (year: number) => void;
  tableOpen: boolean; onTable: (open: boolean) => void;
}) {
  const years = [...annual.years].sort((a, b) => a.year - b.year);
  if (!years.length) return null;
  const first = years[0].year, last = years[years.length - 1].year;
  const max = niceMax(Math.max(0, ...years.map(y => y.outside ?? 0)));
  const buttons = years.filter(y => monthlyYears.includes(y.year)).map(y => y.year);
  const label = `${districtName} 연도별 외지인 방문 합계 막대그래프. ${years.map(y => `${y.year}년 ${y.outside === null ? "값 없음" : `${count(y.outside)}명`}`).join(", ")}`;
  return <section aria-labelledby="new-annual-heading" className="region-card space-y-3">
    <div>
      <h3 id="new-annual-heading" className="text-lg font-extrabold">{districtName} 연도별 방문 합계</h3>
      <p className="text-sm text-muted">{first}–{last} · {districtName} 전체 외지인 · 연간 합계(명) · 통신 기반 추정</p>
    </div>
    <div role="img" aria-label={label} className="space-y-2">
      <div aria-hidden="true" className="grid grid-cols-[3rem_minmax(0,1fr)_4.5rem] gap-2 text-xs text-muted">
        <span /><span className="flex justify-between"><span>0</span><span>{compact.format(max)}명</span></span><span />
      </div>
      {years.map(item => <div key={item.year} aria-hidden="true" className="grid grid-cols-[3rem_minmax(0,1fr)_4.5rem] items-center gap-2 text-sm">
        <span className={item.year === viewedYear ? "font-extrabold text-blue" : "text-muted"}>{item.year}</span>
        <span className="block h-3 rounded bg-paper">
          {item.outside !== null && <span className={`block h-full rounded ${item.year === viewedYear ? "bg-blue" : "bg-ink"}`} style={{ width: `${item.outside / max * 100}%` }} />}
        </span>
        <span className="text-right tabular-nums">{item.outside === null ? "값 없음" : compact.format(item.outside)}</span>
      </div>)}
    </div>
    {viewedYear !== null && years.some(item => item.year === viewedYear) && <p className="text-xs text-muted">파란 막대 {viewedYear}년: 위 월별 그래프 연도</p>}
    {buttons.length > 0 && <div role="group" aria-label="월별로 볼 연도" className="flex flex-wrap gap-1.5">
      {buttons.map(year => <button key={year} type="button" className="region-button px-2" aria-pressed={year === selectedYear} onClick={() => onYear(year)}>{year}년</button>)}
    </div>}
    <div className="flex flex-wrap items-start gap-2">
      <Disclosure label="연도별 수치 표 보기" open={tableOpen} onToggle={onTable}>
        <TableScroll label="연도별 방문 합계 수치 표">
          <table className="w-full min-w-[360px] border-collapse text-sm">
            <caption className="px-3 py-2 text-left font-bold">연도별 방문 합계(명, 추정)</caption>
            <thead><tr className="bg-paper text-left">
              <th scope="col" className="px-3 py-2">연도</th>
              {["외지인", "현지인", "내국인 전체"].map(h => <th key={h} scope="col" className="px-3 py-2 text-right">{h}</th>)}
            </tr></thead>
            <tbody>{years.map(item => <tr key={item.year} className="border-t border-ink/10">
              <th scope="row" className="px-3 py-1.5 text-left font-normal">{item.year}</th>
              {[item.outside, item.local, item.total].map((v, i) => <td key={i} className="px-3 py-1.5 text-right tabular-nums">{count(v)}</td>)}
            </tr>)}</tbody>
          </table>
        </TableScroll>
      </Disclosure>
      <InfoDialog label="연간 추세 출처 보기" title="연도별 방문 합계 출처">
        <p>한 해 동안 {districtName}을 찾은 현지인·외지인 방문을 통신 데이터로 추정한 합계예요. 같은 사람이 여러 날 방문하면 날짜별로 더해져 연간 고유 방문객 수가 아니에요.</p>
        <p>내국인 전체는 원문 값 그대로라 현지인과 외지인을 더한 값과 조금 다를 수 있어요.</p>
        <p>자료: <a className="font-bold text-blue underline" href={annual.source.url} target="_blank" rel="noreferrer">{annual.source.title} ↗</a> · 내려받은 날 {annual.source.downloadedOn}</p>
      </InfoDialog>
    </div>
  </section>;
}
