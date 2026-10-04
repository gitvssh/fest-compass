"use client";
import { Gauge } from "lucide-react";
import { useState } from "react";
import { dayWithWeekday, timeLabel, weekdayOf } from "@/components/existing/format";
import { Disclosure, InfoDialog, LoadState, TableScroll } from "@/components/existing/ui";
import { useKeyedRequest } from "@/components/existing/useKeyedRequest";
import { IconBadge } from "@/components/guide/icons";
import type { RegionRef } from "@/lib/existing/types";
import { crowdKey, parseCrowd } from "@/lib/kto-signals/request";
import type { CrowdForecast as Forecast } from "@/lib/kto-signals/types";

const TOP = 8;
const whole = (v: number) => Math.round(v).toString();
/** Busier = darker; the number is always written next to it. */
const shade = (rate: number | null) => (rate === null ? "transparent" : `rgba(217, 119, 6, ${(0.12 + Math.min(100, rate) / 100 * 0.88).toFixed(2)})`);
const weekend = (date: string) => { const w = weekdayOf(date); return w === 0 || w === 6; };

/** KTO's 30-day concentration forecast for the district's tourist spots (busiest period of each spot = 100). */
export function CrowdForecast({ region }: { region: RegionRef }) {
  const params = new URLSearchParams({ province: region.province, district: region.district });
  const key = (() => { try { return crowdKey(parseCrowd(params)); } catch { return null; } })();
  const result = useKeyedRequest<Forecast>(key ? `/api/signals/crowd?${params}` : null, undefined, key);
  const data = result.data && result.data.region.code === region.code ? result.data : null;
  const [all, setAll] = useState(false);
  return <section aria-labelledby="crowd-heading" className="region-card space-y-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex min-w-0 items-start gap-3">
        <IconBadge icon={Gauge} tone="amber" />
        <div className="min-w-0">
          <h3 id="crowd-heading" className="text-lg font-extrabold">앞으로 30일 관광지 붐빔 예측</h3>
          <p className="text-sm text-muted">{data?.status === "complete" ? `${data.basis ? data.basis.name : region.districtName} 관광지 ${data.spots.length}곳 · ` : ""}한국관광공사 예측 · 관광지마다 가장 붐비는 때 = 100</p>
        </div>
      </div>
      <Criteria data={data} />
    </div>
    <LoadState loading={result.loading} failure={result.failure} hasData={!!data} retrievedAt={data?.retrievedAt} subject="붐빔 예측을" onRetry={result.retry} retryLabel="붐빔 예측 다시 불러오기" />
    {data?.status === "unavailable" && <p role="alert" className="flex flex-wrap items-center gap-2 rounded-xl bg-coral-soft p-3 text-sm">지금은 붐빔 예측을 불러올 수 없어요.<button type="button" className="region-button" onClick={result.retry}>붐빔 예측 다시 불러오기</button></p>}
    {data?.status === "empty" && <p className="rounded-xl bg-paper p-3 text-sm">이 지역은 한국관광공사 붐빔 예측이 아직 없어요.</p>}
    {data?.status === "complete" && data.spots.length > 0 && <Complete data={data} region={region} all={all} onAll={setAll} />}
  </section>;
}

