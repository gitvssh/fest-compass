"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState, type RefObject } from "react";
import { monthlyKey, parseMonthly } from "@/lib/existing/request";
import type { CurrentFestival, DailyValue, MonthlyResponse, RegionRef } from "@/lib/existing/types";
import { rememberView, writeAddress } from "./address";
import { niceMax } from "./EditionChart";
import { FestivalPending, useFestival } from "./ExistingShell";
import { dayWithWeekday, koreaToday, monthRange, monthTitle, periodLabel, rawNumber, shortDate, validDay, validMonth, weekdayOf, WEEKDAY_SHORT } from "./format";
import { festivalMemory, viewHref } from "./memory";
import { ObservedMonths } from "./ObservedMonths";
import { one } from "./route-params";
import { useKeyedRequest } from "./useKeyedRequest";

// Registration observations of this exact registered festival are dates it was registered with, not proven
// editions, so they are never used as a festival period or averaged over.
type Registered = { key: string; start: string; end: string; checkedAt: string | null; now: boolean };

type Applied = { year: number | null; month: string | null };
function readApplied(params: URLSearchParams): Applied {
  const year = one(params, "year"), month = one(params, "month");
  return { year: year && /^\d{4}$/.test(year) && Number(year) >= 2000 && Number(year) <= 2035 ? Number(year) : null, month: validMonth(month) ? month : null };
}
function addressOf(a: Applied): URLSearchParams {
  const params = new URLSearchParams();
  if (a.year !== null) params.set("year", String(a.year));
  if (a.month) params.set("month", a.month);
  params.sort();
  return params;
}
const safeKey = (build: () => string) => { try { return build(); } catch { return null; } };
/** Korean calendar day of a collection time, or null when it is not a time. */
const checkedDay = (iso: string | null) => { const t = iso ? Date.parse(iso) : NaN; return Number.isNaN(t) ? null : koreaToday(new Date(t)); };

/** Newest first; the current registration is added only when no observation carries the same dates. */
function registeredDates(current: CurrentFestival | null): Registered[] {
  if (!current) return [];
  const list: Registered[] = (current.periods ?? []).filter(p => validDay(p.start) && validDay(p.end) && p.start <= p.end)
    .map(p => ({ key: p.id, start: p.start, end: p.end, checkedAt: p.collectedAt || null, now: false }));
  if (current.datesVerified && current.start && current.end) {
    const same = list.find(r => r.start === current.start && r.end === current.end);
    if (same) same.now = true;
    else list.push({ key: "current", start: current.start, end: current.end, checkedAt: current.provenance.collectedAt, now: true });
  }
  const seen = new Set<string>();
  return list.filter(r => !seen.has(`${r.start}/${r.end}`) && (seen.add(`${r.start}/${r.end}`), true)).sort((a, b) => b.start.localeCompare(a.start));
}

/**
 * District visits for a registered festival without a reviewed past-edition record: the district's observed
 * monthly means for one year and the daily line of a chosen month. Nothing here is a festival-period result.
 */
export function CurrentVisits({ heading }: { heading: RefObject<HTMLHeadingElement | null> }) {
  const festival = useFestival(), region = festival.region;
  return <>
    <div>
      <h2 id="visits-heading" ref={heading} tabIndex={-1} className="text-xl font-extrabold">{region ? `${region.districtName} 외지인 방문 흐름` : "지역 외지인 방문 흐름"}</h2>
      <p className="text-sm text-muted">{region ? `${region.name} 전체` : "시군구 전체"} · 명/일 · 통신 기반 추정 · 축제장 입장객 수 아님</p>
    </div>
    {region ? <DistrictVisits key={festival.id} region={region} /> : <FestivalPending />}
  </>;
}

