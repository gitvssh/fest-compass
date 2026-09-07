import type { Metadata } from "next";
import Link from "next/link";
import { loadRuntimeSummary } from "@/lib/forecast/runtime";
import { canonicalUrl } from "@/lib/site";

export const metadata: Metadata = {
  title: "논산 수집 자료와 사전 예측 기록",
  description: "논산시 방문 자료의 기준일·누락과 대상일 전에 저장한 예측을 확인합니다. 발행 당시 입력을 보존하고 이후 관측과 비교합니다.",
  alternates: { canonical: canonicalUrl("/forecast/records") },
};
const number = (n: number | null, digits = 1) => n === null ? "제공 불가" : n.toLocaleString("ko-KR", { maximumFractionDigits: digits });
const time = (date: string) => new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", dateStyle: "medium", timeStyle: "short", hour12: false }).format(new Date(date));
const outcomeLabels: Record<string, string> = { "not-yet-occurred": "대상일 전", "waiting-provider": "자료 제공 대기", "invalid-observation": "자료 오류", observed: "관측 확보" };
const reasonLabels: Record<string, string> = { "no-observations": "방문 자료 없음", "observations-too-old": "최근 방문 자료 부족",
  "collection-too-old": "최근 수집 필요", "insufficient-training-history": "학습 이력 부족", "recent-history-unavailable": "최근 입력 기간 누락",
  "four-weekdays-unavailable": "같은 요일 자료 부족", "previous-year-unavailable": "전년 자료 없음", "nonfinite-model-result": "계산 불가" };

