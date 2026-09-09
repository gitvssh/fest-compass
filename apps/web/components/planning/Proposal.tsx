"use client";
import { useEffect, useRef, useState } from "react";
import type { Planning, Revision } from "@/lib/planning/types";
import { FIELDS } from "@/lib/planning/types";
import { archiveProposal, proposalBlockers } from "@/lib/planning/proposal";
import { archive, copy } from "@/lib/planning/model";
import { REGIONS } from "@/lib/region/model";
import { Field, Select } from "./Fields";
import { OptionComparison } from "./OptionComparison";
import { RecordDetails } from "./RecordDetails";
import { EvidenceView } from "./EvidenceView";
import { BudgetComparison } from "./budget/Comparison";
import { BudgetReadOnly } from "./budget/ReadOnly";

type Kind = "business" | "preparation";
const kinds = { business: "사업설명 자료", preparation: "준비 목록" };

// Browsers omit closed details when printing. Expand only this report, then
// restore the reader's screen state; keyboard/browser-menu print works too.
function usePrintDetails(ref: React.RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    let closed: HTMLDetailsElement[] = [];
    const before = () => { if (closed.length) return; closed = [...(ref.current?.querySelectorAll<HTMLDetailsElement>("details:not([open])") ?? [])]; closed.forEach(d => { d.open = true; }); };
    const after = () => { closed.forEach(d => { d.open = false; }); closed = []; };
    window.addEventListener("beforeprint", before); window.addEventListener("afterprint", after);
    return () => { after(); window.removeEventListener("beforeprint", before); window.removeEventListener("afterprint", after); };
  }, [ref]);
}

function ProposalReport({ revision: r, number, kind, generatedAt }: { revision: Revision; number: number; kind: Kind; generatedAt: string }) {
  const ref = useRef<HTMLDivElement>(null); usePrintDetails(ref);
  const d = r.draft, region = REGIONS.find(x => `${x.provinceCode}/${x.districtCode}` === d.regionKey);
  const records = <RecordDetails draft={d} />;
  return <div ref={ref} className="proposal-report report-sheet space-y-6" data-proposal-id={r.id}>
    <header className="region-card space-y-3"><p className="font-bold text-blue">{kinds[kind]} · 개인 보관본</p><h2 className="text-2xl font-extrabold">{d.title || "기획 이름 미정"}</h2>
      <p className="text-sm leading-7">{d.year}년 · {region ? `${region.provinceName} ${region.districtName}` : "담당 지역 미정"}<br />기획안 P{number} · 작성 기준일 {d.asOf || "미정"}<br />보관 시각 {r.savedAt} · 출력 구성 시각 {generatedAt}</p>
      <p className="break-all text-xs text-muted">버전 식별자 {r.id} · 출력 형식 1</p><p className="whitespace-pre-wrap text-sm">보관 메모: {r.note || "없음"}</p>
      <p className="rounded-xl bg-paper p-3 text-sm leading-7">담당자가 작성한 검토 자료입니다. 공식 결재·예산 확정·장소 허가·안전 승인을 뜻하지 않습니다. 수치와 확인 기록은 이 버전의 보관 시점 기준입니다.</p>
    </header>
    <section className="region-card space-y-3"><h3 className="text-xl font-extrabold">사업 목적과 선택 이유</h3><p className="whitespace-pre-wrap">{d.purpose || "사업 목적 미정"}</p>{d.options.filter(o => o.decision === "selected").map(o => <p key={o.id} className="whitespace-pre-wrap text-sm leading-7"><strong>우선 후보: {o.name || "이름 미정"}</strong><br />{o.reason}</p>)}<p className="whitespace-pre-wrap text-sm leading-7">측정 계획: {d.measurementPlan || "미정 · 지표·단위·기간·수집 방법·담당을 추가 확인해야 합니다."}</p></section>
    {kind === "preparation" && records}
    <OptionComparison draft={d} />
    {kind === "business" && records}
    <BudgetComparison key={r.id} draft={d} readOnly />
    <section className="space-y-4"><h3 className="text-2xl font-extrabold">당시 예산·재원·변경 이유</h3>{d.options.map(o => <div className="region-card" key={o.id}><BudgetReadOnly draft={d} option={o} report /></div>)}</section>
    <section className="space-y-4"><h3 className="text-2xl font-extrabold">판단에 연결한 근거와 출처</h3><p className="text-sm text-muted">공개 자료 사본과 담당자의 해석을 구분합니다. 연결한 근거가 없으면 담당자 가정 단계입니다. 최신 자료를 자동 조회하지 않습니다.</p>
      {d.options.map(o => <div key={o.id} className="region-card space-y-3"><h4 className="font-extrabold">{o.name || "후보 이름 미정"}의 판단 근거</h4>{!o.links.length && <p className="text-sm">연결한 자료 없음 · 담당자 가정 단계</p>}{o.links.map(l => <p key={`${l.field}/${l.sourceKey}`} className="whitespace-pre-wrap text-sm leading-7"><strong>{FIELDS[l.field]} · {d.evidence.find(e => e.key === l.sourceKey)!.value.title}</strong><br />담당자 판단: {l.reason || "이유 미입력"}</p>)}</div>)}
      {!d.evidence.length && <p className="region-card">보관한 공공데이터 근거 없음 · 자료 확보 필요</p>}
      {d.evidence.map(e => <details key={e.key} className="region-card"><summary className="cursor-pointer font-bold">보관한 자료: {e.value.title}</summary><div className="mt-4"><EvidenceView key={r.id + e.key} source={e} readOnly /></div></details>)}
    </section>
    <p className="border-t border-ink/20 pt-4 text-xs leading-6">기획안 P{number} · {r.id} · {kinds[kind]} · 보관 시각 {r.savedAt}<br />개인 보관 자료입니다. 기획 입력 파일을 별도로 내려받아 백업할 수 있습니다.</p>
  </div>;
}

