"use client";
import { House, Luggage, Scale, Trophy, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { IconBadge } from "@/components/guide/icons";
import { InfoDialog } from "@/components/existing/ui";
import { Segmented } from "@/components/Segmented";
import { formatCount } from "@/lib/datalab/model";
import { ORIENTATION_SHARE, rankScale, SCALE_SORTS, scaleYears, sharePercent, type Orientation, type ScaleRow, type ScaleSort } from "@/lib/datalab/scale";
import type { FestivalPeriodDataset } from "@/lib/datalab/types";

// One colour per visitor group wherever the groups are drawn; the share text next to each bar carries the same facts.
const GROUPS = [
  { key: "local", label: "현지인", color: "#0f766e" },
  { key: "outside", label: "외지인", color: "#2667e8" },
  { key: "foreign", label: "외국인", color: "#d97706" },
] as const;
const ORIENTATIONS: Readonly<Record<Orientation, { label: string; Icon: LucideIcon; className: string }>> = {
  outside: { label: "외지인 중심", Icon: Luggage, className: "bg-blue-soft text-[#164ea1]" },
  local: { label: "현지인 중심", Icon: House, className: "bg-teal-soft text-[#11564f]" },
  mixed: { label: "고르게", Icon: Scale, className: "bg-paper text-ink/70" },
};
const PERCENT = Math.round(ORIENTATION_SHARE * 100);

export function FestivalScale({ dataset, initialYear, initialSort }: { dataset: FestivalPeriodDataset; initialYear: number; initialSort: ScaleSort }) {
  const years = useMemo(() => scaleYears(dataset), [dataset]);
  const [year, setYear] = useState(initialYear), [sort, setSort] = useState(initialSort);
  const ranked = useMemo(() => rankScale(dataset, year, sort), [dataset, year, sort]);
  const leaders = useMemo(() => ({ mean: rankScale(dataset, year, "mean").rows[0], outside: rankScale(dataset, year, "outside").rows[0], local: rankScale(dataset, year, "local").rows[0] }), [dataset, year]);
  function sync(nextYear: number, nextSort: ScaleSort) {
    const params = new URLSearchParams();
    if (nextYear !== years[0]) params.set("year", String(nextYear));
    if (nextSort !== "mean") params.set("sort", nextSort);
    const qs = params.toString();
    window.history.replaceState(window.history.state, "", `${window.location.pathname}${qs ? `?${qs}` : ""}`);
  }
  const chooseYear = (next: number) => { setYear(next); sync(next, sort); };
  const chooseSort = (next: ScaleSort) => { setSort(next); sync(year, next); };
  const share = SCALE_SORTS[sort].share, max = ranked.rows[0] ? (sort === "total" ? ranked.rows[0].periodTotal : ranked.rows[0].dailyMean) : 1;

  return <div className="space-y-6">
    <header className="space-y-3">
      <p className="text-xs font-extrabold text-blue">한국관광 데이터랩 · 문화관광축제 {dataset.festivals.length}곳</p>
      <h1 className="text-3xl font-extrabold">문화관광축제 방문 규모</h1>
      <p className="max-w-3xl text-sm leading-7 text-muted">축제 기간에 얼마나 많이, 어디서 왔는지 한눈에 견줘 봐요.</p>
      <div className="flex flex-wrap gap-2">
        <Link href="/compare/annual" className="region-button">축제별 방문 자료</Link>
        <Link href="/existing/search?type=EV010100" className="region-button">문화관광축제 찾기</Link>
      </div>
    </header>

    {leaders.mean && <ul aria-label={`${year}년 한눈에 보기`} className="grid divide-y divide-ink/10 rounded-2xl border border-ink/10 bg-white sm:grid-cols-3 sm:divide-x sm:divide-y-0">
      <Leader icon={Trophy} tone="amber" label="하루 방문 최다" row={leaders.mean} value={`하루 ${formatCount(Math.round(leaders.mean.dailyMean))}명`} />
      <Leader icon={Luggage} tone="blue" label="외지인 비율 최고" row={leaders.outside} value={`외지인 ${sharePercent(leaders.outside.shares.outside)}`} />
      <Leader icon={House} tone="teal" label="현지인 비율 최고" row={leaders.local} value={`현지인 ${sharePercent(leaders.local.shares.local)}`} />
    </ul>}

    <section aria-labelledby="scale-list" className="region-card space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="space-y-2">
          <h2 id="scale-list" className="text-lg font-extrabold">{year}년 순위</h2>
          <Segmented label="연도" value={year} options={years.map(y => ({ value: y, label: String(y) }))} onChange={chooseYear} columns="grid-cols-6" />
        </div>
        <Segmented label="순위 기준" value={sort} options={(Object.keys(SCALE_SORTS) as ScaleSort[]).map(k => ({ value: k, label: SCALE_SORTS[k].label }))} onChange={chooseSort} columns="grid-cols-2" />
      </div>
      {/* Each colour and each badge stays beside its meaning when the row wraps. */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-y border-ink/10 py-2.5 text-xs">
        <span className="inline-flex items-center gap-3">{GROUPS.map(g => <span key={g.key} className="inline-flex items-center gap-1.5 font-bold"><span aria-hidden="true" className="h-2.5 w-2.5 rounded-sm" style={{ background: g.color }} />{g.label}</span>)}</span>
        <span aria-hidden="true" className="hidden h-4 w-px bg-ink/15 sm:block" />
        <span className="inline-flex items-center gap-1.5"><OrientationBadge orientation="outside" /><span className="text-muted">관광 연계·숙박이 중요</span></span>
        <span className="inline-flex items-center gap-1.5"><OrientationBadge orientation="local" /><span className="text-muted">교통편·프로그램이 중요</span></span>
        <span className="inline-flex items-center gap-1.5"><OrientationBadge orientation="mixed" /><span className="text-muted">둘 다 살펴보기</span></span>
        <span className="ml-auto"><Criteria dataset={dataset} /></span>
      </div>
      <p aria-live="polite" className="sr-only">{year}년 {SCALE_SORTS[sort].label} 순 {ranked.rows.length}곳</p>
      <div aria-hidden="true" className="hidden grid-cols-[2.25rem_minmax(0,15rem)_minmax(0,1fr)_8rem] gap-x-4 text-xs font-bold text-muted md:grid">
        <span>순위</span><span>축제</span><span>{share ? "방문객 구성" : `방문객 구성 · 막대 길이는 ${SCALE_SORTS[sort].label}`}</span><span className="text-right">{SCALE_SORTS[sort].label}</span>
      </div>
      <ol aria-label={`${year}년 ${SCALE_SORTS[sort].label} 순위`} className="divide-y divide-ink/10">
        {ranked.rows.map(r => <Row key={r.id} row={r} sort={sort} width={share ? 1 : (sort === "total" ? r.periodTotal : r.dailyMean) / max} />)}
      </ol>
      {ranked.absent.length > 0 && <p className="rounded-xl bg-paper px-3 py-2 text-sm text-muted">{year}년 자료 없음 · {ranked.absent.map(a => a.name).join(", ")}</p>}
    </section>
  </div>;
}

function Leader({ icon, tone, label, row, value }: { icon: LucideIcon; tone: "amber" | "blue" | "teal"; label: string; row: ScaleRow; value: string }) {
  return <li className="flex min-w-0 items-center gap-3 px-4 py-3 sm:py-4">
    <IconBadge icon={icon} tone={tone} />
    <span className="min-w-0 leading-snug">
      <span className="block text-xs font-bold text-muted">{label}</span>
      <span className="block truncate font-extrabold">{row.name}</span>
      <span className="block text-sm font-bold tabular-nums">{value}</span>
    </span>
  </li>;
}

function OrientationBadge({ orientation }: { orientation: Orientation }) {
  const o = ORIENTATIONS[orientation];
  return <span className={`inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold ${o.className}`}><o.Icon aria-hidden="true" size={13} strokeWidth={2.25} />{o.label}</span>;
}

function Row({ row: r, sort, width }: { row: ScaleRow; sort: ScaleSort; width: number }) {
  const value = sort === "mean" ? `하루 ${formatCount(Math.round(r.dailyMean))}명` : sort === "total" ? `${formatCount(r.periodTotal)}명`
    : sort === "outside" ? sharePercent(r.shares.outside) : sharePercent(r.shares.local);
  return <li className="grid grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 py-3 md:grid-cols-[2.25rem_minmax(0,15rem)_minmax(0,1fr)_8rem] md:gap-x-4">
    <span className={`col-start-1 row-span-3 row-start-1 self-start text-center text-lg font-extrabold tabular-nums md:row-span-2 md:row-start-1 ${r.rank <= 3 ? "text-blue" : "text-ink/60"}`}>{r.rank}</span>
    <span className="col-start-2 row-start-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
      <Link href={`/compare/annual?festival=${encodeURIComponent(r.id)}`} className="min-w-0 break-keep font-extrabold hover:text-blue hover:underline">{r.name}</Link>
      <span className="rounded-md bg-paper px-1.5 py-0.5 text-xs font-bold text-muted">{r.days}일</span>
    </span>
    <span className="col-start-3 row-start-1 text-right text-sm font-extrabold tabular-nums md:col-start-4">{value}</span>
    <span aria-hidden="true" className="col-span-2 col-start-2 row-start-2 block h-3 overflow-hidden rounded-full bg-paper md:col-span-1 md:col-start-3 md:row-start-1">
      <span className="flex h-full" style={{ width: `${Math.max(2, width * 100)}%` }}>
        {GROUPS.map(g => <span key={g.key} className="h-full" style={{ width: `${r.shares[g.key] * 100}%`, background: g.color }} />)}
      </span>
    </span>
    <span className="col-span-2 col-start-2 row-start-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted md:col-span-3 md:col-start-2 md:row-start-2">
      <OrientationBadge orientation={r.orientation} />
      <span className="tabular-nums">현지인 {sharePercent(r.shares.local)} · 외지인 {sharePercent(r.shares.outside)} · 외국인 {sharePercent(r.shares.foreign)}</span>
    </span>
  </li>;
}

function Criteria({ dataset }: { dataset: FestivalPeriodDataset }) {
  return <InfoDialog label="기준" title="방문 규모를 읽는 기준" buttonClassName="region-button min-h-8 px-2 py-1 text-xs">
    <ul className="list-disc space-y-2 pl-5">
      <li>방문자는 축제가 열린 행정동에 머문 사람을 이동통신 자료로 추정한 수예요. 행사장 입장객이 아니에요.</li>
      <li>일평균은 개최기간 방문자 합계를 개최일수로 나눈 값이에요. 기간이 긴 축제는 일평균이 낮게 보일 수 있어요.</li>
      <li>현지인·외지인·외국인 구분과 수는 데이터랩 원문 그대로예요. 외국인 0명도 원문 값이에요.</li>
      <li>‘외지인 중심’·‘현지인 중심’은 한쪽이 {PERCENT}% 이상일 때 이 화면에서 붙인 표시예요.</li>
      <li>데이터랩에서 내려받은 문화관광축제 {dataset.festivals.length}곳만 비교해요. 2020·2021년 자료는 없어요.</li>
    </ul>
    <p><a className="font-bold text-blue underline" href={dataset.source.officialUrl} target="_blank" rel="noreferrer">{dataset.source.title} ↗</a></p>
  </InfoDialog>;
}
