"use client";
import { CreditCard, Luggage, type LucideIcon } from "lucide-react";
import { useState } from "react";
import { Disclosure, InfoDialog, TableScroll } from "@/components/existing/ui";
import { IconBadge } from "@/components/guide/icons";
import type { RegionProfile as Profile, RegionShare } from "@/lib/datalab/region-profile-types";

const TOP = 5;
export const pct = (v: number) => `${v.toFixed(1)}%`;
/** Thousand won -> 억 원: whole 억 from 100억, one decimal below. */
export const eok = (thousandWon: number) => { const v = thousandWon / 1e5; return `${v.toLocaleString("ko-KR", { maximumFractionDigits: v >= 100 ? 0 : 1 })}억 원`; };
const rangeText = (p: Profile) => `${p.range.from}~${p.range.to}년`;
export const REGION_SECTION_ID = "region-spending";

/** DataLab cards for one whole region: tourism spending (years, industries, dongs) and where its outside visitors come from. */
export function RegionProfileCards({ profile, officialUrl }: { profile: Profile; officialUrl: string }) {
  return <div className="grid items-start gap-4 xl:grid-cols-2">
    <Spending profile={profile} officialUrl={officialUrl} />
    {profile.visitors ? <Visitors profile={profile} officialUrl={officialUrl} />
      : <section aria-labelledby="region-visitors" className="region-card space-y-2">
        <Heading id="region-visitors" icon={Luggage} tone="blue" title={`${profile.name} 외지인 방문객`} note={rangeText(profile)} />
        <p className="text-sm">이 지역은 외지인 방문객의 거주지·읍면동 자료가 아직 없어요.</p>
      </section>}
  </div>;
}

export function Heading({ id, icon, title, note, tone }: { id: string; icon: LucideIcon; title: string; note: string; tone: "blue" | "amber" }) {
  return <div className="flex min-w-0 items-start gap-3">
    <IconBadge icon={icon} tone={tone} />
    <div className="min-w-0">
      <h3 id={id} tabIndex={-1} className="scroll-mt-24 text-lg font-extrabold focus:outline-none">{title}</h3>
      <p className="text-sm text-muted">{note}</p>
    </div>
  </div>;
}

export function RankLine({ text }: { text: string }) {
  return <p className="w-fit rounded-full bg-paper px-3 py-1 text-xs font-bold">{text}</p>;
}

/** Labelled bars on one shared scale; the value next to each bar carries the same fact. */
export function ShareBars({ label, rows, color, columns = "grid-cols-[minmax(0,8.5rem)_minmax(0,1fr)_4.5rem]" }: { label: string; rows: { key: string; name: string; value: number; text: string }[]; color: string; columns?: string }) {
  const max = Math.max(...rows.map(r => r.value), 0) || 1;
  return <div role="img" aria-label={`${label}. ${rows.map(r => `${r.name} ${r.text}`).join(", ")}`} className="space-y-1.5">
    {rows.map(r => <div key={r.key} aria-hidden="true" className={`grid ${columns} items-center gap-2 text-sm`}>
      <span className="min-w-0 truncate" title={r.name}>{r.name}</span>
      <span className="block h-3 rounded bg-paper"><span className={`block h-full rounded ${color}`} style={{ width: `${(r.value / max) * 100}%` }} /></span>
      <span className="text-right tabular-nums">{r.text}</span>
    </div>)}
  </div>;
}

function TopAreas({ title, rows, color }: { title: string; rows: RegionShare[]; color: string }) {
  return <div className="space-y-2">
    <h4 className="text-sm font-extrabold">{title}</h4>
    <ShareBars label={title} rows={rows.slice(0, TOP).map(r => ({ key: r.name, name: r.name, value: r.share, text: pct(r.share) }))} color={color} />
  </div>;
}

