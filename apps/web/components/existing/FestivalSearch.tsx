"use client";
import { ArrowDown, LayoutGrid, Trophy, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from "react";
import { FlowMap } from "@/components/guide/FlowMap";
import { hasMarks, MARK_KINDS, parseMarkKinds, type MarkKind } from "@/lib/existing/festival-marks";
import { ALL_FESTIVALS, FESTIVAL_TYPES, festivalType, isFestivalTypeFilter, type FestivalTypeFilter } from "@/lib/existing/festival-types";
import { mergeCurrentItems, normalizeKeyword } from "@/lib/existing/identity";
import type { ArchiveFestival, CurrentBlock, CurrentFestival, FestivalSearchResponse } from "@/lib/existing/types";
import { REGIONS, SOURCE } from "@/lib/region/model";
import { writeAddress } from "./address";
import { isStale, keepBlock } from "./blocks";
import { MARK_ICONS, MarkBadges } from "./festival-marks";
import { FESTIVAL_TYPE_ICONS, TypeBadge } from "./festival-type";
import { koreaToday, periodLabel, timeLabel } from "./format";
import { shared } from "./memory";
import { festivalPath, one } from "./route-params";
import { InfoDialog, LoadState } from "./ui";
import { useKeyedRequest } from "./useKeyedRequest";

const provinces = [...new Map(REGIONS.map(r => [r.provinceCode, r.provinceName])).entries()];
// `type: "all"` = every festival type nationwide (only without a name or region). `marks` filter the shown list on the page.
type Applied = { q: string; province: string; district: string; type: FestivalTypeFilter | null; marks: MarkKind[] };
// A type list can be long (a whole country); it opens in steps so the page stays light.
const REVEAL_STEP = 40;

function readApplied(params: URLSearchParams): Applied {
  const q = normalizeKeyword(one(params, "q") ?? ""), province = one(params, "province") ?? "", district = one(params, "district") ?? "", type = one(params, "type");
  const valid = REGIONS.some(r => r.provinceCode === province && r.districtCode === district);
  const scoped = !!q || valid, kind = isFestivalTypeFilter(type) && !(type === "all" && scoped) ? type : null;
  return { q, province: valid ? province : "", district: valid ? district : "", type: kind, marks: parseMarkKinds(one(params, "mark")) };
}
/** What the server is asked (marks are not: they filter the answer on the page). */
function searchQuery(a: Omit<Applied, "marks">): URLSearchParams {
  const params = new URLSearchParams();
  if (a.q) params.set("q", a.q);
  if (a.district) { params.set("province", a.province); params.set("district", a.district); }
  if (a.type) params.set("type", a.type);
  params.sort();
  return params;
}
/** The page address: the search plus the chosen marks. */
function addressQuery(a: Applied): URLSearchParams {
  const params = searchQuery(a);
  if (a.marks.length) params.set("mark", a.marks.join(","));
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
  const pageAddress = addressQuery(applied).toString();
  useEffect(() => { shared.search = pageAddress || null; }, [pageAddress]);
  // Without a condition the first page still offers the festivals with past-edition records as starting choices.
  const url = query ? `/api/existing/festivals?${query}` : "/api/existing/festivals";
  const result = useKeyedRequest<FestivalSearchResponse>(url, merge);
  const data = result.data;
  const more = useMoreCurrent(query, data && (data.current.status === "complete" || data.current.status === "empty") ? data.current : null, result.retry);
  const list = data ? results(data.archive.items, more.items) : [];
  // Marks filter what is listed; a festival whose introduction was not read yet never passes a filter.
  const filtered = applied.marks.length ? list.filter(r => hasMarks(r.current?.marks, applied.marks)) : list;
  const unchecked = list.filter(r => !r.current?.marks).length;
  const [reveal, setReveal] = useState({ query: pageAddress, limit: REVEAL_STEP });
  const limit = reveal.query === pageAddress ? reveal.limit : REVEAL_STEP;
  // Keyword answers already come in source pages; other lists open in steps on the page.
  const visible = data?.current.mode === "keyword" ? filtered : filtered.slice(0, limit);
  useEffect(() => { if (data && focusResults.current) { focusResults.current = false; resultsHeading.current?.focus(); } }, [data]);

  /** Applies the typed name and region with `type`. A chip keeps focus where it is; the form moves to the results. */
  function apply(type: FestivalTypeFilter | null, from: "form" | "chip") {
    const keyword = normalizeKeyword(q);
    if (province && !district) { setFieldError({ field: "district", text: "시군구까지 골라 주세요. 지역 없이 찾으려면 시도를 ‘전체’로 두세요." }); return; }
    if (!keyword && !district && !type && from === "form") { setFieldError({ field: "q", text: "축제 이름을 입력하거나 지역·유형을 골라 주세요." }); return; }
    setFieldError(null);
    // With a name or a region, "every festival type" is simply no type condition.
    const next: Applied = { q: keyword, province: district ? province : "", district, type: type === "all" && (keyword || district) ? null : type, marks: applied.marks };
    if (searchQuery(next).toString() === query) {
      // The same condition again: search once more and move to its results instead of waiting for an address change.
      if (from === "form") { result.retry(); resultsHeading.current?.focus(); }
      return;
    }
    focusResults.current = from === "form";
    writeAddress(addressQuery(next));
  }
  function submit(event: FormEvent) { event.preventDefault(); apply(applied.type, "form"); }
  // A pressed chip lifts its condition again. "전체" lists every festival type nationwide when nothing else narrows the search.
  const scoped = !!applied.q || !!applied.district, allPressed = applied.type === "all" || (!applied.type && scoped);
  const chooseAll = () => apply(applied.type === "all" || normalizeKeyword(q) || district ? null : "all", "chip");
  const chooseType = (code: FestivalTypeFilter) => apply(applied.type === code ? null : code, "chip");
  const toggleMark = (kind: MarkKind) => writeAddress(addressQuery({ ...applied, marks: applied.marks.includes(kind) ? applied.marks.filter(k => k !== kind) : [...applied.marks, kind] }));
  const districts = REGIONS.filter(r => r.provinceCode === province);
  const regionName = applied.district ? REGIONS.find(r => r.provinceCode === applied.province && r.districtCode === applied.district) : null;
  const regionLabel = regionName ? `${regionName.provinceName} ${regionName.districtName}` : null;
  const typeLabel = applied.type === "all" ? ALL_FESTIVALS.label : festivalType(applied.type)?.label ?? null;
  const subject = [applied.q ? `‘${applied.q}’` : "", regionLabel ?? "", typeLabel ?? ""].filter(Boolean).join(" · ");
  const markLabel = MARK_KINDS.filter(m => applied.marks.includes(m.kind)).map(m => m.label).join("·");

  return <div className="space-y-6">
    <header>
      <p className="mb-2 text-xs font-extrabold tracking-widest text-blue">기존 축제 개선</p>
      <h1 className="text-3xl font-extrabold sm:text-4xl">어떤 축제를 살펴볼까요?</h1>
      <p className="mt-2 text-sm text-muted">축제를 고르면 지난 방문 흐름·연계 관광·개최 시기를 살펴볼 수 있어요.</p>
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
      {/* One line on a wide screen so the list below still starts in the first screen. */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-ink/10 pt-3 sm:col-span-4">
        <p id={`${ids}-types`} className="text-sm font-bold">축제 유형</p>
        <div role="group" aria-labelledby={`${ids}-types`} className="flex flex-wrap gap-2">
          <TypeChip icon={LayoutGrid} label={ALL_FESTIVALS.short} pressed={allPressed} onClick={chooseAll} />
          {FESTIVAL_TYPES.map(t => <TypeChip key={t.code} icon={FESTIVAL_TYPE_ICONS[t.icon]} label={t.short} hint={t.hint} pressed={applied.type === t.code} onClick={() => chooseType(t.code)} />)}
        </div>
        {/* A chip keeps focus, and the list may start below the screen: one step to the answer, next to the chips. */}
        {typeLabel && data && !result.loading && (filtered.length ? <button type="button" onClick={() => resultsHeading.current?.focus()} className="inline-flex min-h-8 items-center gap-1 text-sm font-bold text-blue hover:underline">
          {typeLabel} {filtered.length}건 보기<ArrowDown aria-hidden="true" size={15} />
        </button> : <p className="text-sm font-bold text-muted">{typeLabel} 0건</p>)}
        <Link href="/compare/scale" className="inline-flex min-h-8 items-center gap-1.5 text-sm font-bold text-blue hover:underline lg:ml-auto"><Trophy aria-hidden="true" size={15} />문화관광축제 방문 규모</Link>
      </div>
      {fieldError && <p id={`${ids}-error`} role="alert" className="text-sm font-bold text-red-800 sm:col-span-4">{fieldError.text}</p>}
    </form>
    <FlowMap journey="existing" />

    {/* Reserves room for the list so the footer stays below the first screen until the results arrive. */}
    <section aria-labelledby={`${ids}-results`} className="min-h-[50vh] space-y-4">
      <h2 id={`${ids}-results`} ref={resultsHeading} tabIndex={-1} className="scroll-mt-24 text-xl font-extrabold">
        {query ? `${subject} 검색 결과` : "바로 살펴볼 수 있는 축제"}
      </h2>
      <LoadState loading={result.loading} failure={result.failure} hasData={!!data} retrievedAt={data?.retrievedAt} subject="축제 목록을" onRetry={result.retry} />
      {data && <>
        <p aria-live="polite" className="text-sm text-muted">축제 {list.length}건{applied.marks.length ? ` 중 ${markLabel} ${filtered.length}건` : ""}{more.next ? " 표시" : visible.length < filtered.length ? ` 중 ${visible.length}건 표시` : ""}</p>
        <SourceNotes archive={data.archive} block={data.current} onRetry={result.retry} searched={!!query} regionChosen={!!applied.district} />
        {list.length - unchecked > 0 && <MarkFilter list={list} chosen={applied.marks} unchecked={unchecked} onToggle={toggleMark} />}
        {visible.length > 0 && <ul aria-label="찾은 축제" className="grid gap-2 sm:grid-cols-2">{visible.map(r => <li key={r.id}><ResultCard result={r} chosenType={applied.type} /></li>)}</ul>}
        {list.length > 0 && filtered.length === 0 && <div className="region-card flex flex-wrap items-center gap-3 text-sm">
          <p>{markLabel} 표시가 있는 축제가 이 목록에는 없어요.</p>
          <button type="button" className="region-button" onClick={() => writeAddress(addressQuery({ ...applied, marks: [] }))}>거르기 지우기</button>
        </div>}
        {visible.length < filtered.length && <button type="button" className="region-button" onClick={() => setReveal({ query: pageAddress, limit: limit + REVEAL_STEP })}>축제 더 보기 ({filtered.length - visible.length}건 남음)</button>}
        <CurrentSource block={data.current} shown={more.items.length} keyword={applied.q} regionLabel={regionLabel} typeLabel={typeLabel} />
        {more.restarted && <p role="status" className="text-sm text-muted">등록 목록이 바뀌어 처음부터 다시 불러왔어요.</p>}
        {more.next && <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="region-button" disabled={more.loading} onClick={() => void more.loadMore()}>{more.loading ? "다음 목록을 불러오고 있어요…" : "축제 더 보기"}</button>
          {more.failed && <p role="alert" className="text-sm text-red-800">다음 목록을 불러오지 못했어요. 다시 눌러 주세요.</p>}
        </div>}
        {list.length === 0 && data.archive.status !== "unavailable" && data.current.status !== "unavailable" && <div className="region-card space-y-2 text-sm">
          <p>검색어·지역·유형을 바꿔 다시 찾아보세요.</p>
          <Link className="region-button" href={applied.district ? `/regions?${new URLSearchParams({ province: applied.province, district: applied.district, start: `${koreaToday().slice(0, 4)}-01-01`, end: `${koreaToday().slice(0, 4)}-12-31`, kind: "12" })}` : "/regions"}>지역 관광정보 살펴보기</Link>
        </div>}
      </>}
    </section>
  </div>;
}

const pastYears = (a: ArchiveFestival) => `지난 개최 ${a.editions.map(e => `${e.year}년${e.start ? "" : "(개최일 미확인)"}`).join(" · ")}`;

function TypeChip({ icon: Icon, label, hint = null, pressed, onClick }: { icon: LucideIcon; label: string; hint?: string | null; pressed: boolean; onClick: () => void }) {
  return <button type="button" aria-pressed={pressed} onClick={onClick} className="region-button rounded-full px-3">
    <Icon aria-hidden="true" size={16} strokeWidth={2.25} />{label}{hint && <span className="text-xs font-semibold opacity-70">· {hint}</span>}
  </button>;
}

/** Filters by what registration introductions say, with how many listed festivals carry each mark. */
function MarkFilter({ list, chosen, unchecked, onToggle }: { list: Result[]; chosen: MarkKind[]; unchecked: number; onToggle: (kind: MarkKind) => void }) {
  const id = useId();
  return <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl bg-paper px-3 py-2.5">
    <p id={id} className="text-sm font-bold">소개 글로 거르기</p>
    <div role="group" aria-labelledby={id} className="flex flex-wrap gap-2">
      {MARK_KINDS.map(m => { const Icon = MARK_ICONS[m.kind], count = list.filter(r => hasMarks(r.current?.marks, [m.kind])).length;
        return <button key={m.kind} type="button" aria-pressed={chosen.includes(m.kind)} onClick={() => onToggle(m.kind)} className="region-button rounded-full px-3">
          <Icon aria-hidden="true" size={16} strokeWidth={2.25} />{m.label}<span className="text-xs font-semibold tabular-nums opacity-70">{count}</span>
        </button>; })}
    </div>
    {unchecked > 0 && <p className="text-xs text-muted">{chosen.length ? `소개 글을 아직 확인하지 못한 ${unchecked}건은 빠져요` : `소개 글 확인 전 ${unchecked}건`}</p>}
  </div>;
}

function ResultCard({ result: { id, current, archive }, chosenType }: { result: Result; chosenType: FestivalTypeFilter | null }) {
  const f = current ?? archive!;
  return <Link href={festivalPath(id, "visits")} onClick={() => { shared.focusTitle = true; }} className="block h-full rounded-2xl border border-ink/10 bg-white p-4 hover:border-blue">
    {/* Under a chosen type every card shares it; the badge then only repeats the heading. */}
    {current?.type !== chosenType && <TypeBadge code={current?.type} className="mb-1.5" />}
    <span className="block font-extrabold">{f.name}</span>
    <span className="mt-1 block text-sm text-muted">{f.region.name}</span>
    {current && <span className="mt-1 block text-sm">{current.datesVerified && current.start ? `등록 일정 ${periodLabel(current.start, current.end)}` : "등록 일정은 축제를 열면 확인해요"}</span>}
    <MarkBadges marks={current?.marks} className="mt-1.5" />
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
    {block.status === "not-requested" && <p className="text-sm text-muted">{!searched ? "축제 이름·지역·유형으로 찾으면 현재 등록된 축제도 함께 보여드려요." : regionChosen ? "현재 등록된 축제·행사는 이 조건으로 찾지 않았어요." : "지역을 고르면 그 지역에 현재 등록된 축제·행사도 함께 찾아요."}</p>}
  </>;
}

/** After the list, so the first result is the first stop after the results heading. */
function CurrentSource({ block, shown, keyword, regionLabel, typeLabel }: { block: CurrentBlock; shown: number; keyword: string; regionLabel: string | null; typeLabel: string | null }) {
  if (block.status !== "complete" && block.status !== "empty") return null;
  const period = block.range ? `${periodLabel(block.range.start, block.range.end)} ` : "", among = typeLabel ? `${typeLabel} 분류 중 ` : "";
  const how = block.mode === "keyword" ? `${among}‘${keyword}’ 이름으로 ${regionLabel ? `${regionLabel} 안에서` : "전국에서"}`
    : block.mode === "type-list" ? `전국 ${typeLabel ?? ""} ${period}일정 목록으로` : `${regionLabel ?? "선택한 지역"}의 ${among}${period}일정 목록으로`;
  return <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
    {block.range && <p>현재 등록 축제는 {periodLabel(block.range.start, block.range.end)}와 겹치는 일정만 보여드려요.</p>}
    <InfoDialog label="검색 출처" title="현재 등록 축제 검색 출처" buttonClassName="region-button min-h-8 px-2 py-1 text-xs">
      <p>한국관광공사 축제·행사 등록 정보에서 {how} 찾았어요.</p>
      {typeLabel && <p>축제 유형은 한국관광공사가 등록 정보에 붙인 분류예요.{typeLabel === ALL_FESTIVALS.label ? " 모든 축제는 여섯 분류를 모두 보여드리고, 공연·전시 같은 행사는 빼요." : ""}</p>}
      <p>지금 {shown}건을 불러왔어요.{block.next ? " 더 보기로 이어서 볼 수 있어요." : ""}</p>
      {block.collectedAt && <p>{timeLabel(block.collectedAt)} 조회</p>}
      <p><a className="font-bold text-blue underline" href={SOURCE} target="_blank" rel="noreferrer">공공데이터포털 관광정보 서비스 ↗</a></p>
    </InfoDialog>
  </div>;
}
