"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { CATALOGUE, dates, REGIONS, TYPES } from "@/lib/region/model";
import { HOME_REGION_KEY, makeEvidence, storeEvidence } from "@/lib/region/evidence";
import type { Query, RegionResult, Resource } from "@/lib/region/types";
import { RegionMap, type Bounds } from "./RegionMap";
import { RegionHistory } from "./RegionHistory";

const emptyResources: Resource[] = [];
const provinces = [...new Map(REGIONS.map(r => [r.provinceCode, r.provinceName])).entries()];
const label = (code: string) => provinces.find(p => p[0] === code)?.[1] ?? "";
export function RegionExplorer({ year }: { year: number }) {
  const [province, setProvince] = useState(""), [district, setDistrict] = useState("");
  const [start, setStart] = useState(`${year}-01-01`), [end, setEnd] = useState(`${year}-12-31`), [kind, setKind] = useState<Query["kind"]>("12");
  const [query, setQuery] = useState<Query | null>(null), [data, setData] = useState<RegionResult | null>(null);
  const [loading, setLoading] = useState(false), [error, setError] = useState(""), [notice, setNotice] = useState("");
  const [resourceId, setResourceId] = useState(""), [date, setDate] = useState(""), [note, setNote] = useState("");
  const [home, setHome] = useState<{ province: string; district: string } | null>(null), [bounds, setBounds] = useState<Bounds | null>(null);
  const [districtSearch, setDistrictSearch] = useState(""), [retry, setRetry] = useState(0);
  const [provinceExpanded, setProvinceExpanded] = useState(true);
  const serial = useRef(0), details = useRef<HTMLDivElement>(null);
  useEffect(() => { try { const saved = JSON.parse(localStorage.getItem(HOME_REGION_KEY) ?? "null"); if (REGIONS.some(r => r.provinceCode === saved?.province && r.districtCode === saved?.district)) setHome(saved); } catch { /* The initial view stays nationwide. */ } }, []);
  function reset() { serial.current++; setData(null); setQuery(null); setLoading(false); setError(""); setResourceId(""); setDate(""); setBounds(null); setNote(""); }
  function chooseProvince(code: string) { reset(); setProvince(code); setDistrict(""); setProvinceExpanded(!code); setDistrictSearch(""); setNotice(""); }
  function load(p: string, d: string, s = start, e = end, k = kind) {
    reset(); setProvince(p); setDistrict(d); setProvinceExpanded(false);
    try { dates(s, e); setQuery({ province: p, district: d, start: s, end: e, kind: k }); }
    catch (err) { setError((err as Error).message); }
  }
  useEffect(() => {
    if (!query) return;
    const controller = new AbortController(), current = ++serial.current;
    setLoading(true); setData(null); setError(""); setResourceId(""); setDate(""); setBounds(null);
    fetch(`/api/regions?${new URLSearchParams(query)}`, { signal: controller.signal }).then(async response => {
      const result = await response.json(); if (!response.ok) throw new Error(result.error ?? "자료를 불러오지 못했습니다.");
      if (current === serial.current) setData(result);
    }).catch(err => { if (current === serial.current && err.name !== "AbortError") setError("자료를 불러오지 못했습니다. 다시 조회하세요."); }).finally(() => { if (current === serial.current) setLoading(false); });
    return () => controller.abort();
  }, [query, retry]);
  function setRange(value: string, isStart: boolean) { reset(); if (isStart) setStart(value); else setEnd(value); }
  function saveHome() { try { const value = { province, district }; localStorage.setItem(HOME_REGION_KEY, JSON.stringify(value)); setHome(value); setNotice("우리 지역을 저장했습니다. 다음 방문도 전국에서 시작하며 바로가기로 이동할 수 있습니다."); } catch { setNotice("우리 지역을 저장하지 못했습니다. 브라우저 저장 설정을 확인하세요."); } }
  function selectResource(id: string) { setResourceId(id); setDate(""); }
  async function save(allDates = false) {
    if (!data) return;
    try {
      const selection = allDates ? { dates: data.history.points.map(p => p.date) } : resourceId ? { resourceId, ...(bounds ? { mapBounds: bounds } : {}) } : { dates: [date] };
      const item = await makeEvidence(data, selection, note), result = storeEvidence([item]);
      setNotice(result.added ? "기획 근거에 담았습니다. 이 브라우저의 ‘담은 근거’에서 확인하세요." : "같은 자료와 조회 조건을 이미 담았습니다. 기존 근거를 유지합니다.");
    } catch (e) { setNotice(e instanceof Error ? e.message : "저장하지 못했습니다. 브라우저 저장 공간을 확인하세요."); }
  }
  const children = REGIONS.filter(r => r.provinceCode === province), districtName = children.find(r => r.districtCode === district)?.districtName ?? "";
  const resources = data?.resources.items ?? emptyResources;
  const visible = bounds ? resources.filter(r => r.longitude === null || r.latitude === null || (r.longitude >= bounds[0] && r.longitude <= bounds[2] && r.latitude >= bounds[1] && r.latitude <= bounds[3])) : resources;
  const resource = resources.find(r => r.id === resourceId), point = data?.history.points.find(p => p.date === date);
  return <div className="space-y-6">
    <header className="flex flex-wrap items-end justify-between gap-4"><div><p className="mb-2 text-xs font-extrabold tracking-widest text-blue">지역을 이해하는 축제 기획</p><h1 className="text-3xl font-extrabold sm:text-4xl">전국에서 우리 지역으로</h1><p className="mt-3 max-w-2xl text-sm leading-7 text-muted">지역을 좁혀 관광자원과 방문 추세를 살펴보세요. 필요한 자료를 담으면 올해 축제를 준비할 기획 근거가 됩니다.</p></div><Link href="/evidence" className="region-button">담은 근거 보기 →</Link></header>
    <nav aria-label="선택 지역 경로" className="flex flex-wrap items-center gap-2 rounded-2xl bg-white p-4 text-sm shadow-sm"><button className="font-bold text-blue underline" onClick={() => chooseProvince("")}>전국</button><span aria-hidden="true">›</span>{province ? <button className="font-bold text-blue underline" onClick={() => chooseProvince(province)}>{label(province)}</button> : <span className="text-muted">시도 선택</span>}<span aria-hidden="true">›</span><span aria-current={district ? "location" : undefined}>{districtName || "시군구 선택"}</span>{home && <button className="region-button ml-auto" onClick={() => load(home.province, home.district)}>우리 지역 바로가기</button>}</nav>
    <div className="flex flex-wrap gap-2"><Link className="region-button" href={district ? `/compare?${new URLSearchParams({province,district,start,end,mode:"current"})}` : "/compare"}>이 지역·과거 축제 비교 →</Link></div>
    <div className="region-card grid grid-cols-2 gap-3 lg:hidden">
      <label className="text-sm font-bold">01 시도<select aria-label="시도 선택" className="workspace-input mt-2" value={province} onChange={e => chooseProvince(e.target.value)}><option value="">전국</option>{provinces.map(([code, name]) => <option key={code} value={code}>{name}</option>)}</select></label>
      <label className="text-sm font-bold">02 시군구<select aria-label="시군구 선택" className="workspace-input mt-2" value={district} disabled={!province} onChange={e => { if (e.target.value) load(province, e.target.value); else chooseProvince(province); }}><option value="">{province ? "시군구를 선택하세요" : "시도를 먼저 선택하세요"}</option>{children.map(r => <option key={r.districtCode} value={r.districtCode}>{r.districtName}</option>)}</select></label>
      <button className="region-button col-span-2 text-left" onClick={() => { setStart("2025-03-01"); setEnd("2025-03-31"); setKind("12"); load("44", "230", "2025-03-01", "2025-03-31", "12"); }}>논산 2025년 3월 자료로 살펴보기 →</button>
      <p className="col-span-2 text-xs text-muted">관광공사 조회 지역 목록 · {CATALOGUE.collectedAt.slice(0, 10)} · 일반시와 행정구 포함</p>
    </div>
    <div className="grid items-start gap-5 lg:grid-cols-[290px_minmax(0,1fr)]">
      <aside className="hidden space-y-4 lg:block">
        <section className="region-card"><h2 className="font-extrabold"><span className="text-blue">01</span> 시도 선택</h2><p className="my-2 text-xs leading-5 text-muted">선택하면 해당 시군구 목록이 펼쳐집니다.</p><button className="region-button mb-3 w-full" aria-expanded={provinceExpanded} onClick={() => setProvinceExpanded(v => !v)}>{province ? `${label(province)} · 시도 변경` : "시도 목록 펼치기 / 접기"}</button>{provinceExpanded && <div className="grid grid-cols-2 gap-2">{provinces.map(([code, name]) => <button key={code} aria-pressed={province === code} aria-controls="district-options" onClick={() => chooseProvince(code)} className={`rounded-xl border px-2 py-3 text-left text-xs font-bold ${province === code ? "border-blue bg-blue-soft text-blue" : "border-ink/10 bg-white hover:bg-paper"}`}>{name}<span className="float-right" aria-hidden="true">›</span></button>)}</div>}</section>
        <section id="district-options" className="region-card" aria-label="시군구 선택"><h2 className="font-extrabold"><span className="text-blue">02</span> {province ? label(province) : "시군구 선택"}</h2>{province ? <><label className="mt-3 block text-xs font-bold">시군구 이름 찾기<input className="workspace-input mt-2" value={districtSearch} onChange={e => setDistrictSearch(e.target.value)} placeholder="예: 논산" /></label><div className="mt-3 grid max-h-72 grid-cols-2 gap-2 overflow-auto">{children.filter(r => r.districtName.includes(districtSearch)).map(r => <button key={r.districtCode} aria-pressed={district === r.districtCode} onClick={() => load(province, r.districtCode)} className={`rounded-lg border px-2 py-3 text-left text-xs font-bold ${district === r.districtCode ? "border-blue bg-blue-soft text-blue" : "border-ink/10"}`}>{r.districtName}</button>)}</div><p className="mt-3 text-xs leading-5 text-muted">관광공사 조회 단위입니다. 일반시와 행정구를 함께 포함하며 합산 대상이 아닙니다.</p></> : <p className="mt-3 rounded-xl bg-paper p-4 text-sm text-muted">위 시도를 선택하면 이곳에 시군구가 펼쳐집니다.</p>}</section>
        <button className="region-button w-full text-left" onClick={() => { setStart("2025-03-01"); setEnd("2025-03-31"); setKind("12"); load("44", "230", "2025-03-01", "2025-03-31", "12"); }}>논산 2025년 3월 자료로 살펴보기 →</button>
        <p className="text-xs leading-5 text-muted">지역 목록 확인: {CATALOGUE.collectedAt.slice(0, 10)}<br /><a href={CATALOGUE.source} className="underline" target="_blank" rel="noreferrer">한국관광공사 법정동 조회 목록 ↗</a></p>
      </aside>
      <div className="min-w-0 space-y-4">
        <RegionMap province={province} resources={resources} selected={resourceId} appliedBounds={bounds} onProvince={chooseProvince} onResource={selectResource} onBounds={b => { setBounds(b); setResourceId(""); }} />
        {resource && <button className="region-button w-full" onClick={() => details.current?.scrollIntoView({ behavior: "smooth", block: "start" })}>{resource.title} · 상세·기획 근거 확인 ↓</button>}
        <section className="region-card"><div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h2 className="font-extrabold"><span className="text-blue">03</span> 자료 조회 조건</h2>{district && <button className="region-button" onClick={saveHome}>우리 지역으로 저장</button>}</div><form onSubmit={e => { e.preventDefault(); if (district) load(province, district); }} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <label className="text-xs font-bold">통계 시작일<input aria-label="통계 시작일" type="date" min="2000-01-01" max="2035-12-31" className="workspace-input mt-2" value={start} onChange={e => setRange(e.target.value, true)} /></label><label className="text-xs font-bold">통계 종료일<input aria-label="통계 종료일" type="date" min="2000-01-01" max="2035-12-31" className="workspace-input mt-2" value={end} onChange={e => setRange(e.target.value, false)} /></label>
          <label className="text-xs font-bold">지도·목록 자료<select className="workspace-input mt-2" value={kind} onChange={e => { const next = e.target.value as Query["kind"]; setKind(next); reset(); if (district) load(province, district, start, end, next); }}>{Object.entries(TYPES).map(([code, name]) => <option key={code} value={code}>{name}</option>)}</select></label><button type="submit" className="region-primary self-end" disabled={!district || loading}>자료 조회</button>
        </form><p className="mt-3 text-xs leading-5 text-muted">최대 366일. 축제·행사는 이 기간에 <strong>시작하는</strong> 등록 자료를 조회합니다. 관광지·문화시설은 현재 등록 목록이며 과거 영업·사용 가능 여부를 뜻하지 않습니다.</p></section>
        {loading && <p role="status" className="region-card">{districtName} 자료의 전체 페이지를 확인하고 있습니다…</p>}
        {error && <p role="alert" className="region-card text-red-800">{error} <button className="region-button" onClick={() => setRetry(r => r + 1)}>다시 조회</button></p>}
        {!district && <div className="region-card"><h2 className="font-extrabold">시군구를 선택하면 자료가 연결됩니다</h2><p className="mt-2 text-sm leading-7 text-muted">전국 합계나 지역 순위를 임의로 만들지 않습니다. 관광자원은 공공 API로 조회하고, 연속 방문 이력은 현재 논산 자료를 제공합니다.</p></div>}
        {district && !query && !error && <p className="region-card text-sm">조회 조건을 바꿨습니다. ‘자료 조회’를 눌러 새 기간을 확인하세요.</p>}
        {data && <>
          <section className="region-card space-y-3" aria-label="조회 자료 목록"><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-xl font-extrabold">{districtName} · {TYPES[data.query.kind]}</h2><span className="region-tag">{data.resources.status === "unavailable" ? "조회 미확보" : `API 등록 ${data.resources.total}건`}</span></div>
            <p className="text-xs leading-6 text-muted">{data.resources.message} · 조회 {new Date(data.resources.collectedAt).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })} · {data.resources.pages}페이지 확인<br />좌표 없는 자료 {resources.filter(r => r.longitude === null).length}건은 목록에 유지합니다.{bounds && " 공간 필터 적용 중 · 좌표 없는 자료는 포함합니다."}</p>
            {data.resources.status === "unavailable" && <button className="region-button" onClick={() => setRetry(r => r + 1)}>자료 다시 조회</button>}
            <div className="max-h-96 space-y-2 overflow-auto">{visible.map(r => <button key={r.id} className={`block w-full rounded-xl border p-3 text-left text-sm ${r.id === resourceId ? "border-blue bg-blue-soft" : "border-ink/10 hover:bg-paper"}`} onClick={() => selectResource(r.id)}><span className="font-bold">{resources.indexOf(r) + 1}. {r.title}</span><span className="mt-1 block text-xs text-muted">{r.address || "주소 미확보"}{r.longitude === null ? " · 좌표 미확보" : ""}{r.start ? ` · ${r.start} ~ ${r.end}` : ""}</span></button>)}</div>
            {bounds && <p className="text-xs text-muted">공간 필터 안 목록 {visible.length}건 / 조회 목록 {resources.length}건. 지역 방문 통계의 공간 범위는 시군구 전체입니다.</p>}
          </section>
          <RegionHistory history={data.history} region={districtName} selected={date} onSelect={d => { setDate(d); setResourceId(""); }} />
          <section ref={details} className="region-card space-y-3" aria-label="자료 상세와 근거 담기"><h2 className="text-xl font-extrabold">자료를 확인하고 기획 근거에 담기</h2>
            {resource ? <div className="rounded-xl bg-paper p-4 text-sm leading-7"><h3 className="font-extrabold">{resource.title}</h3><p>{resource.address || "주소 미확보"}</p><p>{resource.start ? `행사 일정: ${resource.start} ~ ${resource.end}` : "현재 등록 관광자원 · 과거 사용 가능 여부 미확인"}</p><p>원천 수정 표기: {resource.modifiedAt ?? "미확보"} · 관광공사 원문 형식</p><p>원천 항목 번호: {resource.id} · 장소 사용 조건은 담당 기관에 확인 필요</p></div> : point ? <div className="rounded-xl bg-paper p-4 text-sm leading-7"><strong>{districtName} · {point.date}</strong><p>{point.value === null ? "미확보" : `${point.value.toLocaleString("ko-KR")}명 (통신 기반 추정)`}</p><p>시군구 일별 외지인 방문 · 행사장 입장객 아님</p><p>수집 시각: {point.collectedAt ?? "미확보"}</p><p className="break-all">자료 식별자: {point.snapshotId ?? "미확보"}</p></div> : <p className="text-sm text-muted">지도·목록의 항목이나 수치 표의 날짜를 선택하세요. 방문 추세는 기간 전체를 담을 수도 있습니다.</p>}
            <a href={resource ? data.resources.source : data.history.source} className="inline-block text-sm font-bold text-blue underline" target="_blank" rel="noreferrer">선택 자료의 공공데이터 출처 ↗</a>
            <label className="block text-sm font-bold">기획에 참고할 이유<textarea className="workspace-input mt-2" maxLength={2000} rows={2} value={note} onChange={e => setNote(e.target.value)} placeholder="예: 개최 시기와 주변 자원을 조사할 때 참고" /></label>
            <div className="flex flex-wrap gap-2"><button className="region-primary" disabled={!resource && (!point || point.value === null)} onClick={() => void save()}>선택 자료를 기획 근거에 담기</button><button className="region-button" disabled={data.history.status !== "available"} onClick={() => void save(true)}>방문 추세 기간 전체 담기</button></div><p className="text-xs leading-5 text-muted">선택 당시 값·누락·지역·기간·출처를 이 브라우저에 보관합니다. 담은 근거는 파일로 보관할 수 있으며 공식 결재·공동 저장이 아닙니다.</p>
          </section>
        </>}
      </div>
    </div>
    {notice && <p role="status" className="sticky bottom-3 z-20 rounded-2xl border border-blue/20 bg-blue-soft p-4 text-sm font-bold shadow-card">{notice} <Link className="underline" href="/evidence">담은 근거 보기</Link></p>}
  </div>;
}
