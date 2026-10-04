"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Columns2, Info, Layers, Table2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { historyKey, parseHistory } from "@/lib/existing/request";
import type { EditionHistory, HistoryResponse, Range } from "@/lib/existing/types";
import { rememberView, writeAddress } from "./address";
import { DEFAULT_PAD, EditionPicker, WindowForm } from "./EditionControls";
import { EditionChart, niceMax } from "./EditionChart";
import { CurrentVisits } from "./CurrentVisits";
import { useFestival, useViewHeadingFocus } from "./ExistingShell";
import { dateOnly, dayWithWeekday, editionLabel, fullDate, number, rawNumber, timeLabel, WEEKDAY_SHORT } from "./format";
import { EDITION_LOOKS, LookSwatch, OverlayChart, OverlayLegend, type OverlaySeries } from "./OverlayChart";
import { historyRequest, readVisitsApplied, visitsAddress, type VisitsApplied } from "./visits-address";
import { PeriodBars } from "./PeriodBars";
import { festivalMemory } from "./memory";
import { Disclosure, FreshnessNote, InfoDialog, LoadState, TableScroll } from "./ui";
import { useKeyedRequest } from "./useKeyedRequest";

type Applied = VisitsApplied;

export function HistoryPanel() {
  const festival = useFestival(), heading = useRef<HTMLHeadingElement>(null);
  useViewHeadingFocus(festival.id, "visits", heading);
  // A registered festival with a reviewed past-edition record shows that record here, under its own name and address.
  return <section aria-labelledby="visits-heading" className="space-y-4">
    {festival.source === "archive" || festival.archive ? <ArchiveHistory heading={heading} /> : <CurrentVisits heading={heading} />}
  </section>;
}

function NoHistory() {
  return <div className="region-card space-y-3">
    <p className="font-bold">이 축제의 지난 개최 기록이 없어요.</p>
    <p className="text-sm text-muted">연계 관광과 개최 시기는 아래에서 바로 살펴볼 수 있어요.</p>
    <div className="flex flex-wrap gap-2">
      <Link className="region-button" href="/existing/search">다른 축제 찾기</Link>
    </div>
  </div>;
}

