"use client";
import { ArrowLeftRight, MapPin, Users } from "lucide-react";
import { useState } from "react";
import { DemographicBars, pct, SEX } from "@/components/DemographicBars";
import { Disclosure, InfoDialog, TableScroll } from "@/components/existing/ui";
import { IconBadge } from "@/components/guide/icons";
import { Segmented } from "@/components/Segmented";
import { FESTIVAL_INDICATOR_KEYS, type FestivalDestinationGroup, type FestivalIndicatorKey, type FestivalProfile as Profile } from "@/lib/datalab/festival-profile-types";

const INDICATORS: Readonly<Record<FestivalIndicatorKey, { label: string; area: string; source: string }>> = {
  outside: { label: "외지인 방문", area: "개최 행정동", source: "외부방문자 유입" },
  local: { label: "현지인 방문", area: "개최 행정동", source: "현지인방문자 유입" },
  search: { label: "내비게이션 검색", area: "개최 행정동", source: "내비게이션 검색량" },
  spending: { label: "관광 소비", area: "개최 시군구", source: "관광소비" },
  concentration: { label: "축제지 집중률", area: "행정동 ÷ 시군구", source: "축제지 집중률" },
};
export const PROFILE_SECTIONS = [
  { id: "festival-indicators", label: "축제 기간과 평소" },
  { id: "festival-demographics", label: "방문객 성·연령" },
  { id: "festival-destinations", label: "목적지 검색순위" },
] as const;
const TOP = 10;
/** Source value (period mean ÷ that year's maximum) read as "maximum = 100". */
const score = (v: number) => (v * 100).toFixed(1);
const signed = (v: number) => `${v > 0 ? "+" : v < 0 ? "−" : "±"}${Math.abs(v * 100).toFixed(1)}`;
const rangeText = (p: Profile) => `${p.range.from}~${p.range.to}년`;
/** Road addresses come with a "-0" sub-number; drop it for reading. The source file keeps the original. */
const address = (a: string) => a.replace(/(\d)-0$/, "$1");

/** DataLab profile cards for one reviewed 문화관광축제, shown under its yearly visit trend. */
export function FestivalProfile({ profile, officialUrl }: { profile: Profile; officialUrl: string }) {
  return <>
    <Indicators profile={profile} officialUrl={officialUrl} />
    <div className="grid items-start gap-4 xl:grid-cols-2">
      <Demographics profile={profile} officialUrl={officialUrl} />
      <Destinations profile={profile} officialUrl={officialUrl} />
    </div>
  </>;
}

function CardHeading({ id, icon, title, note, tone }: { id: string; icon: typeof Users; title: string; note: string; tone: "blue" | "teal" | "coral" }) {
  return <div className="flex min-w-0 items-start gap-3">
    <IconBadge icon={icon} tone={tone} />
    <div className="min-w-0">
      <h3 id={id} tabIndex={-1} className="scroll-mt-24 text-lg font-extrabold focus:outline-none">{title}</h3>
      <p className="text-sm text-muted">{note}</p>
    </div>
  </div>;
}

