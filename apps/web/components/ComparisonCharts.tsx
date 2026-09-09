"use client";
import { useState } from "react";
import { addDays, composition, costReason, DAY, duration, overlaps, relativePoints, visitReason } from "@/lib/comparison/model";
import type { Edition, Selection, Source } from "@/lib/comparison/types";
const colors = ["#1649b8", "#995008", "#06736b"];
const dash = ["", "8 5", "2 5"];
export const number = (n: number | null) => n === null ? "미확보" : n.toLocaleString("ko-KR", { maximumFractionDigits: 2 });
export const offsetLabel = (n: number) => n === 0 ? "D0" : `D${n > 0 ? "+" : ""}${n}`;
const title = (e: Edition) => `${e.year} ${e.name}`;
export function SourceDetails({ source }: { source: Source }) {
  return <div className="break-words text-xs leading-6 text-muted"><a href={source.url} target="_blank" rel="noreferrer" className="font-bold text-blue underline">{source.title} ↗</a><p>확인 {source.checkedAt.slice(0,10)} · 게시 {source.publishedAt ?? "미확인"}</p><p>{source.note}</p>{source.sha256 && <details><summary className="cursor-pointer">원문 확인본 식별 정보</summary><p className="break-all">SHA-256: {source.sha256}</p></details>}</div>;
}
export function Availability({ editions }: { editions: Edition[] }) {
  const ref = editions.find(e => !visitReason(e));
  return <section className="region-card"><h2 className="text-xl font-extrabold">자료 확보 현황</h2><p className="my-3 text-sm text-muted">미확보 항목이 있어도 회차를 유지합니다. 아래 수치는 행사장 입장객이나 전체 축제 예산으로 바꾸어 해석하지 않습니다.</p><div className="overflow-x-auto"><table className="comparison-table"><caption className="sr-only">선택 회차별 일정·방문·비용 확보 현황</caption><thead><tr><th>회차</th><th>일정·상태</th><th>방문 추세</th><th>비용</th></tr></thead><tbody>{editions.map(e => <tr key={e.id}><th scope="row">{title(e)}<span className="mt-1 block font-normal">{e.region.name}</span></th><td>{e.start ? `${e.start} ~ ${e.end} · ${duration(e)}일` : "개최일 미확인"}<span className="mt-1 block">{e.status}</span></td><td>{visitReason(e, ref) ?? `${e.visits!.points.filter(p => p.value !== null).length}일 확보`}<span className="block text-xs">{e.visits ? e.visits.unit : "값을 0으로 채우지 않음"}</span></td><td>{e.costs.length ? `${e.costs.length}개 원문 금액 · 범위 확인 필요` : "미확보"}</td></tr>)}</tbody></table></div></section>;
}
export function ScheduleChart({ editions }: { editions: Edition[] }) {
  const years = [...new Set(editions.filter(e => e.start && e.end).map(e => e.year))].sort();
  const pairs = editions.flatMap((a, i) => editions.slice(i+1).map(b => ({ a, b, days: overlaps(a,b) })));
  return <section className="region-card space-y-4"><h2 className="text-xl font-extrabold">행사 일정 나란히 보기</h2><p className="text-sm text-muted">실제 날짜로 겹침을 확인합니다. 연도별로 나누며 각 연도의 표시 범위가 다릅니다. 현재 등록 정보의 실제 개최·취소 여부는 별도 확인이 필요합니다.</p>
    {years.map(year => {
      const rows = editions.filter(e => e.year === year && e.start && e.end), start = addDays(rows.map(e => e.start!).sort()[0], -3), end = addDays(rows.map(e => e.end!).sort().at(-1)!, 3), span = (Date.parse(end) - Date.parse(start)) / DAY + 1;
      return <div key={year} className="rounded-xl border border-ink/10 p-4"><h3 className="mb-3 font-bold">{year}년</h3><div className="mb-3 flex justify-between text-xs text-muted"><span>{start}</span><span>{end}</span></div>{rows.map(e => <div key={e.id} className="mb-4"><p className="mb-2 text-sm font-bold">{e.name} <span className="font-normal">· {e.start} ~ {e.end} · {duration(e)}일</span></p><div role="img" aria-label={`${title(e)} ${e.start}부터 ${e.end}까지, ${e.status}`} className="h-5 rounded bg-paper"><div style={{ marginLeft: `${(Date.parse(e.start!) - Date.parse(start))/DAY/span*100}%`, width: `${duration(e)!/span*100}%`, background: colors[editions.indexOf(e)] }} className="h-5 rounded border border-ink/30" /></div></div>)}</div>;
    })}
    {editions.filter(e => !e.start).map(e => <p key={e.id} className="rounded-xl bg-paper p-3 text-sm">{title(e)}: 개최일 미확인 · 일정 겹침 판단 보류</p>)}
    {pairs.map(({ a,b,days }) => <p key={`${a.id}-${b.id}`} className="text-sm"><strong>{title(a)} / {title(b)}</strong>: {days === null ? "일정 미확인 또는 취소 회차 · 겹침 판단 보류" : days ? `등록·확인 일정 ${days}일 겹침` : "확인한 일정은 겹치지 않음"}</p>)}
  </section>;
}
export function VisitComparison({ editions, onSave, initialRange, readOnly = false }: { readOnly?: boolean; editions: Edition[]; onSave?: (s: Selection) => void; initialRange?: { from: number; to: number } }) {
  const [axis, setAxis] = useState("relative"), [from,setFrom] = useState(initialRange?.from ?? -7), [to,setTo] = useState(initialRange?.to ?? 7);
  const reference = editions.find(e => !visitReason(e));
  const available = editions.filter(e => !visitReason(e,reference));
  const series = available.map(e => ({ e, points: relativePoints(e) }));
  const max = Math.max(20000, ...series.flatMap(s => s.points.map(p => p.value ?? 0))), top = Math.ceil(max/20000)*20000;
  const timestamps = series.flatMap(s => s.points.map(p => Date.parse(p.date))), first = Math.min(...timestamps), last = Math.max(...timestamps);
  const x = (p: { offset: number; date: string }) => 70 + (axis === "relative" ? (p.offset+7)/14 : (Date.parse(p.date)-first)/Math.max(DAY,last-first))*650;
  const y = (v: number) => 236-v/top*186;
  const offsets = Array.from({length:15}, (_,i)=>i-7);
  return <section className="region-card space-y-4"><h2 className="text-xl font-extrabold">개최 전후 방문 추세 비교</h2><p className="text-sm leading-7 text-muted">같은 지역·지표·단위·측정 방법의 보관값을 공통 축으로 표시합니다. 행사장 입장객·순방문객 합계·축제 효과가 아닙니다. 다른 지역의 미확보 값을 대신 채우지 않습니다.</p>
    {!available.length ? <p className="rounded-xl bg-paper p-4">선택 회차의 비교 가능한 방문 이력이 미확보 상태입니다.</p> : <>
      <p className="text-sm font-bold">{reference!.region.name} · {reference!.visits!.metric} · {reference!.visits!.unit}</p>
      <label className={readOnly ? "hidden" : "no-print block text-sm font-bold"}>그래프 날짜 기준<select className="workspace-input mt-2 max-w-xs" value={axis} onChange={e=>setAxis(e.target.value)}><option value="relative">행사 시작일 기준 (D0)</option><option value="calendar">실제 날짜 기준</option></select></label>
      <div className="flex flex-wrap gap-3 text-xs">{series.map(({e}) => <span key={e.id} className="font-bold" style={{color:colors[editions.indexOf(e)]}}>{["● 실선", "■ 긴 점선", "◆ 짧은 점선"][editions.indexOf(e)]} · {title(e)} · {duration(e)}일 개최</span>)}</div>
      <svg viewBox="0 0 760 290" className="w-full" role="img" aria-label="회차별 일별 외지인 방문 추세. 실제 날짜와 값은 아래 수치 표에서 확인할 수 있습니다.">
        {[0,.25,.5,.75,1].map(t=><g key={t}><line x1="70" x2="720" y1={y(top*t)} y2={y(top*t)} stroke="#cbd5e1"/><text x="62" y={y(top*t)+4} textAnchor="end" fontSize="12" fill="#475569">{number(top*t)}</text></g>)}
        {axis === "relative" ? [-7,-3,0,3,7].map(n=><text key={n} x={x({offset:n,date:""})} y="267" textAnchor="middle" fontSize="13" fill="#475569">{offsetLabel(n)}</text>) : [0,.25,.5,.75,1].map(t=><text key={t} x={70+t*650} y="267" textAnchor="middle" fontSize="10" fill="#475569">{new Date(first+(last-first)*t).toISOString().slice(0,10)}</text>)}
        {series.map(({e,points}) => {
          const segments:string[]=[]; let path="";
          points.forEach(p=>{ if(p.value===null){ if(path)segments.push(path);path=""; }else path+=`${path?"L":"M"}${x(p)},${y(p.value)}`; }); if(path)segments.push(path);
          const i=editions.indexOf(e);
          return <g key={e.id}>{segments.map((d,j)=><path key={j} d={d} fill="none" stroke={colors[i]} strokeWidth="3" strokeDasharray={dash[i]}/>)}{points.filter(p=>p.value!==null).map(p=><g key={p.offset} onClick={readOnly ? undefined : ()=>{setFrom(p.offset);setTo(p.offset);}} style={{cursor:readOnly ? "default" : "pointer"}}><title>{`${title(e)} · ${p.date} · ${offsetLabel(p.offset)} · ${number(p.value)}명`}</title>{i===1?<rect x={x(p)-3} y={y(p.value!)-3} width="6" height="6" fill={colors[i]}/>:i===2?<polygon points={`${x(p)},${y(p.value!)-4} ${x(p)+4},${y(p.value!)} ${x(p)},${y(p.value!)+4} ${x(p)-4},${y(p.value!)}`} fill={colors[i]}/>:<circle cx={x(p)} cy={y(p.value!)} r={p.offset>=from&&p.offset<=to?4:2.5} fill={colors[i]}/>}</g>)}</g>;
        })}
      </svg>
      <p className="text-xs text-muted">D0는 각 회차 시작일입니다. 결측은 선을 잇지 않습니다. {readOnly ? "보관한 선택 범위를 표시합니다." : "아래 날짜 선택으로 점이나 기간을 담을 수 있습니다."}</p>
      <div hidden={readOnly} className={readOnly ? "hidden" : "no-print grid gap-3 sm:grid-cols-3"}><label className="text-sm font-bold">선택 시작<select aria-label="선택 시작" className="workspace-input mt-2" value={from} onChange={e=>{const n=Number(e.target.value);setFrom(n);if(n>to)setTo(n);}}>{offsets.map(n=><option key={n} value={n}>{offsetLabel(n)}</option>)}</select></label><label className="text-sm font-bold">선택 끝<select aria-label="선택 끝" className="workspace-input mt-2" value={to} onChange={e=>{const n=Number(e.target.value);setTo(n);if(n<from)setFrom(n);}}>{offsets.map(n=><option key={n} value={n}>{offsetLabel(n)}</option>)}</select></label>{onSave&&<button className="region-primary self-end" onClick={()=>onSave({kind:"visits",from,to})}>선택한 방문 추세 담기</button>}</div>
      <p className="text-sm font-bold">선택 범위 {offsetLabel(from)} ~ {offsetLabel(to)} · 회차당 {to-from+1}일</p>
      <div className="max-h-96 overflow-auto"><table className="comparison-table"><caption className="mb-2 text-left text-sm font-bold">수치 표 · 실제 날짜와 원값 (명)</caption><thead><tr><th>상대 날짜</th>{series.map(({e})=><th key={e.id}>{title(e)}</th>)}</tr></thead><tbody>{offsets.filter(n=>n>=from&&n<=to).map(n=><tr key={n}><th scope="row">{offsetLabel(n)}</th>{series.map(({e,points})=>{const p=points.find(p=>p.offset===n)!;return <td key={e.id}>{p.date}<strong className="block">{number(p.value)}</strong>{e.start&&e.end&&p.date>=e.start&&p.date<=e.end&&<span className="region-tag">행사 기간</span>}</td>;})}</tr>)}</tbody></table></div>
      {series.map(({e})=><div key={e.id} className="border-t border-ink/10 pt-3"><p className="mb-1 text-sm font-bold">{title(e)} · {e.visits!.points[0]?.date} ~ {e.visits!.points.at(-1)?.date}</p><SourceDetails source={e.visits!.source}/><details className="text-xs leading-6 text-muted"><summary className="cursor-pointer">수집 시각·보관 식별자</summary><p className="break-all">수집 {e.visits!.collectedAt} · 보관 식별자 {e.visits!.snapshotId}</p></details></div>)}
    </>}
    {editions.filter(e=>visitReason(e,reference)).map(e=><p key={e.id} className="rounded-xl bg-paper p-3 text-sm">{title(e)}: {visitReason(e,reference)}</p>)}
  </section>;
}
export function CostCharts({ editions, onSave }: { editions: Edition[]; onSave?: (s: Selection)=>void }) {
  const all = editions.flatMap(e=>e.costs.map(c=>({e,c})));
  return <section className="region-card space-y-4"><h2 className="text-xl font-extrabold">비용 원문과 재원 구성</h2><p className="text-sm leading-7 text-muted">사업·범위·단계별 원문 금액입니다. 전체 축제 예산으로 통합하지 않습니다. 같은 문서의 계획·집행도 기재 금액을 보여주며 확정 예산 대비 효율로 해석하지 않습니다.</p>
    {editions.map(e=><div key={e.id} className="space-y-4 rounded-xl border border-ink/10 p-4"><h3 className="font-extrabold">{title(e)}</h3>{!e.costs.length?<p className="text-sm text-muted">비용 자료 미확보 · 0원으로 표시하지 않습니다.</p>:<>
      <div className="space-y-4" role="group" aria-label={`${title(e)} 비용 막대그래프`}>{e.costs.map(c=><div key={c.id}><p className="mb-1 text-sm font-bold">{c.label} · {number(c.amount)}원</p><div className="h-6 rounded bg-paper"><div className="h-6 rounded bg-blue" style={{width:`${c.amount/Math.max(1,...e.costs.map(c=>c.amount))*100}%`}}/></div></div>)}<p className="text-xs text-muted">0원 기준 · 이 회차의 원문 금액 안에서 공통 축 사용 · 명목 금액</p></div>
      {e.costs.map(c=>{const parts=composition(c);let running=0;const stops=parts?.map((p,i)=>{const start=running;running+=p.share*100;return `${colors[i%3]} ${start}% ${running}%`;});return <div key={c.id} className="space-y-3 border-t border-ink/10 pt-4"><h4 className="font-bold">{c.label}</h4><p className="text-xs leading-6">{c.year}년 · {c.stage} · 부가세 {c.vat}<br/>{c.scope}<br/>작성 부서·기관: {c.department}</p>
        {parts?<div className="grid items-center gap-4 sm:grid-cols-[180px_1fr]"><div role="img" aria-label={`${c.label} 재원 구성: ${parts.map(p=>`${p.label} ${number(p.amount)}원 ${(p.share*100).toFixed(1)}%`).join(", ")}`} className="mx-auto flex h-40 w-40 items-center justify-center rounded-full" style={{background:`conic-gradient(${stops!.join(",")})`}}><div className="flex h-28 w-28 items-center justify-center rounded-full bg-white p-2 text-center text-xs font-bold">{number(c.amount)}원<br/>해당 지원사업</div></div><table className="comparison-table"><caption className="sr-only">{c.label} 재원별 원금액과 구성비</caption><thead><tr><th>재원</th><th>원</th><th>비율</th></tr></thead><tbody>{parts.map(p=><tr key={p.label}><th scope="row">{p.label}</th><td>{number(p.amount)}</td><td>{(p.share*100).toFixed(1)}%</td></tr>)}</tbody></table><p className="text-xs text-muted sm:col-span-2">분모 {number(c.amount)}원 · 재원 합계와 일치 · 소수 첫째 자리 반올림. 재원과 지출을 합친 구성이 아닙니다.</p></div>:<p className="rounded-xl bg-paper p-3 text-sm">전체 분모·중복 없는 항목 구성이 확인되지 않아 구성비는 그리지 않습니다.</p>}
        <SourceDetails source={c.source}/>{onSave&&<button className="region-button no-print" onClick={()=>onSave({kind:"cost",editionId:e.id,costId:c.id})}>{c.label} 근거 담기</button>}
      </div>;})}
    </>}</div>)}
    {all.flatMap((a,i)=>all.slice(i+1).map(b=>({a,b,reason:costReason(a.c,b.c)}))).filter(p=>p.reason).map(({a,b,reason})=><p key={`${a.c.id}-${b.c.id}`} className="rounded-xl bg-paper p-3 text-sm"><strong>{a.c.label} / {b.c.label}</strong><br/>{reason}</p>)}
  </section>;
}
