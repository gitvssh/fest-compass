import type { Metadata } from "next";
import Link from "next/link";
import report from "@/data/nonsan-calendar-summary.json";
import calendar from "@/data/nonsan-calendar.json";
import plan from "@/data/calendar-trial-plan.json";
import { loadRuntimeSummary } from "@/lib/forecast/runtime";
import { canonicalUrl } from "@/lib/site";

export const metadata: Metadata = { title: "공휴일·축제를 반영한 논산 예측 비교", description: "과거 일별 방문 이력으로 학습한 네 모델의 오차와 제공 범위를 비교하고, 겨울 공휴일 사전 시험의 등록·발행·결과 대기를 확인합니다.",
  alternates: { canonical: canonicalUrl("/forecast/calendar") } };
const labels = { B1: "최근 같은 요일", B2: "전년 같은 요일", ridge: "기존 모델", holiday: "공휴일 반영", festival: "축제 반영", combined: "공휴일·축제 반영" };
type Method = keyof typeof labels;
const methods: Method[] = ["ridge", "holiday", "festival", "combined", "B1", "B2"];
const number = (v: number | null, digits = 0) => v === null ? "—" : v.toLocaleString("ko-KR", { maximumFractionDigits: digits });
const percent = (v: number | null) => v === null ? "—" : `${number(v * 100, 1)}%`;
const time = (v: string) => new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", dateStyle: "medium", timeStyle: "short", hour12: false }).format(new Date(v));
const statusLabels: Record<string, string> = { upcoming: "발행 예정", issued: "예측 저장됨", withheld: "입력 부족으로 보류", missed: "발행일 지남", "collection-failed": "오늘 수집 실패로 발행 보류" };

