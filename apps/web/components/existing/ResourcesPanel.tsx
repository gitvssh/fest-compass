"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { introKey, ResourceIntro } from "@/components/resources/ResourceIntro";
import { useResourceLists } from "@/components/resources/useResourceLists";
import { distanceKm, validPoint } from "@/lib/comparison/distance";
import { RESOURCE_KINDS } from "@/lib/existing/request";
import { resourceRows } from "@/lib/existing/resources";
import { parseResourceTarget, readResourceTypes, RESOURCE_KIND_LABELS as LABEL, resourceTypesValue } from "@/lib/existing/types";
import type { Point, RegionRef, ResourceItem, ResourceKind, ResourcesResponse, ResourceTypeBlock } from "@/lib/existing/types";
import { SOURCE } from "@/lib/region/model";
import { rememberView, writeAddress } from "./address";
import { isStale } from "./blocks";
import { FestivalPending, useFestival, useViewHeadingFocus } from "./ExistingShell";
import { timeLabel } from "./format";
import { festivalMemory, shared, viewHref, type Anchor } from "./memory";
import { one } from "./route-params";
import { InfoDialog, LoadState } from "./ui";
import type { MapRow } from "./ResourceMap";

const ResourceMap = dynamic(() => import("./ResourceMap"), { ssr: false, loading: () => <p role="status" className="region-card text-sm">지도를 준비하고 있어요. 목록은 바로 볼 수 있어요.</p> });
const RADII = [1, 3, 5, 10, 20];

// Address condition: absent or invalid = the default 관광지·문화시설, `types=none` = none chosen, otherwise the listed
// kinds in display order. Exactly the default set is written without `types`; any other set (all four included) is explicit.
function readTypes(params: URLSearchParams): ResourceKind[] {
  return readResourceTypes(one(params, "types"));
}
function typesAddress(types: ResourceKind[]): URLSearchParams {
  const params = new URLSearchParams(), value = resourceTypesValue(types);
  if (value !== null) params.set("types", value);
  return params;
}
// One-shot arrival target `resource=<kind>:<id>`. Anything else (or a repeated key) is ignored and never selects.
function readTarget(params: URLSearchParams): { kind: ResourceKind; id: string } | null {
  return parseResourceTarget(one(params, "resource"));
}
/** A pending arrival target. `baseline` is the list answer seen when it arrived; only a later answer may resolve it. */
type Target = { festivalId: string; kind: ResourceKind; id: string; baseline?: ResourcesResponse | null };
const km = (value: number) => `${value < 10 ? value.toFixed(1) : Math.round(value)}km`;
const modified = (value: string | null) => value && /^\d{8}/.test(value) ? `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}` : null;