function ArchiveHistory({ heading }: { heading: RefObject<HTMLHeadingElement | null> }) {
  const festival = useFestival(), params = useSearchParams(), address = params.toString();
  const applied = useMemo(() => readVisitsApplied(new URLSearchParams(address)), [address]);
  const request = historyRequest(festival.id, applied);
  const expectedKey = (() => { try { return historyKey(parseHistory(request)); } catch { return null; } })();
  const result = useKeyedRequest<HistoryResponse>(expectedKey ? `/api/existing/history?${request}` : null, undefined, expectedKey);
  const data = result.data, memory = festivalMemory(festival.id);
  useEffect(() => { rememberView(festival.id, "visits", visitsAddress(applied)); }, [festival.id, applied]);

  const editions = data?.festival.editions ?? festival.archive?.editions ?? [];
  const appliedIds = data ? data.editions.map(e => e.editionId) : applied.editions;
  function apply(next: Applied) { const params = visitsAddress(next); rememberView(festival.id, "visits", params); writeAddress(params); }
  function applyWindow(editionId: string, range: Range | null) {
    const windows = { ...applied.windows };
    if (range) windows[editionId] = range; else delete windows[editionId];
    apply({ ...applied, editions: appliedIds, windows });
  }

  const region = data?.festival.region ?? festival.region;
  const yMax = niceMax(data?.sharedYMax ?? 0);
  // Only held editions with a comparable definition are charted; cancelled/incompatible/undated keep their own reason.
  const charted = (e: EditionHistory) => e.state === "available" && e.points.some(p => p.value !== null);
  const hasChart = !!data && data.sharedYMax !== null && data.editions.some(charted);
  const noObservation = !!data && !hasChart && data.editions.every(e => e.state === "available" || e.state === "no-history");
  // Overlay first: one large chart lined up on each edition's first day, lines shown or hidden per edition. The separate
  // charts (actual dates side by side) stay one click away. Both choices are kept for this tab only.
  const [separate, setOverlaySeparate] = useState(() => !!memory.open["visits-separate"]);
  const overlay = hasChart && !separate, setOverlay = (on: boolean) => setOverlaySeparate(!on);
  const [hidden, setHidden] = useState<ReadonlySet<string>>(() => new Set(Object.keys(memory.open).filter(k => k.startsWith("visits-hidden:") && memory.open[k]).map(k => k.slice(14))));
  function toggleLine(editionId: string) {
    setHidden(previous => { const next = new Set(previous); if (next.has(editionId)) next.delete(editionId); else next.add(editionId); memory.open[`visits-hidden:${editionId}`] = next.has(editionId); return next; });
  }
  const series: OverlaySeries[] = (data?.editions ?? []).filter(e => charted(e) && e.start).map((edition, i) => ({ edition, look: EDITION_LOOKS[i % EDITION_LOOKS.length] }));
  const looks = new Map(series.map(s => [s.edition.editionId, s.look]));
  const shown = series.filter(s => !hidden.has(s.edition.editionId));
  const title = <div>
    <h2 id="visits-heading" ref={heading} tabIndex={-1} className="text-xl font-extrabold">{region ? `${region.districtName} 외지인 방문 추이` : "지역 외지인 방문 추이"}</h2>
    <p className="text-sm text-muted">{region ? `${region.name} 전체` : "시군구 전체"} · 명/일 · 통신 기반 추정</p>
  </div>;
  if (result.failure === "notfound" && !data) return festival.source === "current" ? <CurrentVisits heading={heading} /> : <>{title}<NoHistory /></>;
  return <>
    {title}
    <EditionPicker key={`${appliedIds.join(",")}/${applied.before}/${applied.after}`} editions={editions} applied={appliedIds} pads={{ before: applied.before, after: applied.after }}
      onApply={(ids, pads) => apply({ ...pads, editions: ids, windows: Object.fromEntries(Object.entries(applied.windows).filter(([k]) => ids.includes(k))) })} />
    {!expectedKey && <div role="alert" className="region-card flex flex-wrap items-center gap-2 text-sm">
      <p>주소의 조회 조건을 확인하지 못했어요.</p>
      <button type="button" className="region-button" onClick={() => apply({ editions: [], before: DEFAULT_PAD, after: DEFAULT_PAD, windows: {} })}>기본 회차로 보기</button>
    </div>}
    <LoadState loading={result.loading} failure={result.failure} hasData={!!data} retrievedAt={data?.retrievedAt} subject="방문 자료를" onRetry={result.retry} />
    {result.failure === "invalid" && <button type="button" className="region-button" onClick={() => apply({ editions: [], before: DEFAULT_PAD, after: DEFAULT_PAD, windows: {} })}>기본 회차로 보기</button>}
    {data && <>
      {!hasChart && <div className="region-card space-y-3">
        {noObservation && <p className="font-bold">선택한 회차 기간의 방문 자료가 없어요.</p>}
        <div className="flex flex-wrap gap-2"><Link className="region-button" href="/existing/search">다른 축제 찾기</Link></div>
      </div>}
      {hasChart && <ChartMode mode={overlay ? "overlay" : "separate"} onChange={next => { setOverlay(next === "overlay"); memory.open["visits-separate"] = next === "separate"; }} />}
      {overlay && <section aria-label="회차 겹쳐 보기" className="region-card space-y-3">
        <OverlayLegend series={series} hidden={hidden} onToggle={toggleLine} />
        {shown.length ? <OverlayChart series={shown} yMax={yMax} region={region?.districtName ?? ""} />
          : <p className="rounded-xl bg-paper px-3 py-6 text-center text-sm text-muted">그래프에 보일 회차를 하나 이상 골라 주세요.</p>}
      </section>}
      <ul className={`grid gap-4 ${data.editions.length > 1 ? overlay && data.editions.length > 2 ? "md:grid-cols-2 xl:grid-cols-3" : "md:grid-cols-2" : ""}`}>
        {data.editions.map(e => { const look = overlay ? looks.get(e.editionId) : undefined;
          return <li key={e.editionId} className="region-card min-w-0 space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <h3 className="flex items-center gap-2 font-extrabold">{look && <LookSwatch look={look} className={hidden.has(e.editionId) ? "opacity-40" : ""} />}{editionLabel(e)}</h3>
            {e.window && e.windowSource === "custom" && <span className="text-xs text-muted">표시 {fullDate(e.window.start)} ~ {fullDate(e.window.end)}</span>}
          </div>
          {hasChart && !overlay && charted(e) ? <EditionChart edition={e} region={region?.districtName ?? ""} yMax={yMax} slots={data.maxWindowDays} /> : null}
          <EditionSummary edition={e} scaleMax={yMax} />
          <WindowForm key={`${e.window?.start}-${e.window?.end}`} edition={e} custom={e.windowSource === "custom"} onApply={range => applyWindow(e.editionId, range)} />
        </li>; })}
      </ul>
      <div className="flex flex-wrap items-start gap-2">
        <Disclosure label="수치 표 보기" icon={<Table2 size={16} />} open={!!memory.open[`visits-table:${data.key}`]} onToggle={open => { memory.open[`visits-table:${data.key}`] = open; }}>
          <div className="space-y-4">{data.editions.filter(e => e.points.length).map(e => <EditionTable key={e.editionId} edition={e} />)}</div>
        </Disclosure>
        <InfoDialog label="출처·산식 보기" title="방문 자료 출처와 계산" buttonIcon={<Info size={16} />}>
          <SourceDetails data={data} />
        </InfoDialog>
      </div>
      <FreshnessNote freshness={data.freshness} retrievedAt={data.retrievedAt} onRetry={result.retry} />
    </>}
  </>;
}

