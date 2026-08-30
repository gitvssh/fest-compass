import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cloneFestivalAction } from "@/lib/actions";
import { CAPACITY_FORMULA, type CapacityResult } from "@/lib/calc/capacity";
import { formatNumber, formatPercent } from "@/lib/format";
import { getFestival, latestAssumption, scenarioResults, type FestivalDetail } from "@/lib/queries";
import { FestivalNav } from "@/components/FestivalNav";
import { KindBadge } from "@/components/KindBadge";
import { EmptyValue } from "@/components/EmptyValue";
import { PrintButton } from "@/components/PrintButton";
import { EditorOnly } from "@/components/EditorOnly";
import { festivalPageMetadata } from "@/lib/site";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  return festivalPageMetadata(id, "report");
}

type TriggerRow = {
  id: string;
  condition: string;
  plannedAction: string;
  owner: string;
  fieldActions?: Array<{ id: string; occurredAt: string }>;
};

type MatrixRow = {
  scenario: FestivalDetail["scenarios"][number];
  byInflow?: { min: CapacityResult; base: CapacityResult; max: CapacityResult };
  live?: CapacityResult;
};

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const festival = await getFestival(id);
  if (!festival) notFound();

  const inflow = latestAssumption(festival, "inflow");
  const peak = latestAssumption(festival, "peakRatio");
  const dwell = latestAssumption(festival, "dwellHours");
  const hours = latestAssumption(festival, "operatingHours");
  const rule = festival.capacityRules[0] ?? null;
  const assumptionRows = [inflow, peak, dwell, hours];
  const assumptionVersions = [...new Set(assumptionRows.flatMap((row) => (row ? [row.version] : [])))].sort(
    (a, b) => a - b,
  );
  const coherentAssumptionSet = assumptionRows.every(Boolean) && assumptionVersions.length === 1;
  const decision = festival.decisions[0];
  const matrix = scenarioResults(festival) as unknown as MatrixRow[];
  const selected = matrix.find((row) => row.scenario.id === decision?.scenarioId);
  const maxResult = selected?.byInflow?.max ?? selected?.live ?? null;
  const versionCount = new Set(festival.assumptions.filter((row) => row.item === "inflow").map((row) => row.version)).size;
  const triggers = ((festival as unknown as { triggers?: TriggerRow[] }).triggers ?? []);
  const currentSnapshots = festival.snapshots.filter((row) => !row.stale);
  const historicalSnapshots = festival.snapshots.filter((row) => row.stale);

  return (
    <div>
      <div className="no-print"><FestivalNav festival={festival} current="report" /></div>
      <article className="report-sheet rounded-3xl bg-white p-8 shadow-card">
        <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-blue">사후 운영 리포트 초안</p>
        <h1 className="mt-2 text-3xl font-extrabold">{festival.name}</h1>
        <p className="text-sm text-muted">
          계산 결과는 아래 입력 스냅샷과 공식으로 재현할 수 있습니다. 확인되지 않은 값은 0으로 바꾸지 않고 "없음"으로 남깁니다.
        </p>

        <section className="mt-6">
          <h2 className="mb-2 text-lg font-extrabold">1. 근거 스냅샷</h2>
          <p className="mb-3 text-xs text-muted">현재 스냅샷과 보고서 계산에서 제외된 과거 스냅샷을 분리합니다.</p>
          {currentSnapshots.length ? (
            <ul className="space-y-2 text-sm">
              {currentSnapshots.map((snapshot) => <SnapshotReportRow key={snapshot.id} snapshot={snapshot} />)}
            </ul>
          ) : (
            <p className="rounded-2xl bg-paper px-4 py-3 text-sm text-muted">현재 근거 스냅샷 없음</p>
          )}
          {historicalSnapshots.length ? (
            <details className="mt-3 rounded-2xl border border-ink/10 px-4 py-3 text-sm">
              <summary className="cursor-pointer font-bold">과거 스냅샷 {historicalSnapshots.length}건 · 계산 근거에서 제외</summary>
              <ul className="mt-3 space-y-2">
                {historicalSnapshots.map((snapshot) => <SnapshotReportRow key={snapshot.id} snapshot={snapshot} />)}
              </ul>
            </details>
          ) : null}
        </section>

        <section className="mt-6">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-extrabold">2. 계산에 사용한 사용자 가정</h2>
            <KindBadge kind="assumption" />
          </div>
          <p className={`mb-3 text-xs ${coherentAssumptionSet ? "text-muted" : "font-bold text-coral"}`}>
            {assumptionSetCopy(coherentAssumptionSet, assumptionVersions, assumptionRows)}
            {coherentAssumptionSet ? ` · 이전 유입 버전 ${Math.max(0, versionCount - 1)}개` : " · 계산은 아래 항목별 최신 행을 사용"}
          </p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="text-left text-muted">
                <tr>
                  <th className="pb-2">항목</th>
                  <th className="pb-2">계산 입력</th>
                  <th className="pb-2">버전</th>
                  <th className="pb-2">작성자</th>
                  <th className="pb-2">근거</th>
                </tr>
              </thead>
              <tbody>
                <AssumptionReportRow label="유입 범위" item="inflow" row={inflow} />
                <AssumptionReportRow label="피크비율" item="peakRatio" row={peak} />
                <AssumptionReportRow label="평균 체류" item="dwellHours" row={dwell} />
                <AssumptionReportRow label="운영시간" item="operatingHours" row={hours} />
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-6">
          <h2 className="mb-2 text-lg font-extrabold">3. 선택한 운영안</h2>
          <p className="text-sm">{decision?.changeSummary ?? "선택 없음"}</p>
          <p className="text-sm text-muted">{decision?.reason ?? "이유 없음"}</p>
          {decision ? (
            <p className="mt-1 text-xs text-muted">승인자 {decision.approver} · 결정 {decision.decidedAt.toLocaleString("ko-KR")}</p>
          ) : null}

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <article className="rounded-2xl bg-paper px-4 py-3 text-sm">
              <h3 className="font-extrabold">승인 수용량 근거</h3>
              <dl className="mt-2 space-y-1">
                <ReportValue label="구역" value={rule?.zone ?? "없음"} />
                <ReportValue label="승인 수용량" value={numberWithUnit(rule?.approvedCapacity, "명")} />
                <ReportValue label="기준문서" value={rule?.documentRef ?? "없음"} />
                <ReportValue label="승인자" value={rule?.approver ?? "없음"} />
              </dl>
              <p className={`mt-2 text-xs font-bold ${maxResult?.safetyEnabled ? "text-teal" : "text-coral"}`}>
                안전 관련 계산 {maxResult?.safetyEnabled ? "활성" : "비활성"}
              </p>
            </article>

            <article className="rounded-2xl bg-paper px-4 py-3 text-sm">
              <h3 className="font-extrabold">계산 입력 스냅샷 · 최대 유입</h3>
              {maxResult ? (
                <dl className="mt-2 space-y-1">
                  <ReportValue label="유입" value={numberWithUnit(maxResult.inputs.inflow, "명")} />
                  <ReportValue label="피크비율" value={numberWithUnit(maxResult.inputs.peakRatio, "", 2)} />
                  <ReportValue label="평균 체류" value={numberWithUnit(maxResult.inputs.dwellHours, "시간")} />
                  <ReportValue label="운영시간" value={numberWithUnit(maxResult.inputs.operatingHours, "시간")} />
                  <ReportValue label="승인 수용량" value={numberWithUnit(maxResult.inputs.approvedCapacity, "명")} />
                  <ReportValue label="승인 근거" value={maxResult.inputs.hasApprovalBasis ? "기준문서·승인자 확인" : "미확인"} />
                </dl>
              ) : (
                <p className="mt-2 text-muted">선택된 운영안의 계산 입력 없음</p>
              )}
            </article>
          </div>

          {maxResult ? (
            <p className="mt-2 text-sm">
              <KindBadge kind="calculated" /> 최대 유입 기준 점유율 {formatPercent(maxResult.occupancy) ?? "없음"} · 피크 동시체류 <EmptyValue value={maxResult.peakConcurrent} digits={1} suffix="명" /> · 수용여유 <EmptyValue value={maxResult.slack} digits={1} suffix="명" />
            </p>
          ) : null}
          {selected?.byInflow ? (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="text-left text-muted">
                  <tr>
                    <th className="pb-2">유입 구간</th>
                    <th className="pb-2">유입</th>
                    <th className="pb-2">피크 동시체류</th>
                    <th className="pb-2">수용여유</th>
                    <th className="pb-2">점유율</th>
                    <th className="pb-2">계산 상태</th>
                  </tr>
                </thead>
                <tbody>
                  {(["min", "base", "max"] as const).map((band) => {
                    const result = selected.byInflow?.[band];
                    if (!result) return null;
                    return (
                      <tr key={band} className="border-t border-ink/5">
                        <td className="py-2 font-bold">{inflowBandLabel(band)}</td>
                        <td>{numberWithUnit(result.inputs.inflow, "명")}</td>
                        <td>{numberWithUnit(result.peakConcurrent, "명")}</td>
                        <td>{numberWithUnit(result.slack, "명")}</td>
                        <td>{formatPercent(result.occupancy) ?? "없음"}</td>
                        <td>{result.safetyEnabled ? "활성" : "비활성"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : null}
          <div className="mt-3 rounded-2xl border border-ink/10 px-4 py-3 text-xs text-muted">
            <p>피크 동시체류 = {CAPACITY_FORMULA.peakConcurrent}</p>
            <p>수용여유 = {CAPACITY_FORMULA.slack}</p>
            <p>점유율 = {CAPACITY_FORMULA.occupancy}</p>
            <p className="mt-1">보고서 생성 시점의 최신 가정과 승인 수용량으로 재계산한 값입니다.</p>
          </div>
        </section>

        <section className="mt-6">
          <h2 className="mb-2 text-lg font-extrabold">3.5 계획된 대응</h2>
          {triggers.length ? (
            <ul className="space-y-2 text-sm">
              {triggers.map((trigger) => (
                <li key={trigger.id} className="rounded-2xl bg-paper px-4 py-3">
                  <b>{trigger.condition}</b> → {trigger.plannedAction} · 책임자 {trigger.owner}
                  <p className="mt-1 text-xs text-muted">
                    {triggerExecutionCopy(trigger, festival.fieldActions)}
                  </p>
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-muted">등록된 대응 트리거가 없습니다.</p>}
        </section>

        <section className="mt-6">
          <h2 className="mb-2 text-lg font-extrabold">4. 현장 조치와 실제</h2>
          <ul className="space-y-1 text-sm">
            {festival.fieldActions.map((row) => {
              const triggerId = (row as typeof row & { triggerId?: string | null }).triggerId;
              const trigger = triggers.find((item) => item.id === triggerId);
              return <li key={row.id}>{row.occurredAt} {row.action} ({(trigger?.condition ?? row.trigger) || "계획 밖 대응"})</li>;
            })}
          </ul>
          <ul className="mt-3 space-y-2 text-sm">
            {festival.outcomes.map((row) => {
              const granularity = (row as typeof row & { granularity?: string }).granularity ?? "total";
              return (
                <li key={row.id} className="rounded-2xl bg-paper px-4 py-3">
                  <KindBadge kind="measured" /> {row.metric}: 계획 <EmptyValue value={row.plannedValue} /> / 실제 <EmptyValue value={row.actualValue} /> · {granularityName(granularity)} · 구간 {row.bucketLabel || (granularity === "total" ? "전체" : "없음")} · 출처 {row.source || "없음"} · 측정 {row.measureMethod || "없음"}
                </li>
              );
            })}
          </ul>
        </section>
      </article>

      <div className="no-print mt-6 flex flex-wrap gap-3">
        <PrintButton />
        <EditorOnly>
          <form action={cloneFestivalAction}>
            <input type="hidden" name="festivalId" value={festival.id} />
            <button className="rounded-full bg-navy px-5 py-3 text-sm font-bold text-white" type="submit">다음 행사로 복제</button>
          </form>
        </EditorOnly>
      </div>
    </div>
  );
}

type AssumptionRow = FestivalDetail["assumptions"][number];
type AssumptionItem = "inflow" | "peakRatio" | "dwellHours" | "operatingHours";
type SnapshotRow = FestivalDetail["snapshots"][number];

function SnapshotReportRow({ snapshot }: { snapshot: SnapshotRow }) {
  const statusTone =
    snapshot.status === "success"
      ? "bg-teal-soft text-teal"
      : snapshot.status === "empty"
        ? "bg-white text-muted"
        : "bg-coral-soft text-coral";
  return (
    <li className="rounded-2xl bg-paper px-4 py-3">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <KindBadge kind="observation" />
        <b>{snapshot.apiName}</b>
        <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-extrabold ${statusTone}`}>
          {snapshotStatusLabel(snapshot.status)}
        </span>
        <span className="text-xs font-bold text-muted">{snapshot.stale ? "과거 보관 · 계산 제외" : "현재"}</span>
      </div>
      <p>{snapshot.rawSummary ?? "요약 없음"}</p>
      <div className="mt-2 space-y-1 text-xs text-muted">
        <p>
          기준일 {snapshot.baseDate ?? "없음"} · 호출 {snapshot.fetchedAt.toLocaleString("ko-KR")} · 상태 {snapshot.status}
        </p>
        <p>집계 {snapshot.aggregation ?? "없음"}</p>
        <p>허용 해석 {snapshot.interpretation ?? "없음"}</p>
        <p className="text-coral">금지 해석 {snapshot.prohibition ?? "없음"}</p>
      </div>
    </li>
  );
}

function AssumptionReportRow({
  label,
  item,
  row,
}: {
  label: string;
  item: AssumptionItem;
  row: AssumptionRow | null;
}) {
  return (
    <tr className="border-t border-ink/5 align-top">
      <th className="py-2 pr-3 text-left">{label}</th>
      <td className="py-2 pr-3">{assumptionValue(item, row)}</td>
      <td className="py-2 pr-3">{row ? `v${row.version}` : "없음"}</td>
      <td className="py-2 pr-3">{row?.author ?? "없음"}</td>
      <td className="py-2">{row?.rationale ?? "없음"}</td>
    </tr>
  );
}

function ReportValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right">{value}</dd>
    </div>
  );
}

function assumptionSetCopy(
  coherent: boolean,
  versions: number[],
  rows: Array<AssumptionRow | null>,
) {
  if (coherent) return `가정 세트 v${versions[0]}`;
  if (!rows.some(Boolean)) return "저장된 가정 세트 없음";
  const missing = 4 - rows.filter(Boolean).length;
  const versionCopy = versions.length ? versions.map((version) => `v${version}`).join(", ") : "버전 없음";
  return missing ? `가정 세트 불완전 · ${missing}개 항목 없음 · ${versionCopy}` : `항목별 버전 혼합 · ${versionCopy}`;
}

function assumptionValue(item: AssumptionItem, row: AssumptionRow | null) {
  if (!row) return "없음";
  if (item === "inflow") {
    return `최소 ${numberWithUnit(row.minValue, "명")} / 기준 ${numberWithUnit(row.baseValue, "명")} / 최대 ${numberWithUnit(row.maxValue, "명")}`;
  }
  if (item === "peakRatio") {
    const ratio = numberWithUnit(row.baseValue, "", 2);
    const percent = formatPercent(row.baseValue);
    return percent ? `${ratio} (${percent})` : ratio;
  }
  return numberWithUnit(row.baseValue, "시간");
}

function numberWithUnit(value: number | null | undefined, unit: string, digits?: number) {
  const formatted =
    digits === undefined
      ? value === null || value === undefined || !Number.isFinite(value)
        ? null
        : new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 6 }).format(value)
      : formatNumber(value, digits);
  if (formatted === null) return "없음";
  return unit ? `${formatted}${unit}` : formatted;
}

function inflowBandLabel(band: "min" | "base" | "max") {
  if (band === "min") return "최소";
  if (band === "base") return "기준";
  return "최대";
}

function snapshotStatusLabel(status: string) {
  if (status === "success") return "정상";
  if (status === "empty") return "빈결과";
  if (status === "error") return "오류";
  return status;
}

function granularityName(value: string) {
  if (value === "hourly") return "시간대별";
  if (value === "zone") return "구역별";
  return "총계";
}

function triggerExecutionCopy(
  trigger: TriggerRow,
  fieldActions: FestivalDetail["fieldActions"],
) {
  const executed = trigger.fieldActions?.[0] ?? fieldActions.find(
    (row) => (row as typeof row & { triggerId?: string | null }).triggerId === trigger.id,
  );
  return executed ? `실행됨 ${executed.occurredAt}` : "미실행";
}