function Indicators({ profile, officialUrl }: { profile: Profile; officialUrl: string }) {
  const years = profile.indicators, [year, setYear] = useState(years.at(-1)!.year);
  const shown = years.find(y => y.year === year) ?? years.at(-1)!;
  const rows = FESTIVAL_INDICATOR_KEYS.map((key, i) => ({ key, ...INDICATORS[key], festival: shown.festival[i], base: shown.base[i], change: shown.festival[i] - shown.base[i] }));
  const up = rows.reduce((a, b) => (b.change > a.change ? b : a)), down = rows.reduce((a, b) => (b.change < a.change ? b : a));
  const label = `${shown.year}년 축제기간과 평소, 그해 최댓값을 100으로 본 값. ${rows.map(r => `${r.label} 축제기간 ${score(r.festival)}, 평소 ${score(r.base)}, 차이 ${signed(r.change)}`).join("; ")}`;
  return <section aria-labelledby="festival-indicators" className="region-card space-y-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <CardHeading id="festival-indicators" icon={ArrowLeftRight} tone="blue" title="축제 기간과 평소 비교" note="축제기간과 앞뒤 4주(평소)의 평균 · 그해 최댓값 = 100" />
      <IndicatorCriteria profile={profile} officialUrl={officialUrl} />
    </div>
    <Segmented label="연도" value={shown.year} options={years.map(y => ({ value: y.year, label: String(y.year) }))} onChange={setYear} columns="grid-cols-6" />
    <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs font-bold">
      <span className="inline-flex items-center gap-1.5"><span aria-hidden="true" className="h-2.5 w-2.5 rounded-sm bg-blue" />축제기간</span>
      <span className="inline-flex items-center gap-1.5"><span aria-hidden="true" className="h-2.5 w-2.5 rounded-sm bg-ink/30" />평소(앞뒤 4주)</span>
    </p>
    <div role="img" aria-label={label} className="space-y-3">
      {rows.map(r => <div key={r.key} aria-hidden="true" className="grid grid-cols-[minmax(0,7.5rem)_minmax(0,1fr)_3.25rem] items-center gap-x-3 gap-y-1 sm:grid-cols-[9rem_minmax(0,1fr)_3.25rem_4.25rem]">
        <span className="row-span-2 min-w-0 leading-tight"><span className="block text-sm font-bold">{r.label}</span><span className="block text-xs text-muted">{r.area}</span></span>
        <span className="block h-3 rounded-full bg-paper"><span className="block h-full rounded-full bg-blue" style={{ width: `${r.festival * 100}%` }} /></span>
        <span className="text-right text-sm font-bold tabular-nums">{score(r.festival)}</span>
        <span className="col-start-4 row-span-2 row-start-1 hidden text-right text-sm font-extrabold tabular-nums sm:block">{signed(r.change)}</span>
        <span className="col-start-2 block h-3 rounded-full bg-paper"><span className="block h-full rounded-full bg-ink/30" style={{ width: `${r.base * 100}%` }} /></span>
        <span className="text-right text-sm tabular-nums text-muted">{score(r.base)}</span>
        <span className="col-span-2 col-start-2 text-xs font-bold tabular-nums sm:hidden">평소보다 {signed(r.change)}</span>
      </div>)}
    </div>
    <p className="rounded-xl bg-paper px-3 py-2 text-sm">
      {up.change > 0 ? <>평소보다 가장 크게 오른 지표: <b>{up.label}</b>({signed(up.change)})</> : <>평소보다 오른 지표가 없어요.</>}
      {down.change < 0 && <><span aria-hidden="true"> · </span>평소보다 낮았던 지표: <b>{down.label}</b>({signed(down.change)})</>}
    </p>
    <Disclosure label="연도별 원문 값 보기">
      <TableScroll label={`${profile.name} 연도별 주요 지표 표`}>
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <caption className="px-3 py-2 text-left font-bold">원문 지표값(0~1) · 축제기간 / 평소(앞뒤 4주)</caption>
          <thead><tr className="bg-paper text-left">
            <th scope="col" className="px-3 py-2">연도</th>
            {FESTIVAL_INDICATOR_KEYS.map(k => <th key={k} scope="col" className="px-3 py-2 text-right">{INDICATORS[k].source}</th>)}
          </tr></thead>
          <tbody>{yearRows(profile).map(r => <tr key={r.year} className="border-t border-ink/10">
            <th scope="row" className="px-3 py-1.5 text-left font-bold">{r.year}</th>
            {r.values ? r.values.map((v, i) => <td key={i} className="px-3 py-1.5 text-right tabular-nums">{v.festival} / {v.base}</td>)
              : <td colSpan={FESTIVAL_INDICATOR_KEYS.length} className="px-3 py-1.5 text-right text-muted">값 없음(원문 값이 모두 0)</td>}
          </tr>)}</tbody>
        </table>
      </TableScroll>
    </Disclosure>
  </section>;
}

/** Held and withheld years in order; held values as the source wrote them (up to three decimals). */
function yearRows(profile: Profile) {
  const held = profile.indicators.map(y => ({ year: y.year, values: y.festival.map((f, i) => ({ festival: String(f), base: String(y.base[i]) })) }));
  return [...held, ...profile.withheldYears.map(year => ({ year, values: null }))].sort((a, b) => a.year - b.year);
}

