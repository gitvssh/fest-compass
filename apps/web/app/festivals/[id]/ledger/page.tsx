import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cloneFestivalAction } from "@/lib/actions";
import { getFestival, latestAssumption } from "@/lib/queries";
import { FestivalNav } from "@/components/FestivalNav";
import { KindBadge } from "@/components/KindBadge";
import { EmptyValue } from "@/components/EmptyValue";
import { EditorOnly } from "@/components/EditorOnly";
import { FieldActionForm, OutcomeForm, TriggerForm } from "@/components/forms/WorkflowForms";
import { festivalPageMetadata } from "@/lib/site";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  return festivalPageMetadata(id, "ledger");
}

type TriggerRow = {
  id: string;
  condition: string;
  plannedAction: string;
  owner: string;
  fieldActions?: Array<{ id: string; occurredAt: string }>;
};

export default async function LedgerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const festival = await getFestival(id);
  if (!festival) notFound();

  const inflow = latestAssumption(festival, "inflow");
  const decision = festival.decisions[0];
  const triggers = ((festival as unknown as { triggers?: TriggerRow[] }).triggers ?? []);
  const granularOutcomes = festival.outcomes.filter((row) => row.granularity === "hourly" || row.granularity === "zone");
  const granularMaxima = granularOutcomeMaxima(granularOutcomes);

  return (
    <div>
      <FestivalNav festival={festival} current="ledger" />

      <div className="grid gap-4 md:grid-cols-3">
        <TimeCard when="D-3 / 결정" title={decision?.changeSummary ?? "선택된 운영안 없음"} note={decision?.reason} kind="assumption" />
        <TimeCard
          when="행사일"
          title={festival.fieldActions[0]?.action ?? "현장 조치 없음"}
          note={festival.fieldActions[0]?.occurredAt}
          kind="measured"
        />
        <TimeCard when="D+14" title="계획 대비 실제" note={`${festival.outcomes.length}개 지표`} kind="calculated" />
      </div>

      <section className="mt-6 rounded-3xl bg-white p-6 shadow-card">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-blue">D-3 계획</p>
            <h2 className="text-xl font-extrabold">대응 트리거</h2>
          </div>
          <KindBadge kind="assumption" />
        </div>

        {triggers.length ? (
          <ul className="mb-5 grid gap-3 md:grid-cols-2">
            {triggers.map((trigger) => {
              const executed = trigger.fieldActions?.[0] ?? festival.fieldActions.find(
                (row) => (row as typeof row & { triggerId?: string | null }).triggerId === trigger.id,
              );
              return (
                <li key={trigger.id} className="rounded-2xl bg-paper px-4 py-3 text-sm">
                  <p><b>{trigger.condition}</b> → {trigger.plannedAction}</p>
                  <p className="mt-1 text-xs text-muted">책임자 {trigger.owner}</p>
                  {executed ? (
                    <span className="mt-2 inline-flex rounded-full bg-teal-soft px-2.5 py-1 text-[11px] font-extrabold text-teal">
                      실행됨 {executed.occurredAt}
                    </span>
                  ) : (
                    <span className="mt-2 inline-flex rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-muted">미실행</span>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mb-4 text-sm text-muted">등록된 대응 트리거가 없습니다.</p>
        )}

        <EditorOnly>
          <TriggerForm festivalId={festival.id} />
        </EditorOnly>
      </section>

      <section className="mt-5 rounded-3xl bg-white p-6 shadow-card">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-extrabold">현장 조치</h2>
          <KindBadge kind="measured" />
        </div>
        <ul className="mb-4 space-y-2">
          {festival.fieldActions.map((row) => {
            const triggerId = (row as typeof row & { triggerId?: string | null }).triggerId;
            const linked = triggers.find((trigger) => trigger.id === triggerId);
            return (
              <li key={row.id} className="rounded-2xl bg-paper px-4 py-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <b>{row.occurredAt}</b>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${linked ? "bg-teal-soft text-teal" : "bg-white text-muted"}`}>
                    {linked ? "계획된 대응" : "계획 밖 대응"}
                  </span>
                </div>
                <p className="mt-1">{(linked?.condition ?? row.trigger) || "직접 입력"} → {row.action}</p>
                <p className="text-xs text-muted">담당 {row.actor ?? "없음"}</p>
              </li>
            );
          })}
        </ul>
        <EditorOnly>
          <FieldActionForm
            festivalId={festival.id}
            triggers={triggers.map((trigger) => ({ id: trigger.id, condition: trigger.condition }))}
          />
        </EditorOnly>
      </section>

      <section className="mt-5 rounded-3xl bg-white p-6 shadow-card">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-extrabold">계획 대비 실제</h2>
          <div className="flex gap-2"><KindBadge kind="assumption" /><KindBadge kind="measured" /></div>
        </div>
        <p className="mb-3 text-sm text-muted">
          유입 가정 기준 <EmptyValue value={inflow?.baseValue} suffix="명" />. 실제값은 주최 입력입니다. KTO 지역방문자를 입장객으로 넣지 마세요.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="text-left text-muted">
              <tr><th className="pb-2">지표</th><th className="pb-2">계획</th><th className="pb-2">실제</th><th className="pb-2">집계</th><th className="pb-2">구간</th><th className="pb-2">출처·측정방식</th></tr>
            </thead>
            <tbody>
              {festival.outcomes.map((row) => {
                const granularity = (row as typeof row & { granularity?: string }).granularity ?? "total";
                return (
                  <tr key={row.id} className="border-t border-ink/5">
                    <td className="py-2">{row.metric}</td>
                    <td><EmptyValue value={row.plannedValue} suffix={row.unit ?? undefined} /></td>
                    <td><EmptyValue value={row.actualValue} suffix={row.unit ?? undefined} /></td>
                    <td>{granularityName(granularity)}</td>
                    <td>{row.bucketLabel || (granularity === "total" ? "전체" : "없음")}</td>
                    <td className="text-muted">{row.source || "없음"} · {row.measureMethod || "없음"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <EditorOnly>
          <OutcomeForm festivalId={festival.id} />
        </EditorOnly>
      </section>

      {festival.labelLevel === "L2" ? (
        <section className="mt-5 rounded-3xl bg-white p-6 shadow-card">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-blue">L2 재현</p>
              <h2 className="text-xl font-extrabold">피크 시간대·구역 실측</h2>
            </div>
            <KindBadge kind="measured" />
          </div>
          {granularOutcomes.length ? (
            <div className="grid gap-3 md:grid-cols-2">
              {granularOutcomes.map((row) => {
                const key = granularOutcomeKey(row);
                const isPeak = row.actualValue !== null && granularMaxima.get(key) === row.actualValue;
                return (
                  <article key={`${row.id}-reproduction`} className="rounded-2xl bg-paper px-4 py-3 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <b>{row.metric}</b>
                      {isPeak ? (
                        <span className="rounded-full bg-coral-soft px-2.5 py-1 text-[11px] font-extrabold text-coral">
                          {row.granularity === "hourly" ? "피크 시간대" : "최대 구역"}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1">{row.bucketLabel || "구간 없음"} · <EmptyValue value={row.actualValue} suffix={row.unit ?? undefined} /></p>
                    <p className="mt-1 text-xs text-muted">{row.source || "출처 없음"} · {row.measureMethod || "측정방식 없음"}</p>
                  </article>
                );
              })}
            </div>
          ) : (
            <p className="rounded-2xl bg-coral-soft px-4 py-3 text-sm text-coral">
              L2 라벨과 연결된 시간대·구역 실측 행이 없습니다. 라벨 근거를 점검하세요.
            </p>
          )}
          <p className="mt-3 text-xs text-muted">같은 지표·단위 안에서만 실제값의 최대 구간을 표시하며 인과효과는 주장하지 않습니다.</p>
        </section>
      ) : null}

      <div className="mt-6 flex flex-wrap gap-3">
        <Link href={`/festivals/${festival.id}/report`} className="rounded-full bg-navy px-5 py-3 text-sm font-bold text-white">사후보고서 보기</Link>
        <EditorOnly>
          <form action={cloneFestivalAction}>
            <input type="hidden" name="festivalId" value={festival.id} />
            <button className="rounded-full bg-white px-5 py-3 text-sm font-bold shadow-card" type="submit">다음 행사로 복제</button>
          </form>
        </EditorOnly>
      </div>
    </div>
  );
}

function granularityName(value: string) {
  if (value === "hourly") return "시간대별";
  if (value === "zone") return "구역별";
  return "총계";
}

type OutcomeRow = NonNullable<Awaited<ReturnType<typeof getFestival>>>["outcomes"][number];

function granularOutcomeKey(row: OutcomeRow) {
  return `${row.granularity}\u0000${row.metric}\u0000${row.unit ?? ""}`;
}

function granularOutcomeMaxima(rows: OutcomeRow[]) {
  const maxima = new Map<string, number>();
  for (const row of rows) {
    if (row.actualValue === null) continue;
    const key = granularOutcomeKey(row);
    const current = maxima.get(key);
    if (current === undefined || row.actualValue > current) maxima.set(key, row.actualValue);
  }
  return maxima;
}

function TimeCard({ when, title, note, kind }: { when: string; title: string; note?: string | null; kind: "assumption" | "measured" | "calculated" }) {
  return (
    <article className="rounded-3xl bg-white p-5 shadow-card">
      <KindBadge kind={kind} />
      <p className="mt-3 text-xs font-extrabold uppercase tracking-[0.16em] text-muted">{when}</p>
      <h3 className="mt-1 text-lg font-extrabold">{title}</h3>
      <p className="text-sm text-muted">{note || "기록 없음"}</p>
    </article>
  );
}
