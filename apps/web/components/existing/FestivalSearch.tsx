"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from "react";
import { mergeCurrentItems, normalizeKeyword } from "@/lib/existing/identity";
import type { ArchiveFestival, CurrentBlock, CurrentFestival, FestivalSearchResponse } from "@/lib/existing/types";
import { REGIONS, SOURCE } from "@/lib/region/model";
import { writeAddress } from "./address";
import { isStale, keepBlock } from "./blocks";
import { koreaToday, periodLabel, timeLabel } from "./format";
import { shared } from "./memory";
import { festivalPath, one } from "./route-params";
import { InfoDialog, LoadState } from "./ui";
import { useKeyedRequest } from "./useKeyedRequest";

const provinces = [...new Map(REGIONS.map(r => [r.provinceCode, r.provinceName])).entries()];
type Applied = { q: string; province: string; district: string };

function readApplied(params: URLSearchParams): Applied {
  const q = normalizeKeyword(one(params, "q") ?? ""), province = one(params, "province") ?? "", district = one(params, "district") ?? "";
  const valid = REGIONS.some(r => r.provinceCode === province && r.districtCode === district);
  return { q, province: valid ? province : "", district: valid ? district : "" };
}
function searchQuery(a: Applied): URLSearchParams {
  const params = new URLSearchParams();
  if (a.q) params.set("q", a.q);
  if (a.district) { params.set("province", a.province); params.set("district", a.district); }
  params.sort();
  return params;
}
function merge(previous: FestivalSearchResponse, next: FestivalSearchResponse): FestivalSearchResponse {
  return { ...next, archive: keepBlock(previous.archive, next.archive), current: keepBlock(previous.current, next.current) };
}

// One result per festival. A registered festival and a reviewed past-edition record are the same festival only
// through the registration's explicit link; then the registered card takes the record's place and shows its years.
type Result = { id: string; current: CurrentFestival | null; archive: ArchiveFestival | null };
function results(archive: ArchiveFestival[], current: CurrentFestival[]): Result[] {
  const known = new Set(archive.map(a => a.id)), linked = new Map<string, CurrentFestival>();
  for (const c of current) if (c.linkedArchiveId && known.has(c.linkedArchiveId) && !linked.has(c.linkedArchiveId)) linked.set(c.linkedArchiveId, c);
  const merged = new Set(linked.values());
  return [
    ...archive.map(a => { const c = linked.get(a.id) ?? null; return { id: c?.id ?? a.id, current: c, archive: a }; }),
    ...current.filter(c => !merged.has(c)).map(c => ({ id: c.id, current: c, archive: null })),
  ];
}

// Further pages of the national keyword search, remembered per applied condition for this tab only.
// They belong to one first-page answer (its generation); a successful new first page starts over.
type More = { query: string; generation: string; items: CurrentFestival[]; next: { page: number; total: number } | null; failed: boolean };
const morePages = new Map<string, More>();
function useMoreCurrent(query: string, first: CurrentBlock | null, restart: () => void) {
  const generation = first ? `${first.page ?? 1}:${first.collectedAt ?? ""}` : null;
  const [state, setState] = useState<More | null>(() => morePages.get(query) ?? null);
  const [loading, setLoading] = useState(false), [restarted, setRestarted] = useState(false), serial = useRef(0);
  useEffect(() => { serial.current++; setLoading(false); setRestarted(false); setState(morePages.get(query) ?? null); }, [query]);
  const own = state && state.query === query && state.generation === generation ? state : null;
  const items = first ? mergeCurrentItems(first.items, own?.items ?? []) : [];
  const next = own ? own.next : first?.next ?? null;
  async function loadMore() {
    if (!next || loading || !generation) return;
    const id = ++serial.current, base: More = own ?? { query, generation, items: [], next, failed: false };
    const save = (value: More) => { morePages.set(query, value); if (id === serial.current) setState(value); };
    setLoading(true);
    try {
      const response = await fetch(`/api/existing/festivals?${query}&page=${next.page}&total=${next.total}`, { headers: { accept: "application/json" } });
      const body = (await response.json()) as FestivalSearchResponse;
      if (body?.current?.continuity === "changed") {
        // The registered list changed between pages: drop appended pages and start again from page 1.
        morePages.delete(query);
        if (id === serial.current) { setState(null); setRestarted(true); restart(); }
        return;
      }
      if (!response.ok || (body.current.status !== "complete" && body.current.status !== "empty")) throw new Error("page");
      save({ ...base, items: mergeCurrentItems(base.items, body.current.items), next: body.current.next, failed: false });
    } catch { save({ ...base, failed: true }); }
    finally { if (id === serial.current) setLoading(false); }
  }
  return { items, next, loading, failed: own?.failed ?? false, restarted, loadMore };
}

