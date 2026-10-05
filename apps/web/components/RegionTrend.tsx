"use client";
import { CreditCard, Luggage } from "lucide-react";
import { Disclosure, InfoDialog, TableScroll } from "@/components/existing/ui";
import type { RegionTrend as Trend } from "@/lib/datalab/region-trend-types";
import { eok, Heading, pct, RankLine, REGION_SECTION_ID, ShareBars } from "./RegionProfile";

const span = (r: { from: number; to: number }) => `${r.from}~${r.to}년`;
const man = (count: number) => `${Math.round(count / 1e4).toLocaleString("ko-KR")}만 명`;
const signed = (v: number) => `${v > 0 ? "+" : v < 0 ? "−" : "±"}${Math.abs(v).toFixed(1)}%`;

/**
 * DataLab cards for a region whose download holds only yearly totals: spending (years, local and outside, industry groups)
 * and outside visitors per year. Where the page already shows the yearly visitors, only the spending card is drawn.
 */
export function RegionTrendCards({ trend, officialUrl, visitors = true }: { trend: Trend; officialUrl: string; visitors?: boolean }) {
  return <div className={`grid items-start gap-4 ${visitors ? "xl:grid-cols-2" : ""}`}>
    <Spending trend={trend} officialUrl={officialUrl} />
    {visitors && <Visitors trend={trend} officialUrl={officialUrl} />}
  </div>;
}

function Spending({ trend, officialUrl }: { trend: Trend; officialUrl: string }) {
  const s = trend.spending, whole = s.years.reduce((n, y) => n + y.total, 0), outside = s.years.reduce((n, y) => n + y.outside, 0) / whole * 100;
  return <section aria-labelledby={REGION_SECTION_ID} className="region-card space-y-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <Heading id={REGION_SECTION_ID} icon={CreditCard} tone="amber" title={`${trend.name} 관광 소비`} note={`${trend.name} 전체 · ${span(s.range)} 해마다 합계·업종 비율`} />
      <InfoDialog label="기준" title="지역 관광 소비의 기준" buttonClassName="region-button min-h-8 px-2 py-1 text-xs">
        <ul className="list-disc space-y-2 pl-5">
          <li>데이터랩의 지역 관광소비예요. {trend.name} 전체에서 쓴 관광 소비라 축제장에서 쓴 돈만 뜻하지 않아요.</li>
          <li>내국인 소비는 현지인(이 지역 주민)과 외지인(다른 지역 주민)의 소비를 더한 값이에요. 해마다·업종마다 맞는지 확인했어요.</li>
          <li>업종 비율은 {span(s.range)} 내국인 소비를 모두 더한 값 기준이에요.</li>
          <li>이 지역 자료에는 세부 업종, 읍면동 비율, 같은 시도 순위가 없어요.</li>
        </ul>
        <p>자료: <a className="font-bold text-blue underline" href={officialUrl} target="_blank" rel="noreferrer">한국관광 데이터랩 지역 데이터 ↗</a> · 내려받은 날 {s.downloadDate} · 원문 CSV <a className="font-bold text-blue underline" href={s.links.domestic} target="_blank" rel="noreferrer">내국인 ↗</a> · <a className="font-bold text-blue underline" href={s.links.local} target="_blank" rel="noreferrer">현지인 ↗</a> · <a className="font-bold text-blue underline" href={s.links.outside} target="_blank" rel="noreferrer">외지인 ↗</a></p>
      </InfoDialog>
    </div>
    <RankLine text={`${span(s.range)} 합계 중 외지인 ${pct(outside)} · 현지인 ${pct(100 - outside)}`} />
    {/* Side by side only while the card is full width (before two region cards sit next to each other). */}
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1">
      <div className="space-y-2">
        <h4 className="text-sm font-extrabold">해마다 관광 소비</h4>
        <ShareBars label={`${trend.name} 해마다 관광 소비`} rows={s.years.map(y => ({ key: String(y.year), name: `${y.year}년`, value: y.total, text: eok(y.total) }))} color="bg-amber-500" columns="grid-cols-[3.5rem_minmax(0,1fr)_6.5rem]" />
      </div>
      <div className="space-y-2">
        <h4 className="text-sm font-extrabold">업종별 비율</h4>
        <ShareBars label={`${trend.name} 업종별 관광 소비 비율`} rows={s.industries.map(g => ({ key: g.name, name: g.name, value: g.share, text: pct(g.share) }))} color="bg-amber-500" columns="grid-cols-[6.5rem_minmax(0,1fr)_3.5rem]" />
      </div>
    </div>
    <Disclosure label="해마다·업종 표 보기">
      <div className="space-y-3">
        <TableScroll label={`${trend.name} 해마다 관광 소비 표`}>
          <table className="w-full min-w-[420px] border-collapse text-sm">
            <caption className="px-3 py-2 text-left font-bold">해마다 관광 소비(원문 천 원)</caption>
            <thead><tr className="bg-paper text-left">
              <th scope="col" className="px-3 py-2">연도</th>
              {["내국인", "현지인", "외지인"].map(h => <th key={h} scope="col" className="px-3 py-2 text-right">{h}</th>)}
            </tr></thead>
            <tbody>{s.years.map(y => <tr key={y.year} className="border-t border-ink/10">
              <th scope="row" className="px-3 py-1.5 text-left font-normal">{y.year}</th>
              {[y.total, y.local, y.outside].map((v, i) => <td key={i} className="px-3 py-1.5 text-right tabular-nums">{Math.round(v).toLocaleString("ko-KR")}</td>)}
            </tr>)}</tbody>
          </table>
        </TableScroll>
        <TableScroll label={`${trend.name} 업종별 비율 표`}>
          <table className="w-full min-w-[260px] border-collapse text-sm">
            <caption className="px-3 py-2 text-left font-bold">업종별 비율(%, {span(s.range)} 내국인 합계)</caption>
            <thead><tr className="bg-paper text-left"><th scope="col" className="px-3 py-2">업종</th><th scope="col" className="px-3 py-2 text-right">비율(%)</th></tr></thead>
            <tbody>{s.industries.map(g => <tr key={g.name} className="border-t border-ink/10"><th scope="row" className="px-3 py-1.5 text-left font-normal">{g.name}</th><td className="px-3 py-1.5 text-right tabular-nums">{g.share.toFixed(1)}</td></tr>)}</tbody>
          </table>
        </TableScroll>
      </div>
    </Disclosure>
  </section>;
}

