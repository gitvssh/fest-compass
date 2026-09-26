"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { createContext, useContext, useEffect, useRef, type ReactNode, type RefObject } from "react";
import { RelatedSearch } from "@/components/related/RelatedSearch";
import { parseFestivalId } from "@/lib/existing/identity";
import type { ArchiveFestival, CurrentFestival, FestivalSearchResponse, RegionRef } from "@/lib/existing/types";
import { editionYearOptions, FESTIVAL_TOPICS, selectedEditionYear } from "@/lib/related-search/query";
import { isStale, keepBlock } from "./blocks";
import { dateOnly, periodLabel, timeLabel } from "./format";
import { festivalMemory, shared, viewHref, type View } from "./memory";
import { useKeyedRequest, type KeyedState } from "./useKeyedRequest";
import { InfoDialog, LoadState } from "./ui";

export type FestivalContextValue = {
  id: string;
  source: "archive" | "current";
  /** Region of the verified festival record only (archive record or server-verified current registration). */
  region: RegionRef | null;
  /** The archive record itself, or for a current festival the reviewed archive record it is linked to. */
  archive: ArchiveFestival | null;
  current: CurrentFestival | null;
  /** The lookup finished and this id is not a known festival. */
  notFound: boolean;
  name: string | null;
  lookup: Pick<KeyedState<FestivalSearchResponse>, "loading" | "failure" | "retry"> & { unavailable: boolean };
};
const FestivalContext = createContext<FestivalContextValue | null>(null);
export function useFestival(): FestivalContextValue {
  const value = useContext(FestivalContext);
  if (!value) throw new Error("useFestival must be used inside ExistingShell");
  return value;
}

const VIEWS: { view: View; label: string }[] = [
  { view: "visits", label: "과거 방문 흐름" },
  { view: "resources", label: "주변 관광자원" },
  { view: "timing", label: "개최 시기" },
];
const pastYears = (archive: ArchiveFestival) => `지난 개최 ${archive.editions.map(e => `${e.year}년${e.start ? "" : "(개최일 미확인)"}`).join(" · ")}`;

// A failed refresh of the same id keeps the earlier verified record (and marks it) instead of dropping it.
function mergeLookup(previous: FestivalSearchResponse, next: FestivalSearchResponse): FestivalSearchResponse {
  return { ...next, archive: keepBlock(previous.archive, next.archive), current: keepBlock(previous.current, next.current) };
}