export function ResourcesPanel() {
  const festival = useFestival(), heading = useRef<HTMLHeadingElement>(null);
  useViewHeadingFocus(festival.id, "resources", heading);
  const params = useSearchParams(), address = params.toString();
  // Honor the arrival's type from the first render. On an initial page load, history replacement may precede
  // Next's history subscription; relying on a later URL render alone would leave a types=14 link waiting forever.
  const types = useMemo(() => {
    const p = new URLSearchParams(address), chosen = readTypes(p), arrival = readTarget(p);
    return arrival ? RESOURCE_KINDS.filter(k => k === arrival.kind || chosen.includes(k)) : chosen;
  }, [address]);
  const noneChosen = types.length === 0;
  const memory = festivalMemory(festival.id).resources;
  // An explicit arrival target replaces the remembered selection from the first render (no flash, no focus return to it).
  const [arriving] = useState(() => readTarget(new URLSearchParams(address)) !== null);
  const [picked, setPicked] = useState<ResourceItem | null>(arriving ? null : memory.selected), [anchor, setAnchor] = useState<Anchor | null>(memory.anchor);
  const [radiusKm, setRadiusKm] = useState(memory.radiusKm), [sort, setSort] = useState(memory.sort), [display, setDisplay] = useState(memory.display);
  const [mapFailed, setMapFailed] = useState(false), [mapKey, setMapKey] = useState(0);
  const list = useRef<HTMLUListElement>(null), detailHeading = useRef<HTMLHeadingElement>(null), focusDetail = useRef(false);
  useEffect(() => { Object.assign(memory, { selected: picked, anchor, radiusKm, sort, display }); }, [memory, picked, anchor, radiusKm, sort, display]);
  useEffect(() => { rememberView(festival.id, "resources", typesAddress(types)); shared.types = typesAddress(types).get("types"); }, [festival.id, types]);

  const region = festival.region;
  // Each type is its own request so one type's failure or delay never holds back the others. A block is shown
  // only when the answer is for this festival's region (a matching key alone is not enough).
  const lists = useResourceLists(region, types);
  const states = RESOURCE_KINDS.filter(kind => types.includes(kind))
    .map(kind => { const request = lists[kind]; return { kind, request, block: region && request.data?.region.code === region.code ? request.data.byType.find(b => b.kind === kind) ?? null : null }; });
  const done = (b: ResourceTypeBlock | null): b is ResourceTypeBlock => !!b && (b.status === "complete" || b.status === "empty");
  const items = useMemo(() => states.flatMap(s => done(s.block) ? s.block.items : []), [lists["12"].data, lists["14"].data, lists["39"].data, lists["32"].data, types, region?.code]); // eslint-disable-line react-hooks/exhaustive-deps
  const allDone = states.length > 0 && states.every(s => done(s.block) && !isStale(s.block));
  const { rows, counts } = useMemo(() => resourceRows(items, anchor?.point ?? null, { radiusKm: anchor ? radiusKm : null, sort: anchor ? sort : "name" }), [items, anchor, radiusKm, sort]);
  const visible = rows.filter(r => r.withinRadius !== false);
  const numbered = visible.map((r, i) => ({ ...r, number: i + 1 }));
  const mapRows: MapRow[] = numbered.filter(r => r.item.point).map(r => ({ id: r.item.id, number: r.number, title: r.item.title, point: r.item.point! }));
  const selectedId = picked?.id ?? null;
  // The freshest copy of the selected resource; a type filter that hides it keeps the selection.
  const selected = picked ? items.find(i => i.id === picked.id) ?? picked : null;
  const hiddenByFilter = !!picked && !types.includes(picked.kind);
  // Straight-line distance of the open resource from the anchor itself, so a type or radius filter that hides it keeps a known distance.
  const selectedDistance = selected && anchor && validPoint(anchor.point) && selected.point && validPoint(selected.point) ? distanceKm(anchor.point, selected.point) : null;

  // Only a successful full re-query of the same type that no longer contains the resource releases it; failures keep it.
  const pickedBlock = picked ? states.find(s => s.kind === picked.kind)?.block ?? null : null;
  useEffect(() => {
    if (picked && done(pickedBlock) && !isStale(pickedBlock) && !pickedBlock.items.some(i => i.id === picked.id)) setPicked(null);
  }, [pickedBlock, picked]);
  useEffect(() => { if (focusDetail.current && selectedId) { focusDetail.current = false; detailHeading.current?.focus(); } }, [selectedId]);
  // Coming back (browser history or a link) with a remembered selection: return focus to it.
  const restoreFocus = useRef(!!memory.selected && !arriving);
  useEffect(() => {
    if (!restoreFocus.current || !picked || document.activeElement === heading.current) return;
    const button = [...list.current?.querySelectorAll<HTMLElement>("[data-resource-id]") ?? []].find(el => el.dataset.resourceId === picked.id);
    if (button && button.offsetParent !== null) { restoreFocus.current = false; button.focus(); }
    else if (hiddenByFilter) { restoreFocus.current = false; detailHeading.current?.focus(); }
  }, [items, picked, hiddenByFilter]);

  // Arrival link `resource=<kind>:<id>`: read once, then removed from the address with replace (no history entry),
  // so reloads, back/forward and later address changes never select it again. Its type is added only here, once.
  const [target, setTarget] = useState<Target | null>(null), [targetMissing, setTargetMissing] = useState(false);
  const consumed = useRef<string | null>(null);
  useEffect(() => {
    const current = new URLSearchParams(address);
    if (!current.has("resource")) { consumed.current = null; return; }
    const raw = current.getAll("resource").join("&");
    if (consumed.current === raw) return;
    consumed.current = raw;
    const found = readTarget(current), next = new URLSearchParams(current);
    next.delete("resource");
    if (found) {
      restoreFocus.current = false;
      setTarget({ festivalId: festival.id, ...found }); setTargetMissing(false); setPicked(null);
      const chosen = readTypes(next);
      if (!chosen.includes(found.kind)) {
        const withKind = typesAddress(RESOURCE_KINDS.filter(k => k === found.kind || chosen.includes(k))).get("types");
        next.delete("types");
        if (withKind) next.set("types", withKind);
      }
    }
    writeAddress(next);
  }, [address, festival.id]);

  // Resolve only against a list answer that arrived after the target (a forced refresh when one was already shown),
  // succeeded completely for this region and type, and is not a kept earlier copy. Failures keep the target for retry.
  const slot = target ? states.find(s => s.kind === target.kind) ?? null : null;
  const targetWaitsForRetry = !!slot && (!!slot.request.failure || slot.block?.status === "unavailable" || (!!slot.block && isStale(slot.block)));
  useEffect(() => {
    if (!target) return;
    if (target.festivalId !== festival.id) { setTarget(null); return; }
    if (!slot) return;
    const { request: r, block: b } = slot;
    if (target.baseline === undefined) {
      setTarget({ ...target, baseline: r.data });
      if (r.data && !r.loading) r.retry();
      return;
    }
    if (!r.data || r.data === target.baseline || r.loading || r.failure || !done(b) || isStale(b) || r.data.region.code !== region?.code) return;
    const item = b.items.find(i => i.id === target.id && i.kind === target.kind) ?? null;
    setTarget(null);
    if (!item) { setTargetMissing(true); return; }
    // Keep the inherited center, but lift a radius that would hide the chosen resource.
    if (anchor && radiusKm !== null && resourceRows([item], anchor.point, { radiusKm }).rows[0]?.withinRadius === false) setRadiusKm(null);
    focusDetail.current = true; setPicked(item);
  }, [target, festival.id, slot?.request.data, slot?.request.loading, slot?.request.failure, slot?.block, region?.code]); // eslint-disable-line react-hooks/exhaustive-deps

  function toggleType(kind: ResourceKind) {
    setTarget(null); setTargetMissing(false);
    const next = RESOURCE_KINDS.filter(k => (k === kind ? !types.includes(k) : types.includes(k)));
    const params = typesAddress(next);
    rememberView(festival.id, "resources", params); shared.types = params.get("types"); writeAddress(params);
  }
  const choose = useCallback((id: string) => {
    const item = items.find(i => i.id === id);
    if (item) { setTarget(null); setTargetMissing(false); focusDetail.current = true; setPicked(item); }
  }, [items]);
  function closeDetail() {
    const id = selectedId; setPicked(null);
    requestAnimationFrame(() => {
      const button = [...list.current?.querySelectorAll<HTMLElement>("[data-resource-id]") ?? []].find(el => el.dataset.resourceId === id);
      (button && button.offsetParent !== null ? button : heading.current)?.focus();
    });
  }
  function setAnchorFrom(item: ResourceItem) { if (item.point) setAnchor({ point: item.point, label: item.title, source: "resource", resourceId: item.id }); }
  function setMapCenter(point: Point) { setAnchor({ point, label: `지도에서 고른 위치 (${point.latitude.toFixed(4)}, ${point.longitude.toFixed(4)})`, source: "map" }); }

  return <section aria-labelledby="resources-heading" className="space-y-4">
    <div>
      <h2 id="resources-heading" ref={heading} tabIndex={-1} className="min-w-0 break-words text-xl font-extrabold">{region ? `${region.districtName} 전체` : ""} 주변 관광자원</h2>
      <p className="text-sm text-muted">현재 등록 관광지·문화시설·음식점·숙박</p>
    </div>
    <div className="region-card space-y-3">
      <fieldset className="flex flex-wrap items-center gap-2">
        <legend className="sr-only">자원 유형</legend>
        {RESOURCE_KINDS.map(k => <button key={k} type="button" className="region-button" aria-pressed={types.includes(k)} onClick={() => toggleType(k)}>{LABEL[k]}</button>)}
      </fieldset>
      <AnchorControls anchor={anchor} radiusKm={radiusKm} sort={sort} onClear={() => { setAnchor(null); setRadiusKm(null); setSort("name"); }} onRadius={setRadiusKm} onSort={setSort} />
    </div>

    {!region && <FestivalPending />}
    {noneChosen && <p className="region-card text-sm">볼 유형을 하나 이상 골라 주세요.</p>}
    {region && states.length > 0 && <>
      <ul className="space-y-1 text-sm">{states.map(({ kind, request, block: b }) => <li key={kind}>
        {!b ? <LoadState loading={request.loading} failure={request.failure} hasData={false} subject={`${LABEL[kind]} 목록을`} onRetry={request.retry} />
          : b.status === "unavailable" ? <span role="alert" className="inline-flex flex-wrap items-center gap-2 rounded-xl bg-coral-soft px-3 py-2">{LABEL[kind]} 목록을 불러오지 못했어요.<button type="button" className="region-button" onClick={request.retry}>다시 불러오기</button></span>
          : isStale(b) || (request.failure && request.data) ? <span role="alert" className="inline-flex flex-wrap items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-amber-950">{LABEL[kind]} 새 목록을 불러오지 못했어요. {timeLabel(b.collectedAt ?? request.data?.retrievedAt ?? null)} 목록이에요.<button type="button" className="region-button" onClick={request.retry}>다시 불러오기</button></span>
          : b.status === "empty" ? <span className="text-muted">{LABEL[kind]}: 조회한 등록 결과가 없어요</span>
          : <span>{LABEL[kind]} {b.total ?? b.items.length}건{request.loading ? " · 새 자료를 확인하고 있어요…" : ""}</span>}
      </li>)}</ul>
      {target && <p role="status" className="text-sm text-muted">{targetWaitsForRetry ? "목록을 다시 불러오면 고른 장소를 열어 드려요." : "고른 장소를 목록에서 찾고 있어요…"}</p>}
      {targetMissing && <p role="status" className="rounded-xl bg-paper p-3 text-sm">고른 장소를 지금 등록된 관광정보 목록에서 찾지 못했어요. 아래 목록에서 살펴봐 주세요.</p>}
      {(allDone || items.length > 0) && <p className="text-sm text-muted" aria-live="polite">
        {allDone ? `조회 ${counts.returned}건` : `불러온 ${counts.returned}건`} · 좌표 있는 자원 {counts.withCoordinates}건
        {anchor && radiusKm !== null && counts.withinRadius !== null ? ` · 기준점 ${radiusKm}km 안 ${counts.withinRadius}건 (좌표 없는 자원은 거리 미확인으로 함께 표시)` : ""}
      </p>}
      <div className="flex gap-2 lg:hidden" role="group" aria-label="보기 방식">
        <button type="button" className="region-button" aria-pressed={display === "list"} onClick={() => setDisplay("list")}>목록</button>
        <button type="button" className="region-button" aria-pressed={display === "map"} onClick={() => setDisplay("map")}>지도</button>
      </div>
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className={`min-w-0 ${display === "map" ? "hidden lg:block" : ""}`}>
          {visible.length === 0 ? (items.length > 0 ? <div className="region-card space-y-2 text-sm">
            <p>기준점 반경 안에 있는 자원이 없어요.</p>
            <button type="button" className="region-button" onClick={() => setRadiusKm(null)}>반경 해제</button>
          </div> : allDone ? <p className="region-card text-sm">선택한 유형에 조회된 자원이 없어요.</p> : null)
          : <ul ref={list} aria-label="관광자원 목록" className="max-h-[36rem] space-y-2 overflow-y-auto pr-1">
            {numbered.map(r => <li key={r.item.id}>
              <button type="button" data-resource-id={r.item.id} aria-pressed={r.item.id === selectedId} onClick={() => choose(r.item.id)}
                className={`block w-full rounded-xl border p-3 text-left text-sm ${r.item.id === selectedId ? "border-blue bg-blue-soft" : "border-ink/10 bg-white hover:bg-paper"}`}>
                <span className="break-words font-bold">{r.number}. {r.item.title}</span>
                <span className="mt-1 block break-words text-xs text-muted">{LABEL[r.item.kind]} · {r.item.address || "주소 정보 없음"}{r.item.point ? "" : " · 지도 위치 없음"}</span>
                {anchor && <span className="mt-1 block text-xs font-bold">{r.distanceKm === null ? "거리 미확인" : `기준점에서 직선거리 약 ${km(r.distanceKm)}`}</span>}
              </button>
            </li>)}
          </ul>}
        </div>
        <div className={`min-w-0 ${display === "list" ? "hidden lg:block" : ""}`}>
          {mapFailed ? <div role="alert" className="region-card space-y-2 text-sm"><p>지도를 불러오지 못했어요. 목록은 계속 볼 수 있어요.</p>
            <button type="button" className="region-button" onClick={() => { setMapFailed(false); setMapKey(k => k + 1); }}>지도 다시 열기</button></div>
            : mapRows.length ? <ResourceMap key={mapKey} rows={mapRows} selectedId={selectedId} anchor={anchor?.point ?? null} radiusKm={anchor ? radiusKm : null} onSelect={choose} onCenter={setMapCenter} onFailure={() => setMapFailed(true)} />
            : allDone || items.length > 0 ? <p className="region-card text-sm text-muted">지도에 표시할 위치가 있는 자원이 없어요. 목록에서 확인해 주세요.</p> : null}
        </div>
      </div>
    </>}
    {/* The open detail stays even when every type is switched off. */}
    {region && selected && <ResourceDetail region={region} item={selected} heading={detailHeading} distance={selectedDistance} anchored={!!anchor}
      hidden={hiddenByFilter} isAnchor={anchor?.resourceId === selected.id} onAnchor={() => setAnchorFrom(selected)} onClose={closeDetail} />}
    {region && states.length > 0 && <>
      <div className="flex flex-wrap items-center gap-2">
        <InfoDialog label="출처 보기" title="관광자원 출처">
          <p>한국관광공사 국문 관광정보 서비스의 지역 기반 목록(관광지·문화시설·음식점·숙박)이에요. 현재 등록 정보이며 운영 여부나 이용 조건은 각 시설에 확인해 주세요.</p>
          <ul className="list-disc pl-5">{states.map(({ kind, request, block: b }) => <li key={kind}>{LABEL[kind]}: {!b || b.status === "unavailable" ? "불러오지 못함" : `${timeLabel(b.collectedAt)} 수집 · ${timeLabel(request.data?.retrievedAt ?? null)} 조회`}</li>)}</ul>
          <p>거리는 고른 기준점에서 잰 직선거리예요. 이동 시간이나 경로가 아니에요.</p>
          <p><a className="font-bold text-blue underline" href={SOURCE} target="_blank" rel="noreferrer">공공데이터포털 관광정보 서비스 ↗</a></p>
        </InfoDialog>
        <Link className="region-button" href={viewHref(festival.id, "timing")}>개최 시기 보기</Link>
      </div>
    </>}
  </section>;
}

