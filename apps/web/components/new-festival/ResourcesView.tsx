"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { isStale } from "@/components/existing/blocks";
import { timeLabel } from "@/components/existing/format";
import type { Anchor } from "@/components/existing/memory";
import type { MapRow } from "@/components/existing/ResourceMap";
import { InfoDialog, LoadState } from "@/components/existing/ui";
import { useResourceLists } from "@/components/resources/useResourceLists";
import { distanceKm, validPoint } from "@/lib/comparison/distance";
import { RESOURCE_KINDS } from "@/lib/existing/request";
import { resourceRows } from "@/lib/existing/resources";
import type { Point, ResourceItem, ResourceKind, ResourceTypeBlock } from "@/lib/existing/types";
import { SOURCE } from "@/lib/region/model";
import { CompareResources } from "./CompareResources";
import { setAddressParam } from "./address";
import { readTypes, typesValue } from "./durable";
import { useNewRegion, useViewHeadingFocus } from "./NewShell";
import { ResourceDetailPanel } from "./ResourceDetailPanel";
import { KIND_LABEL, MAX_COMPARED } from "./resource-labels";
import { AnchorControls, ResourceList } from "./ResourceList";

const ResourceMap = dynamic(() => import("@/components/existing/ResourceMap"), { ssr: false, loading: () => <p role="status" className="region-card text-sm">지도를 준비하고 있어요. 목록은 바로 볼 수 있어요.</p> });

const done = (b: ResourceTypeBlock | null): b is ResourceTypeBlock => !!b && (b.status === "complete" || b.status === "empty");

/**
 * Current attractions, cultural facilities, restaurants and lodging of the whole selected district. Detail, `함께 보기`
 * and the distance anchor are separate, explicit, temporary choices; none of them is saved or becomes a venue.
 */
