import type { DistanceCondition, Edition, SearchContext } from "@/lib/comparison/types";
import { distanceLabel, distanceRows, validPoint } from "@/lib/comparison/distance";

export function DistanceControls({ items, condition, onChange, disabled }: { items: Edition[]; condition: SearchContext["distance"]; onChange: (value: SearchContext["distance"]) => void; disabled: boolean }) {
  const located = items.filter(e => validPoint(e.point));
  return <fieldset disabled={disabled} className="no-print rounded-xl border border-ink/10 p-4 space-y-3"><legend className="px-1 font-bold">조회한 행사 거리 비교</legend>
    <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm font-bold">거리 기준 행사<select aria-label="거리 기준 행사" className="workspace-input mt-2" value={condition?.anchor.editionId ?? ""} onChange={event => {
      const e = located.find(e => e.id === event.target.value);
      onChange(e?.point ? { method: "haversine-v1", anchor: { editionId: e.id, name: e.name, point: { ...e.point }, source: { ...e.source } }, radiusKm: condition?.radiusKm ?? null } : undefined);
    }}><option value="">거리 비교 안 함</option>{condition && !located.some(e => e.id === condition.anchor.editionId) && <option value={condition.anchor.editionId}>{condition.anchor.name} · 이전 조회 기준 유지</option>}{located.map(e => <option key={e.id} value={e.id}>{e.name} · {e.region.name}</option>)}</select></label>
    <label className="text-sm font-bold">직선거리 반경<select aria-label="직선거리 반경" className="workspace-input mt-2" disabled={!condition} value={condition?.radiusKm ?? ""} onChange={e => { if (condition) onChange({ ...condition, radiusKm: e.target.value ? Number(e.target.value) : null }); }}><option value="">제한 없이 가까운 순</option>{[10,30,50,100].map(km => <option key={km} value={km}>{km}km 이내 + 거리 미확인</option>)}</select></label></div>
    <p className="text-xs leading-6 text-muted">조회한 지역 자료에만 적용하며 추가 조회는 하지 않습니다. 전국 반경 전수 검색·주변 지역 자동 추천은 제공하지 않습니다. 기준 행사도 포함합니다. 좌표가 없으면 거리 미확인으로 남깁니다. 재조회 후에도 선택 당시 기준 좌표를 유지하며, 해제 후 다시 선택하면 갱신합니다.</p>
    {!located.length && <p className="text-sm">조회한 행사 중 거리 기준으로 선택할 좌표가 없습니다.</p>}
  </fieldset>;
}

export function DistanceChart({ query, editions }: { query: SearchContext; editions: Edition[] }) {
  const d: DistanceCondition | undefined = query.distance;
  if (query.mode !== "current" || !d) return null;
  const rows = distanceRows(editions, d), located = rows.filter(r => r.km !== null), unknown = rows.length - located.length;
  const max = d.radiusKm ?? Math.max(1, ...located.map(r => r.km!));
  return <section aria-label="기준 행사와 직선거리" className="rounded-xl border border-ink/10 p-4 space-y-3 text-sm">
    <h3 className="font-bold">기준 행사와 직선거리</h3><p>거리 기준: <strong>{d.anchor.name}</strong> · {d.radiusKm === null ? "반경 제한 없음" : `${d.radiusKm}km 이내`}</p>
    <p className="text-xs leading-6 text-muted">등록 좌표 사이의 대략적인 직선거리입니다. 도로 이동거리·시간이나 행사장 범위를 뜻하지 않습니다. 반경 판정은 반올림 전 값을 사용합니다.</p>
    <p>거리 확인 {located.length}건 · 거리 미확인 {unknown}건 · 반경 밖 {editions.length - rows.length}건 제외</p>
    <div className="space-y-3">{rows.slice(0,20).map(({edition:e,km}) => <div key={e.id}><p className="font-bold">{e.name}</p><p>{distanceLabel(km)}{e.id === d.anchor.editionId ? " · 기준 행사" : ""}</p>{km !== null && <div aria-hidden="true" className="mt-1 h-3 rounded bg-paper"><div className="h-3 rounded bg-blue" style={{width:`${Math.min(100,km/max*100)}%`}} /></div>}</div>)}</div>
    {rows.length > 20 && <p className="text-xs">거리 그림은 최대 20건이며 전체 결과는 목록에 유지합니다.</p>}
    <details className="text-xs leading-6"><summary className="cursor-pointer text-blue underline">거리 기준 좌표·출처 확인</summary><p>위도 {d.anchor.point.latitude} · 경도 {d.anchor.point.longitude}<br/>기준 자료 확인 {d.anchor.source.checkedAt}<br/>구면 직선거리 계산 v1 · 지구 반지름 6,371km</p><a href={d.anchor.source.url} target="_blank" rel="noreferrer" className="text-blue underline">{d.anchor.source.title} ↗</a><p>{d.anchor.source.note}</p><p>비교 좌표는 각 행사 원문에 보관된 조회 당시 값입니다. 같은 좌표도 같은 행사장 사용을 증명하지 않습니다.</p></details>
  </section>;
}
