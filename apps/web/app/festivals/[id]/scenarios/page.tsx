import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CAPACITY_FORMULA, occupancyWarning, type CapacityResult } from "@/lib/calc/capacity";
import { formatNumber, formatPercent } from "@/lib/format";
import { getFestival, latestAssumption, scenarioResults, type FestivalDetail } from "@/lib/queries";
import { FestivalNav } from "@/components/FestivalNav";
import { KindBadge } from "@/components/KindBadge";
import { EditorOnly } from "@/components/EditorOnly";
import { ScenarioDecisionForm, ScenarioResourcesForm } from "@/components/forms/WorkflowForms";
import { festivalPageMetadata } from "@/lib/site";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  return festivalPageMetadata(id, "scenarios");
}

type MatrixRow = {
  scenario: FestivalDetail["scenarios"][number];
  byInflow?: { min: CapacityResult; base: CapacityResult; max: CapacityResult };
  live?: CapacityResult;
  stored?: unknown;
};

export default async function ScenariosPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const festival = await getFestival(id);
  if (!festival) notFound();

  const rows = (scenarioResults(festival) as unknown as MatrixRow[]).map((row) => ({
    ...row,
    byInflow: row.byInflow ?? {
      min: row.live as CapacityResult,
      base: row.live as CapacityResult,
      max: row.live as CapacityResult,
    },
  }));
  const inflow = latestAssumption(festival, "inflow");
  const selected = festival.decisions[0];
  const decisionHistory = festival.decisions.slice(1);
  const rule = festival.capacityRules[0];
  const safetyOn = Boolean(rule?.approvedCapacity && rule.approvedCapacity > 0 && rule.documentRef && rule.approver);

  return (
    <div>
      <FestivalNav festival={festival} current="scenarios" />
      <p className="mb-5 text-sm text-muted">
        유입의 최소·기준·최대는 수요 불확실성이고, 각 안의 셔틀·주차 안내·회차·동선은 대응 자원입니다.
      </p>

      {!safetyOn ? (
        <div className="mb-5 rounded-2xl bg-coral-soft px-4 py-3 text-sm">
          수용량 기준이 없어 여유 경고를 계산하지 않습니다. 자원 대안 비교와 결정 기록은 계속할 수 있습니다.
        </div>
      ) : null}

      <section className="overflow-hidden rounded-3xl bg-white shadow-card" aria-labelledby="matrix-title">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5">
          <div>
            <h1 id="matrix-title" className="text-xl font-extrabold">운영자원 × 유입 가정 매트릭스</h1>
            <p className="mt-1 text-xs text-muted">점유율은 자원 대수가 아니라 유입·체류·운영시간·승인수용량으로 계산합니다.</p>
          </div>
          <KindBadge kind="calculated" />
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="bg-paper text-left text-muted">
              <tr>
                <th className="px-5 py-3">시나리오</th>
                <th className="px-4 py-3">대응 자원</th>
                <th className="px-4 py-3">최소 {formatInflow(inflow?.minValue)}</th>
                <th className="px-4 py-3">기준 {formatInflow(inflow?.baseValue)}</th>
                <th className="px-4 py-3">최대 {formatInflow(inflow?.maxValue)}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ scenario, byInflow }) => (
                <tr key={scenario.id} className="border-t border-ink/5 align-top">
                  <th className="px-5 py-4 text-left">
                    {scenario.name}
                    {selected?.scenarioId === scenario.id ? (
                      <span className="ml-2 rounded-full bg-blue-soft px-2 py-0.5 text-[11px] text-blue">선택됨</span>
                    ) : null}
                  </th>
                  <td className="px-4 py-4 text-xs">
                    셔틀 {scenario.shuttles ?? "없음"}대 · 주차 {scenario.staffParking ?? "없음"}명 · 회차{" "}
                    {scenario.sessions ?? "없음"}회
                    <p className="mt-1 text-muted">구역 {scenario.zone || "없음"} · {scenario.routeNote || "동선 메모 없음"}</p>
                  </td>
                  <CapacityCell result={byInflow.min} />
                  <CapacityCell result={byInflow.base} />
                  <CapacityCell result={byInflow.max} />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        {rows.map(({ scenario, byInflow }) => {
          const maxWarning = occupancyWarning(byInflow.max.occupancy);
          const selectedHere = selected?.scenarioId === scenario.id;
          return (
            <article
              key={`${scenario.id}-editor`}
              className={`rounded-3xl bg-white p-5 shadow-card ${selectedHere ? "ring-2 ring-blue" : ""}`}
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="text-xl font-extrabold">{scenario.name}</h2>
                <KindBadge kind="assumption" />
              </div>
              <p className="rounded-2xl bg-paper px-3 py-3 text-sm">
                최대 유입({formatInflow(inflow?.maxValue)}) 시 점유율 {formatPercent(byInflow.max.occupancy) ?? "없음"} — 이 안의
                대응: 셔틀 {scenario.shuttles ?? "없음"}대 · {scenario.routeNote || "동선 메모 없음"}
              </p>
              <p className="mt-2 text-xs text-muted">{warningLabel(maxWarning)}</p>

              <EditorOnly>
                <ScenarioResourcesForm
                  festivalId={festival.id}
                  scenarioId={scenario.id}
                  shuttles={scenario.shuttles}
                  staffParking={scenario.staffParking}
                  sessions={scenario.sessions}
                  zone={scenario.zone}
                  routeNote={scenario.routeNote}
                />

                <ScenarioDecisionForm
                  festivalId={festival.id}
                  scenarioId={scenario.id}
                  initialReason={scenario.kind === "expanded" ? "최대 유입 위험에 대응할 운영자원을 확보" : ""}
                />
              </EditorOnly>
            </article>
          );
        })}
      </div>

      {selected ? (
        <section className="mt-6 rounded-3xl bg-white p-6 shadow-card">
          <h2 className="text-xl font-extrabold">기록된 결정</h2>
          <p className="mt-2 text-sm">{selected.changeSummary} · {selected.reason}</p>
          <p className="text-xs text-muted">승인자 {selected.approver} · {selected.decidedAt.toLocaleString("ko-KR")}</p>
          {decisionHistory.length ? (
            <details className="mt-4 rounded-2xl bg-paper px-4 py-3 text-sm">
              <summary className="cursor-pointer font-bold">과거 결정 {decisionHistory.length}건</summary>
              <ol className="mt-3 space-y-3">
                {decisionHistory.map((decision) => (
                  <li key={decision.id}>
                    <b>{decision.changeSummary}</b> · {decision.reason}
                    <p className="text-xs text-muted">{decision.approver} · {decision.decidedAt.toLocaleString("ko-KR")}</p>
                  </li>
                ))}
              </ol>
            </details>
          ) : null}
        </section>
      ) : null}

      <section className="mt-5 rounded-3xl bg-white p-6 text-sm shadow-card">
        <h2 className="mb-2 text-lg font-extrabold">계산식</h2>
        <p>피크 동시체류 = {CAPACITY_FORMULA.peakConcurrent}</p>
        <p>수용여유 = {CAPACITY_FORMULA.slack}</p>
        <p>점유율 = {CAPACITY_FORMULA.occupancy}</p>
      </section>
    </div>
  );
}

function CapacityCell({ result }: { result: CapacityResult }) {
  const warning = occupancyWarning(result?.occupancy ?? null);
  return (
    <td className="px-4 py-4">
      <p className="font-extrabold">{formatPercent(result?.occupancy) ?? "없음"}</p>
      <p className="text-xs text-muted">여유 {formatNumber(result?.slack, 1) ?? "없음"}명 · {warningShort(warning)}</p>
    </td>
  );
}

function formatInflow(value: number | null | undefined) {
  const formatted = formatNumber(value);
  return formatted ? `${formatted}명` : "없음";
}

function warningShort(level: ReturnType<typeof occupancyWarning>) {
  if (level === "over") return "초과";
  if (level === "watch") return "주의";
  if (level === "ok") return "여유";
  return "계산 꺼짐";
}

function warningLabel(level: ReturnType<typeof occupancyWarning>) {
  if (level === "off") return "수용량 기준이 없어 여유 경고를 계산하지 않습니다.";
  if (level === "over") return "가정 기준으로 승인 수용량을 넘습니다. 자동 안전판단이 아니라 비교 신호입니다.";
  if (level === "watch") return "가정 기준 점유율이 높습니다. 확대 운영 대안을 검토하세요.";
  return "가정 기준 여유 있음.";
}