export function ResourcesView() {
  const { region, memory, href, chooseHref } = useNewRegion(), saved = memory.resources;
  const heading = useRef<HTMLHeadingElement>(null), detailHeading = useRef<HTMLHeadingElement>(null), compareHeading = useRef<HTMLHeadingElement>(null);
  const list = useRef<HTMLUListElement>(null), focusDetail = useRef(false);
  useViewHeadingFocus("resources", heading);
  const address = useSearchParams()?.toString() ?? "";
  const types = useMemo(() => readTypes(new URLSearchParams(address)), [address]);
  const [compared, setCompared] = useState<ResourceItem[]>(saved.compared), [detail, setDetail] = useState<ResourceItem | null>(saved.detail);
  const [anchor, setAnchor] = useState<Anchor | null>(saved.anchor), [radiusKm, setRadiusKm] = useState(saved.radiusKm);
  const [sort, setSort] = useState(saved.sort), [display, setDisplay] = useState(saved.display);
  const [notice, setNotice] = useState<string | null>(null), [mapFailed, setMapFailed] = useState(false), [mapKey, setMapKey] = useState(0);
  useEffect(() => { Object.assign(saved, { compared, detail, anchor, radiusKm, sort, display }); }, [saved, compared, detail, anchor, radiusKm, sort, display]);

  // Each type is its own full district request, so one type's failure or delay never holds back the others.
  const lists = useResourceLists(region, types);
  const states = RESOURCE_KINDS.filter(kind => types.includes(kind))
    .map(kind => { const result = lists[kind]; return { kind, result, block: result.data?.region.code === region.code ? result.data.byType.find(b => b.kind === kind) ?? null : null }; });
  const items = useMemo(() => states.flatMap(s => done(s.block) ? s.block.items : []), [lists["12"].data, lists["14"].data, lists["39"].data, lists["32"].data, types, region.code]); // eslint-disable-line react-hooks/exhaustive-deps
  const allDone = states.length > 0 && states.every(s => done(s.block) && !isStale(s.block));
  const { rows, counts } = useMemo(() => resourceRows(items, anchor?.point ?? null, { radiusKm: anchor ? radiusKm : null, sort: anchor ? sort : "name" }), [items, anchor, radiusKm, sort]);
  const numbered = rows.filter(r => r.withinRadius !== false).map((r, i) => ({ ...r, number: i + 1 }));
  const visibleIds = new Set(numbered.map(r => r.item.id));
  const mapRows: MapRow[] = numbered.filter(r => r.item.point).map(r => ({ id: r.item.id, number: r.number, title: r.item.title, point: r.item.point! }));
  const freshest = (item: ResourceItem) => items.find(i => i.id === item.id && i.kind === item.kind) ?? item;
  const shownDetail = detail ? freshest(detail) : null, shownCompared = compared.map(freshest);
  const distance = (item: ResourceItem) => anchor && item.point && validPoint(item.point) ? distanceKm(anchor.point, item.point) : null;

  // Only a successful, complete re-query of the same district and type that no longer lists a chosen resource
  // releases it. Failures, stale answers and type filters keep the choice.
  const blocks = new Map(states.map(s => [s.kind, s.block]));
  const confirmedGone = (item: ResourceItem) => { const b = blocks.get(item.kind) ?? null; return done(b) && !isStale(b) && !b.items.some(i => i.id === item.id); };
  // "Hidden by the current conditions" is stated only once that type's list is settled (or the type is switched off).
  const hidden = (item: ResourceItem) => !visibleIds.has(item.id) && (!types.includes(item.kind) || done(blocks.get(item.kind) ?? null));
  const goneSignature = [detail, ...compared].filter((i): i is ResourceItem => !!i && confirmedGone(i)).map(i => i.id).join(",");
  useEffect(() => {
    if (!goneSignature) return;
    const gone = new Set(goneSignature.split(","));
    setDetail(d => d && gone.has(d.id) ? null : d);
    setCompared(c => c.filter(i => !gone.has(i.id)));
  }, [goneSignature]);

  useEffect(() => { if (focusDetail.current && detail) { focusDetail.current = false; detailHeading.current?.focus(); } }, [detail]);

  function toggleType(kind: ResourceKind) {
    const next = RESOURCE_KINDS.filter(k => (k === kind ? !types.includes(k) : types.includes(k)));
    setAddressParam("types", typesValue(next));
  }
  function open(item: ResourceItem) { focusDetail.current = true; setDetail(item); }
  function openById(id: string) { const item = items.find(i => i.id === id); if (item) open(item); }
  function closeDetail() {
    const id = detail?.id; setDetail(null);
    requestAnimationFrame(() => {
      const button = [...list.current?.querySelectorAll<HTMLElement>("[data-resource-id]") ?? []].find(el => el.dataset.resourceId === id);
      (button && button.offsetParent !== null ? button : heading.current)?.focus();
    });
  }
  function toggleCompare(item: ResourceItem) {
    if (compared.some(c => c.id === item.id)) { setCompared(compared.filter(c => c.id !== item.id)); setNotice(null); return; }
    if (compared.length >= MAX_COMPARED) {
      setNotice(`함께 보기는 ${MAX_COMPARED}곳까지예요. 한 곳을 빼고 추가해 주세요.`);
      requestAnimationFrame(() => compareHeading.current?.focus());
      return;
    }
    setCompared([...compared, item]); setNotice(null);
  }
  function removeCompared(item: ResourceItem) {
    setCompared(compared.filter(c => c.id !== item.id)); setNotice(null);
    requestAnimationFrame(() => compareHeading.current?.focus());
  }
  function anchorOn(item: ResourceItem) { if (item.point) setAnchor({ point: item.point, label: item.title, source: "resource", resourceId: item.id }); }
  function anchorMap(point: Point) { setAnchor({ point, label: `지도에서 고른 위치 (${point.latitude.toFixed(4)}, ${point.longitude.toFixed(4)})`, source: "map" }); }

  return <section aria-labelledby="new-resources-heading" className="space-y-4">
    <div>
      <h2 id="new-resources-heading" ref={heading} tabIndex={-1} className="min-w-0 break-words text-xl font-extrabold">{region.districtName} 관광자원</h2>
      <p className="text-sm text-muted">{region.name} 전체 · 현재 등록된 관광지·문화시설·음식점·숙박</p>
    </div>
    <div className="region-card space-y-3">
      <fieldset className="flex flex-wrap items-center gap-2">
        <legend className="sr-only">자원 유형</legend>
        {RESOURCE_KINDS.map(k => <button key={k} type="button" className="region-button" aria-pressed={types.includes(k)} onClick={() => toggleType(k)}>{KIND_LABEL[k]}</button>)}
      </fieldset>
      <AnchorControls anchor={anchor} radiusKm={radiusKm} sort={sort} onRadius={setRadiusKm} onSort={setSort}
        onClear={() => { setAnchor(null); setRadiusKm(null); setSort("name"); }} />
    </div>

    {types.length === 0 && <p className="region-card text-sm">볼 유형을 하나 이상 골라 주세요.</p>}
    {states.length > 0 && <>
      <ul className="space-y-1 text-sm">{states.map(({ kind, result, block: b }) => <li key={kind}>
        {!b ? <LoadState loading={result.loading} failure={result.failure} hasData={false} subject={`${KIND_LABEL[kind]} 목록을`} onRetry={result.retry} />
          : b.status === "unavailable" ? <span role="alert" className="inline-flex flex-wrap items-center gap-2 rounded-xl bg-coral-soft px-3 py-2">{KIND_LABEL[kind]} 목록을 불러오지 못했어요.<button type="button" className="region-button" onClick={result.retry}>다시 불러오기</button></span>
          : isStale(b) || (result.failure && result.data) ? <span role="alert" className="inline-flex flex-wrap items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-amber-950">{KIND_LABEL[kind]} 새 목록을 불러오지 못했어요. {timeLabel(b.collectedAt ?? result.data?.retrievedAt ?? null)} 목록이에요.<button type="button" className="region-button" onClick={result.retry}>다시 불러오기</button></span>
          : b.status === "empty" ? <span className="text-muted">{KIND_LABEL[kind]}: 조회한 등록 결과가 없어요</span>
          : <span>{KIND_LABEL[kind]} {b.total ?? b.items.length}건{result.loading ? " · 새 자료를 확인하고 있어요…" : ""}</span>}
      </li>)}</ul>
      {(allDone || items.length > 0) && <p className="text-sm text-muted" aria-live="polite">
        {allDone ? `조회 ${counts.returned}건` : `불러온 ${counts.returned}건`} · 지도 위치 있는 자원 {counts.withCoordinates}건
        {anchor && radiusKm !== null && counts.withinRadius !== null ? ` · 기준점 ${radiusKm}km 안 ${counts.withinRadius}건` : ""}
      </p>}
      <div className="flex gap-2 lg:hidden" role="group" aria-label="보기 방식">
        <button type="button" className="region-button" aria-pressed={display === "list"} onClick={() => setDisplay("list")}>목록</button>
        <button type="button" className="region-button" aria-pressed={display === "map"} onClick={() => setDisplay("map")}>지도</button>
      </div>
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className={`min-w-0 ${display === "map" ? "hidden lg:block" : ""}`}>
          {numbered.length > 0 ? <ResourceList rows={numbered} listRef={list} detailId={shownDetail?.id ?? null} comparedIds={new Set(compared.map(c => c.id))} anchored={!!anchor} onOpen={open} onCompare={toggleCompare} />
            : items.length > 0 ? <div className="region-card space-y-2 text-sm"><p>기준점 반경 안에 있는 자원이 없어요.</p>
              <button type="button" className="region-button" onClick={() => setRadiusKm(null)}>반경 해제</button></div>
            : allDone ? <div className="region-card space-y-2 text-sm"><p>선택한 유형에 조회된 자원이 없어요.</p>
              <Link className="region-button" href={chooseHref}>다른 지역 고르기</Link></div> : null}
        </div>
        <div className={`min-w-0 ${display === "list" ? "hidden lg:block" : ""}`}>
          {mapFailed ? <div role="alert" className="region-card space-y-2 text-sm"><p>지도를 불러오지 못했어요. 목록은 계속 볼 수 있어요.</p>
            <button type="button" className="region-button" onClick={() => { setMapFailed(false); setMapKey(k => k + 1); }}>지도 다시 열기</button></div>
            : mapRows.length ? <ResourceMap key={mapKey} rows={mapRows} selectedId={shownDetail?.id ?? null} anchor={anchor?.point ?? null} radiusKm={anchor ? radiusKm : null}
              highlightedIds={compared.map(c => c.id)} highlightLabel="함께 보기 중"
              onSelect={openById} onCenter={anchorMap} onFailure={() => setMapFailed(true)} />
            : allDone || items.length > 0 ? <p className="region-card text-sm text-muted">지도에 표시할 위치가 있는 자원이 없어요. 목록에서 확인해 주세요.</p> : null}
          {!mapFailed && mapRows.length > 0 && compared.some(c => visibleIds.has(c.id) && c.point) && <p className="mt-1 text-xs text-muted">굵은 테두리 번호: 함께 보기 중인 자원</p>}
        </div>
      </div>
    </>}
    {shownDetail && <ResourceDetailPanel region={region} item={shownDetail} heading={detailHeading} distance={distance(shownDetail)} anchored={!!anchor}
      hidden={hidden(shownDetail)} isAnchor={anchor?.resourceId === shownDetail.id} compared={compared.some(c => c.id === shownDetail.id)}
      onAnchor={() => anchorOn(shownDetail)} onCompare={() => toggleCompare(shownDetail)} onClose={closeDetail} />}
    <CompareResources region={region} items={shownCompared} hiddenIds={new Set(shownCompared.filter(hidden).map(i => i.id))} anchored={!!anchor} distances={new Map(shownCompared.map(i => [i.id, distance(i)]))}
      notice={notice} heading={compareHeading} onRemove={removeCompared} onOpen={open} />
    <div className="flex flex-wrap items-center gap-2">
      <InfoDialog label="관광자원 출처 보기" title="관광자원 출처">
        <p>한국관광공사 국문 관광정보 서비스의 지역 기반 목록(관광지·문화시설·음식점·숙박)이에요. 현재 등록 정보이며 운영 여부나 이용 조건은 각 시설에 확인해 주세요.</p>
        <ul className="list-disc pl-5">{states.map(({ kind, result, block: b }) => <li key={kind}>{KIND_LABEL[kind]} 목록: {!b || b.status === "unavailable" ? "불러오지 못함" : `${timeLabel(b.collectedAt)} 수집 · ${timeLabel(result.data?.retrievedAt ?? null)} 조회`}</li>)}</ul>
        <p>거리는 고른 기준점에서 잰 직선거리예요. 이동 시간이나 경로가 아니에요.</p>
        <p><a className="font-bold text-blue underline" href={SOURCE} target="_blank" rel="noreferrer">공공데이터포털 관광정보 서비스 ↗</a></p>
      </InfoDialog>
      <Link className="region-button" href={href("visits")}>지역 방문 흐름 보기</Link>
      <Link className="region-button" href={href("timing")}>개최 시기 보기</Link>
    </div>
  </section>;
}
