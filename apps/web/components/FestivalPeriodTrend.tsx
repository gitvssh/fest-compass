"use client";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { LoadState } from "@/components/existing/ui";
import { useKeyedRequest } from "@/components/existing/useKeyedRequest";
import { festivalBundleKey, type FestivalBundle } from "@/lib/datalab/festival-bundle-types";
import { consecutiveRuns, formatCount, formatMetric, METRICS, metricValue, niceMax, searchFestivals } from "@/lib/datalab/model";
import type { FestivalPeriodDataset, FestivalPeriodYear, FestivalSummary, FestivalTrendView, PeriodMetric } from "@/lib/datalab/types";
import { FestivalProfile, PROFILE_SECTIONS } from "./FestivalProfile";
import { REGION_SECTION_ID, RegionProfileCards } from "./RegionProfile";
import { RegionTrendCards } from "./RegionTrend";

const W = 720, H = 290, L = 76, R = 700, T = 24, B = 236;

/** What the page needs for every festival; one festival's values arrive as a bundle when it is chosen. */
export type AnnualPageData = {
  festivals: FestivalSummary[]; axisYears: number[]; rawHeader: string[];
  scope: FestivalPeriodDataset["scope"]; source: { title: string; officialUrl: string }; regionOfficialUrl: string | null;
};

