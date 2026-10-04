"use client";
import { Route } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { monthTitle, timeLabel } from "@/components/existing/format";
import { InfoDialog, LoadState } from "@/components/existing/ui";
import { useKeyedRequest } from "@/components/existing/useKeyedRequest";
import { IconBadge } from "@/components/guide/icons";
import { Segmented } from "@/components/Segmented";
import type { RegionRef } from "@/lib/existing/types";
import { parseRelated, relatedKey } from "@/lib/kto-signals/request";
import type { RelatedCategory, RelatedSpots as Related } from "@/lib/kto-signals/types";

const TOP = 10;
type Filter = "all" | RelatedCategory;
const CATEGORY_STYLE: Readonly<Record<RelatedCategory, string>> = { 관광지: "bg-teal-soft text-[#11564f]", 음식: "bg-coral-soft text-[#9a2f1f]", 숙박: "bg-blue-soft text-[#164ea1]" };

/** Navigation-based spots searched together with the district's center spots in one month (TarRlteTarService1). */
export function RelatedSpots({ region }: { region: RegionRef }) {
  const [month, setMonth] = useState<string | null>(null);
  const params = new URLSearchParams({ province: region.province, district: region.district, ...(month ? { month } : {}) });
  const key = (() => { try { return relatedKey(parseRelated(params)); } catch { return null; } })();
  const result = useKeyedRequest<Related>(key ? `/api/signals/related?${params}` : null, undefined, key);
  const data = result.data && result.data.region.code === region.code ? result.data : null;
  const [center, setCenter] = useState(0), [filter, setFilter] = useState<Filter>("all"), [all, setAll] = useState(false);
  const [draft, setDraft] = useState("");
  useEffect(() => { setCenter(0); setFilter("all"); setAll(false); }, [data?.month, region.code]);
  useEffect(() => { if (data) setDraft(data.month); }, [data]);
  // A region change returns to the newest month.
  useEffect(() => { setMonth(null); }, [region.code]);
  function apply(event: FormEvent) { event.preventDefault(); if (draft && draft !== data?.month) setMonth(draft); }

  const current = data?.centers[center] ?? data?.centers[0] ?? null;
  const items = current ? current.items.filter(i => filter === "all" || i.category === filter) : [];
  const shown = all ? items : items.slice(0, TOP);
  const count = (c: RelatedCategory) => current?.items.filter(i => i.category === c).length ?? 0;
  return <section aria-labelledby="related-heading" className="region-card space-y-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex min-w-0 items-start gap-3">
        <IconBadge icon={Route} tone="teal" />
        <div className="min-w-0">
          <h3 id="related-heading" className="text-lg font-extrabold">함께 찾는 곳</h3>
          <p className="text-sm text-muted">{region.districtName} 중심 관광지를 찾은 뒤 내비게이션으로 이어서 찾은 곳 · 한국관광공사(티맵 자료){data?.status === "complete" ? ` · ${monthTitle(data.month)}` : ""}</p>
        </div>
      </div>
      <Criteria data={data} />
    </div>
    {data && data.months.length > 0 && <form onSubmit={apply} className="flex flex-wrap items-end gap-2">
      <label className="text-sm font-bold" htmlFor="related-month">기준 달
        <select id="related-month" className="workspace-input mt-1 block" value={draft} onChange={e => setDraft(e.target.value)}>
          {data.months.map(m => <option key={m} value={m}>{monthTitle(m)}</option>)}
        </select>
      </label>
      <button type="submit" className="region-button" disabled={!draft || draft === data.month}>달 보기</button>
    </form>}
    <LoadState loading={result.loading} failure={result.failure} hasData={!!data} retrievedAt={data?.retrievedAt} subject="함께 찾는 곳을" onRetry={result.retry} retryLabel="함께 찾는 곳 다시 불러오기" />
    {data?.status === "unavailable" && <p role="alert" className="flex flex-wrap items-center gap-2 rounded-xl bg-coral-soft p-3 text-sm">지금은 함께 찾는 곳을 불러올 수 없어요.<button type="button" className="region-button" onClick={result.retry}>함께 찾는 곳 다시 불러오기</button></p>}
    {data?.status === "empty" && <p className="rounded-xl bg-paper p-3 text-sm">{monthTitle(data.month)}에는 이 지역의 자료가 없어요. 다른 달을 골라 보세요.</p>}
    {data?.status === "complete" && current && <>
      <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
        <label className="text-sm font-bold" htmlFor="related-center">중심 관광지
          <select id="related-center" className="workspace-input mt-1 block max-w-full" value={center} onChange={e => { setCenter(Number(e.target.value)); setFilter("all"); setAll(false); }}>
            {data.centers.map((c, i) => <option key={`${c.name}-${i}`} value={i}>{c.name} ({c.items.length}곳)</option>)}
          </select>
        </label>
        <Segmented label="유형" value={filter} onChange={v => { setFilter(v); setAll(false); }} columns="grid-cols-4"
          options={[{ value: "all", label: `전체 ${current.items.length}` }, ...(["관광지", "음식", "숙박"] as const).map(c => ({ value: c as Filter, label: `${c} ${count(c)}` }))]} />
      </div>
      {items.length === 0 ? <p className="rounded-xl bg-paper p-3 text-sm">이 유형으로 함께 찾은 곳이 없어요.</p>
        : <ol aria-label={`${current.name} · 함께 찾은 곳`} className="grid gap-1.5 sm:grid-cols-2">
          {shown.map(i => <li key={`${i.rank}-${i.name}`} className="grid min-w-0 grid-cols-[2.5rem_minmax(0,1fr)] gap-2 rounded-xl border border-ink/10 bg-white px-3 py-2 text-sm">
            <span className={`font-extrabold tabular-nums ${i.rank <= 3 ? "text-blue" : ""}`}>{i.rank}위</span>
            <span className="min-w-0">
              <span className="block break-words font-bold">{i.name}</span>
              <span className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted">
                <span className={`rounded-full px-1.5 py-0.5 font-bold ${CATEGORY_STYLE[i.category]}`}>{i.category}</span>
                {i.detail && i.detail !== i.category && <span>{i.detail}</span>}
                {i.place && i.place !== region.districtName && <span>· {i.place}</span>}
              </span>
            </span>
          </li>)}
        </ol>}
      {items.length > TOP && <button type="button" className="region-button" aria-expanded={all} onClick={() => setAll(!all)}>{all ? `상위 ${TOP}곳만 보기` : `${items.length}곳 모두 보기`}</button>}
    </>}
  </section>;
}

function Criteria({ data }: { data: Related | null }) {
  return <InfoDialog label="기준" title="함께 찾는 곳의 기준" buttonClassName="region-button min-h-8 px-2 py-1 text-xs">
    <ul className="list-disc space-y-2 pl-5">
      <li>한국관광공사가 티맵 내비게이션 자료로 지역의 중심 관광지와 이어서 많이 찾은 곳을 순위로 낸 정보예요.</li>
      <li>목적지를 조회하고 100m·1분 이상 실제로 이동한 경우만 세요. 차량 이동 기준이라 실제로 함께 방문한 정도나 사람 수와 다를 수 있어요.</li>
      <li>유형별(관광지·음식·숙박)로 최대 50위까지 주고, 순위는 공사 원문 그대로예요. 달마다 바뀌며 두 달쯤 늦게 공개돼요.</li>
    </ul>
    <p>자료: <a className="font-bold text-blue underline" href="https://www.data.go.kr/data/15128560/openapi.do" target="_blank" rel="noreferrer">한국관광공사 관광지별 연관 관광지 정보 ↗</a>{data?.source ? ` · ${timeLabel(data.source.collectedAt)} 조회` : ""}</p>
  </InfoDialog>;
}