function AnchorControls({ anchor, radiusKm, sort, onClear, onRadius, onSort }: {
  anchor: Anchor | null; radiusKm: number | null; sort: "name" | "distance"; onClear: () => void; onRadius: (r: number | null) => void; onSort: (s: "name" | "distance") => void;
}) {
  if (!anchor) return null;
  return <div className="flex flex-wrap items-end gap-3 rounded-xl bg-paper p-3 text-sm">
    <p className="min-w-0 basis-full break-words"><strong>기준점</strong> {anchor.label}</p>
    <label className="text-xs font-bold">반경<select className="workspace-input mt-1" value={radiusKm ?? ""} onChange={e => onRadius(e.target.value ? Number(e.target.value) : null)}>
      <option value="">제한 없음</option>{RADII.map(r => <option key={r} value={r}>{r}km 안</option>)}
    </select></label>
    <label className="text-xs font-bold">정렬<select className="workspace-input mt-1" value={sort} onChange={e => onSort(e.target.value as "name" | "distance")}>
      <option value="name">이름순</option><option value="distance">가까운 순</option>
    </select></label>
    <button type="button" className="region-button" onClick={onClear}>기준점 해제</button>
  </div>;
}

/** List facts of one resource plus its separate shared introduction (own request, own source and collection time). */
function ResourceDetail({ region, item, heading, distance, anchored, hidden, isAnchor, onAnchor, onClose }: {
  region: RegionRef; item: ResourceItem; heading: RefObject<HTMLHeadingElement | null>; distance: number | null; anchored: boolean; hidden: boolean; isAnchor: boolean; onAnchor: () => void; onClose: () => void;
}) {
  return <aside aria-labelledby="resource-detail-heading" className="region-card space-y-2 text-sm">
    <div className="flex items-start justify-between gap-3">
      <h3 id="resource-detail-heading" ref={heading} tabIndex={-1} className="min-w-0 break-words text-lg font-extrabold">{item.title}</h3>
      <button type="button" className="region-button shrink-0" onClick={onClose}>상세 닫기</button>
    </div>
    {hidden && <p className="text-xs text-muted">지금 고른 유형 목록에는 보이지 않는 자원이에요.</p>}
    <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1">
      <dt className="text-muted">유형</dt><dd>{LABEL[item.kind]}</dd>
      <dt className="text-muted">주소</dt><dd className="break-words">{item.address || "주소 정보 없음"}</dd>
      <dt className="text-muted">지도 위치</dt><dd>{item.point ? "있음" : "없음 · 거리를 계산할 수 없어요"}</dd>
      {anchored && <><dt className="text-muted">기준점에서</dt><dd>{distance === null ? "거리 미확인" : `직선거리 약 ${km(distance)}`}</dd></>}
      {modified(item.modifiedAt) && <><dt className="text-muted">목록 원천 수정일</dt><dd>{modified(item.modifiedAt)}</dd></>}
    </dl>
    {item.point && <button type="button" className="region-button" disabled={isAnchor} onClick={onAnchor}>{isAnchor ? "현재 기준점이에요" : "이 자원을 기준점으로"}</button>}
    <ResourceIntro key={introKey(region, item)} region={region} item={item} />
  </aside>;
}
