"use client";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { RelatedSearch } from "@/components/related/RelatedSearch";
import type { RegionRef } from "@/lib/existing/types";
import { REGION_TOPICS } from "@/lib/related-search/query";
import { durableParams, viewPath } from "./durable";
import { regionMemory, tab, type NewView, type RegionMemory } from "./memory";
import { RegionPicker } from "./RegionPicker";
import { routeCode } from "./region-route";

type Overrides = Parameters<typeof durableParams>[1];
export type NewRegionValue = {
  region: RegionRef;
  memory: RegionMemory;
  view: NewView | null;
  /** Path of a view of this region carrying the current durable conditions (optionally changed). */
  href: (view: NewView, overrides?: Overrides) => string;
  /** Region choice page carrying the current durable conditions. */
  chooseHref: string;
};
const NewRegionContext = createContext<NewRegionValue | null>(null);
export function useNewRegion(): NewRegionValue {
  const value = useContext(NewRegionContext);
  if (!value) throw new Error("useNewRegion must be used inside NewShell");
  return value;
}

const VIEWS: { view: NewView; label: string }[] = [
  { view: "resources", label: "지역 관광자원" },
  { view: "visits", label: "지역 방문 흐름" },
  { view: "timing", label: "개최 시기" },
];

/**
 * Shared frame of one verified region. The layout keys it by region code, so another region mounts a fresh
 * shell and fresh region memory; nothing of the previous region can render under the new title.
 */
export function NewShell({ region, children }: { region: RegionRef; children: ReactNode }) {
  const [memory] = useState(() => regionMemory(region.code));
  const pathname = usePathname() ?? "", router = useRouter();
  const address = useSearchParams()?.toString() ?? "";
  const view = VIEWS.find(v => pathname.endsWith(`/${v.view}`))?.view ?? null;
  const title = useRef<HTMLHeadingElement>(null);
  const [changing, setChanging] = useState(false), changeButton = useRef<HTMLButtonElement>(null);
  const code = routeCode(region);
  const href = (target: NewView, overrides: Overrides = {}) => viewPath(code, target, durableParams(new URLSearchParams(address), overrides));
  const carried = durableParams(new URLSearchParams(address)).toString();

  useEffect(() => {
    // Arriving from a region choice moves focus to the region title.
    if (tab.focusTitle) { tab.focusTitle = false; title.current?.focus(); }
  }, []);

  function pick(next: string) {
    setChanging(false);
    if (next === code) { changeButton.current?.focus(); return; }
    tab.focusTitle = true;
    router.push(viewPath(next, view ?? "resources", durableParams(new URLSearchParams(address))));
  }

  const chooseHref = `/new${carried ? `?${carried}` : ""}`;
  const value: NewRegionValue = { region, memory, view, href, chooseHref };
  return <NewRegionContext.Provider value={value}>
    <div className="space-y-3">
      <header className="space-y-2">
        <Link href={chooseHref} className="inline-flex text-sm font-bold text-blue underline underline-offset-4">← 지역 다시 고르기</Link>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h1 ref={title} tabIndex={-1} className="text-2xl font-extrabold leading-tight sm:text-3xl">{region.name}</h1>
          <button ref={changeButton} type="button" className="region-button min-h-8 px-2 py-1 text-xs" aria-expanded={changing} aria-controls="new-region-change"
            onClick={() => setChanging(open => !open)}>지역 바꾸기</button>
          <RelatedSearch key={region.code} target={region.name} region={region} topics={REGION_TOPICS} />
        </div>
        <p className="text-sm text-muted">새 축제 기획</p>
        <div id="new-region-change" hidden={!changing} className="region-card">
          {changing && <RegionPicker initial={{ province: region.province, district: region.district }} submitLabel="이 지역 보기" onPick={pick} />}
        </div>
      </header>
      <nav aria-label="새 축제 탐색 메뉴" className="-mx-1 overflow-x-auto px-1">
        <ul className="flex min-w-max gap-2 border-b border-ink/10 pb-2">
          {VIEWS.map(v => <li key={v.view}>
            <Link href={href(v.view)} aria-current={view === v.view ? "page" : undefined} onClick={() => { tab.focusHeading = v.view; }}
              className={`inline-flex min-h-10 items-center rounded-xl px-3 py-2 text-sm font-bold ${view === v.view ? "bg-navy text-white" : "border border-ink/15 bg-white hover:bg-paper"}`}>{v.label}</Link>
          </li>)}
        </ul>
      </nav>
      {children}
    </div>
  </NewRegionContext.Provider>;
}

/** Moves focus to the view heading after the view menu was used, so keyboard users land on the new content. */
export function useViewHeadingFocus(view: NewView, heading: RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (tab.focusHeading === view) { tab.focusHeading = null; heading.current?.focus(); }
  }, [view, heading]);
}
