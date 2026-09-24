"use client";
import Link from "next/link";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { compareDestinations, percentagePointChange } from "@/lib/datalab/visitor-profile-compare";
import type { VisitorProfile as Profile, VisitorProfileBand, VisitorProfileResource, VisitorProfileSelection } from "@/lib/datalab/visitor-profile-types";
import { dateOnly, daysBetween, shortDate } from "./format";
import { festivalMemory, resourceHref } from "./memory";
import { Disclosure, InfoDialog, TableScroll } from "./ui";

type Group = Profile["destinationGroups"][number]["group"];
type BandPair = { ageBand: string; before: VisitorProfileBand; after: VisitorProfileBand };
const GROUP_ORDER: Group[] = ["outside", "local", "all"];
const pct = (value: number) => `${value.toFixed(1)}%`;
const signed = (value: number) => `${value > 0 ? "+" : value < 0 ? "-" : ""}${Math.abs(value).toFixed(1)}`;
const rankText = (rank: number | null) => (rank === null ? "—" : `${rank}위`);
const rankChangeText = (change: number | null) => (change === null ? "—" : change > 0 ? `${change}위 상승` : change < 0 ? `${-change}위 하락` : "같음");
const periodOf = (p: Profile) => `${p.start.slice(0, 4)}.${shortDate(p.start)}–${shortDate(p.end)}`;
const daysOf = (p: Profile) => daysBetween(p.start, p.end);
const SEX = [
  { key: "malePercent", short: "남", label: "남성", swatch: "bg-blue", soft: "bg-blue/40" },
  { key: "femalePercent", short: "여", label: "여성", swatch: "bg-coral", soft: "bg-coral/45" },
] as const;

/**
 * Reviewed visitor profile for the selected editions of the host town: one edition as a single profile, two editions
 * (same area, ascending) side by side. Shares are shown exactly as published (one decimal); no headcounts are derived.
 */
export function VisitorProfile({ festivalId, festivalName, data, recentPair = false }: { festivalId: string; festivalName: string; data: VisitorProfileSelection; recentPair?: boolean }) {
  const [before, after] = [...data.editions].sort((a, b) => a.start.localeCompare(b.start));
  if (before && after) return <ProfileComparison festivalId={festivalId} festivalName={festivalName} before={before} after={after} recentPair={recentPair} />;
  return before ? <SingleProfile festivalId={festivalId} festivalName={festivalName} data={before} /> : null;
}

function SingleProfile({ festivalId, festivalName, data }: { festivalId: string; festivalName: string; data: Profile }) {
  const memory = festivalMemory(festivalId), id = useId();
  const period = periodOf(data);
  return <section aria-labelledby={`${id}-heading`} className="region-card space-y-4">
    <div>
      <h3 id={`${id}-heading`} className="text-lg font-extrabold">{data.year}년 방문자 특성</h3>
      <p className="text-sm text-muted">{period} · {data.areaName} · 내국인 · 통신 기반 추정</p>
    </div>
    <div className="grid items-start gap-4 lg:grid-cols-2">
      {data.demographics.length > 0 && <Demographics rows={data.demographics} />}
      {data.destinationGroups.length > 0 && <Destinations festivalId={festivalId} areaName={data.areaName} groups={data.destinationGroups} />}
    </div>
    <div className="flex flex-wrap items-start gap-2">
      {data.demographics.length > 0 && <Disclosure label="성·연령 비율 표 보기" open={!!memory.open["visitor-profile-table"]} onToggle={open => { memory.open["visitor-profile-table"] = open; }}>
        <TableScroll label="성·연령별 비율 표">
          <table className="w-full min-w-[300px] border-collapse text-sm">
            <caption className="px-3 py-2 text-left font-bold">성·연령별 비율(%, 내국인 방문자 전체 중)</caption>
            <thead><tr className="bg-paper text-left">
              <th scope="col" className="px-3 py-2">연령대</th>
              {SEX.map(s => <th key={s.key} scope="col" className="px-3 py-2 text-right">{s.label}(%)</th>)}
            </tr></thead>
            <tbody>{data.demographics.map(row => <tr key={row.ageBand} className="border-t border-ink/10">
              <th scope="row" className="px-3 py-1.5 text-left font-normal">{row.ageBand}</th>
              {SEX.map(s => <td key={s.key} className="px-3 py-1.5 text-right tabular-nums">{row[s.key].toFixed(1)}</td>)}
            </tr>)}</tbody>
          </table>
        </TableScroll>
      </Disclosure>}
      <InfoDialog label="방문자 특성 출처 보기" title="방문자 특성 출처">
        <p>{data.year}년 {festivalName} 기간({period})에 {data.areaName}에 온 내국인을 통신 데이터로 추정한 자료예요. 축제장 입장객 수가 아니에요.</p>
        <p>성·연령별 비율은 내국인 방문자 전체를 100으로 본 비율이에요.</p>
        <p>목적지 검색순위는 축제 기간에 {data.areaName}에서 내비게이션 목적지 검색이 많았던 장소의 순위예요. 음식점·숙박은 빠져 있어요. 인원이나 이동 경로를 뜻하지 않아요.</p>
        <p>외지인·현지인·전체는 공식 자료의 검색한 사람 구분을 따라요.</p>
        <p>관광자원에서 보기는 한국관광공사 관광정보에 지금 등록된 같은 장소를 열어요.</p>
        <p>자료: <a className="font-bold text-blue underline" href={data.source.url} target="_blank" rel="noreferrer">{data.source.title} ↗</a> · 수집 {dateOnly(data.source.collectedAt)}</p>
      </InfoDialog>
    </div>
  </section>;
}

