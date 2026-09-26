"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { isStale } from "@/components/existing/blocks";
import { timeLabel } from "@/components/existing/format";
import type { Anchor } from "@/components/existing/memory";
import type { MapRow } from "@/components/existing/ResourceMap";
import { InfoDialog } from "@/components/existing/ui";
import { useResourceLists } from "@/components/resources/useResourceLists";
import { AreaNote, CountLine, focusAfterDetail, KindPicker, KindStatusList, ListMapGrid, ViewToggle, WORKSPACE_ROOT } from "@/components/resources/ResourceWorkspace";
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
  const kindStates = states.map(({ kind, result, block }) => ({ kind, request: result, block }));
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
  function open(item: ResourceItem) {
    // Choosing the place that is already open again (list, map or comparison) still takes the reader to its detail.
    if (detail && detail.id === item.id && detail.kind === item.kind) { setDetail(item); detailHeading.current?.focus(); return; }
    focusDetail.current = true; setDetail(item);
  }
  function openById(id: string) { const item = items.find(i => i.id === id); if (item) open(item); }
  function closeDetail() {
    const id = detail?.id; setDetail(null);
    requestAnimationFrame(() => focusAfterDetail(heading.current, id));
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

  return <section aria-labelledby="new-resources-heading" className={WORKSPACE_ROOT}>
    <div className="space-y-1">
      <h2 id="new-resources-heading" ref={heading} tabIndex={-1} className="min-w-0 break-words text-xl font-extrabold sm:text-2xl">{region.districtName} 관광자원</h2>
      <p className="text-sm text-muted">{region.name} 전체 · 현재 등록된 관광지·문화시설·음식점·숙박</p>
    </div>
    <div className="region-card space-y-3">
      <KindPicker types={types} states={kindStates} onToggle={toggleType} />
      {types.length === 0 ? <p className="text-[15px]">볼 유형을 하나 이상 골라 주세요.</p>
        : <KindStatusList states={kindStates} />}
      <AnchorControls anchor={anchor} radiusKm={radiusKm} sort={sort} onRadius={setRadiusKm} onSort={setSort}
        onClear={() => { setAnchor(null); setRadiusKm(null); setSort("name"); }} />
      {states.length > 0 && (allDone || items.length > 0) && <CountLine listed={numbered.length} mapped={mapRows.length}
        radius={anchor && radiusKm !== null && counts.withinRadius !== null ? { km: radiusKm, inside: counts.withinRadius, unknown: numbered.length - counts.withinRadius } : null} />}
    </div>

    {states.length > 0 && <>
      <ViewToggle display={display} onChange={setDisplay} />
      <ListMapGrid display={display}
        list={numbered.length > 0 ? <ResourceList rows={numbered} listRef={list} detailId={shownDetail?.id ?? null} comparedIds={new Set(compared.map(c => c.id))} anchored={!!anchor} onOpen={open} onCompare={toggleCompare} />
          : items.length > 0 ? <AreaNote action={<button type="button" className="region-button min-h-11" onClick={() => setRadiusKm(null)}>반경 해제</button>}>기준점 반경 안에 있는 자원이 없어요.</AreaNote>
          : allDone ? <AreaNote action={<Link className="region-button min-h-11" href={chooseHref}>다른 지역 고르기</Link>}>선택한 유형에 조회된 자원이 없어요.</AreaNote> : null}
        map={<>
          {mapFailed ? <AreaNote alert action={<button type="button" className="region-button min-h-11" onClick={() => { setMapFailed(false); setMapKey(k => k + 1); }}>지도 다시 열기</button>}>지도를 불러오지 못했어요. 목록은 계속 볼 수 있어요.</AreaNote>
            : mapRows.length ? <ResourceMap key={mapKey} rows={mapRows} selectedId={shownDetail?.id ?? null} anchor={anchor?.point ?? null} radiusKm={anchor ? radiusKm : null}
              highlightedIds={compared.map(c => c.id)} highlightLabel="함께 보기 중"
              onSelect={openById} onCenter={anchorMap} onFailure={() => setMapFailed(true)} />
            : allDone || items.length > 0 ? <AreaNote muted>지도에 표시할 위치가 있는 자원이 없어요. 목록에서 확인해 주세요.</AreaNote> : null}
          {!mapFailed && mapRows.length > 0 && compared.some(c => visibleIds.has(c.id) && c.point) && <p className="mt-2 text-[13px] text-muted">굵은 테두리 번호: 함께 보기 중인 자원</p>}
        </>} />
    </>}
    {shownDetail && <ResourceDetailPanel region={region} item={shownDetail} heading={detailHeading} distance={distance(shownDetail)} anchored={!!anchor}
      hidden={hidden(shownDetail)} isAnchor={anchor?.resourceId === shownDetail.id} compared={compared.some(c => c.id === shownDetail.id)}
      onAnchor={() => anchorOn(shownDetail)} onCompare={() => toggleCompare(shownDetail)} onClose={closeDetail} />}
    <CompareResources region={region} items={shownCompared} hiddenIds={new Set(shownCompared.filter(hidden).map(i => i.id))} anchored={!!anchor} distances={new Map(shownCompared.map(i => [i.id, distance(i)]))}
      notice={notice} heading={compareHeading} onRemove={removeCompared} onOpen={open} />
    <div className="flex flex-wrap items-center gap-2">
      <InfoDialog label="관광자원 출처 보기" title="관광자원 출처" buttonClassName="region-button min-h-11">
        <p>한국관광공사 국문 관광정보 서비스의 지역 기반 목록(관광지·문화시설·음식점·숙박)이에요. 현재 등록 정보이며 운영 여부나 이용 조건은 각 시설에 확인해 주세요.</p>
        <ul className="list-disc pl-5">{states.map(({ kind, result, block: b }) => <li key={kind}>{KIND_LABEL[kind]} 목록: {!b || b.status === "unavailable" ? "불러오지 못함" : `${timeLabel(b.collectedAt)} 수집 · ${timeLabel(result.data?.retrievedAt ?? null)} 조회`}</li>)}</ul>
        <p>거리는 고른 기준점에서 잰 직선거리예요. 이동 시간이나 경로가 아니에요.</p>
        <p><a className="font-bold text-blue underline" href={SOURCE} target="_blank" rel="noreferrer">공공데이터포털 관광정보 서비스 ↗</a></p>
      </InfoDialog>
      <Link className="region-button min-h-11" href={href("visits")}>지역 방문 흐름 보기</Link>
      <Link className="region-button min-h-11" href={href("timing")}>개최 시기 보기</Link>
    </div>
  </section>;
}