export function FestivalSearch() {
  const params = useSearchParams();
  const address = params.toString();
  const applied = useMemo(() => readApplied(new URLSearchParams(address)), [address]);
  const [q, setQ] = useState(applied.q), [province, setProvince] = useState(applied.province), [district, setDistrict] = useState(applied.district);
  const [fieldError, setFieldError] = useState<{ field: "q" | "district"; text: string } | null>(null);
  const resultsHeading = useRef<HTMLHeadingElement>(null), focusResults = useRef(false), ids = useId();

  // Back/forward or a restored address replaces the inputs with the applied condition.
  useEffect(() => { setQ(applied.q); setProvince(applied.province); setDistrict(applied.district); setFieldError(null); }, [applied]);
  const query = searchQuery(applied).toString();
  useEffect(() => { shared.search = query || null; }, [query]);
  // Without a condition the first page still offers the festivals with past-edition records as starting choices.
  const url = query ? `/api/existing/festivals?${query}` : "/api/existing/festivals";
  const result = useKeyedRequest<FestivalSearchResponse>(url, merge);
  const data = result.data;
  const more = useMoreCurrent(query, data && (data.current.status === "complete" || data.current.status === "empty") ? data.current : null, result.retry);
  const list = data ? results(data.archive.items, more.items) : [];
  useEffect(() => { if (data && focusResults.current) { focusResults.current = false; resultsHeading.current?.focus(); } }, [data]);

  function submit(event: FormEvent) {
    event.preventDefault();
    const keyword = normalizeKeyword(q);
    if (province && !district) { setFieldError({ field: "district", text: "시군구까지 골라 주세요. 지역 없이 찾으려면 시도를 ‘전체’로 두세요." }); return; }
    if (!keyword && !district) { setFieldError({ field: "q", text: "축제 이름을 입력하거나 지역을 골라 주세요." }); return; }
    setFieldError(null);
    const next = searchQuery({ q: keyword, province: district ? province : "", district });
    // The same condition again: search once more and move to its results instead of waiting for an address change.
    if (next.toString() === query) { result.retry(); resultsHeading.current?.focus(); return; }
    focusResults.current = true;
    writeAddress(next);
  }
  const districts = REGIONS.filter(r => r.provinceCode === province);
  const regionName = applied.district ? REGIONS.find(r => r.provinceCode === applied.province && r.districtCode === applied.district) : null;

  return <div className="space-y-6">
    <header>
      <p className="mb-2 text-xs font-extrabold tracking-widest text-blue">기존 축제 개선</p>
      <h1 className="text-3xl font-extrabold sm:text-4xl">어떤 축제를 살펴볼까요?</h1>
      <p className="mt-2 text-sm text-muted">축제를 고르면 그 지역의 외지인 방문 흐름, 주변 관광자원, 다음 개최 시기를 차례와 상관없이 볼 수 있어요.</p>
    </header>
    <form onSubmit={submit} role="search" aria-label="기존 축제 찾기" className="region-card grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end" noValidate>
      <label className="text-sm font-bold">축제 이름
        <input className="workspace-input mt-2" value={q} maxLength={50} onChange={e => setQ(e.target.value)} placeholder="예: 논산딸기축제"
          aria-invalid={fieldError?.field === "q" || undefined} aria-describedby={fieldError?.field === "q" ? `${ids}-error` : undefined} />
      </label>
      <label className="text-sm font-bold">시도 (선택)
        <select className="workspace-input mt-2" value={province} onChange={e => { setProvince(e.target.value); setDistrict(""); }}>
          <option value="">전체</option>{provinces.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
        </select>
      </label>
      <label className="text-sm font-bold">시군구
        <select className="workspace-input mt-2" value={district} disabled={!province} onChange={e => setDistrict(e.target.value)}
          aria-invalid={fieldError?.field === "district" || undefined} aria-describedby={fieldError?.field === "district" ? `${ids}-error` : undefined}>
          <option value="">{province ? "시군구 선택" : "시도를 먼저 고르세요"}</option>{districts.map(r => <option key={r.districtCode} value={r.districtCode}>{r.districtName}</option>)}
        </select>
      </label>
      <button type="submit" className="region-primary">축제 찾기</button>
      {fieldError && <p id={`${ids}-error`} role="alert" className="text-sm font-bold text-red-800 sm:col-span-4">{fieldError.text}</p>}
    </form>

    <section aria-labelledby={`${ids}-results`} className="space-y-4">
      <h2 id={`${ids}-results`} ref={resultsHeading} tabIndex={-1} className="text-xl font-extrabold">
        {query ? <>{applied.q ? `‘${applied.q}’` : ""}{applied.q && regionName ? " · " : ""}{regionName ? `${regionName.provinceName} ${regionName.districtName}` : ""} 검색 결과</> : "바로 살펴볼 수 있는 축제"}
      </h2>
      <LoadState loading={result.loading} failure={result.failure} hasData={!!data} retrievedAt={data?.retrievedAt} subject="축제 목록을" onRetry={result.retry} />
      {data && <>
        <p aria-live="polite" className="text-sm text-muted">축제 {list.length}건{more.next ? " 표시" : ""}</p>
        <SourceNotes archive={data.archive} block={data.current} onRetry={result.retry} searched={!!query} regionChosen={!!applied.district} />
        {list.length > 0 && <ul aria-label="찾은 축제" className="grid gap-2 sm:grid-cols-2">{list.map(r => <li key={r.id}><ResultCard result={r} /></li>)}</ul>}
        <CurrentSource block={data.current} shown={more.items.length} keyword={applied.q} regionLabel={regionName ? `${regionName.provinceName} ${regionName.districtName}` : null} />
        {more.restarted && <p role="status" className="text-sm text-muted">등록 목록이 바뀌어 처음부터 다시 불러왔어요.</p>}
        {more.next && <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="region-button" disabled={more.loading} onClick={() => void more.loadMore()}>{more.loading ? "다음 목록을 불러오고 있어요…" : "축제 더 보기"}</button>
          {more.failed && <p role="alert" className="text-sm text-red-800">다음 목록을 불러오지 못했어요. 다시 눌러 주세요.</p>}
        </div>}
        {list.length === 0 && data.archive.status !== "unavailable" && data.current.status !== "unavailable" && <div className="region-card space-y-2 text-sm">
          <p>검색어나 지역을 바꿔 다시 찾아보세요.</p>
          <Link className="region-button" href={applied.district ? `/regions?${new URLSearchParams({ province: applied.province, district: applied.district, start: `${koreaToday().slice(0, 4)}-01-01`, end: `${koreaToday().slice(0, 4)}-12-31`, kind: "12" })}` : "/regions"}>지역 관광정보 살펴보기</Link>
        </div>}
      </>}
    </section>
  </div>;
}

const pastYears = (a: ArchiveFestival) => `지난 개최 ${a.editions.map(e => `${e.year}년${e.start ? "" : "(개최일 미확인)"}`).join(" · ")}`;

function ResultCard({ result: { id, current, archive } }: { result: Result }) {
  const f = current ?? archive!;
  return <Link href={festivalPath(id, "visits")} onClick={() => { shared.focusTitle = true; }} className="block h-full rounded-2xl border border-ink/10 bg-white p-4 hover:border-blue">
    <span className="block font-extrabold">{f.name}</span>
    <span className="mt-1 block text-sm text-muted">{f.region.name}</span>
    {current && <span className="mt-1 block text-sm">{current.datesVerified && current.start ? `등록 일정 ${periodLabel(current.start, current.end)}` : "등록 일정은 축제를 열면 확인해요"}</span>}
    {archive && <span className="mt-1 block text-sm">{pastYears(archive)}</span>}
    {current?.address && <span className="mt-1 block break-words text-xs text-muted">{current.address}</span>}
  </Link>;
}

/** Per-source state of one answer: each source fails, goes stale and retries on its own; results of the other stay. */
function SourceNotes({ archive, block, onRetry, searched, regionChosen }: {
  archive: FestivalSearchResponse["archive"]; block: CurrentBlock; onRetry: () => void; searched: boolean; regionChosen: boolean;
}) {
  const retry = <button type="button" className="region-button" onClick={onRetry}>다시 불러오기</button>;
  return <>
    {archive.status === "unavailable" && <p role="alert" className="flex flex-wrap items-center gap-2 rounded-xl bg-coral-soft p-3 text-sm">지난 개최 기록이 있는 축제를 불러오지 못했어요.{retry}</p>}
    {isStale(archive) && <p role="alert" className="flex flex-wrap items-center gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-950">지난 개최 기록을 새로 불러오지 못해 먼저 불러온 목록을 보여드려요.{retry}</p>}
    {block.status === "unavailable" && <p role="alert" className="flex flex-wrap items-center gap-2 rounded-xl bg-coral-soft p-3 text-sm">현재 등록된 축제를 불러오지 못했어요.{retry}</p>}
    {isStale(block) && <p role="alert" className="flex flex-wrap items-center gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-950">새 등록 정보를 불러오지 못했어요. {timeLabel(block.collectedAt)} 기준 목록이에요.{retry}</p>}
    {block.status === "not-requested" && <p className="text-sm text-muted">{!searched ? "축제 이름이나 지역으로 찾으면 현재 등록된 축제도 함께 보여드려요." : regionChosen ? "현재 등록된 축제·행사는 이 조건으로 찾지 않았어요." : "지역을 고르면 그 지역에 현재 등록된 축제·행사도 함께 찾아요."}</p>}
  </>;
}

/** After the list, so the first result is the first stop after the results heading. */
function CurrentSource({ block, shown, keyword, regionLabel }: { block: CurrentBlock; shown: number; keyword: string; regionLabel: string | null }) {
  if (block.status !== "complete" && block.status !== "empty") return null;
  return <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
    {block.range && <p>현재 등록 축제는 {periodLabel(block.range.start, block.range.end)}와 겹치는 일정만 보여드려요.</p>}
    <InfoDialog label="검색 출처" title="현재 등록 축제 검색 출처" buttonClassName="region-button min-h-8 px-2 py-1 text-xs">
      <p>한국관광공사 축제·행사 등록 정보에서 {block.mode === "keyword" ? `‘${keyword}’ 이름으로${regionLabel ? ` ${regionLabel} 안에서` : " 전국에서"}` : `${regionLabel ?? "선택한 지역"}의 ${block.range ? periodLabel(block.range.start, block.range.end) : ""} 일정 목록으로`}찾았어요.</p>
      <p>지금 {shown}건을 보여드리고 있어요.{block.next ? " 더 보기로 이어서 볼 수 있어요." : ""}</p>
      {block.collectedAt && <p>{timeLabel(block.collectedAt)} 조회</p>}
      <p><a className="font-bold text-blue underline" href={SOURCE} target="_blank" rel="noreferrer">공공데이터포털 관광정보 서비스 ↗</a></p>
    </InfoDialog>
  </div>;
}