export function FestivalPeriodTrend({ data, initial, initialMetric, missingRequest }: { data: AnnualPageData; initial: FestivalBundle | null; initialMetric: PeriodMetric; missingRequest: boolean }) {
  const [query, setQuery] = useState(""), [id, setId] = useState(initial?.trend.id ?? null), [metric, setMetric] = useState(initialMetric);
  const [missing, setMissing] = useState(missingRequest);
  const heading = useRef<HTMLHeadingElement>(null), focusPending = useRef(false);
  const matches = useMemo(() => searchFestivals(data.festivals, query), [data.festivals, query]);
  const remoteId = id !== null && id !== initial?.trend.id ? id : null;
  const remote = useKeyedRequest<FestivalBundle>(remoteId ? `/api/datalab/festival?festival=${encodeURIComponent(remoteId)}` : null, undefined, remoteId ? festivalBundleKey(remoteId) : null);
  const bundle = id === null ? null : id === initial?.trend.id ? initial : remote.data;
  const chosen = data.festivals.find(f => f.id === id) ?? null;
  // Focus moves to the festival heading once the chosen festival's values are on screen.
  useEffect(() => { if (bundle && focusPending.current) { focusPending.current = false; heading.current?.focus(); } }, [bundle]);
  function sync(nextId: string | null, nextMetric: PeriodMetric) {
    const params = new URLSearchParams();
    if (nextId) params.set("festival", nextId);
    if (nextMetric !== "mean") params.set("metric", nextMetric);
    const qs = params.toString();
    window.history.replaceState(window.history.state, "", `${window.location.pathname}${qs ? `?${qs}` : ""}`);
  }
  function choose(next: string) {
    setMissing(false); sync(next, metric);
    if (next === id) { heading.current?.focus(); return; }
    focusPending.current = true; setId(next);
  }
  function chooseMetric(next: PeriodMetric) { setMetric(next); sync(id, next); }
  const host = bundle?.host ?? null, hostTrend = bundle?.hostTrend ?? null, hostName = host?.name ?? hostTrend?.name ?? null;
  return <div className="space-y-6">
    <header className="space-y-3"><p className="text-xs font-extrabold text-blue">한국관광 데이터랩 · 문화관광축제 {data.festivals.length}곳</p><h1 className="text-3xl font-extrabold">축제별 방문 자료</h1><p className="max-w-3xl text-sm leading-7 text-muted">축제를 골라 해마다 방문, 축제 기간과 평소의 차이, 방문객 성·연령, 많이 찾은 곳을 봐요.</p><Link href="/compare/scale" className="region-button">{data.festivals.length}곳 방문 규모 한눈에 보기</Link></header>
    <div className="grid gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]">
      <section className="region-card space-y-3 self-start" aria-labelledby="period-trend-picker">
        <h2 id="period-trend-picker" className="text-lg font-extrabold">축제 선택</h2>
        <label className="block text-sm font-bold">축제 이름·지역 찾기<input className="workspace-input mt-2" type="search" maxLength={40} value={query} onChange={e => setQuery(e.target.value)} placeholder="예: 강릉커피, 논산" aria-controls="period-trend-list" /></label>
        <p className="text-xs text-muted" aria-live="polite">{query.trim() ? matches.length ? `${matches.length}곳 일치` : `‘${query.trim()}’에 맞는 축제가 없습니다.` : `축제 ${data.festivals.length}곳 · 가나다순`}</p>
        {matches.length > 0 && <ul id="period-trend-list" className="max-h-72 space-y-1 overflow-y-auto pr-1 lg:max-h-[30rem]" aria-label="축제 목록">
          {matches.map(f => <li key={f.id}><button type="button" className="region-button w-full flex-col items-start gap-0.5 text-left" aria-pressed={f.id === id} onClick={() => choose(f.id)}><span>{f.name}</span><span className="text-xs font-medium text-muted">{f.place} · {f.years.length}개 연도</span></button></li>)}
        </ul>}
      </section>
      <div className="min-w-0 space-y-4">
        {missing && !id && <p role="status" className="rounded-xl bg-paper p-4 text-sm font-bold">요청한 축제의 자료가 없습니다. 목록에서 골라 주세요.</p>}
        {bundle ? <>
          <TrendPanel key={bundle.trend.id} data={data} festival={bundle.trend} metric={metric} onMetric={chooseMetric} heading={heading}
            sections={[...(bundle.profile ? PROFILE_SECTIONS : []), ...(hostName ? [{ id: REGION_SECTION_ID, label: `개최지 ${hostName}` }] : [])]} />
          {bundle.profile && <FestivalProfile key={`profile-${bundle.profile.id}`} profile={bundle.profile} officialUrl={data.source.officialUrl} />}
          {host && data.regionOfficialUrl && <div key={`host-${host.code}`} className="space-y-3">
            <p className="text-sm font-bold">개최지 {host.name} 전체 자료 <span className="font-normal text-muted">· 축제 기간만이 아닌 {host.range.from}~{host.range.to}년 지역 전체</span></p>
            <RegionProfileCards profile={host} officialUrl={data.regionOfficialUrl} />
          </div>}
          {hostTrend && data.regionOfficialUrl && <div key={`host-trend-${hostTrend.code}`} className="space-y-3">
            <p className="text-sm font-bold">개최지 {hostTrend.name} 전체 자료 <span className="font-normal text-muted">· 축제 기간만이 아닌 지역 전체의 해마다 값</span></p>
            <RegionTrendCards trend={hostTrend} officialUrl={data.regionOfficialUrl} />
          </div>}
        </> : id ? <section className="region-card space-y-3" aria-labelledby="period-trend-loading" aria-busy={remote.loading}>
          {/* Not a heading: the festival heading appears with its values, and focus moves there. */}
          <p id="period-trend-loading" className="text-xl font-extrabold">{chosen?.name ?? "축제 자료"}</p>
          <LoadState loading={remote.loading} failure={remote.failure} hasData={false} subject="축제 자료를" onRetry={remote.retry} retryLabel="축제 자료 다시 불러오기" />
        </section> : !missing && <section className="region-card"><p className="text-sm font-bold">목록에서 축제를 고르면 해마다 방문 흐름, 축제 기간과 평소 비교, 방문객 성·연령, 목적지 검색순위를 보여 줘요.</p></section>}
      </div>
    </div>
  </div>;
}

