"use client";
import { useId } from "react";
import type { VisitorProfileBand } from "@/lib/datalab/visitor-profile-types";

export const pct = (value: number) => `${value.toFixed(1)}%`;
export const SEX = [
  { key: "malePercent", short: "남", label: "남성", swatch: "bg-blue", soft: "bg-blue/40" },
  { key: "femalePercent", short: "여", label: "여성", swatch: "bg-coral", soft: "bg-coral/45" },
] as const;

/** Published sex·age shares of all domestic visitors on one shared scale (rounded up to a whole 5%); no headcounts. */
export function DemographicBars({ rows, note = "내국인 방문자 전체 중 비율(%)" }: { rows: VisitorProfileBand[]; note?: string }) {
  const id = useId();
  const max = Math.max(5, Math.ceil(Math.max(0, ...rows.flatMap(r => [r.malePercent, r.femalePercent])) / 5) * 5);
  const label = `성·연령별 비율, 내국인 방문자 전체 중. ${rows.map(r => `${r.ageBand} 남성 ${pct(r.malePercent)}, 여성 ${pct(r.femalePercent)}`).join("; ")}`;
  return <section aria-labelledby={`${id}-heading`} className="min-w-0 space-y-2">
    <div>
      <h4 id={`${id}-heading`} className="font-extrabold">성·연령별 비율</h4>
      <p className="text-xs text-muted">{note}</p>
    </div>
    <p className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
      {SEX.map(s => <span key={s.key} className="inline-flex items-center gap-1"><span aria-hidden="true" className={`inline-block h-3 w-3 rounded-sm ${s.swatch}`} />{s.label}({s.short})</span>)}
    </p>
    <div role="img" aria-label={label} className="space-y-2">
      <div aria-hidden="true" className="grid grid-cols-[4.5rem_1.25rem_minmax(0,1fr)_3rem] gap-x-1.5 text-xs text-muted">
        <span className="col-start-3 flex justify-between"><span>0%</span><span>{max}%</span></span>
      </div>
      {rows.map(r => <div key={r.ageBand} aria-hidden="true" className="grid grid-cols-[4.5rem_1.25rem_minmax(0,1fr)_3rem] items-center gap-x-1.5 gap-y-0.5 text-xs">
        <span className="row-span-2 text-sm">{r.ageBand}</span>
        {SEX.map(s => <span key={s.key} className="contents">
          <span className="text-muted">{s.short}</span>
          <span className="block h-2.5 rounded bg-paper"><span className={`block h-full rounded ${s.swatch}`} style={{ width: `${Math.min(100, (r[s.key] / max) * 100)}%` }} /></span>
          <span className="text-right tabular-nums">{pct(r[s.key])}</span>
        </span>)}
      </div>)}
    </div>
  </section>;
}