function ProfileComparison({ festivalId, festivalName, before, after, recentPair }: { festivalId: string; festivalName: string; before: Profile; after: Profile; recentPair: boolean }) {
  const memory = festivalMemory(festivalId), id = useId();
  const years = `${before.year}년과 ${after.year}년`;
  const pairs = useMemo(() => after.demographics.flatMap((a): BandPair[] => {
    const b = before.demographics.find(x => x.ageBand === a.ageBand);
    return b ? [{ ageBand: a.ageBand, before: b, after: a }] : [];
  }), [before, after]);
  return <section aria-labelledby={`${id}-heading`} className="region-card space-y-4">
    <div>
      <h3 id={`${id}-heading`} className="text-lg font-extrabold">방문자 특성 · {years}</h3>
      {recentPair && <p className="flex flex-wrap gap-x-3 text-xs text-muted"><span>최근 두 회차</span><a href="#edition-picker" className="font-bold text-blue underline">비교할 회차 바꾸기</a></p>}
      <p className="text-sm font-bold">{[before, after].map(p => `${p.year}년 ${shortDate(p.start)}–${shortDate(p.end)} ${daysOf(p)}일`).join(" · ")}</p>
      <p className="text-sm text-muted">{after.areaName} · 내국인 · 통신 기반 추정</p>
    </div>
    <div className="grid items-start gap-4 lg:grid-cols-2">
      {pairs.length > 0 && <DemographicsComparison before={before} after={after} pairs={pairs} />}
      <DestinationsComparison festivalId={festivalId} before={before} after={after} />
    </div>
    <div className="flex flex-wrap items-start gap-2">
      {pairs.length > 0 && <Disclosure label="성·연령 비율 표 보기" open={!!memory.open["visitor-profile-table"]} onToggle={open => { memory.open["visitor-profile-table"] = open; }}>
        <TableScroll label="성·연령별 비율 비교 표">
          <table className="w-full min-w-[560px] border-collapse text-sm">
            <caption className="px-3 py-2 text-left font-bold">성·연령별 비율(%, 내국인 방문자 전체 중) · 변화 = {after.year}년 − {before.year}년(%p)</caption>
            <thead><tr className="bg-paper text-left">
              <th scope="col" className="px-3 py-2">연령대</th>
              {SEX.flatMap(s => [`${s.label} ${before.year}년(%)`, `${s.label} ${after.year}년(%)`, `${s.label} 변화(%p)`])
                .map(h => <th key={h} scope="col" className="px-3 py-2 text-right">{h}</th>)}
            </tr></thead>
            <tbody>{pairs.map(p => <tr key={p.ageBand} className="border-t border-ink/10">
              <th scope="row" className="px-3 py-1.5 text-left font-normal">{p.ageBand}</th>
              {SEX.flatMap(s => [p.before[s.key].toFixed(1), p.after[s.key].toFixed(1), signed(percentagePointChange(p.before[s.key], p.after[s.key]))])
                .map((v, i) => <td key={i} className="px-3 py-1.5 text-right tabular-nums">{v}</td>)}
            </tr>)}</tbody>
          </table>
        </TableScroll>
      </Disclosure>}
      <InfoDialog label="방문자 특성 출처 보기" title="방문자 특성 출처">
        <p>{festivalName} {[before, after].map(p => `${p.year}년(${periodOf(p)}, ${daysOf(p)}일)`).join("과 ")} 기간에 {after.areaName}에 온 내국인을 통신 데이터로 추정한 자료예요. 축제장 입장객 수가 아니에요.</p>
        <p>성·연령별 비율은 해마다 내국인 방문자 전체를 100으로 본 비율이에요. 두 해의 막대는 같은 눈금이에요.</p>
        <p>%p는 두 해 비율의 차이예요. {after.year}년 비율에서 {before.year}년 비율을 뺐어요.</p>
        <p>목적지 검색순위는 축제 기간에 {after.areaName}에서 내비게이션 목적지 검색이 많았던 장소의 순위예요. 음식점·숙박은 빠져 있어요. 인원이나 이동 경로를 뜻하지 않아요.</p>
        <p>순위의 —는 그 해 공개된 순위에 없던 장소예요. 두 해 순위가 모두 있을 때만 변화를 적어요.</p>
        <p>외지인·현지인·전체는 공식 자료의 검색한 사람 구분을 따라요.</p>
        <p>관광자원에서 보기는 한국관광공사 관광정보에 지금 등록된 같은 장소를 열어요.</p>
        {[before, after].map(p => <p key={p.editionId}>{p.year}년 자료: <a className="font-bold text-blue underline" href={p.source.url} target="_blank" rel="noreferrer">{p.source.title} ↗</a> · 수집 {dateOnly(p.source.collectedAt)}</p>)}
      </InfoDialog>
    </div>
  </section>;
}

