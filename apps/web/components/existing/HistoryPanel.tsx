"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, type RefObject } from "react";
import { historyKey, parseHistory } from "@/lib/existing/request";
import type { EditionHistory, HistoryResponse, Range } from "@/lib/existing/types";
import { rememberView, writeAddress } from "./address";
import { DEFAULT_PAD, EditionPicker, WindowForm, type Pads } from "./EditionControls";
import { EditionChart, niceMax } from "./EditionChart";
import { useFestival, useViewHeadingFocus } from "./ExistingShell";
import { dateOnly, daysBetween, dayWithWeekday, editionLabel, fullDate, number, rawNumber, timeLabel, validDay, WEEKDAY_SHORT } from "./format";
import { HostAreaVisits } from "./HostAreaVisits";
import { festivalMemory, viewHref } from "./memory";
import { festivalPath, one } from "./route-params";
import { Disclosure, FreshnessNote, InfoDialog, LoadState, TableScroll } from "./ui";
import { useKeyedRequest } from "./useKeyedRequest";

type Applied = Pads & { editions: string[]; windows: Record<string, Range> };
const WINDOW_ITEM = /^([a-z0-9-]{1,100}):(\d{4}-\d{2}-\d{2}):(\d{4}-\d{2}-\d{2})$/;

function readApplied(params: URLSearchParams): Applied {
  const list = (one(params, "editions") ?? "").split(",").map(s => s.trim()).filter(Boolean);
  const pad = (key: string) => { const v = one(params, key); return v !== null && /^\d{1,2}$/.test(v) && Number(v) <= 30 ? Number(v) : DEFAULT_PAD; };
  const windows: Record<string, Range> = {};
  for (const item of (one(params, "windows") ?? "").split(",")) {
    const m = WINDOW_ITEM.exec(item.trim());
    if (m && validDay(m[2]) && validDay(m[3]) && m[2] <= m[3] && daysBetween(m[2], m[3]) <= 120) windows[m[1]] = { start: m[2], end: m[3] };
  }
  return { editions: [...new Set(list)], before: pad("before"), after: pad("after"), windows };
}
const windowsParam = (w: Record<string, Range>) => Object.keys(w).sort().map(k => `${k}:${w[k].start}:${w[k].end}`).join(",");
function addressOf(a: Applied): URLSearchParams {
  const params = new URLSearchParams();
  if (a.editions.length) params.set("editions", a.editions.join(","));
  if (a.before !== DEFAULT_PAD) params.set("before", String(a.before));
  if (a.after !== DEFAULT_PAD) params.set("after", String(a.after));
  if (Object.keys(a.windows).length) params.set("windows", windowsParam(a.windows));
  params.sort();
  return params;
}

export function HistoryPanel() {
  const festival = useFestival(), heading = useRef<HTMLHeadingElement>(null);
  useViewHeadingFocus(festival.id, "visits", heading);
  const linked = festival.current?.linkedArchiveId ?? null;
  return <section aria-labelledby="visits-heading" className="space-y-4">
    {festival.source === "current" ? <>
      <h2 id="visits-heading" ref={heading} tabIndex={-1} className="text-xl font-extrabold">과거 방문 흐름</h2>
      <NoHistory id={festival.id} linkedArchiveId={linked} />
    </> : <ArchiveHistory heading={heading} />}
  </section>;
}

function NoHistory({ id, linkedArchiveId }: { id: string; linkedArchiveId: string | null }) {
  return <div className="region-card space-y-3">
    <p className="font-bold">이 축제의 지난 개최 기록이 없어요.</p>
    <p className="text-sm text-muted">현재 등록된 정보로 주변 관광자원과 개최 시기를 살펴볼 수 있어요.</p>
    <div className="flex flex-wrap gap-2">
      {linkedArchiveId && <Link className="region-primary" href={festivalPath(linkedArchiveId, "visits")}>지난 개최 기록 보기</Link>}
      <Link className="region-button" href={viewHref(id, "resources")}>주변 관광자원 보기</Link>
      <Link className="region-button" href={viewHref(id, "timing")}>개최 시기 보기</Link>
      <Link className="region-button" href="/existing/search">다른 축제 찾기</Link>
    </div>
  </div>;
}