function Visitors({ trend, officialUrl }: { trend: Trend; officialUrl: string }) {
  const v = trend.visitors, last = v.years.at(-1)!, before = v.years.at(-2);
  const change = (cur: number, prev: number | undefined) => (prev ? (cur - prev) / prev * 100 : null);
  return <section aria-labelledby="region-visitors" className="region-card space-y-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <Heading id="region-visitors" icon={Luggage} tone="blue" title={`${trend.name} 외지인 방문객`} note={`${span(v.range)} 해마다 · 이동통신 기반 추정(연인원)`} />
      <InfoDialog label="기준" title="외지인 방문객 자료의 기준" buttonClassName="region-button min-h-8 px-2 py-1 text-xs">
        <ul className="list-disc space-y-2 pl-5">
          <li>다른 시군구 주민이 {trend.name}에 온 것을 이동통신 자료로 추정해 한 해 동안 더한 값이에요. 같은 사람이 여러 날 오면 날마다 세요(연인원).</li>
          <li>한국관광공사 지역별 방문자 수(날마다 외지인)를 한 해 동안 더한 값과 같은 지표예요.</li>
          <li>{v.range.from}년은 데이터랩이 함께 보여 주는 비교 연도예요.</li>
          <li>이 지역 자료에는 거주지·읍면동 비율과 같은 시도 순위가 없어요. 축제 방문객만 뜻하지 않아요.</li>
        </ul>
        <p>자료: <a className="font-bold text-blue underline" href={officialUrl} target="_blank" rel="noreferrer">한국관광 데이터랩 지역 데이터 ↗</a> · 내려받은 날 {v.downloadDate} · <a className="font-bold text-blue underline" href={v.link} target="_blank" rel="noreferrer">원문 CSV ↗</a></p>
      </InfoDialog>
    </div>
    <RankLine text={`${last.year}년 ${man(last.outside)}${before ? ` · 전년보다 ${signed(change(last.outside, before.outside)!)}` : ""}`} />
    <div className="space-y-2">
      <h4 className="text-sm font-extrabold">해마다 외지인 방문</h4>
      <ShareBars label={`${trend.name} 해마다 외지인 방문`} rows={v.years.map(y => ({ key: String(y.year), name: `${y.year}년`, value: y.outside, text: man(y.outside) }))} color="bg-blue" columns="grid-cols-[3.5rem_minmax(0,1fr)_6.5rem]" />
    </div>
    <Disclosure label="해마다 외지인 방문 표 보기">
      <TableScroll label={`${trend.name} 해마다 외지인 방문 표`}>
        <table className="w-full min-w-[300px] border-collapse text-sm">
          <caption className="px-3 py-2 text-left font-bold">해마다 외지인 방문(명, 연인원)</caption>
          <thead><tr className="bg-paper text-left"><th scope="col" className="px-3 py-2">연도</th><th scope="col" className="px-3 py-2 text-right">외지인 방문</th><th scope="col" className="px-3 py-2 text-right">전년 대비</th></tr></thead>
          <tbody>{v.years.map((y, i) => { const c = change(y.outside, v.years[i - 1]?.outside); return <tr key={y.year} className="border-t border-ink/10">
            <th scope="row" className="px-3 py-1.5 text-left font-normal">{y.year}</th>
            <td className="px-3 py-1.5 text-right tabular-nums">{y.outside.toLocaleString("ko-KR")}</td>
            <td className="px-3 py-1.5 text-right tabular-nums">{c === null ? <><span aria-hidden="true" className="text-muted">—</span><span className="sr-only">비교 없음</span></> : signed(c)}</td>
          </tr>; })}</tbody>
        </table>
      </TableScroll>
    </Disclosure>
  </section>;
}
