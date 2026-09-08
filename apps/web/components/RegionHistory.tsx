"use client";
import { lineSegments } from "@/lib/region/model";
import type { History } from "@/lib/region/types";
export function RegionHistory({ history, region, selected, onSelect }: { history: History; region: string; selected: string; onSelect: (date: string) => void }) {
  const points = history.points, max = Math.max(10000, Math.ceil(Math.max(0, ...points.map(p => p.value ?? 0)) / 10000) * 10000);
  const x = (i: number) => 65 + i * 615 / Math.max(1, points.length - 1), y = (v: number) => 220 - v / max * 180;
  const count = points.filter(p => p.value !== null).length;
  return <section className="region-card space-y-3" aria-label="지역 방문 추세">
    <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-xl font-extrabold">{region} 방문 추세</h2><span className="region-tag">확보 {count}일 / 선택 {points.length}일</span></div>
    <p className="text-sm text-muted">{history.metric} · {history.unit}</p>
    {history.status === "available" ? <svg viewBox="0 0 720 270" role="img" aria-label={`${region} 일별 외지인 방문 선그래프. 아래 수치 표에서 각 날짜를 선택할 수 있습니다.`} className="w-full">
      {[0, .5, 1].map(r => <g key={r}><line x1={65} x2={680} y1={y(max * r)} y2={y(max * r)} stroke="#d5dce3" /><text x={57} y={y(max * r) + 5} fontSize={13} textAnchor="end" fill="#4b5b6d">{(max * r).toLocaleString("ko-KR")}</text></g>)}
      {lineSegments(points, x, y).map((d, i) => <path key={i} d={d} fill="none" stroke="#2667e8" strokeWidth={2.5} />)}
      {points.map((p, i) => p.value !== null && <circle key={p.date} cx={x(i)} cy={y(p.value)} r={selected === p.date ? 6 : 3} fill={selected === p.date ? "#ae2e20" : "#2667e8"} onClick={() => onSelect(p.date)} className="cursor-pointer"><title>{p.date} · {p.value.toLocaleString("ko-KR")}명</title></circle>)}
      <text x={65} y={250} fontSize={13} fill="#4b5b6d">{points[0]?.date}</text><text x={680} y={250} textAnchor="end" fontSize={13} fill="#4b5b6d">{points.at(-1)?.date}</text>
    </svg> : <p className="rounded-xl bg-paper p-5 font-bold">선택 지역·기간의 방문 이력이 미확보 상태입니다.</p>}
    <p className="text-xs leading-6 text-muted">{history.message} 누락은 0으로 바꾸거나 선으로 연결하지 않습니다. 이 통계는 지도 영역·관광자원 종류로 분할되지 않습니다.</p>
    <details><summary className="cursor-pointer text-sm font-bold">수치 표와 날짜별 출처 보기</summary><div className="mt-3 max-h-80 overflow-auto"><table className="w-full text-left text-xs"><caption className="sr-only">{region} 방문 이력과 선택 당시 원천 식별자</caption><thead><tr><th className="p-2">관측일</th><th className="p-2">외지인 방문</th><th className="p-2">자료 확인</th></tr></thead><tbody>{points.map(p => <tr key={p.date} className="border-t border-ink/10"><td className="p-2"><button className="font-bold text-blue underline" onClick={() => onSelect(p.date)}>{p.date}</button></td><td className="p-2">{p.value === null ? "미확보" : p.value.toLocaleString("ko-KR")}</td><td className="p-2">{p.collectedAt?.slice(0, 10) ?? "—"}<span className="block max-w-36 truncate" title={p.snapshotId ?? ""}>{p.snapshotId?.slice(0, 12) ?? "원천 없음"}</span></td></tr>)}</tbody></table></div></details>
    <a className="text-xs font-bold text-blue underline" href={history.source} target="_blank" rel="noreferrer">한국관광공사 지역 방문자 자료 출처 ↗</a>
  </section>;
}