function IndicatorCriteria({ profile, officialUrl }: { profile: Profile; officialUrl: string }) {
  return <InfoDialog label="지표 기준" title="축제 기간과 평소 비교의 기준" buttonClassName="region-button min-h-8 px-2 py-1 text-xs">
    <ul className="list-disc space-y-2 pl-5">
      <li>데이터랩의 문화관광축제 주요 지표예요. 값은 그 기간의 평균을 그해 최댓값으로 나눈 것이라 1(=100)에 가까울수록 그해 가장 붐빈 때에 가까워요.</li>
      <li>평소는 축제 시작 전 4주와 끝난 뒤 4주예요.</li>
      <li>외지인·현지인 방문과 내비게이션 검색은 축제가 열린 행정동, 관광 소비는 시군구 전체 값이에요. 축제지 집중률은 행정동 값을 시군구 값과 견준 거예요.</li>
      <li>지역 규모가 클수록 값이 낮게 나오는 경향이 있어요. 다른 축제와 값의 크기를 견주지 말고, 같은 축제의 해마다 변화를 볼 때 쓰세요.</li>
      {profile.withheldYears.length > 0 && <li>{profile.withheldYears.join("·")}년은 원문 값이 모두 0이라 자료가 없는 해로 봤어요.</li>}
      <li>2020·2021년은 데이터랩이 제공하지 않아요.</li>
    </ul>
    <p>자료: <a className="font-bold text-blue underline" href={officialUrl} target="_blank" rel="noreferrer">한국관광 데이터랩 축제 데이터 ↗</a> · 내려받은 날 {profile.downloadDate} · <a className="font-bold text-blue underline" href={profile.links.indicators} target="_blank" rel="noreferrer">원문 CSV ↗</a></p>
  </InfoDialog>;
}

function Demographics({ profile, officialUrl }: { profile: Profile; officialUrl: string }) {
  const rows = profile.demographics, male = rows.reduce((n, r) => n + r.malePercent, 0), female = rows.reduce((n, r) => n + r.femalePercent, 0);
  const top = rows.reduce((a, b) => (b.malePercent + b.femalePercent > a.malePercent + a.femalePercent ? b : a));
  return <section aria-labelledby="festival-demographics" className="region-card space-y-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <CardHeading id="festival-demographics" icon={Users} tone="coral" title="방문객 성·연령" note={`${rangeText(profile)} 축제기간을 합친 내국인 방문자`} />
      <InfoDialog label="기준" title="방문객 성·연령의 기준" buttonClassName="region-button min-h-8 px-2 py-1 text-xs">
        <ul className="list-disc space-y-2 pl-5">
          <li>축제가 열린 행정동에 축제기간 동안 온 내국인을 이동통신 자료로 추정한 비율이에요. 행사장 입장객이 아니에요.</li>
          <li>{rangeText(profile)} 중 자료가 있는 해의 축제기간을 합친 값이라 한 해의 구성과 다를 수 있어요. 2020·2021년은 데이터랩이 제공하지 않아요.</li>
          <li>비율은 원문 그대로(소수 첫째 자리)라 더하면 100과 조금 다를 수 있어요.</li>
        </ul>
        <p>자료: <a className="font-bold text-blue underline" href={officialUrl} target="_blank" rel="noreferrer">한국관광 데이터랩 축제 데이터 ↗</a> · 내려받은 날 {profile.downloadDate} · <a className="font-bold text-blue underline" href={profile.links.demographics} target="_blank" rel="noreferrer">원문 CSV ↗</a></p>
      </InfoDialog>
    </div>
    <dl className="grid grid-cols-3 divide-x divide-ink/10 rounded-xl bg-paper text-center">
      <div className="px-2 py-2"><dt className="text-xs text-muted">남성</dt><dd className="font-extrabold tabular-nums">{pct(male)}</dd></div>
      <div className="px-2 py-2"><dt className="text-xs text-muted">여성</dt><dd className="font-extrabold tabular-nums">{pct(female)}</dd></div>
      <div className="px-2 py-2"><dt className="text-xs text-muted">가장 많은 연령대</dt><dd className="font-extrabold tabular-nums">{top.ageBand} {pct(top.malePercent + top.femalePercent)}</dd></div>
    </dl>
    <DemographicBars rows={rows} note="내국인 방문자 전체 중 비율(%)" />
    <Disclosure label="성·연령 비율 표 보기">
      <TableScroll label={`${profile.name} 성·연령별 비율 표`}>
        <table className="w-full min-w-[300px] border-collapse text-sm">
          <caption className="px-3 py-2 text-left font-bold">성·연령별 비율(%, 내국인 방문자 전체 중)</caption>
          <thead><tr className="bg-paper text-left">
            <th scope="col" className="px-3 py-2">연령대</th>
            {SEX.map(s => <th key={s.key} scope="col" className="px-3 py-2 text-right">{s.label}(%)</th>)}
          </tr></thead>
          <tbody>{rows.map(r => <tr key={r.ageBand} className="border-t border-ink/10">
            <th scope="row" className="px-3 py-1.5 text-left font-normal">{r.ageBand}</th>
            {SEX.map(s => <td key={s.key} className="px-3 py-1.5 text-right tabular-nums">{r[s.key].toFixed(1)}</td>)}
          </tr>)}</tbody>
        </table>
      </TableScroll>
    </Disclosure>
  </section>;
}