function Spending({ profile, officialUrl }: { profile: Profile; officialUrl: string }) {
  const s = profile.spending;
  return <section aria-labelledby={REGION_SECTION_ID} className="region-card space-y-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <Heading id={REGION_SECTION_ID} icon={CreditCard} tone="amber" title={`${profile.name} 관광 소비`} note={`${profile.name} 전체 · 해마다 합계와 ${rangeText(profile)} 업종·읍면동 비율`} />
      <InfoDialog label="기준" title="지역 관광 소비의 기준" buttonClassName="region-button min-h-8 px-2 py-1 text-xs">
        <ul className="list-disc space-y-2 pl-5">
          <li>데이터랩의 지역 관광소비예요. {profile.name} 전체에서 쓴 관광 소비라 축제장에서 쓴 돈만 뜻하지 않아요.</li>
          <li>업종·읍면동 비율과 같은 시도 순위는 {rangeText(profile)}을 모두 더한 값 기준이에요. 해마다 합계를 더한 값과 맞춰 확인했어요.</li>
          <li>순위는 데이터랩이 함께 준 같은 시도 목록 안의 순위예요. 목록에 구가 따로 있으면 구도 한 곳으로 셌어요.</li>
          <li>데이터랩은 2026년 5월에 관광소비 제공 기준을 바꾼다고 알렸어요. 이 자료는 그 뒤에 받은 것이에요.</li>
        </ul>
        <p>자료: <a className="font-bold text-blue underline" href={officialUrl} target="_blank" rel="noreferrer">한국관광 데이터랩 지역 데이터 ↗</a> · 내려받은 날 {s.downloadDate} · 원문 CSV <a className="font-bold text-blue underline" href={s.links.trend} target="_blank" rel="noreferrer">해마다 ↗</a> · <a className="font-bold text-blue underline" href={s.links.industries} target="_blank" rel="noreferrer">업종 ↗</a> · <a className="font-bold text-blue underline" href={s.links.areas} target="_blank" rel="noreferrer">읍면동 ↗</a> · <a className="font-bold text-blue underline" href={s.links.province} target="_blank" rel="noreferrer">같은 시도 ↗</a></p>
      </InfoDialog>
    </div>
    <RankLine text={`같은 시도 목록 ${s.rank.count}곳 중 ${s.rank.position}위 · ${rangeText(profile)} 합계`} />
    {/* Side by side only while the card is full width (before the two region cards sit next to each other). */}
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1">
      <div className="space-y-2">
        <h4 className="text-sm font-extrabold">해마다 관광 소비</h4>
        <ShareBars label={`${profile.name} 해마다 관광 소비`} rows={s.years.map(y => ({ key: String(y.year), name: `${y.year}년`, value: y.total, text: eok(y.total) }))} color="bg-amber-500" columns="grid-cols-[3.5rem_minmax(0,1fr)_6.5rem]" />
      </div>
      <div className="space-y-2">
        <h4 className="text-sm font-extrabold">업종별 비율</h4>
        <ShareBars label={`${profile.name} 업종별 관광 소비 비율`} rows={s.industries.map(g => ({ key: g.name, name: g.name, value: g.share, text: pct(g.share) }))} color="bg-amber-500" columns="grid-cols-[6.5rem_minmax(0,1fr)_3.5rem]" />
      </div>
    </div>
    <TopAreas title={`관광 소비가 많은 읍면동 상위 ${Math.min(TOP, s.areas.length)}곳`} rows={s.areas} color="bg-amber-500" />
    <div className="flex flex-wrap items-start gap-2">
      <Disclosure label="해마다·업종 표 보기">
        <div className="space-y-3">
          <TableScroll label={`${profile.name} 해마다 관광 소비 표`}>
            <table className="w-full min-w-[280px] border-collapse text-sm">
              <caption className="px-3 py-2 text-left font-bold">해마다 관광 소비(원문 천 원)</caption>
              <thead><tr className="bg-paper text-left"><th scope="col" className="px-3 py-2">연도</th><th scope="col" className="px-3 py-2 text-right">천 원</th><th scope="col" className="px-3 py-2 text-right">억 원</th></tr></thead>
              <tbody>{s.years.map(y => <tr key={y.year} className="border-t border-ink/10"><th scope="row" className="px-3 py-1.5 text-left font-normal">{y.year}</th><td className="px-3 py-1.5 text-right tabular-nums">{y.total.toLocaleString("ko-KR")}</td><td className="px-3 py-1.5 text-right tabular-nums">{eok(y.total)}</td></tr>)}</tbody>
            </table>
          </TableScroll>
          <TableScroll label={`${profile.name} 업종별 비율 표`}>
            <table className="w-full min-w-[320px] border-collapse text-sm">
              <caption className="px-3 py-2 text-left font-bold">업종별 비율(%, {rangeText(profile)} 합계) · 세부 업종은 그 업종 안의 비율</caption>
              <thead><tr className="bg-paper text-left"><th scope="col" className="px-3 py-2">업종</th><th scope="col" className="px-3 py-2">세부 업종</th><th scope="col" className="px-3 py-2 text-right">비율(%)</th></tr></thead>
              <tbody>{s.industries.flatMap(g => [
                <tr key={g.name} className="border-t border-ink/10 font-bold"><th scope="row" className="px-3 py-1.5 text-left">{g.name}</th><td className="px-3 py-1.5">전체</td><td className="px-3 py-1.5 text-right tabular-nums">{g.share.toFixed(1)}</td></tr>,
                ...g.items.map(i => <tr key={`${g.name}-${i.name}`} className="border-t border-ink/5"><td className="px-3 py-1" /><td className="px-3 py-1">{i.name}</td><td className="px-3 py-1 text-right tabular-nums text-muted">{i.share.toFixed(1)}</td></tr>),
              ])}</tbody>
            </table>
          </TableScroll>
        </div>
      </Disclosure>
    </div>
  </section>;
}