/** Overlay or separate charts; a two-button switch that keeps the focus where it is. */
function ChartMode({ mode, onChange }: { mode: "overlay" | "separate"; onChange: (mode: "overlay" | "separate") => void }) {
  const options = [{ mode: "overlay" as const, label: "겹쳐 보기", Icon: Layers }, { mode: "separate" as const, label: "따로 보기", Icon: Columns2 }];
  return <div role="group" aria-label="그래프 보기 방식" className="inline-flex gap-1 rounded-xl border border-ink/15 bg-white p-1">
    {options.map(o => <button key={o.mode} type="button" aria-pressed={mode === o.mode} onClick={() => onChange(o.mode)}
      className={`inline-flex min-h-10 items-center gap-1.5 rounded-lg px-3 text-sm font-bold transition-colors ${mode === o.mode ? "bg-navy text-white" : "text-ink hover:bg-paper"}`}>
      <o.Icon aria-hidden="true" size={16} />{o.label}
    </button>)}
  </div>;
}

export function EditionSummary({ edition: e, scaleMax }: { edition: EditionHistory; scaleMax: number }) {
  const s = e.summary;
  if (e.withheld) return <p className="text-sm text-muted">{e.withheld.message}</p>;
  if (s.status === "available") return <div className="space-y-3">
    <PeriodBars edition={e} scaleMax={scaleMax} />
    <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 border-t border-ink/10 pt-2 text-sm">
      <dt className="text-muted">가장 많았던 날</dt><dd>{s.peak.dates.map(dayWithWeekday).join(", ")} · {rawNumber(s.peak.value)}명</dd>
      <dt className="text-muted">개최 일수</dt><dd>{s.denominator}일</dd>
    </dl>
  </div>;
  if (s.status === "incomplete") return <div className="space-y-2 text-sm">
    <p className="font-bold">이 회차의 평균을 계산할 수 없어요.</p>
    <p className="text-muted">개최 {s.denominator}일 중 {s.observedDays}일만 값이 있어요. 값 없는 날: {s.missingDates.map(dayWithWeekday).join(", ")}</p>
    <button type="button" className="region-button" onClick={() => document.getElementById("edition-picker")?.focus()}>회차 바꾸기</button>
  </div>;
  if (s.status === "no-dates") return <p className="text-sm text-muted">개최일을 확인하지 못해 개최 전후 흐름과 평균을 표시하지 않아요.</p>;
  if (s.status === "cancelled") return <p className="text-sm text-muted">취소된 회차라 개최기간 평균을 만들지 않아요.</p>;
  if (s.status === "incompatible") return <p className="text-sm text-muted">다른 기준의 방문 자료라 같은 그래프에서 비교하지 않아요.</p>;
  return <p className="text-sm text-muted">이 회차 기간의 방문 자료가 없어요.</p>;
}

