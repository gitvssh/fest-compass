"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { EVIDENCE_KEY, encodeEvidence, MAX_EVIDENCE_BYTES, parseEvidence, storeEvidence } from "@/lib/region/evidence";
import type { Evidence } from "@/lib/region/types";
export function RegionEvidence() {
  const [items, setItems] = useState<Evidence[]>([]), [message, setMessage] = useState(""), [ready, setReady] = useState(false);
  useEffect(() => {
    function read() { try { const raw = localStorage.getItem(EVIDENCE_KEY); setItems(raw ? parseEvidence(raw) : []); } catch { setMessage("보관 근거를 읽지 못했습니다. 기존 저장값은 유지됩니다."); } setReady(true); }
    read(); window.addEventListener("storage", read); return () => window.removeEventListener("storage", read);
  }, []);
  function download() {
    const url = URL.createObjectURL(new Blob([encodeEvidence(items)], { type: "application/json" })), a = document.createElement("a");
    a.href = url; a.download = `fest-compass-evidence-${new Date().toISOString().slice(0, 10)}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function restore(file?: File) {
    if (!file) return;
    try { if (file.size > MAX_EVIDENCE_BYTES) throw new Error("근거 파일은 2MB 이하여야 합니다."); const result = storeEvidence(parseEvidence(await file.text())); setItems(result.items); setMessage(`근거 ${result.added}개를 추가했습니다. 기존 근거와 같은 자료는 중복 저장하지 않습니다.`); }
    catch (e) { setMessage(e instanceof Error ? e.message : "근거를 저장하지 못했습니다."); }
  }
  return <div className="space-y-6"><header><p className="text-xs font-extrabold text-blue">지역 자료에서 올해 기획으로</p><h1 className="mt-2 text-3xl font-extrabold">담은 기획 근거</h1><p className="mt-3 text-sm leading-7 text-muted">선택 당시 값·조회 조건·누락·출처를 보관합니다. 원천이 바뀌어도 이 사본은 유지됩니다. 이 브라우저에만 저장되므로 파일로도 보관하세요.</p></header>
    <div className="flex flex-wrap gap-2"><Link href="/regions" className="region-primary">지도에서 자료 더 찾기</Link><button className="region-button" onClick={download} disabled={!items.length}>근거 파일 보관</button><label className="region-button cursor-pointer">근거 파일 가져오기<input className="sr-only" type="file" accept="application/json,.json" onChange={e => { void restore(e.target.files?.[0]); e.target.value = ""; }} /></label><Link href="/workspace" className="region-button">내 작업공간 →</Link></div>
    <p className="text-sm text-muted">기획 후보·예산안에 이 근거를 직접 연결하는 기능은 다음 단계입니다. 현재는 보관 자료를 확인하며 개인 운영안을 작성할 수 있습니다.</p>
    {message && <p role="status" className="rounded-xl bg-blue-soft p-4 text-sm">{message}</p>}
    {!ready ? <p role="status">보관 근거를 불러오고 있습니다.</p> : !items.length ? <p className="region-card">아직 담은 지역 근거가 없습니다. 축제 비교 근거는 아래에서 확인할 수 있습니다.</p> : <p className="font-bold">보관 근거 {items.length}개 / 최대 50개</p>}
    {items.map(item => <article key={item.id} className="region-card space-y-3"><h2 className="text-xl font-extrabold">{item.title}</h2><p className="text-sm text-muted">{item.result.region.provinceName} · {item.result.region.districtName} · 조회 기간 {item.result.query.start} ~ {item.result.query.end}</p><p className="text-xs text-muted">담은 시각: {new Date(item.savedAt).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}</p>
      {item.result.resources.items.map(r => <div key={r.id} className="rounded-xl bg-paper p-4 text-sm leading-7"><p>{r.address || "주소 미확보"}</p><p>{r.start ? `행사 일정 ${r.start} ~ ${r.end}` : "현재 등록 자원 · 과거 사용 가능 여부 미확인"}</p><p>자료 조회 시각: {item.result.resources.collectedAt}</p><p>항목 {r.id} · 좌표 {r.longitude ?? "미확보"}, {r.latitude ?? "미확보"}</p><p>전체 조회 {item.result.resources.total ?? "미확보"}건 중 선택한 1건 · 장소 사용 조건 별도 확인</p></div>)}
      {!!item.result.history.points.length && <><p className="text-sm">{item.result.history.metric} · {item.result.history.unit}<br />선택 {item.result.history.points.length}일 · 미확보 {item.result.history.points.filter(p => p.value === null).length}일 · 합산하지 않은 일별 값</p><details><summary className="cursor-pointer text-sm font-bold">보관한 수치와 출처 식별자</summary><div className="max-h-80 overflow-auto"><table className="w-full text-left text-xs"><thead><tr><th className="p-2">날짜</th><th className="p-2">값</th><th className="p-2">수집 시각 · 원천</th></tr></thead><tbody>{item.result.history.points.map(p => <tr key={p.date} className="border-t border-ink/10"><td className="p-2">{p.date}</td><td className="p-2">{p.value?.toLocaleString("ko-KR") ?? "미확보"}</td><td className="p-2"><span>{p.collectedAt ?? "미확보"}</span><span className="block max-w-48 truncate" title={p.snapshotId ?? ""}>{p.snapshotId ?? "원천 없음"}</span></td></tr>)}</tbody></table></div></details><p className="text-xs leading-6 text-muted">{item.result.history.message}</p></>}
      <p className="whitespace-pre-wrap rounded-xl border border-ink/10 p-3 text-sm">참고 이유: {item.note || "메모 없음"}</p><a href={"resourceId" in item.selection ? item.result.resources.source : item.result.history.source} target="_blank" rel="noreferrer" className="text-sm font-bold text-blue underline">공공데이터 원천 확인 ↗</a>
      {"resourceId" in item.selection && item.selection.mapBounds && <p className="text-xs text-muted">지도 공간 필터 (서·남·동·북 경위도): {item.selection.mapBounds.map(n => n.toFixed(4)).join(", ")}</p>}
    </article>)}
  </div>;
}
