"use client";
import { useId, type ReactNode, type RefObject } from "react";
import { isStale } from "@/components/existing/blocks";
import { timeLabel } from "@/components/existing/format";
import type { Anchor } from "@/components/existing/memory";
import { LoadState } from "@/components/existing/ui";
import type { KeyedState } from "@/components/existing/useKeyedRequest";
import { distanceText, RADII } from "@/components/new-festival/resource-labels";
import { RESOURCE_KINDS } from "@/lib/existing/request";
import { RESOURCE_KIND_LABELS as LABEL } from "@/lib/existing/types";
import type { ResourceItem, ResourceKind, ResourceRow, ResourcesResponse, ResourceTypeBlock } from "@/lib/existing/types";

/**
 * Shared presentation of the tourism resource workspace used by the existing- and new-festival journeys.
 * Layout, type scale and state presentation only; requests, address conditions and selection rules stay in the views.
 * Every class is local to these elements, so other screens that share the global primitives do not change.
 */

/** Root of a resource view: 44px controls and 13px minimum supplementary text for everything rendered inside it. */
export const WORKSPACE_ROOT = "space-y-4 [&_.region-button]:min-h-11 [&_.text-xs]:text-[13px]";
export const count = (value: number) => value.toLocaleString("ko-KR");
export type NumberedRow = ResourceRow & { number: number };
export type KindState = { kind: ResourceKind; request: KeyedState<ResourcesResponse>; block: ResourceTypeBlock | null };

