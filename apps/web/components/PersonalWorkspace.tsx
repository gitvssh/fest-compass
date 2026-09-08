"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { cloneEdition, createDraft, decisionChanged, MAX_FILE_BYTES, outcomeComparison, parseWorkspace, recordDecision, uid, WORKSPACE_KEY, type Draft, type Plan, type Workspace } from "@/lib/workspace";

type Evidence = { latest: string | null; missing: number; collected: string; source: string; alive: boolean };
const steps = ["자료·준비", "운영안 비교", "결정·현장 기록", "결과 비교", "보고·다음 회차"];
const number = (value: number | null) => value === null ? "미입력" : value.toLocaleString("ko-KR");
const stamp = (at: string) => new Date(at).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
const button = "rounded-xl border border-ink/15 bg-white px-4 py-2.5 text-sm font-bold hover:bg-paper disabled:cursor-not-allowed disabled:opacity-40";
const primary = `${button} !border-navy !bg-navy text-white hover:!bg-blue`;
const card = "rounded-2xl border border-ink/10 bg-white p-5 shadow-card sm:p-7";
function download(name: string, body: string, type = "application/json") {
  const url = URL.createObjectURL(new Blob([body], { type }));
  const a = document.createElement("a"); a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function PersonalWorkspace({ evidence }: { evidence: Evidence }) {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [ready, setReady] = useState(false), [step, setStep] = useState(0);
  const [saving, setSaving] = useState("저장 상태 확인 중"), [error, setError] = useState("");
  const [conflict, setConflict] = useState(false), [corrupt, setCorrupt] = useState<string | null>(null);
  const [pending, setPending] = useState<Workspace | null>(null);
  const [reason, setReason] = useState(""), [owner, setOwner] = useState("");
  const [condition, setCondition] = useState(""), [action, setAction] = useState(""), [fieldOwner, setFieldOwner] = useState("");
  const [feedback, setFeedback] = useState("");
  useEffect(() => {
    let raw: string | null = null;
    try { raw = localStorage.getItem(WORKSPACE_KEY); if (raw) setWorkspace(parseWorkspace(raw)); setSaving(raw ? "이 브라우저에 저장됨" : "아직 만든 작업이 없습니다"); }
    catch (e) { if (raw) setCorrupt(raw); setSaving("자동 저장 사용 불가 · 파일로 보관하세요"); setError(e instanceof Error ? e.message : "저장 공간을 읽지 못했습니다."); }
    setReady(true);
    const onStorage = (event: StorageEvent) => { if (event.key === WORKSPACE_KEY || event.key === null) { setConflict(true); setSaving("다른 탭에서 변경됨 · 자동 저장 일시 중지"); } };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
  useEffect(() => {
    if (!ready || !workspace || conflict || corrupt) return;
    try { const body = JSON.stringify(workspace); parseWorkspace(body); localStorage.setItem(WORKSPACE_KEY, body); setSaving("이 브라우저에 저장됨"); }
    catch { setSaving("자동 저장 실패 · 입력은 화면에 유지됩니다. 파일로 보관하세요."); }
  }, [workspace, ready, conflict, corrupt]);
  const draft = workspace?.drafts.find(d => d.id === workspace.activeId);
  function update(next: Draft) { setWorkspace(w => w && ({ ...w, drafts: w.drafts.map(d => d.id === next.id ? next : d) })); }
  function edit(patch: Partial<Draft>) { if (draft) update({ ...draft, ...patch }); }
  function add(d: Draft) {
    if ((workspace?.drafts.length ?? 0) >= 20) { setError("한 작업 파일에는 최대 20회차를 보관할 수 있습니다."); return; }
    setWorkspace(w => ({ schemaVersion: 1, activeId: d.id, drafts: [...(w?.drafts ?? []), d] })); setStep(0); setError(""); setReason(""); setOwner("");
  }
  function changeStep(index: number) { setStep(index); setError(""); }
  function choose(plan: Plan) {
    if (!draft) return;
    try { update(recordDecision(draft, plan.id, reason, owner)); setReason(""); setError(""); setStep(2); }
    catch (e) { setError((e as Error).message); }
  }
  async function importFile(file?: File) {
    if (!file) return;
    try { if (file.size > MAX_FILE_BYTES) throw new Error("파일은 1MB 이하여야 합니다."); setPending(parseWorkspace(await file.text())); setError(""); }
    catch (e) { setError((e as Error).message); }
  }
  const last = draft?.decisions.at(-1), comparison = draft && outcomeComparison(draft);
  if (!ready) return <p role="status">개인 작업을 불러오고 있습니다.</p>;
  return <div className="space-y-6">
    <header className="no-print space-y-3">
      <p className="text-xs font-extrabold tracking-widest text-blue">축제 운영 MVP</p>
      <Link href="/evidence" className="inline-block text-sm font-bold text-blue underline">지도에서 담은 기획 근거 확인 →</Link>
      <h1 className="text-3xl font-extrabold sm:text-4xl">내 축제 작업공간</h1>
      <p className="max-w-3xl text-sm leading-7 text-muted">자료를 살펴보고 운영안을 정한 뒤, 현장 기록과 결과를 다음 축제로 이어가세요. 이 공간의 기록은 <strong className="text-ink">이 브라우저에만 저장</strong>됩니다. 공동 편집·공식 승인 기능은 개발 예정입니다. 브라우저 데이터를 지우기 전에 파일을 내려받으세요.</p>
      <div className="flex flex-wrap items-center gap-2">
        <span role="status" className="mr-auto text-xs font-bold text-blue">{saving}</span>
        <button className={button} disabled={!workspace} onClick={() => download("fest-compass-workspace.json", JSON.stringify(workspace, null, 2))}>작업 파일 내보내기</button>
        <label className={`${button} cursor-pointer`}>작업 파일 가져오기<input className="sr-only" type="file" accept=".json,application/json" onChange={e => { void importFile(e.target.files?.[0]); e.target.value = ""; }} /></label>
      </div>
    </header>
    {error && <p role="alert" className="no-print rounded-xl bg-coral-soft p-4 text-sm font-bold text-coral">{error}</p>}
    {conflict && <div className={`${card} no-print`}><p>다른 탭의 변경을 발견했습니다. 현재 입력은 파일로 보관할 수 있습니다. 새로고침하면 다른 탭에서 저장한 기록을 읽습니다.</p><button className={`${button} mt-3`} onClick={() => location.reload()}>저장된 기록 다시 불러오기</button></div>}
    {corrupt && <div className={`${card} no-print`}><p>기존 저장 내용이 손상되어 덮어쓰기를 중지했습니다. 원본을 보관한 뒤 정상 작업 파일을 가져오세요.</p><button className={`${button} mt-3`} onClick={() => download("fest-compass-recovery.txt", corrupt, "text/plain")}>손상된 원본 보관</button></div>}
    {pending && <section className={`${card} no-print`} aria-label="가져오기 확인"><h2 className="text-xl font-bold">작업 {pending.drafts.length}개를 가져올 준비가 됐습니다</h2><p className="my-3 text-sm">{pending.drafts.map(d => d.name).join(" · ")}</p><p className="mb-3 text-sm text-coral">교체하면 현재 브라우저의 작업 목록이 바뀝니다. 필요한 기록은 먼저 내보내세요. 가져온 내용은 개인 기록이며 검증된 공식 자료가 아닙니다.</p><div className="flex gap-2"><button className={primary} onClick={() => { setWorkspace(pending); setPending(null); setCorrupt(null); setConflict(false); setError(""); setStep(0); }}>이 파일로 작업 목록 교체</button><button className={button} onClick={() => setPending(null)}>취소</button></div></section>}
    {!draft ? <section className={`${card} no-print`}><h2 className="text-2xl font-extrabold">어떤 축제로 시작할까요?</h2><p className="my-4 text-sm text-muted">논산의 실제 자료를 참고해 운영을 연습하거나, 담당하는 축제를 직접 입력하세요. 예산과 현장 결과는 직접 입력합니다.</p><div className="flex flex-wrap gap-3"><button className={primary} disabled={!!corrupt || conflict} onClick={() => add(createDraft(true))}>논산 샘플로 시작</button><button className={button} disabled={!!corrupt || conflict} onClick={() => add(createDraft(false))}>빈 축제로 시작</button></div></section> : <>
      <div className="no-print flex flex-wrap items-end gap-3"><label className="min-w-0 flex-1 text-sm font-bold">작업 중인 회차<select className="workspace-input mt-2" value={draft.id} onChange={e => { setWorkspace({ ...workspace!, activeId: e.target.value }); setStep(0); setReason(""); setOwner(""); setCondition(""); setAction(""); setFieldOwner(""); setError(""); }}>{workspace!.drafts.map(d => <option key={d.id} value={d.id}>{d.name || "이름 없는 축제"} {d.start && `(${d.start})`}</option>)}</select></label><button className={button} disabled={conflict || !!corrupt} onClick={() => add(createDraft(false))}>새 축제 추가</button></div>
      <nav aria-label="축제 준비 단계" className="no-print grid grid-cols-2 gap-2 sm:grid-cols-5">{steps.map((name, i) => <button key={name} aria-current={step === i ? "step" : undefined} onClick={() => changeStep(i)} className={`rounded-xl border p-3 text-left text-sm font-bold ${step === i ? "border-navy bg-navy text-white" : "border-ink/10 bg-white text-muted"}`}><span className="mb-1 block text-xs opacity-70">STEP 0{i + 1}</span>{name}</button>)}</nav>
      <fieldset disabled={conflict || !!corrupt} className="min-w-0 space-y-5">
      {step === 0 && <>
        <section className={card}><div className="mb-5 flex flex-wrap items-start justify-between gap-2"><div><h2 className="text-xl font-extrabold">축제의 기본 정보</h2><p className="mt-2 text-sm text-muted">{draft.sample ? "논산딸기축제 2026 일정에 기반한 운영 연습입니다. 공식 운영 기록이 아닙니다." : "직접 입력하는 개인 계획입니다."}</p></div><span className="rounded-full bg-blue-soft px-3 py-1 text-xs font-bold text-blue">{draft.sample ? "연습용" : "사용자 입력"}</span></div>
          <div className="grid gap-4 sm:grid-cols-2"><Field label="축제명" value={draft.name} max={120} onChange={name => edit({ name })} /><Field label="장소" value={draft.place} max={300} onChange={place => edit({ place })} /><Field label="시작일" type="date" value={draft.start} onChange={start => edit({ start })} /><Field label="종료일" type="date" value={draft.end} onChange={end => edit({ end })} /></div>
          {draft.parent && <p className="mt-3 text-xs text-blue">이전 회차: {workspace!.drafts.find(d => d.id === draft.parent)?.name ?? "가져온 기록"} · 일정과 운영 가정을 다시 확인하세요.</p>}
        </section>
        <section className={card}><p className="text-xs font-bold text-blue">참고 자료 · 충남 논산시</p><h2 className="mt-2 text-xl font-extrabold">과거를 확인하고, 예측의 범위를 이해하세요</h2><p className="mt-2 text-sm leading-7 text-muted">{draft.sample ? "선택한 샘플의 지역 자료입니다." : "아래 자료는 논산 사례입니다. 입력한 다른 지역에 적용되지 않습니다."} 한국관광공사의 지역 방문 추정치는 축제장 입장 건수가 아닙니다. 아래 조회 링크에서 출처와 모델의 실제 오차를 확인할 수 있습니다.</p>
          <div className="my-5 grid gap-3 sm:grid-cols-3"><Stat label="마지막 지역 관측일" value={evidence.latest ?? "미확보"} /><Stat label="조회 범위 중 누락" value={`${evidence.missing}일`} /><Stat label="자료 상태" value={evidence.source === "live" ? evidence.alive ? "저장된 최신 기록" : "수집 연결 확인 필요" : "보관된 사례"} /></div>
          <p className="text-xs text-muted">자료 확인 시각: {stamp(evidence.collected)} 한국시각 · 실시간 현황 아님</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-3"><Link className="workspace-link" href="/forecast/history" target="_blank" rel="noreferrer">과거 축제 비교 ↗<span>연도별 학습 이력과 오차</span></Link><Link className="workspace-link" href="/forecast/records" target="_blank" rel="noreferrer">현재 자료·향후 예측 ↗<span>일반 날짜 예측과 결과 대기</span></Link><Link className="workspace-link" href="/forecast" target="_blank" rel="noreferrer">2025년 축제 사례 ↗<span>실제 지역 추세와 예측 비교</span></Link></div>
        </section>
        <section className={card}><h2 className="text-xl font-extrabold">우리 행사장의 운영 가정</h2><p className="my-3 text-sm leading-7 text-muted">이번 행사 전체의 입장 건수를 직접 가정하세요. 재입장을 포함하는지 근거에 명시하고, 결과에서도 같은 기준을 사용하세요. 지역 방문자나 날짜별 추정치를 자동 변환하지 않습니다.</p><div className="grid gap-4 sm:grid-cols-2"><Numeric label="행사 전체 예상 입장 건수 (건)" value={draft.expected} onChange={expected => edit({ expected })} /><Field label="가정의 근거와 집계 기준" multiline value={draft.basis} onChange={basis => edit({ basis })} /></div></section>
      </>}
      {step === 1 && <>
        <section className="rounded-2xl bg-blue-soft p-5"><h2 className="font-extrabold">자원과 비용을 나란히 비교하세요</h2><p className="mt-2 text-sm leading-7">인원은 행사 전체 배치 인원, 셔틀은 확보 차량 수, 회차는 행사 전체 운영 횟수, 예산은 전체 원 단위입니다. 입력값은 운영 가정입니다. 자원을 늘렸을 때 대기시간·안전·입장 건수가 얼마나 달라지는지는 아직 계산하지 않습니다.</p></section>
        <div className="grid gap-4 md:grid-cols-2">{draft.plans.map((plan, index) => <section key={plan.id} className={card} aria-label={`운영안 ${index + 1}`}><h2 className="mb-4 text-xl font-extrabold">운영안 {index + 1}</h2><div className="grid gap-4"><Field label="운영안 이름" value={plan.name} max={120} onChange={name => edit({ plans: draft.plans.map(p => p.id === plan.id ? { ...p, name } : p) })} /><div className="grid grid-cols-2 gap-3">{([["staff", "배치 인원 (명)"], ["shuttles", "셔틀 차량 (대)"], ["sessions", "운영 회차 (회)"], ["budget", "전체 예산 (원)"]] as const).map(([key, label]) => <Numeric key={key} label={label} value={plan[key]} onChange={value => edit({ plans: draft.plans.map(p => p.id === plan.id ? { ...p, [key]: value } : p) })} />)}</div><Field multiline label="운영 방법·주의점" value={plan.note} onChange={note => edit({ plans: draft.plans.map(p => p.id === plan.id ? { ...p, note } : p) })} /></div></section>)}</div>
        <section className={card}><h2 className="text-xl font-extrabold">운영안을 선택한 이유를 남기세요</h2><p className="my-3 text-sm text-muted">선택 당시의 일정·입장 가정·운영안과 이유를 함께 보관합니다. 개인 의사결정 기록이며 공식 승인을 대신하지 않습니다.</p><div className="grid gap-4 sm:grid-cols-2"><Field label="선택 이유" multiline value={reason} onChange={setReason} /><Field label="기록 담당자" max={120} value={owner} onChange={setOwner} /></div><div className="mt-4 flex flex-wrap gap-2">{draft.plans.map((p, i) => <button key={p.id} className={primary} onClick={() => choose(p)}>운영안 {i + 1}로 결정 기록</button>)}</div>{draft.outcome.actual !== null && <p className="mt-3 text-xs text-coral">결과를 입력한 회차는 결정을 추가할 수 없습니다. 다음 회차를 만들어 새 계획을 기록하세요.</p>}</section>
      </>}
      {step === 2 && <>
        <section className={card}><h2 className="text-xl font-extrabold">결정 기록</h2>{!last ? <p className="mt-4 text-muted">아직 선택한 운영안이 없습니다. 운영안 비교에서 선택 이유와 담당자를 입력하세요.</p> : <><p className="mt-3 text-2xl font-bold text-blue">{last.plan.name}</p><p className="mt-2 text-sm">{last.reason} · {last.owner} · {stamp(last.at)} 한국시각</p><p className="mt-2 text-sm text-muted">선택 당시 가정: {number(last.expected)}건 · 예산 {number(last.plan.budget)}원</p>{decisionChanged(draft) && <p className="mt-4 rounded-xl bg-coral-soft p-3 text-sm font-bold text-coral">결정 이후 준비 정보가 바뀌었습니다. 결과 비교는 보관된 결정 당시의 기준을 사용합니다. 필요하면 운영안을 다시 선택하세요.</p>}</>}
          {draft.decisions.length > 1 && <details className="mt-4"><summary className="cursor-pointer text-sm font-bold">이전 결정 {draft.decisions.length - 1}건 보기</summary>{draft.decisions.slice(0, -1).map(d => <p key={d.id} className="mt-3 text-sm">{stamp(d.at)} · {d.plan.name} · {d.reason} · {number(d.expected)}건 / {number(d.plan.budget)}원</p>)}</details>}
        </section>
        <section className={card}><h2 className="text-xl font-extrabold">현장에서 할 일</h2><p className="my-3 text-sm text-muted">어떤 상황에 누가 무엇을 할지 적고, 실행 여부를 기록하세요. 예: 대기열이 표시선을 넘으면 안내 인력을 추가 배치.</p><div className="grid gap-4 sm:grid-cols-3"><Field label="대응이 필요한 상황" max={1000} value={condition} onChange={setCondition} /><Field label="대응 내용" max={1000} value={action} onChange={setAction} /><Field label="대응 담당자" max={120} value={fieldOwner} onChange={setFieldOwner} /></div><button className={`${button} mt-4`} disabled={!condition.trim() || !action.trim() || !fieldOwner.trim() || draft.records.length >= 100} onClick={() => { edit({ records: [...draft.records, { id: uid(), at: new Date().toISOString(), condition, action, owner: fieldOwner, done: false }] }); setCondition(""); setAction(""); }}>현장 대응 추가</button><div className="mt-5 space-y-3">{draft.records.map(r => <label key={r.id} className="flex items-start gap-3 rounded-xl border border-ink/10 p-4"><input className="mt-1 h-5 w-5 shrink-0" type="checkbox" checked={r.done} onChange={e => edit({ records: draft.records.map(item => item.id === r.id ? { ...item, done: e.target.checked } : item) })} /><span className="min-w-0 text-sm"><strong>{r.condition}</strong><span className="mt-1 block">{r.action} · {r.owner}</span><span className="mt-1 block text-xs text-blue">{r.done ? "실행 확인" : "대응 대기"} · 등록 {stamp(r.at)}</span></span></label>)}</div>{draft.records.length === 0 && <p className="mt-3 text-sm text-muted">등록한 현장 대응이 없습니다.</p>}</section>
      </>}
      {step === 3 && <section className={card}><h2 className="text-xl font-extrabold">계획과 실제 결과를 같은 기준으로 비교하세요</h2><p className="my-3 text-sm leading-7 text-muted">행사 전체 입장 건수만 비교합니다. 시간별·구역별 값이나 지역 방문 추정치를 합쳐 입력하지 마세요. 값이 없으면 빈칸으로 남기고, 실제 0건일 때만 0을 입력하세요.</p>{last ? <p className="mb-5 rounded-xl bg-blue-soft p-4 text-sm">비교 기준: {last.name} · {last.start}~{last.end} · {number(last.expected)}건<br />집계 기준: {last.basis}</p> : <p className="mb-5 font-bold text-coral">운영안을 먼저 선택해야 실제 결과를 기록할 수 있습니다.</p>}<fieldset disabled={!last} className="grid min-w-0 gap-4 sm:grid-cols-2"><Numeric label="행사 전체 실제 입장 건수 (건)" value={draft.outcome.actual} onChange={actual => edit({ outcome: { ...draft.outcome, actual } })} /><Field label="실측 자료 출처" value={draft.outcome.source} onChange={source => edit({ outcome: { ...draft.outcome, source } })} /><Field label="측정 방법·누락·재입장 처리" multiline value={draft.outcome.method} onChange={method => edit({ outcome: { ...draft.outcome, method } })} /><Field label="다음 축제에서 바꿀 점" multiline value={draft.outcome.lesson} onChange={lesson => edit({ outcome: { ...draft.outcome, lesson } })} /></fieldset><div className="mt-6 rounded-xl bg-paper p-4">{comparison ? <><p className="text-xl font-extrabold">계획 대비 {comparison.difference > 0 ? "+" : ""}{number(comparison.difference)}건</p><p className="mt-2 text-sm">{comparison.rate === null ? "계획이 0건이므로 비율을 계산하지 않습니다." : `차이 ${(comparison.rate * 100).toFixed(1)}%`} · 운영 계획과 실측의 차이이며 예측 모델의 정확도가 아닙니다.</p></> : <p className="text-sm text-muted">실제 값과 출처·측정 방법을 모두 입력하면 차이를 표시합니다.</p>}</div></section>}
      {step === 4 && <>
        <article className={`${card} report-sheet space-y-5`} aria-label="축제 결과 보고서"><header><p className="text-xs font-bold text-blue">개인 작업 기록 · {draft.sample ? "운영 연습" : "사용자 입력"} · 공식 승인 아님</p><h2 className="mt-2 text-2xl font-extrabold">{last?.name ?? draft.name} 결과 보고서</h2><p className="mt-2 text-sm text-muted">{last ? `${last.start}~${last.end}` : "결정된 일정 없음"} · {(last ? last.place : draft.place) || "장소 미입력"}</p></header>
          {decisionChanged(draft) && <p className="text-sm font-bold text-coral">현재 준비 정보와 결정 당시 정보가 다릅니다. 아래 계획 수치는 결정 당시 기록입니다.</p>}
          <div className="grid gap-3 sm:grid-cols-3"><Stat label="결정 당시 계획" value={last ? `${number(last.expected)}건` : "결정 필요"} /><Stat label="기록한 실측" value={comparison ? `${number(comparison.actual)}건` : "자료 입력 필요"} /><Stat label="현장 대응 실행" value={`${draft.records.filter(r => r.done).length} / ${draft.records.length}건`} /></div>
          {last && <section><h3 className="font-extrabold">선택한 운영안 · {last.plan.name}</h3><p className="mt-2 text-sm leading-7">인원 {number(last.plan.staff)}명 · 셔틀 {number(last.plan.shuttles)}대 · {number(last.plan.sessions)}회 · 예산 {number(last.plan.budget)}원<br />{last.plan.note}<br />선택 이유: {last.reason}<br />기록 담당: {last.owner} · {stamp(last.at)} 한국시각<br />입장 건수 가정 근거: {last.basis}</p></section>}
          <section><h3 className="font-extrabold">현장 기록</h3>{draft.records.length ? draft.records.map(r => <p className="mt-2 text-sm" key={r.id}>{r.done ? "실행 확인" : "대응 대기"} · {r.condition} → {r.action} · {r.owner}</p>) : <p className="mt-2 text-sm text-muted">기록 없음</p>}</section>
          <section><h3 className="font-extrabold">실제 결과와 배운 점</h3><p className="mt-2 whitespace-pre-wrap text-sm leading-7">{comparison ? `계획 대비 ${number(comparison.difference)}건\n출처: ${draft.outcome.source}\n측정: ${draft.outcome.method}` : "실제 결과 비교에 필요한 자료가 아직 없습니다."}{`\n다음에 바꿀 점: ${draft.outcome.lesson || "미입력"}`}</p></section><p className="text-xs leading-6 text-muted">입력자는 실측 기준과 출처를 확인해야 합니다. 이 보고서는 개인 기록이며 실제 현장 효과나 모델 성능을 검증한 보고서가 아닙니다. 논산 지역 자료와 예측은 별도 참고 화면에서 확인합니다.</p>
        </article>
        <section className={`${card} no-print`}><h2 className="text-xl font-extrabold">기록을 남기고 다음 축제로 이어가세요</h2><div className="my-4 flex flex-wrap gap-2"><button className={primary} onClick={() => window.print()}>보고서 인쇄·PDF 저장</button><button className={button} onClick={() => add(cloneEdition(draft))}>다음 회차 만들기</button></div><p className="text-sm text-muted">기존 회차는 보관됩니다. 다음 회차에는 운영 가정과 대안만 복사하며, 일정·결정·현장 기록·실측은 새로 입력합니다. 2027년 딸기산업엑스포 일정은 자동 적용하지 않습니다.</p><div className="mt-5"><Field label="사용 중 불편했던 점·필요한 기능" multiline value={feedback} onChange={setFeedback} /><button className={`${button} mt-3`} disabled={!feedback.trim()} onClick={() => download("fest-compass-feedback.txt", `FEST Compass MVP 사용 의견\n작성: ${new Date().toISOString()}\n\n${feedback}`, "text/plain;charset=utf-8")}>의견 파일 내려받기</button><p className="mt-2 text-xs text-muted">의견은 자동 전송·저장되지 않습니다. 내려받은 파일을 개발자에게 전달해 주세요. 작업 데이터는 의견 파일에 포함하지 않습니다.</p></div></section>
      </>}
      </fieldset>
      <div className="no-print flex justify-between gap-3"><button className={button} disabled={step === 0} onClick={() => changeStep(step - 1)}>이전 단계</button>{step < 4 && <button className={primary} onClick={() => changeStep(step + 1)}>다음: {steps[step + 1]}</button>}</div>
    </>}
  </div>;
}
function Field({ label, value, onChange, multiline = false, type = "text", max = 2000 }: { label: string; value: string; onChange: (value: string) => void; multiline?: boolean; type?: string; max?: number }) {
  return <label className="block min-w-0 text-sm font-bold">{label}{multiline ? <textarea className="workspace-input mt-2" rows={3} maxLength={max} value={value} onChange={e => onChange(e.target.value)} /> : <input className="workspace-input mt-2" type={type} maxLength={max} value={value} onChange={e => onChange(e.target.value)} />}</label>;
}
function Numeric({ label, value, onChange }: { label: string; value: number | null; onChange: (value: number | null) => void }) { return <label className="block min-w-0 text-sm font-bold">{label}<input className="workspace-input mt-2" type="number" min="0" max="1000000000000" step="1" value={value ?? ""} onChange={e => { const n = e.target.value === "" ? null : Number(e.target.value); if (n === null || (Number.isSafeInteger(n) && n >= 0 && n <= 1_000_000_000_000)) onChange(n); }} /></label>; }
function Stat({ label, value }: { label: string; value: string }) { return <div className="min-w-0 rounded-xl bg-paper p-4"><p className="text-xs text-muted">{label}</p><p className="mt-2 break-words text-lg font-extrabold">{value}</p></div>; }