function ArchiveHistory({ heading }: { heading: RefObject<HTMLHeadingElement | null> }) {
  const festival = useFestival(), params = useSearchParams(), address = params.toString();
  const applied = useMemo(() => readApplied(new URLSearchParams(address)), [address]);
  const request = new URLSearchParams({ festival: festival.id, ...(applied.editions.length ? { editions: applied.editions.join(",") } : {}), before: String(applied.before), after: String(applied.after),
    ...(Object.keys(applied.windows).length ? { windows: windowsParam(applied.windows) } : {}) });
  const expectedKey = (() => { try { return historyKey(parseHistory(request)); } catch { return null; } })();
  const result = useKeyedRequest<HistoryResponse>(expectedKey ? `/api/existing/history?${request}` : null, undefined, expectedKey);
  const data = result.data, memory = festivalMemory(festival.id);
  useEffect(() => { rememberView(festival.id, "visits", addressOf(applied)); }, [festival.id, applied]);

  const editions = data?.festival.editions ?? festival.archive?.editions ?? [];
  const appliedIds = data ? data.editions.map(e => e.editionId) : applied.editions;
  function apply(next: Applied) { const params = addressOf(next); rememberView(festival.id, "visits", params); writeAddress(params); }
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
  const title = <div>
    <h2 id="visits-heading" ref={heading} tabIndex={-1} className="text-xl font-extrabold">{region ? `${region.districtName} 외지인 방문 추이` : "지역 외지인 방문 추이"}</h2>
    <p className="text-sm text-muted">{region ? `${region.name} 전체` : "시군구 전체"} · 명/일 · 통신 기반 추정 · 축제장 입장객 수 아님</p>
  </div>;
  if (result.failure === "notfound" && !data) return <>{title}<NoHistory id={festival.id} linkedArchiveId={null} /></>;
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
        <div className="flex flex-wrap gap-2"><Link className="region-button" href={viewHref(festival.id, "resources")}>주변 관광자원 보기</Link><Link className="region-button" href={viewHref(festival.id, "timing")}>개최 시기 보기</Link><Link className="region-button" href="/existing/search">다른 축제 찾기</Link></div>
      </div>}
      <ul className={`grid gap-4 ${data.editions.length > 1 ? "md:grid-cols-2" : ""}`}>
        {data.editions.map(e => <li key={e.editionId} className="region-card min-w-0 space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <h3 className="font-extrabold">{editionLabel(e)}</h3>
            {e.window && e.windowSource === "custom" && <span className="text-xs text-muted">표시 {fullDate(e.window.start)} ~ {fullDate(e.window.end)}</span>}
          </div>
          {hasChart && charted(e) ? <EditionChart edition={e} region={region?.districtName ?? ""} yMax={yMax} slots={data.maxWindowDays} /> : null}
          <EditionSummary edition={e} />
          <WindowForm key={`${e.window?.start}-${e.window?.end}`} edition={e} custom={e.windowSource === "custom"} onApply={range => applyWindow(e.editionId, range)} />
        </li>)}
      </ul>
      <div className="flex flex-wrap items-start gap-2">
        <Disclosure label="수치 표 보기" open={!!memory.open[`visits-table:${data.key}`]} onToggle={open => { memory.open[`visits-table:${data.key}`] = open; }}>
          <div className="space-y-4">{data.editions.filter(e => e.points.length).map(e => <EditionTable key={e.editionId} edition={e} />)}</div>
        </Disclosure>
        <InfoDialog label="출처·산식 보기" title="방문 자료 출처와 계산">
          <SourceDetails data={data} />
        </InfoDialog>
      </div>
      <FreshnessNote freshness={data.freshness} retrievedAt={data.retrievedAt} onRetry={result.retry} />
      {data.hostVisits && data.hostVisits.editions.length > 0 && <HostAreaVisits festivalId={festival.id} data={data.hostVisits} />}
    </>}
  </>;
}

function EditionSummary({ edition: e }: { edition: EditionHistory }) {
  const s = e.summary;
  if (e.withheld) return <p className="text-sm text-muted">{e.withheld.message}</p>;
  if (s.status === "available") return <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-sm">
    <dt className="text-muted">개최기간 일평균</dt><dd className="font-extrabold">{number(s.rounded)}명/일 <span className="font-normal text-muted">추정</span></dd>
    <dt className="text-muted">가장 많았던 날</dt><dd>{s.peak.dates.map(dayWithWeekday).join(", ")} · {rawNumber(s.peak.value)}명</dd>
    <dt className="text-muted">개최 일수</dt><dd>{s.denominator}일</dd>
  </dl>;
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
    <p>그래프의 표시 기간을 바꿔도 평균은 실제 개최일 전체로 계산해요.</p>
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