function DistrictVisits({ region }: { region: RegionRef }) {
  const festival = useFestival(), router = useRouter(), params = useSearchParams(), address = params.toString();
  const applied = useMemo(() => readApplied(new URLSearchParams(address)), [address]);
  const memory = festivalMemory(festival.id), dailyHeading = useRef<HTMLHeadingElement>(null), focusDaily = useRef<string | null>(null);
  // A month is chosen for the first visit only; a later visit (or a closed month) keeps what the user left.
  const defaulted = useRef(applied.month !== null || memory.search.visits !== undefined);
  const [tableOpen, setTableOpen] = useState(!!memory.open["current-monthly-table"]);
  useEffect(() => { rememberView(festival.id, "visits", addressOf(applied)); }, [festival.id, applied]);

  const requestYear = applied.year ?? (applied.month ? Number(applied.month.slice(0, 4)) : null);
  const monthlyParams = new URLSearchParams({ province: region.province, district: region.district, ...(requestYear !== null ? { year: String(requestYear) } : {}) });
  const monthlyKeyValue = safeKey(() => monthlyKey(parseMonthly(monthlyParams)));
  const monthly = useKeyedRequest<MonthlyResponse>(monthlyKeyValue ? `/api/existing/monthly?${monthlyParams}` : null, undefined, monthlyKeyValue);
  const data = monthly.data, shownYear = data?.year ?? requestYear;
  const month = applied.month && shownYear !== null && applied.month.startsWith(String(shownYear)) ? applied.month : null;
  const registered = useMemo(() => registeredDates(festival.current), [festival.current]);
  const observedYears = new Set((data?.years ?? []).map(y => y.year)), thisMonth = koreaToday().slice(0, 7);
  // Unknown until the district's observation years are loaded.
  const hasMonth = (m: string) => (data ? observedYears.has(Number(m.slice(0, 4))) && m <= thisMonth : null);

  function apply(next: Applied) { const p = addressOf(next); rememberView(festival.id, "visits", p); writeAddress(p); }
  // First visit: open the latest registered month of the shown year that has values, else the latest observed month.
  useEffect(() => {
    if (defaulted.current || !data || applied.month) return;
    if (data.year === null) {
      const latest = data.years.filter(y => y.observedDays > 0).sort((a, b) => b.year - a.year)[0];
      if (latest) apply({year: latest.year, month: null});
      return;
    }
    defaulted.current = true;
    const observed = data.months.filter(m => m.observedDays > 0).map(m => m.month);
    const pick = registered.map(r => r.start.slice(0, 7)).find(m => observed.includes(m)) ?? observed.at(-1);
    if (pick) apply({ year: applied.year, month: pick });
  });

  function showMonth(target: string) {
    // The chosen month may need another observation year first; focus moves once its daily chart is shown.
    focusDaily.current = target;
    apply({ year: Number(target.slice(0, 4)), month: target });
  }
  useEffect(() => {
    if (focusDaily.current && focusDaily.current === month && data && dailyHeading.current) { focusDaily.current = null; dailyHeading.current.focus(); }
  });
  function openCalendar(target: string) {
    // The timing view keeps its own conditions; only the calendar month is set to the chosen month.
    const [path, query = ""] = viewHref(festival.id, "timing").split("?"), next = new URLSearchParams(query);
    next.set("month", target); next.sort();
    memory.focusHeading = "timing";
    router.push(`${path}?${next}`);
  }
  const noData = !!data && data.years.length === 0;

  return <>
    {registered.length > 0 && <RegisteredDates items={registered} selected={month} available={hasMonth} onShow={showMonth} />}
    {noData ? <div className="region-card space-y-2">
      <p className="font-bold">{region.districtName}의 외지인 방문 자료가 아직 없어요.</p>
      <p className="text-sm text-muted">주변 관광자원과 개최 시기는 지금 살펴볼 수 있어요.</p>
    </div> : <>
      <ObservedMonths region={region} result={monthly} year={applied.year ?? (data?.year ?? null)} onYear={year => apply({ year, month: null })}
        selectedMonth={month} onSelectMonth={m => apply({ year: shownYear, month: m })} onOpenCalendar={openCalendar}
        tableOpen={tableOpen} onTable={open => { setTableOpen(open); memory.open["current-monthly-table"] = open; }} />
      {data && month && data.months.length > 0 && <DailyLine region={region} month={month} daily={data.daily.filter(d => d.date.startsWith(month))} heading={dailyHeading} />}
    </>}
    <div className="flex flex-wrap gap-2">
      <Link className="region-button" href={viewHref(festival.id, "resources")}>주변 관광자원 보기</Link>
      <Link className="region-button" href={viewHref(festival.id, "timing")}>개최 시기 보기</Link>
      <Link className="region-button" href="/existing/search">다른 축제 찾기</Link>
    </div>
  </>;
}

function RegisteredDates({ items, selected, available, onShow }: { items: Registered[]; selected: string | null; available: (month: string) => boolean | null; onShow: (month: string) => void }) {
  return <section aria-labelledby="registered-heading" className="region-card space-y-2">
    <div>
      <h3 id="registered-heading" className="font-extrabold">등록 일정</h3>
    </div>
    <ul className="space-y-1.5">{items.map(r => {
      const m = r.start.slice(0, 7), checked = checkedDay(r.checkedAt), has = available(m);
      return <li key={r.key} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <span className="font-bold">{periodLabel(r.start, r.end)}</span>
        <span className="text-xs text-muted">{r.now ? "현재 등록" : "등록 기록"}{checked ? ` · 확인 ${checked}` : ""}</span>
        {has ? <button type="button" className="region-button min-h-8 px-2 py-1 text-xs" aria-pressed={selected === m} onClick={() => onShow(m)}>{monthTitle(m)} 방문 보기</button>
          : null}
      </li>;
    })}</ul>
  </section>;
}

