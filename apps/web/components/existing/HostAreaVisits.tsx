"use client";
import Link from "next/link";
import { useId } from "react";
import type { HostAreaVisits as HostVisits } from "@/lib/existing/types";
import { editionLabel, rawNumber } from "./format";
import { festivalMemory } from "./memory";
import { Disclosure, InfoDialog, TableScroll } from "./ui";

const oneDecimal = (value: number) => value.toLocaleString("ko-KR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const percent = (ratio: number) => `${(ratio * 100).toFixed(1)}%`;
const PARTS = [
  { key: "local", label: "현지인", swatch: "bg-teal" },
  { key: "outside", label: "외지인", swatch: "bg-blue" },
  { key: "foreign", label: "외국인", swatch: "bg-coral" },
] as const;

/**
 * Festival-period visits of the host town (읍·면·동) per selected edition: daily local/outside/foreign on one
 * absolute scale shared by every shown edition. A different area from the district chart above, so kept apart.
 */
export function HostAreaVisits({ festivalId, data }: { festivalId: string; data: HostVisits }) {
  const memory = festivalMemory(festivalId), id = useId();
  const sharedMax = Math.max(0, ...data.editions.map(e => e.total / e.days));
  const width = (daily: number) => `${sharedMax > 0 ? (daily / sharedMax) * 100 : 0}%`;
  return <section aria-labelledby={`${id}-heading`} className="region-card space-y-3">
    <div>
      <h3 id={`${id}-heading`} className="text-lg font-extrabold">축제가 열린 읍·면·동의 방문 구성</h3>
      <p className="text-sm text-muted">{data.festivalName} 개최기간 · 명/일 · 통신 기반 추정</p>
    </div>
    <p className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
      {PARTS.map(p => <span key={p.key} className="inline-flex items-center gap-1"><span aria-hidden="true" className={`inline-block h-3 w-3 rounded-sm ${p.swatch}`} />{p.label}</span>)}
    </p>
    <p aria-hidden="true" className="flex justify-between text-xs text-muted"><span>0명/일</span><span>{oneDecimal(sharedMax)}명/일</span></p>
    <ul className="space-y-4">
      {data.editions.map(e => {
        const daily = { local: e.local / e.days, outside: e.outside / e.days, foreign: e.foreign / e.days };
        const summary = `${e.year}년 하루 평균 ${oneDecimal(e.dailyMean)}명: ${PARTS.map(p => `${p.label} ${oneDecimal(daily[p.key])}명`).join(", ")}`;
        return <li key={e.editionId} className="min-w-0 space-y-2">
          <p className="font-bold">{editionLabel(e)}</p>
          <div role="img" aria-label={summary} className="flex h-4 w-full overflow-hidden rounded bg-paper">
            {PARTS.map(p => <span key={p.key} className={p.swatch} style={{ width: width(daily[p.key]) }} />)}
          </div>
          <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-sm">
            <dt className="text-muted">하루 평균</dt><dd className="font-extrabold">{oneDecimal(e.dailyMean)}명/일</dd>
            <dt className="text-muted">외지인</dt><dd>{oneDecimal(daily.outside)}명/일 · 외지인 비율 {percent(e.outsideShare)}</dd>
            <dt className="text-muted">현지인</dt><dd>{oneDecimal(daily.local)}명/일</dd>
            <dt className="text-muted">외국인</dt><dd>{oneDecimal(daily.foreign)}명/일</dd>
          </dl>
        </li>;
      })}
    </ul>
    <div className="flex flex-wrap items-start gap-2">
      <Disclosure label="기간 합계 표 보기" open={!!memory.open["host-visits-table"]} onToggle={open => { memory.open["host-visits-table"] = open; }}>
        <TableScroll label="개최기간 방문 합계 표">
          <table className="w-full min-w-[520px] border-collapse text-sm">
            <caption className="px-3 py-2 text-left font-bold">개최기간 방문 합계(명, 추정)</caption>
            <thead><tr className="bg-paper text-left">
              <th scope="col" className="px-3 py-2">회차</th>
              {["현지인", "외지인", "외국인", "합계", "하루 평균(명/일)"].map(h => <th key={h} scope="col" className="px-3 py-2 text-right">{h}</th>)}
            </tr></thead>
            <tbody>{data.editions.map(e => <tr key={e.editionId} className="border-t border-ink/10">
              <th scope="row" className="px-3 py-1.5 text-left font-normal">{editionLabel(e)}</th>
              {[e.local, e.outside, e.foreign, e.total].map((v, i) => <td key={i} className="px-3 py-1.5 text-right tabular-nums">{rawNumber(v)}</td>)}
              <td className="px-3 py-1.5 text-right tabular-nums">{oneDecimal(e.dailyMean)}</td>
            </tr>)}</tbody>
          </table>
        </TableScroll>
      </Disclosure>
      <InfoDialog label="방문 구성 출처 보기" title="방문 구성 출처와 계산">
        <p>축제가 열린 읍·면·동을 개최기간에 찾은 방문을 통신 데이터로 추정한 값이에요. 축제장 입장객 수나 고유 방문객 수가 아니에요.
          위 시군구 전체 방문 추이와 대상 지역이 달라 직접 비교하지 않아요.</p>
        <p>하루 평균 = 개최기간 합계 ÷ 개최 일수. 외지인 비율 = 외지인 ÷ 합계.</p>
        <p>자료: <a className="font-bold text-blue underline" href={data.source.url} target="_blank" rel="noreferrer">{data.source.title} ↗</a> · 내려받은 날 {data.source.downloadedOn}</p>
      </InfoDialog>
      <Link className="region-button" href={data.allYearsHref}>모든 개최연도 보기</Link>
    </div>
  </section>;
}
