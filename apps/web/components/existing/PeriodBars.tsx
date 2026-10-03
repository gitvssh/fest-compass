import { Fragment } from "react";
import { sideMeans } from "@/lib/existing/side-means";
import type { EditionHistory } from "@/lib/existing/types";
import { number } from "./format";

type Row = { key: string; label: string; value: number | null; missing: boolean; festival: boolean };

/**
 * Daily means of the shown days before the festival, the festival period itself and the shown days after it, as
 * three bars on the charts' shared scale. Observed values only: a side with a missing day shows no mean.
 */
export function PeriodBars({ edition, scaleMax }: { edition: EditionHistory; scaleMax: number }) {
  const s = edition.summary;
  if (s.status !== "available") return null;
  const { before, after } = sideMeans(edition.points, edition.start, edition.end);
  const rows: Row[] = [
    before && { key: "before", label: `개최 전 ${before.days}일`, value: before.rounded, missing: before.mean === null, festival: false },
    { key: "during", label: "개최기간", value: s.rounded, missing: false, festival: true },
    after && { key: "after", label: `종료 후 ${after.days}일`, value: after.rounded, missing: after.mean === null, festival: false },
  ].filter((r): r is Row => !!r);
  const scale = Math.max(scaleMax, ...rows.map(r => r.value ?? 0), 1);
  return <div className="space-y-1.5">
    <p className="text-xs font-bold text-muted">일평균 · 외지인 방문 추정</p>
    <dl className="grid grid-cols-[auto_minmax(3rem,1fr)_auto] items-center gap-x-3 gap-y-1.5 text-sm">
      {rows.map(r => <Fragment key={r.key}>
        <dt className={r.festival ? "font-bold text-blue" : "text-muted"}>{r.label}</dt>
        <dd aria-hidden="true" className="h-2.5 overflow-hidden rounded-full bg-paper">
          {r.value !== null && <span className={`block h-full rounded-full ${r.festival ? "bg-blue" : "bg-[#a3afbf]"}`} style={{ width: `${Math.max(2, (r.value / scale) * 100)}%` }} />}
        </dd>
        <dd className={`text-right tabular-nums ${r.festival ? "font-extrabold" : ""}`}>
          {r.value !== null ? <>{number(r.value)}<span className="font-normal text-muted">명/일</span></> : <span className="text-muted">{r.missing ? "값 없는 날 있음" : "—"}</span>}
        </dd>
      </Fragment>)}
    </dl>
  </div>;
}
