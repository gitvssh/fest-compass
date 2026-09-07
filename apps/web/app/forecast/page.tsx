import type { Metadata } from "next";
import Link from "next/link";
import summary from "@/data/nonsan-forecast-summary.json";
import { canonicalUrl } from "@/lib/site";

export const metadata: Metadata = {
  title: "논산 방문 추세 예측 실험",
  description: "논산시 3년의 일별 방문 자료로 학습한 모델과 단순 기준을 비교합니다. 2025년 축제 사례의 오차와 한계를 확인하세요.",
  alternates: { canonical: canonicalUrl("/forecast") },
};
const number = (value: number | null, digits = 0) => value === null ? "제공 불가" : value.toLocaleString("ko-KR", { maximumFractionDigits: digits, minimumFractionDigits: digits });
const percent = (value: number | null) => value === null ? "제공 불가" : `${number(value * 100, 1)}%`;
const labels = { B1: "최근 같은 요일 기준", B2: "전년 같은 요일 기준", ridge: "학습 모델" };
type Run = typeof summary.runs[number];
type Method = keyof typeof labels;
const methods: Method[] = ["B1", "B2", "ridge"];

function Comparison({ run }: { run: Run }) {
  const points = run.festival.map((row) => ({ date: row.date, predicted: row.predictions.ridge.index,
    actual: row.actual !== null && row.predictions.B1.value !== null && row.predictions.B1.value > 0 ? 100 * row.actual / row.predictions.B1.value : null }));
  const max = Math.max(150, Math.ceil(Math.max(...points.flatMap((p) => [p.predicted ?? 0, p.actual ?? 0])) / 50) * 50);
  const y = (value: number) => 255 - value / max * 215, x = (i: number) => 70 + i * 110;
  const line = (key: "predicted" | "actual") => points.map((p, i) => p[key] === null ? null : `${x(i)},${y(p[key]!)}`).filter(Boolean).join(" ");
  return (
    <figure className="mt-6 rounded-2xl bg-paper p-3">
      <figcaption className="px-2 text-sm font-bold">최근 같은 요일 기준을 100으로 둔 방문 추세</figcaption>
      <svg viewBox="0 0 440 310" role="img" aria-labelledby="forecast-chart-title forecast-chart-description" className="mx-auto mt-2 w-full max-w-2xl">
        <title id="forecast-chart-title">2025년 논산딸기축제의 지역 방문 추세: 모델 예측과 관측 비교</title>
        <desc id="forecast-chart-description">파란색은 모델 예측, 주황색은 나중에 확인한 지역 관측입니다. 아래 표에서 날짜별 값을 읽을 수 있습니다.</desc>
        {[0, 0.25, 0.5, 0.75, 1].map((fraction) => <g key={fraction}>
          <line x1="50" x2="420" y1={y(max * fraction)} y2={y(max * fraction)} stroke="#d5dce3" />
          <text x="40" y={y(max * fraction) + 5} textAnchor="end" fill="#536172" fontSize="18">{number(max * fraction)}</text>
        </g>)}
        <line x1="50" x2="420" y1={y(100)} y2={y(100)} stroke="#536172" strokeDasharray="6 5" />
        <polyline points={line("predicted")} fill="none" stroke="#2463eb" strokeWidth="3" />
        <polyline points={line("actual")} fill="none" stroke="#a94720" strokeWidth="3" />
        {points.map((p, i) => <g key={p.date}>
          {p.predicted !== null && <circle cx={x(i)} cy={y(p.predicted)} r="5" fill="#2463eb" />}
          {p.actual !== null && <rect x={x(i) - 5} y={y(p.actual) - 5} width="10" height="10" fill="#a94720" />}
          <text x={x(i)} y="283" textAnchor="middle" fill="#263747" fontSize="18">{p.date.slice(5).replace("-", "/")}</text>
        </g>)}
      </svg>
      <p className="flex flex-wrap justify-center gap-x-5 gap-y-1 text-xs"><span className="font-bold text-blue">● 모델 예측</span><span className="font-bold text-[#a94720]">■ 사후 지역 관측</span><span>점선: 최근 같은 요일 기준 100</span></p>
    </figure>
  );
}