const H = 214, L = 44, R = 8, T = 24, B = 42, PLOT_H = H - T - B, DAY_W = 16;
const compact = new Intl.NumberFormat("ko-KR", { notation: "compact", maximumFractionDigits: 1 });

/** Every day of the chosen month on its own slot; missing days break the line and are never drawn as zero. */
function DailyLine({ region, month, daily, heading }: { region: RegionRef; month: string; daily: DailyValue[]; heading: RefObject<HTMLHeadingElement | null> }) {
  const id = useId(), { end } = monthRange(month), days = Number(end.slice(8, 10));
  const byDate = new Map(daily.map(d => [d.date, d.value]));
  const points = Array.from({ length: days }, (_, i) => { const date = `${month}-${String(i + 1).padStart(2, "0")}`; return { date, weekday: weekdayOf(date), value: byDate.get(date) ?? null }; });
  const values = points.filter((p): p is typeof p & { value: number } => p.value !== null);
  const W = L + R + days * DAY_W, yMax = niceMax(Math.max(0, ...values.map(p => p.value)));
  const x = (i: number) => L + (i + 0.5) * DAY_W, y = (v: number) => T + (1 - v / yMax) * PLOT_H;
  const segments: string[] = [];
  let path = "";
  points.forEach((p, i) => {
    if (p.value === null) { if (path) segments.push(path); path = ""; return; }
    path += `${path ? "L" : "M"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`;
  });
  if (path) segments.push(path);
  const missing = points.some(p => p.value === null);
  const peak = values.length ? values.reduce((a, b) => (b.value > a.value ? b : a)) : null;
  const low = values.length ? values.reduce((a, b) => (b.value < a.value ? b : a)) : null;
  const title = `${monthTitle(month)} ${region.districtName} 일별 외지인 방문`;
  const desc = [peak && low ? `가장 많은 날 ${dayWithWeekday(peak.date)} ${rawNumber(peak.value)}명, 가장 적은 날 ${dayWithWeekday(low.date)} ${rawNumber(low.value)}명.` : "",
    missing ? "값이 없는 날은 선을 끊었어요." : "", "날짜별 값은 일별 수치 표에서 볼 수 있어요."].filter(Boolean).join(" ");
  const ticks = [0, 7, 14, 21, 28].filter(i => i < days);
  return <section aria-labelledby="daily-heading" className="region-card space-y-2">
    <div>
      <h3 id="daily-heading" ref={heading} tabIndex={-1} className="text-lg font-extrabold">{title}</h3>
      <p className="text-sm text-muted">명/일 · 추정 · {region.name} 전체 · 지난 관측값</p>
    </div>
    {values.length === 0 ? <p className="text-sm">이 달의 방문 자료가 없어요.</p> : <figure className="min-w-0">
      <div role="region" aria-label={`${monthTitle(month)} 일별 그래프`} tabIndex={0} className="overflow-x-auto rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-blue/40">
        <svg viewBox={`0 0 ${W} ${H}`} style={{ minWidth: W }} className="block w-full max-w-3xl" role="img" aria-labelledby={`${id}-t`} aria-describedby={`${id}-d`}>
          <title id={`${id}-t`}>{`${title} 선그래프`}</title>
          <desc id={`${id}-d`}>{desc}</desc>
          {[0, 0.5, 1].map(r => <g key={r}>
            <line x1={L} x2={W - R} y1={y(yMax * r)} y2={y(yMax * r)} stroke="#d5dce3" />
            <text x={L - 5} y={y(yMax * r) + 4} fontSize={10} textAnchor="end" fill="#4b5b6d">{compact.format(yMax * r)}</text>
          </g>)}
          {segments.map((d, i) => <path key={i} d={d} fill="none" stroke="#071a33" strokeWidth={2} strokeLinejoin="round" />)}
          {points.map((p, i) => p.value !== null && <circle key={p.date} cx={x(i)} cy={y(p.value)} r={2.6} fill="#071a33" />)}
          {points.map((p, i) => <text key={`w-${p.date}`} x={x(i)} y={H - 25} fontSize={9} textAnchor="middle" fill={p.weekday === 0 || p.weekday === 6 ? "#10233d" : "#65738a"} fontWeight={p.weekday === 0 || p.weekday === 6 ? 700 : 400}>{WEEKDAY_SHORT[p.weekday]}</text>)}
          {ticks.map(i => <text key={`d-${i}`} x={x(i)} y={H - 8} fontSize={10} textAnchor="middle" fill="#4b5b6d">{shortDate(points[i].date)}</text>)}
        </svg>
      </div>
      <figcaption className="mt-1 space-y-0.5 text-xs text-muted">
        {missing && <p>선이 끊긴 날: 값 없음</p>}
      </figcaption>
    </figure>}
  </section>;
}