export default async function ForecastRecordsPage() {
  const { summary, source, workerAlive } = await loadRuntimeSummary();
  const { monitor } = summary, { coverage, comparison } = monitor;
  const automatic = summary.automation;
  const automationTitle = source === "bundled" ? "보관 기록 사용 가능 · 자동 수집 연결 필요"
    : source === "unavailable" ? "최신 수집 기록 확인 필요"
    : !workerAlive ? "자동 수집 연결 확인 필요"
    : automatic?.status === "failed" ? "오늘 자동 처리 확인 필요" : "매일 09시 자동 수집 · 예측 결과 확인";
  return <div className="space-y-6">
    <div>
      <Link href="/forecast" className="text-sm font-bold text-blue">← 2025년 축제 예측 실험</Link>
      <p className="mt-5 text-xs font-extrabold text-blue">{summary.generatedAt.slice(0, 10)} 조회 기록 · 논산시 외지인 방문 추세</p>
      <h1 className="mt-2 text-3xl font-extrabold sm:text-4xl">수집 자료와 사전 예측 기록</h1>
      <p className="mt-3 max-w-3xl text-muted">자료가 어디까지 제공됐는지 확인하고, 대상일 전에 발행한 예측을 나중에 들어오는 지역 관측과 비교합니다. 축제장 입장객과 시간별 혼잡은 별도 자료가 필요합니다.</p>
    </div>
    <section className="rounded-3xl border border-blue/20 bg-blue-soft p-5">
      <h2 className="font-extrabold">{automationTitle}</h2>
      <p className="mt-2 text-sm leading-relaxed">이 화면의 자료 확인 시각은 {time(summary.generatedAt)} 한국시각입니다. {source === "live" ? "서버에 저장된 최신 기록을 읽습니다. 새로고침하면 이후 수집 결과를 확인할 수 있습니다." : source === "unavailable" ? "최신 기록을 읽을 수 없어 보관된 사례를 표시합니다. 수집 상태 확인이 필요합니다." : "현재는 보관된 사례를 표시합니다."} 다음 논산딸기축제 회차는 일정 근거를 확보한 뒤 등록합니다.</p>
      {automatic && <p className="mt-2 text-sm">마지막 자동 처리: {time(automatic.completedAt)} · API 요청 {automatic.calls}회 · {automatic.status === "failed" ? "처리 실패" : automatic.status === "partial" ? "수집 완료, 누락 자료 있음" : "수집 완료"} · 다음 예정 {time(automatic.nextRunAt)} 한국시각</p>}
      {automatic?.error && <p className="mt-2 text-sm text-coral">{automatic.error === "daily-storage-limit" ? "자료 보관 공간 점검이 필요합니다." : automatic.error === "history-access-or-quota-stop" ? "데이터 제공처의 접근 허용 또는 호출 한도를 확인해야 합니다." : "오늘 처리를 끝내지 못했습니다. 저장된 자료와 실패 기록을 확인해야 합니다."} 누락을 0으로 대체하거나 지난 시각의 예측을 새로 만들지 않습니다.</p>}
    </section>
    <div className="grid gap-4 sm:grid-cols-3">
      <div className="rounded-2xl bg-white p-5 shadow-card"><p className="text-sm text-muted">확보한 마지막 자료 기준일</p><p className="mt-2 text-2xl font-extrabold">{coverage.latestObservation ?? "없음"}</p><p className="mt-2 text-xs text-muted">조회 당시 {coverage.observationAgeDays}일 전 자료 · 실시간 현황 아님</p></div>
      <div className="rounded-2xl bg-white p-5 shadow-card"><p className="text-sm text-muted">조회 범위 중 누락</p><p className="mt-2 text-2xl font-extrabold text-coral">{coverage.missingDates.length}일</p><p className="mt-2 text-xs text-muted">값이 없는 날은 0으로 계산하지 않음</p></div>
      <div className="rounded-2xl bg-white p-5 shadow-card"><p className="text-sm text-muted">같은 날짜를 다시 확인</p><p className="mt-2 text-2xl font-extrabold">{comparison.repeatedDays}일</p><p className="mt-2 text-xs text-muted">이 관측 사이의 외지인 값·품질 변경 {comparison.changes.length}건</p></div>
    </div>
    <section className="rounded-3xl bg-white p-5 shadow-card sm:p-7">
      <h2 className="text-xl font-extrabold">현재 확보한 자료의 범위</h2>
      <p className="mt-3 text-sm leading-relaxed"><a className="font-bold text-blue underline" href={monitor.source}>한국관광공사 지역별 방문자수</a>의 {coverage.start}~{coverage.end} 중 {number(coverage.availableDays, 0)}일을 확보했습니다. 통신 기반 지역 추정치이며, 일별 값을 더해 축제 순방문객을 만들지 않습니다.</p>
      <p className="mt-3 text-sm text-muted">실제 공개 시각은 확인되지 않았습니다. 마지막 자료가 {coverage.observationAgeDays}일 전이라는 사실만으로 API 공개 지연을 확정할 수 없습니다. 값이 없던 날에 새 값이 나타난 관측 구간은 현재 {comparison.availabilityTransitions.length}건입니다.</p>
      <details className="mt-4 text-sm"><summary className="cursor-pointer font-bold">누락 날짜와 수집 시각</summary>
        <p className="mt-3">마지막 수집: {coverage.latestCollectionAt ? time(coverage.latestCollectionAt) : "없음"} 한국시각</p>
        <p className="mt-2 leading-relaxed">누락: {coverage.missingDates.length ? coverage.missingDates.join(", ") : "없음"}</p>
        <p className="mt-2">확보 기간 내부 누락 {coverage.interiorMissing.length}일 · 최신 자료 뒤 누락 {coverage.trailingMissing.length}일 · 오류 {coverage.invalidDates.length}일</p>
      </details>
    </section>
    <section className="space-y-4">
      <div><h2 className="text-xl font-extrabold">대상일 전에 저장한 지역 예측</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">일반 날짜의 사전 검증 기록입니다. 요일·계절·최근 추세를 학습한 모델을 사용하며, 축제에 따른 추가 유입은 아직 학습하지 않았습니다. 기존 실험에서 오차 범위의 포함률이 부족해 이번 발행에는 범위를 제공하지 않습니다.</p></div>
      {summary.records.map((record) => <article key={record.id} className="rounded-3xl bg-white p-5 shadow-card sm:p-7">
        <p className="text-xs font-extrabold text-blue">{record.request.target.kind === "regional-check" ? "일반 날짜 검증" : "축제 회차"} · 시작 {record.request.horizonDays}일 전 발행 · {record.status === "issued" ? "예측 저장 완료" : "예측 제공 불가 기록"}</p>
        <h3 className="mt-2 text-xl font-extrabold">{record.request.target.start}~{record.request.target.end}</h3>
        <p className="mt-2 text-sm">발행: {time(record.issuedAt)} 한국시각 · 마지막 입력일 {record.lastInputDate ?? "없음"}</p>
        {record.latenessSeconds > 0 && <p className="mt-2 text-xs text-muted">예정 시각 09:00보다 늦게 발행했습니다. 실제 발행 시각까지 확보한 입력으로 저장했습니다.</p>}
        <div className="mt-5 overflow-x-auto"><table className="w-full min-w-[560px] text-left text-sm">
          <caption className="mb-3 text-left text-xs text-muted">방문 추세 지수 · 발행 당시 최근 같은 요일 4회 중앙값 = 100</caption>
          <thead><tr className="border-b border-ink/10">{["날짜", "학습 모델", "전년 같은 요일", "사후 관측", "결과 확인 상태"].map((title) => <th key={title} className="px-3 py-3">{title}</th>)}</tr></thead>
          <tbody>{record.predictions.map((row) => {
            const actual = record.assessment?.rows.find((r) => r.date === row.date), base = row.predictions.B1.value;
            const actualIndex = actual?.actual != null && base !== null && base > 0 ? actual.actual / base * 100 : null;
            return <tr key={row.date} className="border-b border-ink/10"><th className="px-3 py-3">{row.date.slice(5)}</th>
              <td className="px-3 py-3 font-bold text-blue">{number(row.predictions.ridge.index)}{row.predictions.ridge.reason && <span className="block text-xs font-normal">{reasonLabels[row.predictions.ridge.reason] ?? "제공 불가"}</span>}</td>
              <td className="px-3 py-3">{number(row.predictions.B2.index)}</td><td className="px-3 py-3">{actualIndex === null ? "—" : number(actualIndex)}</td>
              <td className="px-3 py-3">{actual ? outcomeLabels[actual.status] ?? "확인 필요" : "결과 확인 전"}</td></tr>;
          })}</tbody>
        </table></div>
        <p className="mt-3 text-xs text-muted sm:hidden">표를 좌우로 밀면 사후 관측과 확인 상태를 볼 수 있습니다.</p>
        <p className="mt-3 text-sm text-muted">{record.assessment ? <>결과 확인 기준: {time(record.assessment.assessedAt)} 한국시각 · 관측 {record.assessment.observedDays}일 · 세 방법을 함께 비교할 수 있는 날짜 {record.assessment.comparableDays}일</> : "아직 결과 확인 기록이 없습니다."}</p>
        {record.assessment && record.assessment.comparableDays > 0 && <p className="mt-2 text-sm">모델 평균 절대오차 {number(record.assessment.metrics.ridge.mae, 0)} 추정 인원 · 오차 비율 {record.assessment.metrics.ridge.wape === null ? "계산 불가" : `${number(record.assessment.metrics.ridge.wape * 100)}%`}</p>}
        <details className="mt-4 text-xs text-muted"><summary className="cursor-pointer font-bold">발행 당시 자료·모델 확인</summary>
          <p className="mt-2 break-all">예측 기록: {record.id}</p>
          <p className="mt-2">모델: {record.policy.modelVersion} · 학습 {number(record.trainingSamples, 0)}일 · 입력 마감일 {record.inputCutoff}</p>
          <p className="mt-2 leading-relaxed">기존 실험과 같은 입력 지연 {record.policy.inputLagDays}일·규제 강도 {record.policy.lambda}을 유지했습니다. 이는 모델 설정이며 API의 실제 공개 지연이 아닙니다. 입력 수집본과 계수는 발행 기록에 보존됩니다.</p>
          {record.snapshots.map((s) => <p key={s.archiveId} className="mt-2 break-all">자료 버전: {s.snapshotId}</p>)}
        </details>
      </article>)}
      {automatic && <div className="rounded-3xl bg-white p-5 shadow-card"><h3 className="text-lg font-extrabold">등록된 사전 발행 일정</h3>
        <ul className="mt-3 space-y-2 text-sm">{automatic.schedule.map((entry) => <li key={entry.requestId}>{entry.start} 시작 · {entry.horizonDays}일 전인 {entry.dueDate} 발행 · {entry.status === "recorded" ? "기록 보존됨" : entry.status === "missed" ? "발행일 지남, 소급 발행하지 않음" : "발행 예정"}</li>)}</ul>
      </div>}
    </section>
  </div>;
}