function Complete({ data, region, all, onAll }: { data: Forecast; region: RegionRef; all: boolean; onAll: (v: boolean) => void }) {
  const best = data.daily.reduce<{ i: number; v: number } | null>((b, v, i) => (v !== null && (!b || v > b.v) ? { i, v } : b), null);
  const top = data.spots[0], spots = all ? data.spots : data.spots.slice(0, TOP);
  const columns = { gridTemplateColumns: `repeat(${data.days.length}, minmax(0, 1fr))` };
  return <>
    {data.basis && <p className="text-sm">{data.basis.parentOf} 관광지는 {data.basis.name} 전체로 예측돼 있어 {data.basis.name} 기준으로 보여 줘요.</p>}
    <dl className="grid gap-2 sm:grid-cols-2">
      {best && <div className="rounded-xl bg-paper px-3 py-2"><dt className="text-xs text-muted">관광지 평균이 가장 높은 날</dt><dd className="font-extrabold">{dayWithWeekday(data.days[best.i])} · 평균 {whole(best.v)}</dd></div>}
      <div className="rounded-xl bg-paper px-3 py-2"><dt className="text-xs text-muted">30일 평균이 가장 높은 곳</dt><dd className="font-extrabold">{top.name} · 평균 {whole(top.mean)}</dd></div>
    </dl>
    <div className="space-y-2">
      <h4 className="text-sm font-extrabold">날마다 관광지 평균</h4>
      <div role="img" aria-label={`날마다 관광지 평균 예측. ${data.days.map((d, i) => `${dayWithWeekday(d)} ${data.daily[i] === null ? "값 없음" : whole(data.daily[i]!)}`).join(", ")}`} className="space-y-1">
        <div aria-hidden="true" className="grid h-20 items-end gap-px" style={columns}>
          {data.daily.map((v, i) => <span key={data.days[i]} className={`block rounded-t ${weekend(data.days[i]) ? "bg-amber-600" : "bg-amber-400"}`} style={{ height: `${v === null ? 0 : Math.max(2, Math.min(100, v))}%` }} />)}
        </div>
        <div aria-hidden="true" className="grid gap-px text-[11px] text-muted" style={columns}>
          {data.days.map((d, i) => <span key={d} className="text-center tabular-nums">{i % 7 === 0 || (i === data.days.length - 1 && i % 7 >= 4) ? `${Number(d.slice(5, 7))}.${Number(d.slice(8))}` : ""}</span>)}
        </div>
      </div>
      <p className="text-xs text-muted">진한 막대: 토·일요일</p>
    </div>
    <div className="space-y-2">
      <h4 className="text-sm font-extrabold">관광지별 · 30일 평균 높은 순</h4>
      <p className="flex flex-wrap items-center gap-2 text-xs text-muted"><span aria-hidden="true" className="inline-flex gap-px">{[10, 40, 70, 100].map(r => <span key={r} className="inline-block h-3 w-4" style={{ background: shade(r) }} />)}</span>연할수록 한산, 진할수록 붐빔 예측</p>
      <ol aria-label="관광지별 30일 붐빔 예측" className="space-y-1.5">
        {spots.map(s => <li key={s.name} className="grid min-w-0 gap-1 rounded-xl border border-ink/10 bg-white px-3 py-2 text-sm sm:grid-cols-[minmax(0,11rem)_minmax(0,1fr)_9.5rem] sm:items-center sm:gap-3">
          <span className="min-w-0 truncate font-bold" title={s.name}>{s.name}</span>
          <span role="img" aria-label={`${s.name} 30일 예측. ${data.days.map((d, i) => `${dayWithWeekday(d)} ${s.rates[i] === null ? "값 없음" : whole(s.rates[i]!)}`).join(", ")}`} className="grid h-4 gap-px" style={columns}>
            {s.rates.map((r, i) => <span key={data.days[i]} aria-hidden="true" className={`block ${weekend(data.days[i]) ? "outline outline-1 -outline-offset-1 outline-ink/10" : ""}`} style={{ background: shade(r) }} />)}
          </span>
          <span className="text-xs tabular-nums text-muted sm:text-right">평균 <b className="text-ink">{whole(s.mean)}</b> · 최고 {whole(s.peak.rate)} {dayWithWeekday(s.peak.date)}</span>
        </li>)}
      </ol>
      {data.spots.length > TOP && <button type="button" className="region-button" aria-expanded={all} onClick={() => onAll(!all)}>{all ? `상위 ${TOP}곳만 보기` : `${data.spots.length}곳 모두 보기`}</button>}
    </div>
    <Disclosure label="날짜별 수치 표 보기">
      <TableScroll label={`${region.districtName} 관광지별 30일 붐빔 예측 표`}>
        <table className="min-w-max border-collapse text-xs">
          <caption className="px-3 py-2 text-left font-bold">관광지별 예측 집중률(가장 붐비는 때 = 100)</caption>
          <thead><tr className="bg-paper"><th scope="col" className="sticky left-0 bg-paper px-2 py-1.5 text-left">관광지</th>{data.days.map(d => <th key={d} scope="col" className="px-1.5 py-1.5 text-right font-normal tabular-nums">{dayWithWeekday(d)}</th>)}</tr></thead>
          <tbody>{data.spots.map(s => <tr key={s.name} className="border-t border-ink/10"><th scope="row" className="sticky left-0 bg-white px-2 py-1 text-left font-normal">{s.name}</th>
            {s.rates.map((r, i) => <td key={data.days[i]} className="px-1.5 py-1 text-right tabular-nums">{r === null ? <><span aria-hidden="true" className="text-muted">—</span><span className="sr-only">값 없음</span></> : whole(r)}</td>)}</tr>)}</tbody>
        </table>
      </TableScroll>
    </Disclosure>
  </>;
}

function Criteria({ data }: { data: Forecast | null }) {
  return <InfoDialog label="기준" title="관광지 붐빔 예측의 기준" buttonClassName="region-button min-h-8 px-2 py-1 text-xs">
    <ul className="list-disc space-y-2 pl-5">
      <li>한국관광공사가 KT 이동통신 자료(2018년부터)의 패턴으로 관광지별 앞으로 30일의 방문 집중률을 예측한 값이에요.</li>
      <li>관광지마다 그 관광지가 가장 붐비는 때를 100으로 본 상대값이라, 관광지끼리 방문자 수를 견주는 값이 아니에요.</li>
      <li>평일·공휴일·휴가철 같은 시기 특성을 반영한 기계학습 추정이라 실제 방문과 다를 수 있어요. 축제 방문객 수 예측도 아니에요.</li>
      <li>날마다 평균은 그날 값이 있는 관광지들의 평균이에요.</li>
    </ul>
    <p>자료: <a className="font-bold text-blue underline" href="https://www.data.go.kr/data/15128555/openapi.do" target="_blank" rel="noreferrer">한국관광공사 관광지 집중률 방문자 추이 예측 ↗</a>{data?.source ? ` · ${timeLabel(data.source.collectedAt)} 조회` : ""}</p>
  </InfoDialog>;
}