function Demographics({ rows }: { rows: Profile["demographics"] }) {
  const id = useId();
  // One shared scale for every bar, rounded up to a whole 5%.
  const max = Math.max(5, Math.ceil(Math.max(0, ...rows.flatMap(r => [r.malePercent, r.femalePercent])) / 5) * 5);
  const label = `성·연령별 비율, 내국인 방문자 전체 중. ${rows.map(r => `${r.ageBand} 남성 ${pct(r.malePercent)}, 여성 ${pct(r.femalePercent)}`).join("; ")}`;
  return <section aria-labelledby={`${id}-heading`} className="min-w-0 space-y-2">
    <div>
      <h4 id={`${id}-heading`} className="font-extrabold">성·연령별 비율</h4>
      <p className="text-xs text-muted">내국인 방문자 전체 중 비율(%)</p>
    </div>
    <p className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
      {SEX.map(s => <span key={s.key} className="inline-flex items-center gap-1"><span aria-hidden="true" className={`inline-block h-3 w-3 rounded-sm ${s.swatch}`} />{s.label}({s.short})</span>)}
    </p>
    <div role="img" aria-label={label} className="space-y-2">
      <div aria-hidden="true" className="grid grid-cols-[4.5rem_1.25rem_minmax(0,1fr)_3rem] gap-x-1.5 text-xs text-muted">
        <span className="col-start-3 flex justify-between"><span>0%</span><span>{max}%</span></span>
      </div>
      {rows.map(r => <div key={r.ageBand} aria-hidden="true" className="grid grid-cols-[4.5rem_1.25rem_minmax(0,1fr)_3rem] items-center gap-x-1.5 gap-y-0.5 text-xs">
        <span className="row-span-2 text-sm">{r.ageBand}</span>
        {SEX.map(s => <span key={s.key} className="contents">
          <span className="text-muted">{s.short}</span>
          <span className="block h-2.5 rounded bg-paper"><span className={`block h-full rounded ${s.swatch}`} style={{ width: `${Math.min(100, (r[s.key] / max) * 100)}%` }} /></span>
          <span className="text-right tabular-nums">{pct(r[s.key])}</span>
        </span>)}
      </div>)}
    </div>
  </section>;
}