function Destinations({ profile, officialUrl }: { profile: Profile; officialUrl: string }) {
  const [group, setGroup] = useState<FestivalDestinationGroup["group"]>("outside"), [all, setAll] = useState(false);
  const current = profile.destinations.find(g => g.group === group) ?? profile.destinations[0];
  const items = all ? current.items : current.items.slice(0, TOP), areas = [...new Set(profile.destinations.flatMap(g => g.items.map(i => i.area)))];
  return <section aria-labelledby="festival-destinations" className="region-card space-y-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <CardHeading id="festival-destinations" icon={MapPin} tone="teal" title="축제 기간 목적지 검색순위" note={`${areas.join("·")} · ${rangeText(profile)} 축제기간 합산 · 음식점·숙박 제외`} />
      <InfoDialog label="기준" title="목적지 검색순위의 기준" buttonClassName="region-button min-h-8 px-2 py-1 text-xs">
        <ul className="list-disc space-y-2 pl-5">
          <li>축제기간에 축제가 열린 행정동 안에서 내비게이션 목적지로 많이 검색된 곳의 순위예요. 방문자 수나 이동 경로가 아니에요.</li>
          <li>데이터랩 정의상 음식점과 숙박시설은 순위에서 빠져 있어요.</li>
          <li>{rangeText(profile)} 중 자료가 있는 해의 축제기간을 합친 순위예요. 같은 순위가 여러 곳이면 같은 숫자로 적어요.</li>
          <li>외지인·현지인·전체는 검색한 사람의 구분이에요. 이름과 분류는 원문 그대로예요.</li>
        </ul>
        <p>자료: <a className="font-bold text-blue underline" href={officialUrl} target="_blank" rel="noreferrer">한국관광 데이터랩 축제 데이터 ↗</a> · 내려받은 날 {profile.downloadDate} · <a className="font-bold text-blue underline" href={profile.links.destinations} target="_blank" rel="noreferrer">원문 CSV ↗</a></p>
      </InfoDialog>
    </div>
    <Segmented label="검색한 사람" value={current.group} options={profile.destinations.map(g => ({ value: g.group, label: g.label }))} onChange={g => { setGroup(g); setAll(false); }} columns="grid-cols-3" />
    <ol aria-label={`${current.label} 목적지 검색순위`} className="grid gap-1.5 sm:grid-cols-2">
      {items.map((item, i) => <li key={`${current.group}-${i}`} className="grid min-w-0 grid-cols-[2.5rem_minmax(0,1fr)] gap-2 rounded-xl border border-ink/10 bg-white px-3 py-2 text-sm">
        <span className={`font-extrabold tabular-nums ${item.rank <= 3 ? "text-blue" : ""}`}>{item.rank}위</span>
        <span className="min-w-0">
          <span className="block break-words font-bold">{item.name}</span>
          <span className="block break-words text-xs text-muted">{item.category} · {address(item.address)}</span>
        </span>
      </li>)}
    </ol>
    {current.items.length > TOP && <button type="button" className="region-button" aria-expanded={all} onClick={() => setAll(!all)}>{all ? `상위 ${TOP}곳만 보기` : `${current.items.length}곳 모두 보기`}</button>}
  </section>;
}
