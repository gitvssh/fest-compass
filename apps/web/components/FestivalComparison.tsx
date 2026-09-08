"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { REGIONS } from "@/lib/region/model";
import type { RegionResult } from "@/lib/region/types";
import { currentEditions, filterEditions, validRange } from "@/lib/comparison/model";
import { makeComparison, storeComparisons } from "@/lib/comparison/evidence";
import type { Edition, SearchContext, Selection } from "@/lib/comparison/types";
import { Availability, CostCharts, ScheduleChart, SourceDetails, VisitComparison } from "./ComparisonCharts";
const provinces = [...new Map(REGIONS.map(r=>[r.provinceCode,r.provinceName])).entries()];
const keyName = (key: string) => { const r=REGIONS.find(r=>`${r.provinceCode}/${r.districtCode}`===key);return r?`${r.provinceName} ${r.districtName}`:key; };
export function FestivalComparison({ catalogue, initial, year }: { catalogue: Edition[]; initial: SearchContext; year: number }) {
  const [draft,setDraft]=useState(initial), [applied,setApplied]=useState(initial), [request,setRequest]=useState<SearchContext|null>(initial.mode==="current"?initial:null);
  const [province,setProvince]=useState(initial.regions[0]?.split("/")[0]??""),[district,setDistrict]=useState("");
  const [results,setResults]=useState<RegionResult[]>([]),[loading,setLoading]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState(""),[note,setNote]=useState("");
  const [selected,setSelected]=useState<Edition[]>(initial.mode==="archive"&&!initial.regions.length?catalogue.filter(e=>["nonsan-strawberry-2024","nonsan-strawberry-2025"].includes(e.id)).map(e=>({...e,discoveredWith:initial})):[]);
  const serial=useRef(0), board=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    if(!request)return;
    const controller=new AbortController(), current=++serial.current;
    setLoading(true);setResults([]);setError("");
    void (async()=>{
      const loaded:RegionResult[]=[];
      for(const key of request.regions){
        if(controller.signal.aborted)return;
        const [p,d]=key.split("/");
        try{
          const response=await fetch(`/api/regions?${new URLSearchParams({province:p,district:d,start:request.start,end:request.end,kind:"15"})}`,{signal:controller.signal});
          if(!response.ok)throw new Error();
          const data:RegionResult=await response.json();
          if(data.query.province!==p||data.query.district!==d||data.query.kind!=="15"||data.query.start!==request.start||data.query.end!==request.end)throw new Error();
          loaded.push(data);
          if(current===serial.current)setResults([...loaded]);
        }catch{
          if(current===serial.current&&!controller.signal.aborted)setError("일부 지역을 조회하지 못했습니다. 성공한 지역은 유지하며 아래 완료 상태를 확인하세요.");
        }
      }
      if(current===serial.current)setLoading(false);
    })();
    return()=>controller.abort();
  },[request]);
  function search(q=draft){
    try{validRange(q.start,q.end,q.mode==="current");if(q.mode==="current"&&!q.regions.length)throw new Error("현재 등록 행사를 조회할 지역을 1~3곳 선택하세요.");
      const next={...q,queriedAt:q.mode==="current"?new Date().toISOString():null};
      serial.current++;setRequest(null);setResults([]);setLoading(false);setError("");setApplied(next);setDraft(next);if(next.mode==="current")setRequest(next);
    }catch(e){setError(e instanceof Error?e.message:"조회 조건을 확인하세요.");}
  }
  function changeMode(mode: SearchContext["mode"]){
    serial.current++;setRequest(null);setResults([]);setLoading(false);setError("");
    const next:SearchContext={...draft,mode,start:mode==="archive"?"2022-01-01":`${year}-01-01`,end:mode==="archive"?"2025-12-31":`${year}-12-31`,theme:"",dateRule:mode==="archive"?"overlap":"starts-within",queriedAt:null};setDraft(next);setApplied(next);
  }
  function example(ids:string[]){
    const q:SearchContext={mode:"archive",regions:[],start:"2022-01-01",end:"2025-12-31",keyword:"",theme:"",dateRule:"overlap",queriedAt:null};
    search(q);setSelected(catalogue.filter(e=>ids.includes(e.id)).map(e=>({...e,discoveredWith:q})));setNotice("");setNote("");
  }
  function select(e:Edition){
    if(selected.some(s=>s.id===e.id)){setSelected(selected.filter(s=>s.id!==e.id));return;}
    if(selected.length>=3){setNotice("회차는 최대 3개까지 비교할 수 있습니다. 선택한 회차를 먼저 빼세요.");return;}
    setSelected([...selected,JSON.parse(JSON.stringify({...e,discoveredWith:applied}))]);setNotice("");
  }
  async function save(selection:Selection){
    try{const e=await makeComparison(selected,applied,selection,note),saved=storeComparisons([e]);setNotice(saved.added?"축제 비교를 기획 근거에 담았습니다. 당시 값과 출처를 보관합니다.":"같은 비교와 선택 범위를 이미 담았습니다. 기존 근거를 유지합니다.");}
    catch(e){setNotice(e instanceof Error?e.message:"저장하지 못했습니다. 브라우저 저장 공간을 확인하세요.");}
  }
  const found=filterEditions(applied.mode==="archive"?catalogue:results.flatMap(currentEditions),applied);
  const children=REGIONS.filter(r=>r.provinceCode===province);
  return <div className="space-y-6"><header className="space-y-3"><p className="text-xs font-extrabold text-blue">지역 자료 → 축제 비교 → 기획 근거</p><h1 className="text-3xl font-extrabold">주변·과거 축제 비교</h1><p className="max-w-3xl text-sm leading-7 text-muted">회차를 골라 일정과 방문 흐름, 비용 자료를 비교하세요. 원문이 확인된 과거 자료와 현재 등록 정보를 구분하고, 판단에 쓴 자료를 담아둡니다.</p><div className="no-print flex flex-wrap gap-2"><Link href="/regions" className="region-button">전국 관광지도</Link><Link href="/evidence#comparisons" className="region-button">담은 비교 근거</Link><button className="region-button" onClick={()=>window.print()}>비교 화면 인쇄</button></div></header>
    <section className="region-card no-print space-y-4"><h2 className="font-extrabold">확보된 자료로 살펴보기</h2><div className="flex flex-wrap gap-2"><button className="region-button" onClick={()=>example(["nonsan-strawberry-2023","nonsan-strawberry-2024","nonsan-strawberry-2025"])}>논산 3회차 방문 비교</button><button className="region-button" onClick={()=>example(["wonju-peach-2022-21"])}>원주 계획·집행 보기</button><button className="region-button" onClick={()=>example(["baekje-gongju-2024","imsil-cheese-2024"])}>공주·임실 일정 비교</button></div><p className="text-xs text-muted">논산·임실·공주·원주의 8회차를 연결했습니다. 전국의 모든 과거 개최 기록을 확보한 목록은 아닙니다.</p></section>
    <div className="region-card no-print sticky top-32 z-20 border border-blue/20 shadow-card"><div className="flex flex-wrap items-center gap-2"><strong>비교 {selected.length}/3회차</strong>{selected.map(e=><button key={e.id} className="region-tag" onClick={()=>setSelected(selected.filter(s=>s.id!==e.id))}>{e.year} {e.name} 빼기 ×</button>)}<button className="region-button" disabled={!selected.length} onClick={()=>board.current?.scrollIntoView({behavior:"smooth",block:"start"})}>그래프 보기 ↓</button><button className="region-button" disabled={!selected.length} onClick={()=>setSelected([])}>선택 비우기</button></div></div>
    <section className="region-card no-print space-y-4"><h2 className="text-xl font-extrabold">비교할 회차 찾기</h2><div className="flex flex-wrap gap-2" role="group" aria-label="자료 종류"><button className="region-button" aria-pressed={draft.mode==="archive"} onClick={()=>changeMode("archive")}>출처가 있는 과거 회차</button><button className="region-button" aria-pressed={draft.mode==="current"} onClick={()=>changeMode("current")}>현재 등록 행사 조회</button></div>
      <form onSubmit={e=>{e.preventDefault();search();}} className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3"><label className="text-sm font-bold">시도<select className="workspace-input mt-2" value={province} onChange={e=>{setProvince(e.target.value);setDistrict("");}}><option value="">시도 선택</option>{provinces.map(([code,name])=><option key={code} value={code}>{name}</option>)}</select></label><label className="text-sm font-bold">시군구<select className="workspace-input mt-2" disabled={!province} value={district} onChange={e=>setDistrict(e.target.value)}><option value="">시군구 선택</option>{children.map(r=><option key={r.districtCode} value={r.districtCode}>{r.districtName}</option>)}</select></label><button type="button" className="region-button self-end" disabled={!district||draft.regions.includes(`${province}/${district}`)||draft.regions.length>=3} onClick={()=>setDraft({...draft,regions:[...draft.regions,`${province}/${district}`]})}>조회 지역 추가</button></div>
        <div className="flex flex-wrap gap-2" aria-label="조회 지역">{draft.regions.map(k=><button type="button" className="region-tag" key={k} onClick={()=>setDraft({...draft,regions:draft.regions.filter(v=>v!==k)})}>{keyName(k)} 빼기 ×</button>)}{!draft.regions.length&&<span className="text-sm text-muted">{draft.mode==="archive"?"과거 자료 전체 지역":"조회할 지역을 선택하세요"}</span>}</div>
        <p className="text-xs text-muted">주변 지자체를 직접 3곳까지 고릅니다. 거리순 자동 추천은 제공하지 않습니다.</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><label className="text-sm font-bold">{draft.mode==="current"?"행사 시작일 조회 시작":"겹치는 기간 시작"}<input className="workspace-input mt-2" type="date" min="2000-01-01" max="2035-12-31" value={draft.start} onChange={e=>setDraft({...draft,start:e.target.value})}/></label><label className="text-sm font-bold">{draft.mode==="current"?"행사 시작일 조회 끝":"겹치는 기간 끝"}<input className="workspace-input mt-2" type="date" min="2000-01-01" max="2035-12-31" value={draft.end} onChange={e=>setDraft({...draft,end:e.target.value})}/></label><label className="text-sm font-bold">축제·지역 이름<input className="workspace-input mt-2" maxLength={200} value={draft.keyword} onChange={e=>setDraft({...draft,keyword:e.target.value})} placeholder="예: 딸기, 임실"/></label><label className="text-sm font-bold">주제<select className="workspace-input mt-2" disabled={draft.mode==="current"} value={draft.theme} onChange={e=>setDraft({...draft,theme:e.target.value})}><option value="">전체</option><option>농특산물</option><option>역사문화</option></select></label></div>
        <div className="flex flex-wrap gap-2"><button type="submit" className="region-primary">{draft.mode==="archive"?"과거 회차 검색":"등록 행사 조회"}</button><button type="button" className="region-button" onClick={()=>{const q:SearchContext={mode:"current",regions:["44/230","44/150","44/760"],start:`${year}-01-01`,end:`${year}-12-31`,keyword:"",theme:"",dateRule:"starts-within",queriedAt:null};search(q);}}>논산·공주·부여 등록 행사 조회</button></div>
      </form><p className="text-xs leading-6 text-muted">{draft.mode==="archive"?"과거는 조회 기간과 겹치는 회차를 찾습니다. 개최일 미확인은 사업연도로 남깁니다. 주제는 검토한 자료를 정리한 분류입니다.":"현재 API는 최대 366일의 기간에 시작하는 등록 행사입니다. 그 이전에 시작한 장기 행사는 빠질 수 있습니다. 과거 회차의 개최 여부를 증명하지 않습니다."}</p>
    </section>
    {error&&<p role="alert" className="region-card text-red-800">{error}</p>}
    <section className="region-card space-y-4" aria-label="회차 검색 결과"><h2 className="text-xl font-extrabold">{applied.mode==="archive"?"보관 출처에서 찾은 회차":"현재 조회한 등록 행사"} · {found.length}건</h2><p className="text-sm text-muted">적용 조건: {applied.start} ~ {applied.end} · {applied.regions.map(keyName).join(", ")||"전체 지역"} · {applied.keyword||"이름 전체"} · {applied.theme||"주제 전체"}<br/>선택한 회차는 검색 조건을 바꿔도 비교 목록에 유지됩니다.</p>
      {loading&&<p role="status">등록 행사의 전체 페이지를 지역별로 조회하고 있습니다…</p>}
      {applied.mode==="current"&&<div className="space-y-2">{applied.regions.map(k=>{const r=results.find(r=>`${r.query.province}/${r.query.district}`===k);return <p key={k} className="rounded-xl bg-paper p-3 text-xs leading-6"><strong>{keyName(k)}</strong> · {r?`${r.resources.message} · ${r.resources.total===null?"건수 미확보":`${r.resources.total}건`} · ${r.resources.pages}페이지 · 조회 ${r.resources.collectedAt}`:loading?"조회 대기":"미조회 또는 조회 실패"}</p>;})}</div>}
      {!found.length&&!loading&&<p className="rounded-xl bg-paper p-4 text-sm">이 조건에서 확인한 자료가 없습니다. 실제 행사 없음·미개최를 뜻하지 않습니다. 기간이나 지역을 바꾸어 조회하세요.</p>}
      <div className="grid max-h-[38rem] gap-3 overflow-auto sm:grid-cols-2">{found.map(e=><article key={e.id} className="rounded-xl border border-ink/10 p-4"><div className="flex flex-wrap gap-2"><span className="region-tag">{e.origin==="archive"?"과거 회차 자료":"현재 등록 정보"}</span><span className="text-xs text-muted">{e.year} · {e.region.name}</span></div><h3 className="mt-3 font-extrabold">{e.name}</h3><p className="my-2 text-sm">{e.start?`${e.start} ~ ${e.end}`:"개최일 미확인"} · {e.status}</p><p className="text-xs text-muted">방문 {e.visits?"보관 이력 있음":"미확보"} · 비용 {e.costs.length?"원문 금액 있음":"미확보"} · 확인 {e.source.checkedAt.slice(0,10)}</p><button className="region-button no-print mt-3" aria-pressed={selected.some(s=>s.id===e.id)} onClick={()=>select(e)}>{e.year} {e.name} {selected.some(s=>s.id===e.id)?"비교에서 빼기":"비교에 추가"}</button></article>)}</div>
    </section>
    <div ref={board} className="scroll-mt-56 space-y-6" aria-label="선택 회차 비교">{!selected.length?<p className="region-card">회차를 1~3개 골라 자료를 확인하세요. 두 회차부터 일정 겹침과 방문 흐름을 나란히 볼 수 있습니다.</p>:<>
      <Availability editions={selected}/><VisitComparison editions={selected} onSave={s=>void save(s)}/><ScheduleChart editions={selected}/><CostCharts editions={selected} onSave={s=>void save(s)}/>
      <section className="region-card space-y-4"><h2 className="text-xl font-extrabold">회차 원문과 확인할 항목</h2>{selected.map(e=><article key={e.id} className="space-y-2 border-t border-ink/10 pt-4"><h3 className="font-bold">{e.year} {e.name} · {e.region.name}</h3><p className="text-sm leading-7">{e.status} · {e.statusNote}<br/>{e.address}</p><p className="text-sm">추가 확인: {e.missing.join(" · ")}</p><SourceDetails source={e.source}/>{e.statusSource&&<SourceDetails source={e.statusSource}/>}<p className="break-all text-xs text-muted">축제 식별자 {e.festivalId} · 회차 식별자 {e.id}</p></article>)}</section>
      <section className="region-card no-print space-y-3"><h2 className="text-xl font-extrabold">비교를 올해 기획 근거로 담기</h2><label className="block text-sm font-bold">비교를 참고할 이유<textarea className="workspace-input mt-2" rows={3} maxLength={2000} value={note} onChange={e=>setNote(e.target.value)} placeholder="예: 개최 시기와 주변 행사 겹침, 준비 규모를 검토할 때 참고"/></label><button className="region-primary" onClick={()=>void save({kind:"overview"})}>선택 회차와 비교 조건 담기</button><p className="text-xs text-muted">회차별 선택 당시 값·누락·출처·조회 조건을 이 브라우저에 저장합니다. 담은 근거에서 올해 기획 후보의 판단에 연결할 수 있습니다.</p></section>
    </>}</div>
    {notice&&<p role="status" className="no-print sticky bottom-3 z-30 rounded-2xl border border-blue/20 bg-blue-soft p-4 text-sm font-bold shadow-card">{notice} <Link href="/evidence#comparisons" className="underline">담은 비교 근거 보기</Link></p>}
  </div>;
}