function EditionTable({ edition: e }: { edition: EditionHistory }) {
  return <TableScroll label={`${e.year}년 일별 수치 표`}>
    <table className="w-full min-w-[320px] border-collapse text-sm">
      <caption className="px-3 py-2 text-left font-bold">{editionLabel(e)} · 외지인 방문(명, 추정)</caption>
      <thead><tr className="bg-paper text-left"><th scope="col" className="px-3 py-2">날짜</th><th scope="col" className="px-3 py-2">요일</th><th scope="col" className="px-3 py-2">구분</th><th scope="col" className="px-3 py-2 text-right">방문(명)</th></tr></thead>
      <tbody>{e.points.map(p => <tr key={p.date} className={`border-t border-ink/10 ${p.inFestival ? "bg-blue-soft/50" : ""}`}>
        <th scope="row" className="px-3 py-1.5 text-left font-normal">{p.date}</th><td className="px-3 py-1.5">{WEEKDAY_SHORT[p.weekday]}</td>
        <td className="px-3 py-1.5">{p.inFestival ? "개최기간" : ""}</td><td className="px-3 py-1.5 text-right tabular-nums">{p.value === null ? "—" : rawNumber(p.value)}</td>
      </tr>)}</tbody>
    </table>
  </TableScroll>;
}

function SourceDetails({ data }: { data: HistoryResponse }) {
  const region = data.festival.region;
  return <div className="space-y-4">
    <p>{data.metric.name} · {region.name} 전체 · 명/일 · 통신 기반 추정. 축제장 입장객 수나 고유 방문객 수가 아니에요.</p>
    <p>개최기간 일평균 = 개최기간 모든 날의 방문 합계 ÷ 실제 개최 일수. 개최기간에 값이 없는 날이 있으면 평균과 최대일을 만들지 않아요.</p>
    <p>개최 전·종료 후 일평균 = 그래프에 표시한 앞(뒤) 날짜의 방문 합계 ÷ 그 날짜 수. 값이 없는 날이 있으면 만들지 않아요. 표시 기간을 바꾸면 함께 바뀌어요.</p>
    <p>그래프의 표시 기간을 바꿔도 개최기간 평균은 실제 개최일 전체로 계산해요.</p>
    {data.editions.map(e => <section key={e.editionId} className="space-y-1 border-t border-ink/10 pt-3">
      <h3 className="font-extrabold">{editionLabel(e)}</h3>
      {e.window && <p>표시 기간 {fullDate(e.window.start)} ~ {fullDate(e.window.end)}</p>}
      {e.summary.status === "available" && <p>계산 {rawNumber(e.summary.numerator)}명 ÷ {e.summary.denominator}일 = {rawNumber(e.summary.mean)}명/일 → {number(e.summary.rounded)}명/일</p>}
      <p>회차 일정: <a className="font-bold text-blue underline" href={e.source.edition.url} target="_blank" rel="noreferrer">{e.source.edition.title} ↗</a>
        {e.source.edition.publishedAt ? ` · 공표 ${dateOnly(e.source.edition.publishedAt)}` : ""}{e.source.edition.checkedAt ? ` · 확인 ${dateOnly(e.source.edition.checkedAt)}` : ""}</p>
      {e.source.visits ? <p>방문 자료: <a className="font-bold text-blue underline" href={e.source.visits.url} target="_blank" rel="noreferrer">{e.source.visits.title} ↗</a>
        {e.source.visits.collectedAt ? ` · 수집 ${timeLabel(e.source.visits.collectedAt)}` : ""}</p> : <p>방문 자료: 이 회차 기간의 자료 없음</p>}
    </section>)}
    <p className="text-xs text-muted">{timeLabel(data.retrievedAt)} 조회</p>
  </div>;
}