function Visitors({ profile, officialUrl }: { profile: Profile; officialUrl: string }) {
  const v = profile.visitors!, s = profile.spending, [all, setAll] = useState(false);
  const names = [...new Set([...v.areas.map(a => a.name), ...s.areas.map(a => a.name)])];
  const rows = names.map(name => ({ name, visits: v.areas.find(a => a.name === name)?.share ?? null, spending: s.areas.find(a => a.name === name)?.share ?? null }))
    .sort((a, b) => (b.visits ?? -1) - (a.visits ?? -1) || (b.spending ?? -1) - (a.spending ?? -1));
  const shown = all ? rows : rows.slice(0, 10);
  return <section aria-labelledby="region-visitors" className="region-card space-y-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <Heading id="region-visitors" icon={Luggage} tone="blue" title={`${profile.name} 외지인 방문객`} note={`${rangeText(profile)} 합계 · 이동통신 기반 추정`} />
      <InfoDialog label="기준" title="외지인 방문객 자료의 기준" buttonClassName="region-button min-h-8 px-2 py-1 text-xs">
        <ul className="list-disc space-y-2 pl-5">
          <li>외지인(다른 시군구 주민)이 {profile.name}에 온 것을 이동통신 자료로 추정한 값이에요. 축제 방문객만 뜻하지 않아요.</li>
          <li>거주지는 외지인 방문 전체를 100으로 본 비율이에요. 데이터랩 목록 {v.listed}곳 중 상위 {v.origins.length}곳을 보이고 나머지는 그 밖으로 더했어요.</li>
          <li>읍면동 비율은 한 사람이 여러 읍면동을 들르면 각각 세는 값이라 인원으로 바꾸지 않았어요.</li>
          <li>순위는 같은 시도 목록 안의 외지인 방문 합계({rangeText(profile)}) 순위예요.</li>
        </ul>
        <p>자료: <a className="font-bold text-blue underline" href={officialUrl} target="_blank" rel="noreferrer">한국관광 데이터랩 지역 데이터 ↗</a> · 내려받은 날 {v.downloadDate} · 원문 CSV <a className="font-bold text-blue underline" href={v.links.origins} target="_blank" rel="noreferrer">거주지 ↗</a> · <a className="font-bold text-blue underline" href={v.links.areas} target="_blank" rel="noreferrer">읍면동 ↗</a> · <a className="font-bold text-blue underline" href={v.links.province} target="_blank" rel="noreferrer">같은 시도 ↗</a></p>
      </InfoDialog>
    </div>
    <RankLine text={`외지인 방문 · 같은 시도 목록 ${v.rank.count}곳 중 ${v.rank.position}위`} />
    <div className="space-y-2">
      <h4 className="text-sm font-extrabold">어디서 왔나 · 거주지 상위 {v.origins.length}곳</h4>
      <ShareBars label={`${profile.name} 외지인 방문객 거주지`} rows={v.origins.map(o => ({ key: `${o.province}-${o.district}`, name: `${o.province} ${o.district}`, value: o.share, text: pct(o.share) }))} color="bg-blue" />
      {v.otherShare > 0 && <p className="text-xs text-muted">그 밖 {v.listed - v.origins.length}곳 {pct(v.otherShare)}</p>}
    </div>
    <TopAreas title={`외지인이 많이 간 읍면동 상위 ${Math.min(TOP, v.areas.length)}곳`} rows={v.areas} color="bg-blue" />
    <Disclosure label="읍면동별 방문·소비 표 보기">
      <TableScroll label={`${profile.name} 읍면동별 방문·소비 비율 표`}>
        <table className="w-full min-w-[320px] border-collapse text-sm">
          <caption className="px-3 py-2 text-left font-bold">읍면동별 비율(%, {rangeText(profile)} 합계) · 외지인 방문 순</caption>
          <thead><tr className="bg-paper text-left"><th scope="col" className="px-3 py-2">읍면동</th><th scope="col" className="px-3 py-2 text-right">외지인 방문</th><th scope="col" className="px-3 py-2 text-right">관광 소비</th></tr></thead>
          <tbody>{shown.map(r => <tr key={r.name} className="border-t border-ink/10"><th scope="row" className="px-3 py-1.5 text-left font-normal">{r.name}</th>
            {[r.visits, r.spending].map((x, i) => <td key={i} className="px-3 py-1.5 text-right tabular-nums">{x === null ? <><span aria-hidden="true" className="text-muted">—</span><span className="sr-only">값 없음</span></> : x.toFixed(1)}</td>)}</tr>)}</tbody>
        </table>
      </TableScroll>
      {rows.length > 10 && <button type="button" className="region-button mt-2" aria-expanded={all} onClick={() => setAll(!all)}>{all ? "10곳만 보기" : `${rows.length}곳 모두 보기`}</button>}
    </Disclosure>
  </section>;
}
