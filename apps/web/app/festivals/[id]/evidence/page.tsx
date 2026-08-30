import type { Metadata } from "next";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { refreshEvidenceAction } from "@/lib/actions";
import { getFestival, latestAssumption, type FestivalDetail } from "@/lib/queries";
import { FestivalNav } from "@/components/FestivalNav";
import { Guardrail } from "@/components/Guardrail";
import { KindBadge } from "@/components/KindBadge";
import { EmptyValue } from "@/components/EmptyValue";
import { EditorOnly } from "@/components/EditorOnly";
import { AssumptionsForm, CapacityForm } from "@/components/forms/WorkflowForms";
import { festivalPageMetadata } from "@/lib/site";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  return festivalPageMetadata(id, "evidence");
}

export default async function EvidencePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const festival = await getFestival(id);
  if (!festival) notFound();

  const inflow = latestAssumption(festival, "inflow");
  const dwell = latestAssumption(festival, "dwellHours");
  const hours = latestAssumption(festival, "operatingHours");
  const peak = latestAssumption(festival, "peakRatio");
  const rule = festival.capacityRules[0];
  const overlap = latestSnapshot(festival.snapshots, "searchFestival2");
  const visitorSnapshots = latestVisitorSnapshots(festival.snapshots);
  const demand = selectSignalSnapshots(festival.snapshots, "areaTarExpDsList");
  const concentration = selectSignalSnapshots(festival.snapshots, "tatsCnctrRatedList");
  const related = selectSignalSnapshots(festival.snapshots, "tarRlteTarAreaBasedList1");
  const overlapItems = parseList(overlap?.valueJson);
  const assumptionVersion = inflow?.version ?? 1;
  const ktoSourced = festival.provenance === "kto";

  return (
    <div>
      <FestivalNav festival={festival} current="evidence" />

      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-sm text-muted">사실과 가정을 같은 화면에 두고, 예측 기능은 켜지 않습니다.</p>
        <EditorOnly>
          <form action={refreshEvidenceAction}>
            <input type="hidden" name="festivalId" value={festival.id} />
            <button className="rounded-full bg-white px-4 py-2 text-sm font-bold shadow-card" type="submit">
              KTO 다시 불러오기
            </button>
          </form>
        </EditorOnly>
      </div>

      <div className="mb-6 rounded-2xl bg-navy px-5 py-4 text-white">
        <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-white/60">라벨 게이트</p>
        <p className="mt-1 text-lg font-extrabold">{labelGateCopy(festival.labelLevel)}</p>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <article className="rounded-3xl bg-white p-6 shadow-card">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xl font-extrabold">{ktoSourced ? "KTO로 확인된 기본정보" : "등록된 기본정보"}</h2>
            <KindBadge kind="observation" />
          </div>
          <dl className="space-y-2 text-sm">
            <Row label="공식 이름" value={festival.name} />
            <Row label="장소" value={festival.place} />
            <Row label="일정" value={`${festival.startDate ?? "없음"} – ${festival.endDate ?? "없음"}`} />
            <Row label="프로그램" value={festival.program} />
          </dl>
          <p className="mt-4 text-xs text-muted">
            {ktoSourced
              ? "출처: KTO detailCommon2 / detailIntro2 · 입장객·예산은 API에 없음"
              : festival.clonedFromId
                ? "출처: 이전 행사 원장에서 복제된 담당자 입력 · KTO 공식 정보로 표시하지 않음"
                : "출처: 담당자 직접 입력 · KTO 공식 정보로 확인되지 않음"}
          </p>
        </article>

        <article className="rounded-3xl bg-white p-6 shadow-card">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xl font-extrabold">동기간 인근 행사</h2>
            <KindBadge kind="observation" />
          </div>
          <SnapshotState snapshot={overlap} />
          {overlapItems.length ? (
            <ul className="mt-3 space-y-2">
              {overlapItems.map((item, index) => (
                <li key={`${String(item.title ?? "event")}-${index}`} className="rounded-2xl bg-paper px-4 py-3">
                  <b>{String(item.title ?? "이름 없음")}</b>
                  <p className="text-sm text-muted">
                    {String(item.addr1 || "주소 없음")} · {String(item.eventstartdate || "시작일 없음")}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-muted">겹치는 행사 목록 없음. 일정 판단은 담당자 입력으로 이어갑니다.</p>
          )}
          <p className="mt-3 text-xs text-muted">{overlap?.prohibition}</p>
        </article>

        <article className="rounded-3xl bg-white p-6 shadow-card">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xl font-extrabold">지역 방문 배경선</h2>
            <KindBadge kind="observation" />
          </div>
          <Guardrail>
            KTO 지역방문자 수는 <em className="font-extrabold not-italic text-coral">행사장 입장객이 아닙니다.</em>
            가정 범위를 정하는 배경으로만 사용합니다.
          </Guardrail>
          <VisitorSnapshots snapshots={visitorSnapshots} />
        </article>

        <article className="rounded-3xl bg-white p-6 shadow-card">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xl font-extrabold">시기·분산 보조신호</h2>
            <KindBadge kind="observation" />
          </div>
          <div className="space-y-4 text-sm">
            <SignalSnapshotBlock
              label="체류 잠재력"
              selection={demand}
              renderValue={(snapshot) => (
                <p>
                  지수 <EmptyValue value={readScore(snapshot.valueJson)} suffix="지수" />
                </p>
              )}
            />
            <SignalSnapshotBlock
              label="인근 집중률"
              selection={concentration}
              renderValue={(snapshot) => <p>{snapshot.rawSummary ?? "요약 없음"}</p>}
            />
            <SignalSnapshotBlock
              label="연관 관광지"
              selection={related}
              renderValue={(snapshot) => {
                const items = parseList(snapshot.valueJson).slice(0, 3);
                return items.length ? (
                  <ol className="space-y-1">
                    {items.map((item, index) => (
                      <li key={`${relatedTitle(item)}-${index}`}>
                        {index + 1}. {relatedTitle(item)}
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="text-muted">결과 항목 없음</p>
                );
              }}
            />
          </div>
        </article>
      </div>

      <EditorOnly>
        <AssumptionsForm
          festivalId={festival.id}
          version={assumptionVersion}
          inflowMin={inflow?.minValue}
          inflowBase={inflow?.baseValue}
          inflowMax={inflow?.maxValue}
          dwellHours={dwell?.baseValue}
          operatingHours={hours?.baseValue}
          peakRatio={peak?.baseValue}
          rationale={inflow?.rationale}
          author={inflow?.author}
        />

        <CapacityForm
          festivalId={festival.id}
          zone={rule?.zone ?? "호수 무대 앞"}
          approvedCapacity={rule?.approvedCapacity}
          dwellHours={rule?.dwellHours}
          documentRef={rule?.documentRef}
          approver={rule?.approver}
        />
      </EditorOnly>

      {festival.quality.length ? (
        <section className="mt-5 rounded-3xl bg-white p-6 shadow-card">
          <h2 className="mb-3 text-xl font-extrabold">데이터 결측·제약</h2>
          <ul className="space-y-2 text-sm">
            {festival.quality.map((row) => (
              <li key={row.id} className="rounded-2xl bg-paper px-4 py-3">
                <b>{row.issue}</b> · {row.note}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted">{label}</dt>
      <dd>{value || <span className="text-muted">없음</span>}</dd>
    </div>
  );
}

type Snapshot = FestivalDetail["snapshots"][number];

function SnapshotState({
  snapshot,
}: {
  snapshot?: { status: string; rawSummary: string | null; stale: boolean; fetchedAt: Date } | undefined;
}) {
  if (!snapshot) return <p className="text-sm text-muted">스냅샷 없음</p>;
  return (
    <p className="mt-2 text-xs text-muted">
      상태 {snapshot.status}
      {snapshot.stale ? " · 이전 성공값" : ""} · {snapshot.rawSummary}
    </p>
  );
}

type SignalSnapshotSelection = {
  current?: Snapshot;
  historical?: Snapshot;
};

function SignalSnapshotBlock({
  label,
  selection,
  renderValue,
}: {
  label: string;
  selection: SignalSnapshotSelection;
  renderValue: (snapshot: Snapshot) => ReactNode;
}) {
  const { current, historical } = selection;
  const showHistorical = Boolean(historical && (!current || current.status !== "success"));

  return (
    <section className="rounded-2xl border border-ink/10 bg-paper px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-extrabold">{label}</h3>
        {current ? <SnapshotStatusBadge snapshot={current} /> : <span className="text-xs text-muted">현재 스냅샷 없음</span>}
      </div>

      {current ? (
        <>
          {current.status === "success" ? (
            <div className="mt-2">{renderValue(current)}</div>
          ) : (
            <p className="mt-2 text-muted">{snapshotUnavailableCopy(current)}</p>
          )}
          <SnapshotMetadata snapshot={current} />
        </>
      ) : (
        <p className="mt-2 text-muted">현재 호출 결과가 없습니다. 과거 값을 최신값으로 대체하지 않습니다.</p>
      )}

      {showHistorical && historical ? (
        <aside className="mt-3 rounded-xl border border-coral/30 bg-white px-3 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <b className="text-coral">과거 성공 스냅샷 · 참고 전용</b>
            <SnapshotStatusBadge snapshot={historical} />
          </div>
          <p className="mt-1 text-xs text-muted">최신 근거로 사용하지 않으며, 현재 호출의 빈결과·오류를 덮어쓰지 않습니다.</p>
          <div className="mt-2">{renderValue(historical)}</div>
          <SnapshotMetadata snapshot={historical} />
        </aside>
      ) : null}
    </section>
  );
}

function SnapshotStatusBadge({ snapshot }: { snapshot: Snapshot }) {
  const tone =
    snapshot.status === "success"
      ? "bg-teal-soft text-teal"
      : snapshot.status === "empty"
        ? "bg-white text-muted"
        : "bg-coral-soft text-coral";
  return (
    <span className={`rounded-full px-2.5 py-1 text-[11px] font-extrabold ${tone}`}>
      {snapshot.stale ? "과거" : "현재"} · {snapshotStatusLabel(snapshot.status)}
    </span>
  );
}

function SnapshotMetadata({ snapshot }: { snapshot: Snapshot }) {
  return (
    <div className="mt-2 space-y-1 text-xs text-muted">
      <p>
        API {snapshot.apiName} · 기준일 {snapshot.baseDate ?? "없음"} · 호출 {snapshot.fetchedAt.toLocaleString("ko-KR")}
      </p>
      <p>집계 {snapshot.aggregation ?? "없음"}</p>
      <p>허용 해석 {snapshot.interpretation ?? "없음"}</p>
      <p className="text-coral">금지 해석 {snapshot.prohibition ?? "없음"}</p>
    </div>
  );
}

function snapshotUnavailableCopy(snapshot: Snapshot) {
  if (snapshot.status === "empty") return "최신 호출은 정상 처리됐지만 결과가 비어 있습니다.";
  if (snapshot.status === "error") {
    return `최신 호출에 실패했습니다. 이전 값을 최신값으로 사용하지 않습니다.${snapshot.rawSummary ? ` · ${snapshot.rawSummary}` : ""}`;
  }
  return `현재 상태(${snapshot.status})에서는 값을 표시하지 않습니다.`;
}

function snapshotStatusLabel(status: string) {
  if (status === "success") return "정상";
  if (status === "empty") return "빈결과";
  if (status === "error") return "오류";
  return status;
}

function VisitorSnapshots({ snapshots }: { snapshots: Snapshot[] }) {
  if (!snapshots.length) return <p className="mt-3 text-sm text-muted">방문자 시계열 없음</p>;
  const rows: Array<Record<string, unknown> & { window: string }> = snapshots.flatMap((snapshot) =>
    parseList(snapshot.valueJson).map((row) => ({ ...row, window: readWindow(snapshot, row) })),
  );

  return (
    <div className="mt-3">
      <div className="mb-3 flex flex-wrap gap-2">
        {snapshots.map((snapshot) => (
          <span key={snapshot.id} className="rounded-full bg-paper px-3 py-1 text-xs text-muted">
            {readWindow(snapshot)} · {snapshot.status}
            {snapshot.stale ? " · 이전 성공값" : ""}
          </span>
        ))}
      </div>
      {rows.length ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead className="text-left text-muted">
              <tr>
                <th className="pb-2">구간</th>
                <th className="pb-2">기준일</th>
                <th className="pb-2">구분</th>
                <th className="pb-2">순방문자</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 18).map((row, index) => (
                <tr key={`${String(row.window)}-${String(row.baseYmd)}-${index}`} className="border-t border-ink/5">
                  <td className="py-2 font-bold">{String(row.window || "미분류")}</td>
                  <td>{String(row.baseYmd || row.baseymd || "없음")}</td>
                  <td>{String(row.touDivNm || row.toudivnm || "없음")}</td>
                  <td>
                    <EmptyValue
                      value={row.touNum === undefined && row.tounum === undefined ? null : Number(row.touNum ?? row.tounum)}
                      suffix="명"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-muted">구간별 스냅샷은 있으나 방문자 행은 없습니다.</p>
      )}
      <ul className="mt-3 space-y-1 text-xs text-muted">
        {snapshots.map((snapshot) => (
          <li key={`${snapshot.id}-meta`}>
            {readWindow(snapshot)} · {snapshot.aggregation} · 기준일 {snapshot.baseDate ?? "없음"} · 호출{" "}
            {snapshot.fetchedAt.toLocaleString("ko-KR")}
          </li>
        ))}
      </ul>
    </div>
  );
}

function parseList(raw?: string) {
  if (!raw || raw === "null") return [] as Array<Record<string, unknown>>;
  try {
    const value = JSON.parse(raw) as unknown;
    if (Array.isArray(value)) return value as Array<Record<string, unknown>>;
    if (!value || typeof value !== "object") return [];
    const record = value as Record<string, unknown>;
    for (const key of ["items", "data", "rows", "value"]) {
      const candidate = record[key];
      if (Array.isArray(candidate)) return candidate as Array<Record<string, unknown>>;
    }
    const nestedItems = record.items;
    if (nestedItems && typeof nestedItems === "object") {
      const item = (nestedItems as Record<string, unknown>).item;
      if (Array.isArray(item)) return item as Array<Record<string, unknown>>;
      if (item && typeof item === "object") return [item as Record<string, unknown>];
    }
    return [];
  } catch {
    return [];
  }
}

function latestSnapshot(snapshots: Snapshot[], apiName: string) {
  const matches = snapshots
    .filter((row) => row.apiName === apiName)
    .sort((a, b) => b.fetchedAt.getTime() - a.fetchedAt.getTime());
  return matches.find((row) => !row.stale) ?? matches[0];
}

function selectSignalSnapshots(snapshots: Snapshot[], apiName: string): SignalSnapshotSelection {
  const matches = snapshots
    .filter((row) => row.apiName === apiName)
    .sort((a, b) => b.fetchedAt.getTime() - a.fetchedAt.getTime());
  return {
    current: matches.find((row) => !row.stale),
    historical: matches.find((row) => row.stale && row.status === "success"),
  };
}

function latestVisitorSnapshots(snapshots: Snapshot[]) {
  const matches = snapshots
    .filter(
      (row) =>
        row.apiName === "metcoRegnVisitrDDList" ||
        row.apiName === "locgoRegnVisitrDDList",
    )
    .sort((a, b) => b.fetchedAt.getTime() - a.fetchedAt.getTime());
  const pool = matches.some((row) => !row.stale) ? matches.filter((row) => !row.stale) : matches;
  const byWindow = new Map<string, Snapshot>();
  for (const snapshot of pool) {
    const window = readWindow(snapshot);
    if (!byWindow.has(window)) byWindow.set(window, snapshot);
  }
  const order = ["평시", "전년 동기간", "당해"];
  return [...byWindow.values()].sort(
    (a, b) => order.indexOf(readWindow(a)) - order.indexOf(readWindow(b)),
  );
}

function readWindow(snapshot: Snapshot, row?: Record<string, unknown>) {
  if (typeof row?.window === "string" && row.window) return row.window;
  try {
    const value = JSON.parse(snapshot.valueJson) as unknown;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const window = (value as Record<string, unknown>).window;
      if (typeof window === "string" && window) return window;
    }
    if (Array.isArray(value) && value[0] && typeof value[0] === "object") {
      const window = (value[0] as Record<string, unknown>).window;
      if (typeof window === "string" && window) return window;
    }
  } catch {
    // 손상된 원문은 상태 문구로 남기고 구간만 미분류 처리한다.
  }
  for (const label of ["평시", "전년 동기간", "당해"]) {
    if (snapshot.aggregation?.includes(label)) return label;
  }
  return "미분류";
}

function relatedTitle(item: Record<string, unknown>) {
  for (const key of ["rlteTatsNm", "rlteTarNm", "tAtsNm", "title", "name"]) {
    const value = item[key];
    if (value !== null && value !== undefined && String(value).trim()) return String(value);
  }
  return "이름 없음";
}

function labelGateCopy(level: string) {
  if (level === "L2") return "시간/구역 단위 실측이 있습니다. 피크 재현과 수용량 검증에 사용합니다.";
  if (level === "L1") return "일별 총계만 있습니다. 시간·구역 정밀예측은 없습니다.";
  return "실측 라벨이 없습니다. 가정 범위와 시나리오만 사용합니다.";
}

function readScore(raw?: string) {
  if (!raw || raw === "null") return null;
  try {
    const value = JSON.parse(raw) as { score?: number | null };
    return value?.score ?? null;
  } catch {
    return null;
  }
}