export default async function CalendarForecastPage({ searchParams }: { searchParams: Promise<{ horizon?: string }> }) {
  const horizon = (await searchParams).horizon === "7" ? 7 : 28;
  const run = report.runs.find((r) => r.horizonDays === horizon)!;
  const { summary, source, workerAlive } = await loadRuntimeSummary();
  const trial = summary.calendarTrial?.planId === plan.id ? summary.calendarTrial : null;
  const live = source === "live" && trial !== null;
  const trialStatus = summary.calendarTrialError ? "시험 자동 처리 확인 필요" : live && workerAlive ? "사전 시험 등록 완료 · 매일 자동 확인" : "시험 목록 준비됨 · 자동 처리 연결 확인 필요";
  const selected = run.selection.candidate as keyof typeof run.selection.comparison.methods;
  const reference = run.selection.reference as keyof typeof run.selection.comparison.methods;
  const primary = trial?.comparisons.find((c) => c.horizonDays === horizon && c.maturityDays === 60);
  const selection = run.selection.comparison.methods;
  return <div className="space-y-6">
    <div>
      <div className="flex flex-wrap gap-4 text-sm font-bold text-blue"><Link href="/forecast">← 2025년 첫 모델 실험</Link><Link href="/forecast/records">수집 자료와 기존 예측 기록 →</Link></div>
      <p className="mt-5 text-xs font-extrabold text-blue">논산시 일별 외지인 추정치 · 개발 자료 비교</p>
      <h1 className="mt-2 text-3xl font-extrabold sm:text-4xl">공휴일과 축제를 반영하면 예측이 나아질까?</h1>
      <p className="mt-3 max-w-3xl leading-relaxed text-muted">공식 일정과 과거 방문 이력으로 네 모델을 학습했습니다. 이미 확인한 과거 자료에서는 오차가 줄었으며, 앞으로 발행하는 겨울 예측에서 다시 확인합니다. 축제장 입장객이나 시간별 혼잡을 예측한 결과는 아닙니다.</p>
    </div>
    <nav aria-label="예측 선행기간" className="flex flex-wrap gap-2">
      {[28, 7].map((h) => <Link key={h} href={`/forecast/calendar?horizon=${h}`} aria-current={horizon === h ? "page" : undefined}
        className={`rounded-xl px-4 py-2 text-sm font-bold ${horizon === h ? "bg-ink text-white" : "bg-white text-ink shadow-card"}`}>시작 {h}일 전 예측</Link>)}
    </nav>
    <section className="rounded-3xl border border-blue/20 bg-blue-soft p-5 sm:p-7">
      <h2 className="text-xl font-extrabold">겨울 시험 후보: {labels[selected]}</h2>
      <p className="mt-3 leading-relaxed">개발 자료의 같은 {run.selection.comparison.common}일에서 {labels[reference]}보다 평균 절대오차가 <strong>{percent(run.selection.relativeMAEImprovement)}</strong> 작았습니다.
        평균 오차는 {number(selection[reference].mae)}에서 {number(selection[selected].mae)} 추정 인원으로 줄었습니다.</p>
      <p className="mt-3 text-sm leading-relaxed">2024~2026년은 이미 열람한 개발 자료입니다. 이 수치만으로 향후 정확도를 확정하지 않습니다. 축제 입력 후보는 2027년 기존 축제 일정이 확인되지 않아 이번 겨울 시험에서 제외했습니다.</p>
    </section>
    <section className="rounded-3xl bg-white p-5 shadow-card sm:p-7">
      <h2 className="text-xl font-extrabold">네 모델과 단순 기준의 과거 오차</h2>
      <p className="mt-3 text-sm leading-relaxed text-muted">2023년부터 이력을 쌓아 2024~2026년 {run.weeklyWindows}개 목~일 창, {run.comparison.expected}일을 시간 순서대로 비교했습니다.
        아래 오차는 여섯 방법 모두 예측을 제공한 동일한 {run.comparison.common}일 기준입니다. 위 겨울 후보 선정과 비교 날짜 수가 다릅니다.</p>
      <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[620px] text-left text-sm">
        <caption className="mb-2 text-left text-xs text-muted">평균 절대오차와 편향 단위: 일별 외지인 추정 인원. 음의 편향은 과소예측입니다.</caption>
        <thead><tr className="border-b border-ink/10">{["방법", "예측 제공일", "평균 절대오차", "오차 비율", "편향"].map((v) => <th className="px-3 py-3" key={v}>{v}</th>)}</tr></thead>
        <tbody>{methods.map((m) => { const s = run.comparison.methods[m]; return <tr key={m} className="border-b border-ink/10">
          <th className="px-3 py-3">{labels[m]}</th><td className="px-3 py-3">{s.available}/{run.comparison.expected}</td>
          <td className="px-3 py-3 font-bold">{number(s.mae)}</td><td className="px-3 py-3">{percent(s.wape)}</td><td className="px-3 py-3">{number(s.bias)}</td></tr>; })}</tbody>
      </table></div>
      <p className="mt-3 text-xs leading-relaxed text-muted">공휴일 목록이나 해당 연도의 축제 일정이 당시 확인되지 않은 입력은 비워 둡니다. 축제 입력 후보는 이 때문에 일부 학습일과 예측일도 빠졌습니다. 네 모델의 차이를 순수한 행사 효과의 크기로 해석하지 않습니다.</p>
      <details className="mt-5 text-sm"><summary className="cursor-pointer font-bold">연도별 오차와 축제일의 한계</summary>
        <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[540px] text-left text-sm"><caption className="mb-2 text-left text-xs text-muted">각 연도의 공통 날짜에서 비교한 평균 절대오차</caption>
          <thead><tr>{["연도", "비교일", ...methods.slice(0, 4).map((m) => labels[m])].map((s) => <th className="p-2" key={s}>{s}</th>)}</tr></thead>
          <tbody>{run.folds.map((fold) => <tr key={fold.year} className="border-t border-ink/10"><th className="p-2">{fold.year}</th><td className="p-2">{fold.common}</td>{methods.slice(0, 4).map((m) => <td className="p-2" key={m}>{number(fold.methods[m].mae)}</td>)}</tr>)}</tbody>
        </table></div>
        <p className="mt-3 leading-relaxed">축제일 비교는 {run.groups.festival.common}일뿐입니다. 기존 모델 오차 {number(run.groups.festival.methods.ridge.mae)}, 공휴일·축제 모델 오차 {number(run.groups.festival.methods.combined.mae)}이며, 새 축제 회차에서 검증한 결과는 아닙니다. 2027년 24일 엑스포는 별도 평가가 필요합니다.</p>
      </details>
    </section>
    <section className="rounded-3xl bg-white p-5 shadow-card sm:p-7">
      <h2 className="text-xl font-extrabold">{trialStatus}</h2>
      <p className="mt-3 leading-relaxed">2026년 11월 5일~2027년 1월 31일의 목~일 13개 창·52일을 대상으로, 각 창의 28일 전과 7일 전에 예측합니다. 크리스마스와 신정을 포함합니다. 첫 예정 발행은 <strong>2026년 10월 8일 09시 한국시각</strong>입니다.</p>
      <p className="mt-3 text-sm">목록 고정: {time(plan.frozenAt)} 한국시각 · 발행 {trial?.issued ?? 0}/26건 · {horizon}일 전 예측의 60일 후 공통 결과 {primary?.common ?? 0}/52일</p>
      {live && <p className="mt-2 text-xs text-muted">운영 서비스 등록: {time(trial.registeredAt)} 한국시각 · 최근 확인 {time(summary.generatedAt)} 한국시각</p>}
      <p className="mt-3 text-sm leading-relaxed text-muted">각 날짜의 60일 후 정기 확인 값을 1차 결과로 고정합니다. 자료가 없거나 그날 실행을 놓치면 그대로 남기며, 90일 후 값과 개정은 별도로 비교합니다. 두 선행기간을 독립 표본으로 합치지 않습니다. 오차 범위는 아직 제공하지 않습니다.</p>
      <p className="mt-3 text-sm leading-relaxed">채택 조건은 선정 기준 대비 평균 오차 10% 이상 감소, 예측 제공일 비율 유지, 공휴일 포함 창의 과소예측 악화 없음입니다. 52일의 공통 결과가 부족하면 채택 판단을 보류합니다.</p>
      {primary && primary.common > 0 && <p className="mt-3 text-sm">현재 공통 결과 {primary.common}일: 시험 모델 오차 {number(primary.metrics.candidate.mae)} · 기존 모델 오차 {number(primary.metrics.ridge.mae)} · {primary.decision === "meets-preregistered-criteria" ? "사전 기준 충족, 제공 범위 검토 가능" : primary.decision === "retain-reference" ? "사전 기준 미충족, 기존 기준 유지" : "결과가 더 필요합니다"}</p>}
      <details className="mt-5 text-sm"><summary className="cursor-pointer font-bold">{horizon}일 전 발행 일정과 저장 결과</summary>
        <ul className="mt-3 space-y-2">{(trial?.schedule ?? plan.requests.map((r) => ({ requestId: r.requestId, start: r.target.start, horizonDays: r.horizonDays,
          dueDate: new Date(Date.parse(`${r.target.start}T00:00:00Z`) - r.horizonDays * 86_400_000).toISOString().slice(0, 10), status: "upcoming" }))).filter((s) => s.horizonDays === horizon)
          .map((s) => <li key={s.requestId}>{s.start} 시작 · {s.dueDate} 발행 · {statusLabels[s.status] ?? "확인 필요"}</li>)}</ul>
        {trial?.records.filter((r) => r.request.horizonDays === horizon).map((r) => <div key={r.id} className="mt-4 rounded-xl bg-paper p-3">
          <p className="font-bold">{r.request.target.start} 시작 · 실제 발행 {time(r.issuedAt)}</p>
          <ul className="mt-2 space-y-1">{r.predictions.map((p) => <li key={p.date}>{p.date}: 공휴일 모델 {number(p.candidate)} · 기존 모델 {number(p.reference.ridge ?? null)} 추정 인원{p.candidateReason ? " · 입력 부족으로 제공 보류" : ""}</li>)}</ul>
        </div>)}
      </details>
    </section>
    <section className="rounded-3xl bg-white p-5 shadow-card sm:p-7">
      <h2 className="text-xl font-extrabold">공식 일정과 재현 가능한 근거</h2>
      <p className="mt-3 text-sm leading-relaxed">2023~2026년 전체 전국 공휴일과 추가·임시 공휴일, 논산딸기축제 4회 일정을 직접 확인했습니다. 2027년 공휴일 입력은 이번 시험에 필요한 1월 1일~2월 1일만 확인했습니다. 날짜만 있는 게시물은 다음 날부터 알려진 것으로 계산합니다.</p>
      <p className="mt-3 text-sm leading-relaxed text-muted">현재 확보한 게시물과 개정 방문 자료로 과거를 재구성한 실험입니다. 당시 원본을 수집해 둔 기록은 아닙니다. 겨울 시험은 등록 당시 달력 버전을 고정하므로 이후 발표되는 변경은 자동 반영하지 않습니다.</p>
      <details className="mt-4 text-sm"><summary className="cursor-pointer font-bold">출처와 모델 설정 보기</summary>
        <ul className="mt-3 space-y-2">{calendar.sources.map((s) => <li key={s.id}><a href={s.url} className="text-blue underline">{s.id.startsWith("festival") ? `${s.id.slice(-4)}년 논산딸기축제 일정` : s.id.startsWith("annual") ? `${s.id.slice(7, 11)}년 월력요항` : `${s.publishedDate} 공휴일 추가 공지`}</a> · 게시 {s.publishedDate} · 직접 확인 {time(s.collectedAt)}</li>)}</ul>
        <p className="mt-4 leading-relaxed">학습 자료 {number(report.observations)}일 · 입력 지연 가정 35일 · 규제 강도 100. 실제 공개 지연을 측정한 값은 아닙니다. 후보별 계수·입력 목록·연도 제외 민감도와 모든 예측은 검증 자료에 보관됩니다.</p>
        <p className="mt-3 break-all text-xs">고정 시험 버전: {plan.id}</p>
      </details>
    </section>
  </div>;
}