export function Proposal({ planning: p, change, save, edit }: { planning: Planning; change: (p: Planning) => void; save: (p: Planning, message: string) => Promise<boolean>; edit: () => void }) {
  const [selected, setSelected] = useState(""), [kind, setKind] = useState<Kind>("business"), [note, setNote] = useState(""), [error, setError] = useState(""), [generatedAt, setGeneratedAt] = useState("");
  useEffect(() => setGeneratedAt(new Date().toISOString()), []);
  const proposals = p.revisions.filter(r => r.proposal), revision = proposals.find(r => r.id === selected) ?? proposals.at(-1), blockers = proposalBlockers(p.draft);
  async function keep() {
    try { setError(""); const next = archiveProposal(p, note); if (await save(next, "기획안을 새 버전으로 보관했습니다. 초안 수정은 이 보관본에 영향을 주지 않습니다.")) { setSelected(next.revisions.at(-1)!.id); setGeneratedAt(new Date().toISOString()); } }
    catch (e) { setError((e as Error).message); }
  }
  async function reopen() {
    if (!revision) return;
    try { setError(""); const next = archive(p, "기획안에서 새 초안을 열기 직전 기록"); next.draft = copy(revision.draft); if (await save(next, "보관된 기획안을 새 초안으로 열었습니다. 기존 기획안과 직전 초안을 유지합니다.")) edit(); }
    catch (e) { setError((e as Error).message); }
  }
  return <section className="space-y-6">
    <div className="no-print region-card space-y-4"><h2 className="text-2xl font-extrabold">기획안 보관과 출력</h2><p className="text-sm leading-7">후보·선택 이유·근거·예산·준비 기록을 같은 버전으로 보관합니다. 미정 항목은 미정으로 남습니다. 이 브라우저에만 저장되며 공식 제출은 별도로 진행하세요.</p>
      <Field label="측정 계획" multiline value={p.draft.measurementPlan ?? ""} onChange={measurementPlan => change({ ...p, version: 3, draft: { ...p.draft, measurementPlan } })} />
      <p className="text-xs text-muted">측정할 지표·단위·기간·수집 방법·담당을 적으세요. 지역 방문 지표를 행사장 입장객으로 바꾸어 해석하지 않습니다.</p>
      <Field label="기획안 보관 메모" value={note} onChange={setNote} />
      {!!blockers.length && <ul className="list-disc pl-5 text-sm text-coral" aria-label="기획안 보관 전 확인">{blockers.map(s => <li key={s}>{s}</li>)}</ul>}
      <div className="flex flex-wrap gap-2"><button className="region-primary" disabled={!!blockers.length} onClick={() => void keep()}>현재 초안을 기획안으로 보관</button><button className="region-button" onClick={edit}>후보·선택 이유 편집</button></div>
      <p className="text-xs text-muted">후보 두 개 이상과 우선 후보의 선택 이유가 필요합니다. 미완성 상태는 상단의 초안 저장을 이용하세요. 일반 보관본과 합쳐 최대 20개·5MB입니다.</p>
    </div>
    {error && <p role="alert" className="no-print region-card text-coral">{error}</p>}
    {!revision ? <p className="region-card">아직 보관한 기획안이 없습니다. 초안을 작성한 뒤 기획안으로 보관하세요.</p> : <>
      <div className="no-print region-card space-y-3"><div className="grid gap-3 sm:grid-cols-2"><Select label="출력할 기획안 버전" value={revision.id} onChange={id => { setSelected(id); setGeneratedAt(new Date().toISOString()); }}>{proposals.map((r, i) => <option key={r.id} value={r.id}>P{i + 1} · {r.draft.title} · {r.savedAt}</option>)}</Select><Select label="출력 자료 종류" value={kind} onChange={v => { setKind(v as Kind); setGeneratedAt(new Date().toISOString()); }} options={kinds} /></div>
        <div className="flex flex-wrap gap-2"><button className="region-primary" onClick={() => window.print()}>이 버전 인쇄·PDF 저장</button><button className="region-button" onClick={() => void reopen()}>이 기획안에서 새 초안 작성</button></div><p className="text-xs text-muted">접어 둔 기록과 출처도 인쇄에 포함됩니다. 인쇄 창에서 PDF로 저장할 수 있습니다.</p>
      </div>
      <ProposalReport key={revision.id + kind} revision={revision} number={proposals.indexOf(revision) + 1} kind={kind} generatedAt={generatedAt} />
    </>}
  </section>;
}
