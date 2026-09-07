import type { Metadata } from "next";
import Link from "next/link";
import report from "@/data/nonsan-festival-history-summary.json";
import sources from "@/data/nonsan-history-sources.json";
import { canonicalUrl } from "@/lib/site";

export const metadata: Metadata = { title: "축제 이력을 보강한 논산 예측 비교", description: "2022년 방문 이력으로 2023년 축제까지 학습한 결과입니다. 평균 오차 개선과 최근 회차의 악화를 함께 비교합니다.",
  alternates: { canonical: canonicalUrl("/forecast/history") } };
const labels = { ridge: "기존 기본 모델", original: "기존 공휴일·축제 모델", extended: "이력 보강 모델", without2023: "보강 후 2023년 축제 제외" };
const methods = ["ridge", "original", "extended", "without2023"] as const;
const number = (v: number | null, digits = 0) => v === null ? "—" : v.toLocaleString("ko-KR", { maximumFractionDigits: digits });
const percent = (v: number | null) => v === null ? "—" : `${number(v * 100, 1)}%`;
const total = (v: Record<string, number> | undefined) => v ? Object.values(v).reduce((a, b) => a + b, 0) : 0;

export default async function FestivalHistoryPage({ searchParams }: { searchParams: Promise<{ horizon?: string }> }) {
  const horizon = (await searchParams).horizon === "7" ? 7 : 28;
  const run = report.runs.find((r) => r.horizonDays === horizon)!;
  const original = run.comparison.methods.original, extended = run.comparison.methods.extended;
  const improvement = original.mae && extended.mae !== null ? 1 - extended.mae / original.mae : null;
  return <div className="space-y-6">
    <div>
      <div className="flex flex-wrap gap-4 text-sm font-bold text-blue"><Link href="/forecast/calendar">← 공휴일·축제 모델과 겨울 시험</Link><Link href="/forecast/records">수집 자료와 예측 기록 →</Link></div>
      <p className="mt-5 text-xs font-extrabold text-blue">논산시 일별 외지인 추정치 · 과거 자료 개발 비교</p>
      <h1 className="mt-2 text-3xl font-extrabold sm:text-4xl">축제 이력을 보강한 예측 비교</h1>
      <p className="mt-3 max-w-3xl leading-relaxed text-muted">2022년 방문 이력 365일을 확보해, 앞선 자료가 부족했던 2023년 축제 5일까지 학습했습니다. 같은 과거 날짜에서 평균 오차는 줄었지만 최근 축제 회차에서는 커졌습니다. 행사장 입장객과 시간별 혼잡을 예측하는 모델은 아닙니다.</p>
    </div>
    <nav aria-label="예측 선행기간" className="flex flex-wrap gap-2">{[28, 7].map((h) => <Link key={h} href={`/forecast/history?horizon=${h}`}
      aria-current={horizon === h ? "page" : undefined} className={`rounded-xl px-4 py-2 text-sm font-bold ${horizon === h ? "bg-ink text-white" : "bg-white text-ink shadow-card"}`}>시작 {h}일 전 예측</Link>)}</nav>
    <section className="rounded-3xl border border-blue/20 bg-blue-soft p-5 sm:p-7">
      <h2 className="text-xl font-extrabold">개발 비교 사용 가능 · 새 회차 검증 필요</h2>
      <p className="mt-3 leading-relaxed">같은 {run.comparison.common}일에서 기존 공휴일·축제 모델보다 평균 절대오차가 <strong>{percent(improvement)}</strong> 작아졌습니다.
        오차는 {number(original.mae)}에서 {number(extended.mae)} 추정 인원으로 줄었습니다.</p>
      <p className="mt-3 leading-relaxed"><strong>2024년 개선, 2025·2026년 축제일 악화</strong>가 함께 나타났습니다. 한 회차를 추가한 효과가 모든 해에 반복되지는 않았습니다. 실제 향후 결과를 확인하기 전에는 축제 운영에 채택하지 않습니다.</p>
      <p className="mt-3 text-sm leading-relaxed">등록된 겨울 공휴일 시험은 기존 계획으로 진행됩니다. 이 연구 결과가 자동 발행 모델을 바꾸지는 않습니다.</p>
    </section>
    <section className="rounded-3xl bg-white p-5 shadow-card sm:p-7">
      <h2 className="text-xl font-extrabold">앞선 자료가 없어서 빠졌던 축제 5일</h2>
      <p className="mt-3 text-sm leading-relaxed text-muted">학습과 비교에 사용할 수 있는 방문 이력은 {number(report.observations)}일입니다. 2022년은 과거 입력으로만 쓰고, 축제 정답은 2023년 이후 현장 행사에서 학습했습니다.</p>
      <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[460px] text-left text-sm">
        <caption className="mb-2 text-left text-xs text-muted">각 회차의 첫 예측 시점에 학습에 포함된 이전 축제일 수</caption>
        <thead><tr>{["예측할 회차", "보강 전", "보강 후", "추가된 정답"].map((s) => <th className="p-3" key={s}>{s}</th>)}</tr></thead>
        <tbody>{run.training.map((t) => <tr key={t.year} className="border-t border-ink/10"><th className="p-3">{t.year}년</th>
          <td className="p-3">{total(t.original?.festivalTargets)}일</td><td className="p-3 font-bold">{total(t.extended?.festivalTargets)}일</td><td className="p-3">2023년 5일</td></tr>)}</tbody>
      </table></div>
      <p className="mt-3 text-sm leading-relaxed">2022년 2월 23~27일 행사는 비대면 중심으로 안내됐습니다. 현장 판매·체험도 언급됐으므로 오프라인 활동이 없었다는 뜻은 아닙니다. 현장 축제와 같은 정답으로 합치지 않았습니다.</p>
    </section>
    <section className="rounded-3xl bg-white p-5 shadow-card sm:p-7">
      <h2 className="text-xl font-extrabold">같은 날짜의 네 가지 비교</h2>
      <p className="mt-3 text-sm leading-relaxed text-muted">원래 평가한 2024~2026년 {run.weeklyWindows}개 목~일 창·{run.comparison.expected}일을 그대로 사용했습니다.
        네 방법 모두 제공한 {run.comparison.common}일의 오차입니다. 일정이 알려지지 않았던 날짜는 보강 후에도 비어 있습니다.</p>
      <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[650px] text-left text-sm">
        <caption className="mb-2 text-left text-xs text-muted">평균 절대오차·편향 단위는 일별 외지인 추정 인원이며, 음의 편향은 과소예측입니다.</caption>
        <thead><tr>{["방법", "제공일", "평균 절대오차", "오차 비율", "편향"].map((s) => <th key={s} className="p-3">{s}</th>)}</tr></thead>
        <tbody>{methods.map((m) => { const s = run.comparison.methods[m]; return <tr key={m} className="border-t border-ink/10">
          <th className="p-3">{labels[m]}</th><td className="p-3">{s.available}/{run.comparison.expected}</td><td className="p-3 font-bold">{number(s.mae)}</td><td className="p-3">{percent(s.wape)}</td><td className="p-3">{number(s.bias)}</td></tr>; })}</tbody>
      </table></div>
      <p className="mt-3 text-sm leading-relaxed">마지막 방법은 보강한 자료에서 2023년 축제 정답 5일만 빼고 다시 학습한 결과입니다. 최근 방문 추세에는 당시 값이 남아 있으므로 축제가 일으킨 방문 증가를 계산하는 실험은 아닙니다.</p>
    </section>
    <section className="rounded-3xl bg-white p-5 shadow-card sm:p-7">
      <h2 className="text-xl font-extrabold">회차별 결과: 최근 두 축제에서는 오차 증가</h2>
      <p className="mt-3 text-sm leading-relaxed text-muted">축제일 비교는 회차당 4일, 총 {run.groups.festival.common}일뿐입니다. 평균을 낮춘 회차와 악화된 회차를 함께 봐야 합니다.</p>
      <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[590px] text-left text-sm">
        <caption className="mb-2 text-left text-xs text-muted">축제일 평균 절대오차 · 작을수록 좋음</caption>
        <thead><tr>{["축제", "보강 전", "보강 후", "2023년 제외", "보강 결과"].map((s) => <th key={s} className="p-3">{s}</th>)}</tr></thead>
        <tbody>{run.festivalFolds.map((f) => <tr key={f.year} className="border-t border-ink/10"><th className="p-3">{f.year}년 · {f.common}일</th>
          <td className="p-3">{number(f.methods.original.mae)}</td><td className="p-3 font-bold">{number(f.methods.extended.mae)}</td><td className="p-3">{number(f.methods.without2023.mae)}</td>
          <td className="p-3">{f.methods.original.mae === null || f.methods.extended.mae === null ? "비교 대기" : f.methods.extended.mae < f.methods.original.mae ? "오차 감소" : "오차 증가"}</td></tr>)}</tbody>
      </table></div>
      <p className="mt-3 text-sm leading-relaxed">전체 축제일의 보강 후 편향도 {number(run.groups.festival.methods.extended.bias)}로 여전히 과소예측입니다. 2027년 24일 딸기산업엑스포와 새 회차 성능은 별도 검증이 필요합니다.</p>
      <details className="mt-4 text-sm"><summary className="cursor-pointer font-bold">연도별 전체 공통 날짜의 오차</summary>
        <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[520px] text-left text-sm"><thead><tr>{["연도", "공통일", "보강 전", "보강 후", "2023년 제외"].map((s) => <th key={s} className="p-3">{s}</th>)}</tr></thead>
          <tbody>{run.folds.map((f) => <tr key={f.year} className="border-t border-ink/10"><th className="p-3">{f.year}</th><td className="p-3">{f.common}</td>
            <td className="p-3">{number(f.methods.original.mae)}</td><td className="p-3">{number(f.methods.extended.mae)}</td><td className="p-3">{number(f.methods.without2023.mae)}</td></tr>)}</tbody></table></div>
      </details>
    </section>
    <section className="rounded-3xl bg-white p-5 shadow-card sm:p-7">
      <h2 className="text-xl font-extrabold">근거와 남은 확인</h2>
      <p className="mt-3 text-sm leading-relaxed">한국관광공사의 2022년 월별 자료를 36회 조회해 365일을 모두 확인했습니다. 누락·오류는 0일입니다. 현재 수집한 개정 자료이며 당시 공개본을 보관해 둔 엄격한 과거 재현은 아닙니다. 공개 지연은 35일을 가정했습니다.</p>
      <ul className="mt-4 space-y-3 text-sm">
        <li><a className="text-blue underline" href={sources.excludedEdition.source.url}>2022년 행사 방식·일정: 서울시 지역상생교류사업단</a> · 게시 2022-02-17, 직접 확인 2026-09-07</li>
        <li><Link className="text-blue underline" href="/forecast/calendar">2023~2026년 공식 일정·기존 모델·겨울 사전 시험</Link></li>
      </ul>
      <p className="mt-4 text-sm leading-relaxed">다음 확인은 여러 회차에서 반복되는 오차의 원인과 비교 가능한 축제 자료, 현장 방문·교통·운영 기록입니다. 과거 자료의 평균 개선을 실제 운영 효과로 표현하지 않습니다.</p>
      <details className="mt-4 text-sm"><summary className="cursor-pointer font-bold">재현 자료 정보</summary>
        <p className="mt-3">보강 모델 {number(report.modelCount)}개 · 규제 강도 {report.policy.lambda} · 기존 계산식과 달력 유지. 계수·학습 정답·입력·모든 예측·주별 비교를 저장했습니다.</p>
        <p className="mt-3 break-all text-xs">보고서 해시: {report.reportHash}</p>
      </details>
    </section>
  </div>;
}
