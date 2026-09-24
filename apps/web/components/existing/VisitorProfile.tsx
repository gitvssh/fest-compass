"use client";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import type { VisitorProfile as Profile } from "@/lib/datalab/visitor-profile-types";
import { dateOnly, shortDate } from "./format";
import { festivalMemory, resourceHref } from "./memory";
import { Disclosure, InfoDialog, TableScroll } from "./ui";

type Group = Profile["destinationGroups"][number]["group"];
const GROUP_ORDER: Group[] = ["outside", "local", "all"];
const pct = (value: number) => `${value.toFixed(1)}%`;
const SEX = [
  { key: "malePercent", short: "남", label: "남성", swatch: "bg-blue" },
  { key: "femalePercent", short: "여", label: "여성", swatch: "bg-coral" },
] as const;

/**
 * One reviewed festival edition's visitor profile for the host town: official sex/age shares of domestic visitors
 * and the destination search ranking. Shares are shown exactly as published (one decimal); no headcounts are derived.
 */
export function VisitorProfile({ festivalId, festivalName, data }: { festivalId: string; festivalName: string; data: Profile }) {
  const memory = festivalMemory(festivalId), id = useId();
  const period = `${data.start.slice(0, 4)}.${shortDate(data.start)}–${shortDate(data.end)}`;
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

function Destinations({ festivalId, areaName, groups }: { festivalId: string; areaName: string; groups: Profile["destinationGroups"] }) {
  const memory = festivalMemory(festivalId).visitorProfile, id = useId(), list = useRef<HTMLOListElement>(null);
  const ordered = GROUP_ORDER.map(g => groups.find(x => x.group === g)).filter((g): g is Profile["destinationGroups"][number] => !!g);
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
  if (!current) return null;
  return <section aria-labelledby={`${id}-heading`} className="min-w-0 space-y-2">
    <div>
      <h4 id={`${id}-heading`} className="font-extrabold">축제 기간 목적지 검색순위</h4>
      <p className="text-xs text-muted">{areaName} · 내비게이션 검색 · 음식점·숙박 제외</p>
    </div>
    {ordered.length > 1 && <div role="group" aria-label="검색한 사람 구분" className="flex flex-wrap gap-1.5">
      {ordered.map(g => <button key={g.group} type="button" className="region-button px-3" aria-pressed={g.group === current.group} onClick={() => setChosen(g.group)}>{g.label}</button>)}
    </div>}
    <ol ref={list} aria-label={`${current.label} 목적지 검색순위`} className="space-y-1.5">
      {current.items.map(item => <li key={item.id} className="grid grid-cols-[2.25rem_minmax(0,1fr)] gap-2 rounded-xl border border-ink/10 bg-white px-3 py-2 text-sm">
        <span className="font-extrabold tabular-nums">{item.rank}위</span>
        <div className="min-w-0">
          <p className="break-words font-bold">{item.name}</p>
          <p className="break-words text-xs text-muted">{item.category} · {item.address}</p>
          {item.resource && <Link data-rank-link={`${current.group}:${item.id}`} href={resourceHref(festivalId, item.resource)}
            aria-label={`${item.resource.title} 관광자원에서 보기`} onClick={() => { memory.returnTo = `${current.group}:${item.id}`; }}
            className="mt-1 inline-flex min-h-8 items-center text-sm font-bold text-blue underline underline-offset-4">관광자원에서 보기 →</Link>}
        </div>
      </li>)}
    </ol>
  </section>;
}