/** Both years per sex on one shared scale; every bar carries its year and published value. */
function DemographicsComparison({ before, after, pairs }: { before: Profile; after: Profile; pairs: BandPair[] }) {
  const id = useId();
  const max = Math.max(5, Math.ceil(Math.max(0, ...pairs.flatMap(p => [p.before, p.after].flatMap(b => [b.malePercent, b.femalePercent]))) / 5) * 5);
  const label = `성·연령별 비율, 내국인 방문자 전체 중, ${before.year}년과 ${after.year}년. ${pairs.map(p =>
    `${p.ageBand} ${SEX.map(s => `${s.label} ${before.year}년 ${pct(p.before[s.key])}, ${after.year}년 ${pct(p.after[s.key])}`).join(", ")}`).join("; ")}`;
  const bars = (p: BandPair) => SEX.flatMap(s => [{ year: before.year, band: p.before, color: s.soft }, { year: after.year, band: p.after, color: s.swatch }]
    .map(b => ({ key: `${s.key}-${b.year}`, text: `${s.short} ${b.year}`, value: b.band[s.key], color: b.color })));
  return <section aria-labelledby={`${id}-heading`} className="min-w-0 space-y-2">
    <div>
      <h4 id={`${id}-heading`} className="font-extrabold">성·연령별 비율</h4>
      <p className="text-xs text-muted">내국인 방문자 전체 중 비율(%) · 두 해 같은 눈금</p>
    </div>
    <p className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
      {SEX.map(s => <span key={s.key} className="inline-flex items-center gap-1">
        <span aria-hidden="true" className={`inline-block h-3 w-3 rounded-sm ${s.soft}`} /><span aria-hidden="true" className={`inline-block h-3 w-3 rounded-sm ${s.swatch}`} />{s.label}({s.short})
      </span>)}
      <span>연한 색 {before.year}년 · 진한 색 {after.year}년</span>
    </p>
    <div role="img" aria-label={label} className="space-y-3">
      <div aria-hidden="true" className="grid grid-cols-[3.75rem_minmax(0,1fr)_3rem] gap-x-1.5 text-xs text-muted">
        <span className="col-start-2 flex justify-between"><span>0%</span><span>{max}%</span></span>
      </div>
      {pairs.map(p => <div key={p.ageBand} aria-hidden="true" className="space-y-0.5">
        <p className="text-sm font-bold">{p.ageBand}</p>
        {bars(p).map(b => <div key={b.key} data-bar={b.key} className="grid grid-cols-[3.75rem_minmax(0,1fr)_3rem] items-center gap-x-1.5 text-xs">
          <span className="text-muted tabular-nums">{b.text}</span>
          <span className="block h-2.5 rounded bg-paper"><span className={`block h-full rounded ${b.color}`} style={{ width: `${Math.min(100, (b.value / max) * 100)}%` }} /></span>
          <span className="text-right tabular-nums">{pct(b.value)}</span>
        </div>)}
      </div>)}
    </div>
  </section>;
}

/** Remembered rank group and the focus return to the followed link, shared by the single and two-year rankings. */
function useRankGroups<T extends { group: Group; label: string }>(festivalId: string, groups: T[]) {
  const memory = festivalMemory(festivalId).visitorProfile, list = useRef<HTMLOListElement>(null);
  const ordered = GROUP_ORDER.map(g => groups.find(x => x.group === g)).filter((g): g is T => !!g);
  const initial = ordered.find(g => g.group === memory.group) ?? ordered.find(g => g.group === "outside") ?? ordered[0];
  const [chosen, setChosen] = useState<Group | null>(initial?.group ?? null);
  const current = ordered.find(g => g.group === chosen) ?? initial;
  useEffect(() => { if (chosen) memory.group = chosen; }, [memory, chosen]);
  // Coming back from the resources view: return focus to the link that was followed, unless something else already has focus.
  useEffect(() => {
    const target = memory.returnTo;
    memory.returnTo = null;
    if (!target || (document.activeElement && document.activeElement !== document.body)) return;
    [...list.current?.querySelectorAll<HTMLElement>("[data-rank-link]") ?? []].find(el => el.dataset.rankLink === target)?.focus();
  }, [memory]);
  return { memory, list, ordered, current, choose: setChosen };
}

function GroupButtons({ groups, current, onChoose }: { groups: { group: Group; label: string }[]; current: Group; onChoose: (group: Group) => void }) {
  if (groups.length < 2) return null;
  return <div role="group" aria-label="검색한 사람 구분" className="flex flex-wrap gap-1.5">
    {groups.map(g => <button key={g.group} type="button" className="region-button px-3" aria-pressed={g.group === current} onClick={() => onChoose(g.group)}>{g.label}</button>)}
  </div>;
}