export function ExistingShell({ id, children }: { id: string; children: ReactNode }) {
  const parsed = parseFestivalId(id)!;
  const pathname = usePathname() ?? "";
  // Re-render on address changes so the view menu links carry each view's latest applied conditions.
  const params = useSearchParams();
  const view = VIEWS.find(v => pathname.endsWith(`/${v.view}`))?.view ?? null;
  const lookup = useKeyedRequest<FestivalSearchResponse>(`/api/existing/festivals?${new URLSearchParams({ id })}`, mergeLookup);
  const title = useRef<HTMLHeadingElement>(null);
  festivalMemory(id);

  const current = parsed.source === "current" ? lookup.data?.current.items.find(f => f.id === id) ?? null : null;
  // A current festival carries its reviewed archive record only through its explicit link, never by name.
  const archiveId = parsed.source === "archive" ? id : current?.linkedArchiveId ?? null;
  const archive = archiveId ? lookup.data?.archive.items.find(f => f.id === archiveId) ?? null : null;
  const own = parsed.source === "archive" ? archive : current;
  const block = parsed.source === "archive" ? lookup.data?.archive : lookup.data?.current;
  // Absence is confirmed only by a completed lookup of this id; a failed or skipped lookup is not absence.
  const confirmedAbsent = !!block && (block.status === "complete" || block.status === "empty") && !own;
  const region = own?.region ?? null;
  const name = own?.name ?? null;
  const unavailable = block?.status === "unavailable";
  const value: FestivalContextValue = { id, source: parsed.source, region, archive, current, notFound: confirmedAbsent, name,
    lookup: { loading: lookup.loading, failure: lookup.failure, retry: lookup.retry, unavailable } };

  useEffect(() => {
    // Arriving from a search result moves focus to the chosen festival's title.
    if (shared.focusTitle && name) { shared.focusTitle = false; title.current?.focus(); }
  }, [name]);

  const searchHref = `/existing/search${shared.search ? `?${shared.search}` : ""}`;
  // Only a verified record (including one kept after a failed refresh) offers a related-material search.
  const verified = own;
  const years = [...new Set([...editionYearOptions(verified), ...(parsed.source === "current" ? editionYearOptions(archive) : [])])].sort((a, b) => b - a);
  const related = verified && !confirmedAbsent ? <RelatedSearch key={id} target={verified.name} subject={verified.name} region={verified.region}
    topics={FESTIVAL_TOPICS} years={years}
    defaultYear={params ? selectedEditionYear(archive, params, view === "visits") : null} /> : null;
  return <FestivalContext.Provider value={value}>
    <div className="space-y-3">
      <header className="space-y-1">
        <Link href={searchHref} className="inline-flex text-sm font-bold text-blue underline underline-offset-4">← 다른 축제 찾기</Link>
        <h1 ref={title} tabIndex={-1} className="text-2xl font-extrabold leading-tight sm:text-3xl">{name ?? (confirmedAbsent ? "선택한 축제를 찾지 못했어요" : "축제 정보")}</h1>
        {parsed.source === "archive" && archive && <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
          <p className="min-w-0 break-words">{archive.region.name} · {pastYears(archive)}</p>
          {related}
        </div>}
        {current && <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
          <p className="min-w-0 break-words">{current.region.name} · 현재 등록 정보 · {current.datesVerified && current.start ? `등록 일정 ${periodLabel(current.start, current.end)}` : "등록 일정 미확인"}{archive ? ` · ${pastYears(archive)}` : ""}</p>
          <InfoDialog label="등록 정보 출처" title="현재 등록 정보 출처" buttonClassName="region-button min-h-8 px-2 py-1 text-xs">
            <p>한국관광공사에 현재 등록된 축제·행사 정보예요.</p>
            {current.address && <p>등록 주소: {current.address}</p>}
            <p><a className="font-bold text-blue underline" href={current.provenance.url} target="_blank" rel="noreferrer">{current.provenance.title} ↗</a>
              {current.provenance.collectedAt ? ` · ${timeLabel(current.provenance.collectedAt)} 수집` : ""}{current.provenance.checkedAt ? ` · 확인 ${dateOnly(current.provenance.checkedAt)}` : ""}</p>
          </InfoDialog>
          {related}
        </div>}
        <LoadState loading={lookup.loading} failure={lookup.failure} hasData={!!own} retrievedAt={lookup.data?.retrievedAt} subject="축제 정보를" onRetry={lookup.retry} />
        {unavailable && !lookup.failure && <p role="alert" className="flex flex-wrap items-center gap-2 rounded-xl bg-coral-soft p-3 text-sm">
          축제 등록 정보를 불러오지 못했어요.
          <button type="button" className="region-button" onClick={lookup.retry}>다시 불러오기</button>
        </p>}
        {block && isStale(block) && !lookup.failure && <p role="alert" className="flex flex-wrap items-center gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-950">
          새 등록 정보를 불러오지 못했어요. {timeLabel(block.collectedAt ?? lookup.data?.retrievedAt ?? null)}에 확인한 정보예요.
          <button type="button" className="region-button" onClick={lookup.retry}>다시 불러오기</button>
        </p>}
      </header>
      {confirmedAbsent ? <section className="region-card space-y-3">
        <p className="text-sm">주소의 축제를 등록 정보에서 찾지 못했어요. 축제 이름이나 지역으로 다시 찾아 주세요.</p>
        <Link href={searchHref} className="region-primary">다른 축제 찾기</Link>
      </section> : <>
        <nav aria-label="축제 탐색 메뉴" className="-mx-1 overflow-x-auto px-1">
          <ul className="flex min-w-max gap-2 border-b border-ink/10 pb-2">
            {VIEWS.map(v => <li key={v.view}>
              <Link href={viewHref(id, v.view)} aria-current={view === v.view ? "page" : undefined}
                onClick={() => { festivalMemory(id).focusHeading = v.view; }}
                className={`inline-flex min-h-10 items-center rounded-xl px-3 py-2 text-sm font-bold ${view === v.view ? "bg-navy text-white" : "border border-ink/15 bg-white hover:bg-paper"}`}>{v.label}</Link>
            </li>)}
          </ul>
        </nav>
        {children}
      </>}
    </div>
  </FestivalContext.Provider>;
}

/** Shown by region-based views until the festival record is verified; never falls back to an unverified region. */
export function FestivalPending() {
  const { lookup, notFound } = useFestival();
  if (notFound) return null;
  if (lookup.loading && !lookup.failure) return <p role="status" className="text-sm text-muted">축제 정보를 확인하고 있어요…</p>;
  return <div className="region-card flex flex-wrap items-center gap-2 text-sm">
    <p>축제 정보를 확인하면 이 내용을 보여드려요.</p>
    <button type="button" className="region-button" onClick={lookup.retry}>축제 정보 다시 불러오기</button>
    <Link className="region-button" href={`/existing/search${shared.search ? `?${shared.search}` : ""}`}>다른 축제 찾기</Link>
  </div>;
}

/** Moves focus to a view heading after the view menu was used, so keyboard users land on the new content. */
export function useViewHeadingFocus(id: string, view: View, heading: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const memory = festivalMemory(id);
    if (memory.focusHeading === view) { memory.focusHeading = null; heading.current?.focus(); }
  }, [id, view, heading]);
}