function TrendPanel({ data, festival, metric, onMetric, heading, sections }: { data: AnnualPageData; festival: FestivalTrendView; metric: PeriodMetric; onMetric: (m: PeriodMetric) => void; heading: RefObject<HTMLHeadingElement | null>; sections: readonly { id: string; label: string }[] }) {
  const [activeYear, setActiveYear] = useState<number | null>(null), years = data.axisYears;
  const byYear = new Map(festival.years.map(y => [y.year, y])), absent = years.filter(y => !byYear.has(y));
  const max = niceMax(Math.max(...festival.years.map(y => metricValue(y, metric))));
  const x = (year: number) => L + (year - years[0]) * (R - L) / Math.max(1, years.length - 1), y = (v: number) => B - v / max * (B - T);
  const active = activeYear === null ? null : byYear.get(activeYear) ?? null, m = METRICS[metric], unit = data.scope.unit;
  return <section className="region-card space-y-4" aria-labelledby="period-trend-title">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h2 id="period-trend-title" ref={heading} tabIndex={-1} className="text-xl font-extrabold focus:outline-none">{festival.name}</h2><p className="mt-1 text-sm text-muted">{festival.place} · {m.short} 방문자 · 단위 {unit}</p>
        {sections.length > 0 && <nav aria-label="이 축제의 다른 자료" className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm">{sections.map(x => <a key={x.id} href={`#${x.id}`} className="font-bold text-blue underline-offset-4 hover:underline" onClick={e => { e.preventDefault(); const t = document.getElementById(x.id); t?.scrollIntoView({ block: "start" }); t?.focus({ preventScroll: true }); }}>{x.label} ↓</a>)}</nav>}
      </div>
      <div role="group" aria-label="표시 값" className="flex gap-2">{(["mean", "total"] as const).map(k => <button key={k} type="button" className="region-button" aria-pressed={metric === k} onClick={() => onMetric(k)}>{METRICS[k].label}</button>)}</div>
    </div>
    <div className="overflow-x-auto" role="region" aria-label={`${festival.name} 방문 흐름 그래프 영역`} tabIndex={0}>
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${festival.name} 개최연도별 ${m.short} 방문자 그래프. 자료 연도 ${festival.years.map(v => v.year).join(", ")}. 정확한 값은 아래 표에 있습니다.`} className="w-full min-w-[36rem]">
      {[0, .5, 1].map(r => <g key={r}><line x1={L} x2={R} y1={y(max * r)} y2={y(max * r)} stroke="#d5dce3" /><text x={L - 8} y={y(max * r) + 5} fontSize={14} textAnchor="end" fill="#4b5b6d">{formatCount(max * r)}</text></g>)}
      {years.map(yr => <g key={yr}><text x={x(yr)} y={B + 24} fontSize={15} textAnchor="middle" fill={byYear.has(yr) ? "#10233d" : "#8a96a8"} fontWeight={byYear.has(yr) ? 700 : 400}>{yr}</text>{!byYear.has(yr) && <text x={x(yr)} y={B + 44} fontSize={13} textAnchor="middle" fill="#8a96a8">없음</text>}</g>)}
      {consecutiveRuns(festival.years).filter(run => run.length > 1).map(run => <path key={run[0].year} d={run.map((p, i) => `${i ? "L" : "M"}${x(p.year)},${y(metricValue(p, metric))}`).join(" ")} fill="none" stroke="#2667e8" strokeWidth={2.5} />)}
      {festival.years.map(p => <circle key={p.year} cx={x(p.year)} cy={y(metricValue(p, metric))} r={active?.year === p.year ? 7 : 4.5} fill={active?.year === p.year ? "#ae2e20" : "#2667e8"} onClick={() => setActiveYear(p.year)} className="cursor-pointer" />)}
      {active && <text x={Math.min(R - 4, Math.max(L + 4, x(active.year)))} y={y(metricValue(active, metric)) - 14} fontSize={15} fontWeight={700} textAnchor={x(active.year) > R - 60 ? "end" : x(active.year) < L + 60 ? "start" : "middle"} fill="#10233d">{formatMetric(metricValue(active, metric), metric)}</text>}
    </svg>
    </div>
    {absent.length > 0 && <p className="text-xs text-muted">자료 없는 연도: {absent.join(" · ")}</p>}
    <div role="group" aria-label="연도별 상세 보기" className="flex flex-wrap gap-2">{festival.years.map(p => <button key={p.year} type="button" className="region-button min-h-9 px-2 py-1 text-xs" aria-pressed={active?.year === p.year} onClick={() => setActiveYear(p.year)}>{p.year}</button>)}</div>
    {active && <YearDetail year={active} unit={unit} />}
    <div className="overflow-x-auto" role="region" aria-label="개최연도별 수치 표" tabIndex={0}>
      <table className="w-full min-w-[18rem] text-left text-sm">
        <caption className="mb-2 text-left text-xs text-muted">{festival.name} · {data.scope.area} · {data.scope.period} 방문자 ({unit})</caption>
        <thead><tr className="text-xs text-muted"><th scope="col" className="p-2">개최연도</th><th scope="col" className="p-2 text-right">기간(일)</th><th scope="col" className="p-2 text-right">일평균</th><th scope="col" className="p-2 text-right">기간 합계</th></tr></thead>
        <tbody>{years.map(yr => { const p = byYear.get(yr); return p
          ? <tr key={yr} className="border-t border-ink/10"><th scope="row" className="p-2 font-bold">{yr}</th><td className="p-2 text-right">{p.days}</td><td className="p-2 text-right">{formatMetric(p.dailyMean, "mean")}</td><td className="p-2 text-right">{formatMetric(p.periodTotal, "total")}</td></tr>
          : <tr key={yr} className="border-t border-ink/10 text-muted"><th scope="row" className="p-2 font-normal">{yr}</th><td colSpan={3} className="p-2 text-right">값 없음</td></tr>; })}</tbody>
      </table>
    </div>
    <RawTable header={data.rawHeader} festival={festival} />
    <details className="text-sm"><summary className="cursor-pointer font-bold">출처와 기준</summary>
      <dl className="mt-3 grid gap-x-4 gap-y-2 text-xs leading-6 sm:grid-cols-[8rem_minmax(0,1fr)]">
        <dt className="font-bold">제공처</dt><dd><a className="font-bold text-blue underline" href={data.source.officialUrl} target="_blank" rel="noreferrer">한국관광 데이터랩 축제 데이터 ↗</a></dd>
        <dt className="font-bold">측정 기준</dt><dd>축제가 열린 행정동을 찾은 방문자를 통신 데이터로 추정해 개최기간 동안 더한 값과 하루 평균입니다. 행사장 입장객 수와는 다릅니다. 개최기간이 짧으면 합계가 줄 수 있습니다.</dd>
        <dt className="font-bold">지역</dt><dd>{festival.place} · 축제가 열린 행정동이 속한 시도·시군구</dd>
        <dt className="font-bold">내려받은 날</dt><dd>{festival.downloadDate}</dd>
        <dt className="font-bold">원문 파일</dt><dd className="break-all"><a className="font-bold text-blue underline" href={festival.originalUrl} target="_blank" rel="noreferrer">원문 CSV 보기 ↗</a></dd>
      </dl>
    </details>
  </section>;
}

function YearDetail({ year, unit }: { year: FestivalPeriodYear; unit: string }) {
  const rows: [string, string][] = [["개최기간", `${year.days}일`], ["일평균", `${formatMetric(year.dailyMean, "mean")}${unit}`], ["기간 합계", `${formatMetric(year.periodTotal, "total")}${unit}`], ["현지인", `${formatCount(year.local)}${unit}`], ["외지인", `${formatCount(year.outside)}${unit}`], ["외국인", `${formatCount(year.foreign)}${unit}`]];
  return <div className="rounded-xl bg-paper p-3" aria-live="polite">
    <p className="text-sm font-extrabold">{year.year}년 개최기간</p>
    <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-3">{rows.map(([k, v]) => <div key={k} className="flex justify-between gap-2"><dt className="text-muted">{k}</dt><dd className="font-bold">{v}</dd></div>)}</dl>
    {year.foreign === 0 && <p className="mt-2 text-xs text-muted">외국인 수는 원문 기준입니다.</p>}
  </div>;
}

function RawTable({ header, festival }: { header: string[]; festival: FestivalTrendView }) {
  return <details className="text-sm"><summary className="cursor-pointer font-bold">원문 표 보기</summary>
    <p className="mt-2 text-xs leading-5 text-muted">전년도는 직전에 자료가 있는 연도를 가리킬 수 있습니다.</p>
    <div className="relative mt-2 max-h-80 overflow-auto rounded-xl border border-ink/10" role="region" aria-label={`${festival.name} 원문 표`} tabIndex={0}>
      <table className="min-w-max text-left text-xs"><caption className="sr-only">{festival.name} 연도별 방문자 추이 원문</caption>
        <thead><tr>{header.map(h => <th key={h} scope="col" className="whitespace-nowrap bg-paper p-2">{h}</th>)}</tr></thead>
        <tbody>{festival.years.map(p => <tr key={p.year} className="border-t border-ink/10">{p.raw.map((v, i) => <td key={i} className="whitespace-nowrap p-2">{v === "" ? <><span className="text-muted" aria-hidden="true">—</span><span className="sr-only">값 없음</span></> : v}</td>)}</tr>)}</tbody>
      </table>
    </div>
  </details>;
}
