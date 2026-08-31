import Link from "next/link";
import type { FestivalDetail } from "@/lib/queries";
import { labelLevelName } from "@/lib/format";
import { isPublicReadonly } from "@/lib/app-mode";
import { AnalyticsView } from "@/components/AnalyticsView";

const TABS = [
  ["evidence", "근거·가정"],
  ["scenarios", "시나리오"],
  ["ledger", "결정·성과"],
  ["report", "보고서"],
] as const;

export function FestivalNav({
  festival,
  current,
}: {
  festival: FestivalDetail;
  current: (typeof TABS)[number][0];
}) {
  return (
    <div className="mb-8">
      {/* Every workspace tab renders this nav, so measuring here keeps the
          reported tab identical to the one actually shown. The festival itself
          is never sent — festival_id and festival_name are forbidden
          properties. */}
      <AnalyticsView
        event="festival_workspace_view"
        properties={{ tab: current, app_mode: isPublicReadonly() ? "public-readonly" : "editor" }}
      />
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="mb-1 text-xs font-extrabold uppercase tracking-[0.16em] text-blue">
            {festival.isExample ? "예시 시나리오" : "실제 축제"}
          </p>
          <h1 className="text-3xl font-extrabold tracking-tight">{festival.name}</h1>
          <p className="mt-1 text-sm text-muted">
            {festival.place ?? "장소 없음"} · {festival.startDate ?? "일정 없음"}
            {festival.endDate ? `–${festival.endDate}` : ""}
          </p>
        </div>
        <div className="rounded-full bg-white px-3 py-1 text-xs font-bold text-ink shadow-card">
          {labelLevelName(festival.labelLevel)}
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {TABS.map(([key, label]) => (
          <Link
            key={key}
            href={`/festivals/${festival.id}/${key}`}
            className={`rounded-full px-4 py-2 text-sm font-bold ${
              current === key ? "bg-navy text-white" : "bg-white text-muted hover:text-ink"
            }`}
          >
            {label}
          </Link>
        ))}
      </div>
    </div>
  );
}