function Check({ on }: { on: boolean }) {
  return <svg aria-hidden="true" focusable="false" viewBox="0 0 16 16" className="h-4 w-4 shrink-0">
    {on ? <><circle cx="8" cy="8" r="7.25" fill="currentColor" /><path d="M4.6 8.2 7 10.5l4.4-4.9" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></>
      : <circle cx="8" cy="8" r="6.75" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.45" />}
  </svg>;
}

/**
 * Registered count of one type, only from a settled list of that type that is current: `complete` gives its count and a
 * confirmed `empty` answer gives 0. Loading without an answer, failure, unavailable and a kept earlier copy give null,
 * so an unknown count is never shown as zero or as a current figure.
 */
export function verifiedCount({ request, block: b }: KindState): number | null {
  if (!b || request.failure || isStale(b)) return null;
  if (b.status === "empty") return 0;
  return b.status === "complete" ? b.total ?? b.items.length : null;
}

/**
 * Four peer type toggles. Each button is named by the exact type name (aria-label) and carries its pressed state;
 * the check mark is decorative. A verified registered count of a chosen type is shown inside its button and attached
 * as the button's description, so the action name stays the plain type name.
 */
export function KindPicker({ types, states, onToggle }: { types: readonly ResourceKind[]; states: readonly KindState[]; onToggle: (kind: ResourceKind) => void }) {
  const id = useId();
  return <fieldset className="flex min-w-0 flex-wrap items-center gap-2">
    <legend className="sr-only">자원 유형</legend>
    {RESOURCE_KINDS.map(k => {
      const on = types.includes(k), state = on ? states.find(s => s.kind === k) : undefined, n = state ? verifiedCount(state) : null;
      return <button key={k} type="button" className="region-button min-h-11 gap-2 px-4 text-[15px] aria-pressed:text-[#164ea1]" aria-label={LABEL[k]} aria-pressed={on}
        aria-describedby={n === null ? undefined : `${id}-${k}`} onClick={() => onToggle(k)}>
        <Check on={on} />{LABEL[k]}
        {n !== null && <span id={`${id}-${k}`} className="rounded-full bg-ink/[0.06] px-2 text-sm font-bold tabular-nums">{count(n)}건</span>}
      </button>;
    })}
  </fieldset>;
}

/**
 * Loading, refresh, failure with its own retry, and confirmed empty result of each chosen type, right under the
 * type toggles (outside their group). A settled type with nothing to report adds no line; its count is on its button.
 */
export function KindStatusList({ states }: { states: KindState[] }) {
  const lines = states.flatMap(({ kind, request, block: b }) => {
    const retry = <button type="button" className="region-button" onClick={request.retry}>다시 불러오기</button>;
    // Failures take a full row with their retry; loading, refresh and empty notes sit side by side.
    const [line, wide]: [ReactNode, boolean] = !b ? [request.failure || request.loading ? <LoadState loading={request.loading} failure={request.failure} hasData={false} subject={`${LABEL[kind]} 목록을`} onRetry={request.retry} /> : null, !!request.failure]
      : b.status === "unavailable" ? [<span role="alert" className="flex flex-wrap items-center gap-2 rounded-xl bg-coral-soft px-3 py-2">{LABEL[kind]} 목록을 불러오지 못했어요.{retry}</span>, true]
      : isStale(b) || request.failure ? [<span role="alert" className="flex flex-wrap items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-amber-950">{LABEL[kind]} 새 목록을 불러오지 못했어요. {timeLabel(b.collectedAt ?? request.data?.retrievedAt ?? null)} 목록이에요.{retry}</span>, true]
      : b.status === "empty" ? [<span className="inline-block rounded-full border border-ink/10 bg-paper px-3 py-1 text-ink/80">{LABEL[kind]}: 조회한 등록 결과가 없어요</span>, false]
      : [request.loading ? <span role="status" className="text-muted">{LABEL[kind]} 새 자료를 확인하고 있어요…</span> : null, false];
    return line ? [<li key={kind} className={wide ? "min-w-0 basis-full" : "min-w-0"}>{line}</li>] : [];
  });
  if (!lines.length) return null;
  return <ul className="flex min-w-0 flex-wrap items-start gap-2 text-sm leading-6">{lines}</ul>;
}

/**
 * What is displayed right now: rows in the numbered list (after the radius, including places without a map position)
 * and places on the map. With a radius, `inside` rows are within it and `unknown` rows are listed with an unknown distance.
 */
export function CountLine({ listed, mapped, radius }: {
  listed: number; mapped: number; radius: { km: number; inside: number; unknown: number } | null;
}) {
  return <p className="text-sm font-semibold tabular-nums text-ink" aria-live="polite">
    현재 목록 {count(listed)}건 · 지도 {count(mapped)}건
    {radius ? ` · 기준점 ${radius.km}km 안 ${count(radius.inside)}건${radius.unknown ? ` · 거리 미확인 ${count(radius.unknown)}건` : ""}` : ""}
  </p>;
}

/** Explicit distance anchor with radius and order. Nothing here is set by selecting a place or moving the map. */
export function AnchorControls({ anchor, radiusKm, sort, onClear, onRadius, onSort, hint }: {
  anchor: Anchor | null; radiusKm: number | null; sort: "name" | "distance"; onClear: () => void; onRadius: (r: number | null) => void; onSort: (s: "name" | "distance") => void; hint?: string;
}) {
  if (!anchor) return hint ? <p className="text-[13px] leading-5 text-muted">{hint}</p> : null;
  return <div className="flex flex-wrap items-end gap-3 rounded-xl border border-ink/10 bg-paper p-3 text-sm">
    <p className="min-w-0 basis-full break-words text-[15px]"><strong>기준점</strong> {anchor.label}</p>
    <label className="min-w-[8.5rem] text-sm font-bold">반경<select className="workspace-input mt-1 block min-h-11" value={radiusKm ?? ""} onChange={e => onRadius(e.target.value ? Number(e.target.value) : null)}>
      <option value="">제한 없음</option>{RADII.map(r => <option key={r} value={r}>{r}km 안</option>)}
    </select></label>
    <label className="min-w-[8.5rem] text-sm font-bold">정렬<select className="workspace-input mt-1 block min-h-11" value={sort} onChange={e => onSort(e.target.value as "name" | "distance")}>
      <option value="name">이름순</option><option value="distance">가까운 순</option>
    </select></label>
    <button type="button" className="region-button min-h-11" onClick={onClear}>기준점 해제</button>
  </div>;
}

/** Small screens switch between list and map; wide screens show both. */
export function ViewToggle({ display, onChange }: { display: "list" | "map"; onChange: (display: "list" | "map") => void }) {
  return <div className="flex gap-2 lg:hidden" role="group" aria-label="보기 방식">
    <button type="button" className="region-button min-h-11 flex-1 aria-pressed:text-[#164ea1]" aria-pressed={display === "list"} onClick={() => onChange("list")}>목록</button>
    <button type="button" className="region-button min-h-11 flex-1 aria-pressed:text-[#164ea1]" aria-pressed={display === "map"} onClick={() => onChange("map")}>지도</button>
  </div>;
}

/** List about 40% and map about 60% on wide screens; one natural column when narrow or zoomed. */
export function ListMapGrid({ display, list, map }: { display: "list" | "map"; list: ReactNode; map: ReactNode }) {
  return <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
    <div data-resource-area="list" className={`min-w-0 ${display === "map" ? "hidden lg:block" : ""}`}>{list}</div>
    <div data-resource-area="map" className={`min-w-0 ${display === "list" ? "hidden lg:block" : ""}`}>{map}</div>
  </div>;
}

/** Short empty or failed area with an optional recovery action. */
export function AreaNote({ children, action, alert = false, muted = false }: { children: ReactNode; action?: ReactNode; alert?: boolean; muted?: boolean }) {
  return <div role={alert ? "alert" : undefined} className={`region-card space-y-3 text-[15px] leading-6 ${muted ? "text-muted" : ""}`}>
    <p>{children}</p>{action}
  </div>;
}

/** Numbered places in the current order; the number matches the map. `compare` adds the new-festival side-by-side toggle. */
export function ResourceRows({ rows, listRef, openId, anchored, onOpen, compare }: {
  rows: NumberedRow[]; listRef: RefObject<HTMLUListElement | null>; openId: string | null; anchored: boolean; onOpen: (item: ResourceItem) => void;
  compare?: { ids: ReadonlySet<string>; onToggle: (item: ResourceItem) => void };
}) {
  return <ul ref={listRef} aria-label="관광자원 목록" tabIndex={-1} className="max-h-[36rem] space-y-2 overflow-y-auto overscroll-contain pr-1 lg:max-h-[44rem]">
    {rows.map(r => {
      const open = r.item.id === openId, inCompare = !!compare?.ids.has(r.item.id);
      return <li key={r.item.id} className={`min-w-0 rounded-xl border ${open ? "border-blue bg-[#f7faff] shadow-[inset_4px_0_0_#2667e8]" : "border-ink/10 bg-white"}`}>
        <button type="button" data-resource-id={r.item.id} aria-pressed={open} onClick={() => onOpen(r.item)}
          className={`relative block min-h-11 w-full rounded-xl py-3 pl-4 pr-10 text-left hover:bg-paper/70 ${compare ? "pb-2" : ""}`}>
          <span className="block break-words text-base font-bold leading-snug"><span className="tabular-nums text-[#164ea1]">{r.number}.</span> {r.item.title}</span>
          <span className="mt-1 block break-words text-sm leading-5 text-muted">{LABEL[r.item.kind]} · {r.item.address || "주소 정보 없음"}{r.item.point ? "" : " · 지도 위치 없음"}</span>
          {anchored && <span className="mt-1 block text-sm font-bold tabular-nums">{distanceText(r.distanceKm)}</span>}
          {open && <svg aria-hidden="true" focusable="false" viewBox="0 0 16 16" className="absolute right-3 top-3.5 h-5 w-5 text-blue">
            <circle cx="8" cy="8" r="7.25" fill="currentColor" /><path d="M4.6 8.2 7 10.5l4.4-4.9" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>}
        </button>
        {compare && <div className="flex flex-wrap items-center gap-2 px-4 pb-3">
          <button type="button" className={`region-button min-h-11 text-sm ${inCompare ? "border-blue font-extrabold text-blue" : ""}`}
            aria-label={`${r.item.title} ${inCompare ? "함께 보기에서 빼기" : "함께 보기에 추가"}`} onClick={() => compare.onToggle(r.item)}>
            {inCompare ? "✓ 함께 보기에서 빼기" : "함께 보기에 추가"}
          </button>
        </div>}
      </li>;
    })}
  </ul>;
}

/** Selected place: name heading (focus target) and close, then the facts, actions and introduction given as children. */
export function DetailFrame({ id, heading, title, note, onClose, children }: {
  id: string; heading: RefObject<HTMLHeadingElement | null>; title: string; note?: string | null; onClose: () => void; children: ReactNode;
}) {
  return <aside aria-labelledby={id} className="region-card space-y-4 border-blue/30 text-[15px] leading-6">
    <div className="flex items-start justify-between gap-3">
      <h3 id={id} ref={heading} tabIndex={-1} className="min-w-0 break-words text-xl font-extrabold leading-snug">{title}</h3>
      <button type="button" className="region-button min-h-11 shrink-0" onClick={onClose}>상세 닫기</button>
    </div>
    {note && <p className="text-[13px] text-muted">{note}</p>}
    {children}
  </aside>;
}

/** Term/value facts in a fixed order. */
export function Facts({ children }: { children: ReactNode }) {
  return <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 [&_dd]:min-w-0 [&_dd]:break-words [&_dt]:text-sm [&_dt]:leading-6 [&_dt]:text-muted">{children}</dl>;
}

const shown = (el: Element | null | undefined): el is HTMLElement => el instanceof HTMLElement && el.getClientRects().length > 0 && !el.closest("[inert]");

/**
 * Focus after a detail closes. A visible list returns to the place's row (or the view heading when that row is not
 * listed). When the list is hidden (small-screen map view) focus stays in visible map controls and never goes to the
 * hidden list: the place's marker if it still exists, the map itself, the pressed view toggle, then the view heading.
 */
export function focusAfterDetail(viewHeading: HTMLElement | null, id: string | null | undefined) {
  const root = viewHeading?.closest("section") ?? null;
  const byId = (area: Element | null | undefined) => [...area?.querySelectorAll<HTMLElement>("[data-resource-id]") ?? []].find(el => el.dataset.resourceId === id && shown(el));
  const list = root?.querySelector("[data-resource-area=list]"), map = root?.querySelector("[data-resource-area=map]");
  const mapShown = shown(map) ? map : null;
  if (shown(list) || !mapShown) { (byId(list) ?? viewHeading)?.focus(); return; }
  const mapTarget = byId(mapShown) ?? [...mapShown.querySelectorAll<HTMLElement>("[role=group][tabindex], button")].find(el => shown(el) && el.tabIndex >= 0 && !(el as HTMLButtonElement).disabled);
  const toggle = [...root?.querySelectorAll<HTMLElement>('[role=group][aria-label="보기 방식"] button[aria-pressed=true]') ?? []].find(shown);
  (mapTarget ?? toggle ?? viewHeading)?.focus();
}