export default async function ForecastPage({ searchParams }: { searchParams: Promise<{ horizon?: string; lag?: string }> }) {
  const params = await searchParams;
  const horizon = params.horizon === "7" ? 7 : 28;
  const lag = [7, 35, 60].includes(Number(params.lag)) ? Number(params.lag) : 35;
  const run = summary.runs.find((r) => r.horizonDays === horizon && r.lagDays === lag)!;
  const modelMetric = run.test.metrics.ridge, festivalMetric = run.groups.festival.metrics.ridge;
  const selectedBaseline = run.choice.baseline as "B1" | "B2", baselineMetric = run.test.metrics[selectedBaseline];
  const improvement = modelMetric.mae !== null && baselineMetric.mae !== null && baselineMetric.mae > 0 ? 1 - modelMetric.mae / baselineMetric.mae : null;
  const first = run.festival[0];
  return (
    <div className="space-y-6">
      <div>
        <Link href="/" className="text-sm font-bold text-blue">← 축제 목록</Link>
        <Link href="/forecast/records" className="ml-5 inline-block text-sm font-bold text-blue underline">수집 자료와 사전 예측 기록 →</Link>
        <p className="mt-5 text-xs font-extrabold tracking-wider text-blue">2025년 사례 · 과거 자료 실험</p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">논산딸기축제 방문 추세 예측</h1>
        <p className="mt-3 max-w-3xl text-muted">논산시의 2023~2025년 일별 이력으로 모델을 학습하고, 2025년의 선택된 날짜에서 예측과 관측을 비교했습니다. 대상은 논산시 전체 외지인 방문 추정치입니다.</p>
      </div>

      <aside className="rounded-2xl border border-coral/30 bg-coral-soft p-5" role="status">
        <p className="font-extrabold">실험 결과 사용 가능 · 축제 운영 적용은 검증 필요</p>
        <p className="mt-2 text-sm leading-relaxed">지역 추세 전반의 오차는 줄었지만 축제 주말의 방문 증가를 크게 낮춰 예상했습니다. 행사장 입장객·시간별 혼잡·필요 차량 수를 뜻하지 않습니다. 예측 범위도 실제 변동을 충분히 포함하지 못했습니다.</p>
      </aside>

      <form action="/forecast" className="flex flex-wrap items-end gap-4 rounded-2xl bg-white p-5 shadow-card">
        <label className="flex flex-col gap-2 text-sm font-bold">예측을 준비하는 시점
          <select name="horizon" defaultValue={String(horizon)} className="rounded-lg border border-ink/20 bg-white px-3 py-2">
            <option value="28">개막 28일 전</option><option value="7">개막 7일 전</option>
          </select>
        </label>
        <label className="flex flex-col gap-2 text-sm font-bold">과거 자료가 도착하는 데 걸리는 시간
          <select name="lag" defaultValue={String(lag)} className="rounded-lg border border-ink/20 bg-white px-3 py-2">
            <option value="35">35일로 가정 (기본)</option><option value="7">7일로 가정</option><option value="60">60일로 가정</option>
          </select>
        </label>
        <button className="rounded-full bg-navy px-5 py-2.5 text-sm font-bold text-white">비교 보기</button>
        <p className="basis-full text-xs text-muted">공개 지연은 검증된 제공 주기가 아닌 실험 가정입니다. 당시 공개본이 없어 현재 조회한 과거 통계를 사용했습니다.</p>
      </form>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl bg-white p-5 shadow-card"><p className="text-sm text-muted">2025년 선택된 {run.test.comparable}일의 모델 오차 비율</p><p className="mt-2 text-3xl font-extrabold">{percent(modelMetric.wape)}</p><p className="mt-2 text-xs text-muted">관측값 합 대비 절대오차 합 (WAPE)</p></div>
        <div className="rounded-2xl bg-white p-5 shadow-card"><p className="text-sm text-muted">선정한 단순 기준 대비 평균 오차 감소</p><p className="mt-2 text-3xl font-extrabold text-blue">{percent(improvement)}</p><p className="mt-2 text-xs text-muted">{labels[selectedBaseline]}과 같은 날짜를 비교</p></div>
        <div className="rounded-2xl bg-white p-5 shadow-card"><p className="text-sm text-muted">축제 4일만의 모델 오차 비율</p><p className="mt-2 text-3xl font-extrabold text-coral">{percent(festivalMetric.wape)}</p><p className="mt-2 text-xs text-muted">전체 기간의 결과를 축제에 그대로 적용할 수 없음</p></div>
      </div>

      <section className="rounded-3xl bg-white p-5 shadow-card sm:p-7">
        <h2 className="text-xl font-extrabold">축제 날짜별 예측과 사후 관측</h2>
        <p className="mt-2 text-sm text-muted">2025년 3월 27~30일 · 가정한 예측 발행일 {first.issuedAt.slice(0, 10)} 09:00 한국시각 · 마지막 입력 관측일 {first.lastObservation ?? "없음"}</p>
        <Comparison run={run} />
        <p className="mt-4 text-xs text-muted sm:hidden">표를 좌우로 밀면 사후 관측과 전년 기준도 볼 수 있습니다.</p>
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[650px] text-left text-sm">
            <caption className="mb-3 text-left text-xs text-muted">일별 추세 지수. 기준 100은 가용한 최근 같은 요일 4회 중앙값입니다.</caption>
            <thead><tr className="border-b border-ink/10">{["날짜", "학습 모델", "예측 범위*", "사후 지역 관측", "전년 같은 요일"].map((title) => <th key={title} className="px-3 py-3">{title}</th>)}</tr></thead>
            <tbody>{run.festival.map((row) => {
              const base = row.predictions.B1.value;
              const index = (value: number | null) => value === null || base === null || base <= 0 ? null : value / base * 100;
              return <tr key={row.date} className="border-b border-ink/10"><th className="px-3 py-3 font-semibold">{row.date.slice(5)}</th>
                <td className="px-3 py-3 font-bold text-blue">{number(row.predictions.ridge.index, 1)}</td>
                <td className="px-3 py-3">{row.predictions.ridge.lower === null ? "보정 자료 부족" : `${number(index(row.predictions.ridge.lower), 1)}~${number(index(row.predictions.ridge.upper), 1)}`}</td>
                <td className="px-3 py-3 font-bold">{number(index(row.actual), 1)}</td><td className="px-3 py-3">{number(row.predictions.B2.index, 1)}</td></tr>;
            })}</tbody>
          </table>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-muted">* 2024년의 별도 {run.calibration.summary.comparable}일({run.calibration.summary.origins}개 예측 창) 오차로 만든 명목 80% 범위입니다. 2025년 실제 포함률은 {percent(modelMetric.coverage)}({modelMetric.intervalN}일), 축제 4일에서는 {percent(festivalMetric.coverage)}였습니다. 80% 포함이 보장되는 범위로 해석하지 마세요.</p>
      </section>

      <section className="rounded-3xl bg-white p-5 shadow-card sm:p-7">
        <h2 className="text-xl font-extrabold">같은 날짜에서 비교한 세 가지 방법</h2>
        <p className="mt-2 text-sm text-muted">2023년부터 학습 → 2024년 상반기로 방법 선택 → 2024년 10~11월로 범위 보정 → 2025년 평가. 선택된 {run.test.distinctDates}일·{run.test.origins}개 예측 창, 누락 등으로 제외한 날짜 {run.test.excluded}일입니다.</p>
        <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[620px] text-left text-sm">
          <thead><tr className="border-b border-ink/10">{["방법", "평균 절대오차 (추정 인원)", "오차 비율", "축제 4일 오차 비율"].map((title) => <th className="px-3 py-3" key={title}>{title}</th>)}</tr></thead>
          <tbody>{methods.map((method) => <tr key={method} className="border-b border-ink/10"><th className="px-3 py-3">{labels[method]}{method === selectedBaseline ? " · 선정 기준" : ""}</th>
            <td className="px-3 py-3">{number(run.test.metrics[method].mae)}</td><td className="px-3 py-3">{percent(run.test.metrics[method].wape)}</td><td className="px-3 py-3">{percent(run.groups.festival.metrics[method].wape)}</td></tr>)}</tbody>
        </table></div>
        <p className="mt-3 text-xs text-muted">하루 단위 지역 추정 인원의 오차입니다. 축제 순방문객 합계를 만들지 않으며, 시점별 결과도 독립 표본으로 합치지 않습니다.</p>
      </section>

      <section className="rounded-3xl bg-white p-5 shadow-card sm:p-7">
        <h2 className="text-xl font-extrabold">자료의 출처와 다음 개선</h2>
        <p className="mt-3 text-sm leading-relaxed"><a href={summary.dataset.source} className="font-bold text-blue underline">한국관광공사 지역별 방문자수</a>의 논산시 외지인 자료입니다. {summary.dataset.range.start}~{summary.dataset.range.end}의 {summary.dataset.quality.completeDays.toLocaleString("ko-KR")}일을 수집했고, 누락 {summary.dataset.quality.missingDates.length}일·오류 {summary.dataset.quality.invalidDates.length}일입니다. 수집본 생성일은 {summary.dataset.generatedAt.slice(0, 10)}입니다.</p>
        <p className="mt-3 text-sm leading-relaxed text-muted">학습 모델은 요일·계절·최근 방문 추세를 사용합니다. 행사 일정에 따른 추가 유입과 공휴일 효과는 아직 따로 학습하지 않았습니다. 여러 회차의 일별 행사장 계수 자료와 당시 공개본을 확보하고, 앞으로의 축제 전에 예측을 저장해 실제 결과와 비교하는 작업이 필요합니다.</p>
        <p className="mt-3 text-sm leading-relaxed text-muted">이 화면은 2025년 사례의 실험 결과이며 현재·다음 축제의 실시간 예측이 아닙니다. 주차·셔틀 판단에는 시간별 도착량과 실제 운행·대기 자료가 더 필요합니다.</p>
        <details className="mt-4 text-xs text-muted"><summary className="cursor-pointer font-bold">자료·모델 버전 확인</summary>
          <p className="mt-2 break-all">자료 버전: {summary.dataset.snapshotId}</p><p className="mt-1">모델: nonsan-direct-ridge-v1 · 규제 강도 {run.choice.lambda} · 실험: {summary.experiment.version}</p>
          <p className="mt-1">계산일: {summary.generatedAt.slice(0, 10)} · 당시 공개 자료만으로 재현 가능한 관측: {summary.strictReplay.availableObservationsAt2025Festival}개</p>
        </details>
      </section>
    </div>
  );
}