function RankLink({ festivalId, target, resource, onFollow }: { festivalId: string; target: string; resource: VisitorProfileResource; onFollow: (target: string) => void }) {
  return <Link data-rank-link={target} href={resourceHref(festivalId, resource)} aria-label={`${resource.title} 관광자원에서 보기`} onClick={() => onFollow(target)}
    className="mt-1 inline-flex min-h-8 items-center text-sm font-bold text-blue underline underline-offset-4">관광자원에서 보기 →</Link>;
}

function Destinations({ festivalId, areaName, groups }: { festivalId: string; areaName: string; groups: Profile["destinationGroups"] }) {
  const id = useId(), { memory, list, ordered, current, choose } = useRankGroups(festivalId, groups);
  if (!current) return null;
  return <section aria-labelledby={`${id}-heading`} className="min-w-0 space-y-2">
    <div>
      <h4 id={`${id}-heading`} className="font-extrabold">축제 기간 목적지 검색순위</h4>
      <p className="text-xs text-muted">{areaName} · 내비게이션 검색 · 음식점·숙박 제외</p>
    </div>
    <GroupButtons groups={ordered} current={current.group} onChoose={choose} />
    <ol ref={list} aria-label={`${current.label} 목적지 검색순위`} className="space-y-1.5">
      {current.items.map(item => <li key={item.id} className="grid grid-cols-[2.25rem_minmax(0,1fr)] gap-2 rounded-xl border border-ink/10 bg-white px-3 py-2 text-sm">
        <span className="font-extrabold tabular-nums">{item.rank}위</span>
        <div className="min-w-0">
          <p className="break-words font-bold">{item.name}</p>
          <p className="break-words text-xs text-muted">{item.category} · {item.address}</p>
          {item.resource && <RankLink festivalId={festivalId} target={`${current.group}:${item.id}`} resource={item.resource} onFollow={t => { memory.returnTo = t; }} />}
        </div>
      </li>)}
    </ol>
  </section>;
}

/** Union of both years' places per group (latest order, then earlier-only); one group choice drives both rank columns. */
function DestinationsComparison({ festivalId, before, after }: { festivalId: string; before: Profile; after: Profile }) {
  const id = useId();
  const groups = useMemo(() => GROUP_ORDER.flatMap(group => {
    const b = before.destinationGroups.find(g => g.group === group), a = after.destinationGroups.find(g => g.group === group);
    const label = a?.label ?? b?.label;
    return label ? [{ group, label, rows: compareDestinations(b?.items ?? [], a?.items ?? []) }] : [];
  }), [before, after]);
  const { memory, list, ordered, current, choose } = useRankGroups(festivalId, groups);
  if (!current) return null;
  return <section aria-labelledby={`${id}-heading`} className="min-w-0 space-y-2">
    <div>
      <h4 id={`${id}-heading`} className="font-extrabold">축제 기간 목적지 검색순위</h4>
      <p className="text-xs text-muted">{after.areaName} · 내비게이션 검색 · 음식점·숙박 제외</p>
    </div>
    <GroupButtons groups={ordered} current={current.group} onChoose={choose} />
    <ol ref={list} aria-label={`${current.label} 목적지 검색순위 · ${before.year}년과 ${after.year}년`} className="space-y-1.5">
      {current.rows.map(row => <li key={row.id} className="min-w-0 space-y-1 rounded-xl border border-ink/10 bg-white px-3 py-2 text-sm">
        <p className="break-words font-bold">{row.name}</p>
        <p className="break-words text-xs text-muted">{row.category} · {row.address}</p>
        <dl className="grid grid-cols-3 gap-2 text-xs">
          <div><dt className="text-muted">{before.year}년</dt><dd className="font-extrabold tabular-nums">{rankText(row.beforeRank)}</dd></div>
          <div><dt className="text-muted">{after.year}년</dt><dd className="font-extrabold tabular-nums">{rankText(row.afterRank)}</dd></div>
          <div><dt className="text-muted">변화</dt><dd className="font-bold">{rankChangeText(row.rankChange)}</dd></div>
        </dl>
        {row.resource && <RankLink festivalId={festivalId} target={`${current.group}:${row.id}`} resource={row.resource} onFollow={t => { memory.returnTo = t; }} />}
      </li>)}
    </ol>
  </section>;
}
