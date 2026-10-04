import { ArrowRight, BookOpen, ExternalLink, ListChecks, MessageCircleQuestion, RotateCcw, Users, type LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { guideTask, JOURNEYS } from "@/lib/guide/content";
import { guideSource, PHASES, STAGE_LABELS, type Phase, type PhaseStage } from "@/lib/guide/process";
import { IconBadge, PHASE_ICONS, TASK_ICONS } from "./icons";

const START: Record<"existing" | "new", string> = { existing: "/existing/search", new: "/new" };
const STAGES: PhaseStage[] = ["before", "during", "after"];
const date = (iso: string) => `${Number(iso.slice(0, 4))}.${Number(iso.slice(5, 7))}.${Number(iso.slice(8, 10))}.`;

/** Seven phases on one rail grouped by 개최 전·개최·개최 후, looping back to the next edition. Links jump to each phase. */
export function PhaseRail() {
  return <nav aria-label="단계 바로가기" className="region-card relative overflow-x-auto px-3 py-4 sm:px-5">
    <div className="mx-auto flex w-max items-stretch gap-3">
      {STAGES.map((stage, i) => <div key={stage} className="flex items-stretch gap-3">
        {i > 0 && <span aria-hidden="true" className="self-center text-ink/25"><ArrowRight size={18} /></span>}
        <div className={`rounded-2xl px-2 pb-2 pt-1.5 ${stage === "during" ? "bg-coral-soft/60" : stage === "after" ? "bg-teal-soft/60" : "bg-blue-soft/50"}`}>
          <p className="px-1 pb-1.5 text-xs font-extrabold text-ink/70">{STAGE_LABELS[stage]}</p>
          <ol className="flex gap-1.5">
            {PHASES.filter(p => p.stage === stage).map(p => { const Icon = PHASE_ICONS[p.icon];
              return <li key={p.step}><a href={`#phase-${p.step}`} className="flex w-[104px] flex-col items-center gap-1.5 rounded-xl bg-white px-2 py-2.5 text-center shadow-[0_1px_2px_rgb(7_26_51/0.06)] transition-colors hover:bg-[#f3f7ff]">
                <span aria-hidden="true" className="relative grid h-10 w-10 place-items-center rounded-full bg-navy text-white">
                  <Icon size={19} />
                  <span className="absolute -right-1.5 -top-1 grid h-5 min-w-5 place-items-center rounded-full border-2 border-white bg-blue px-1 text-[11px] font-extrabold leading-none">{p.step}</span>
                </span>
                <span className="text-xs font-bold leading-snug">{p.title}</span>
                {p.explore.length > 0 && <span className="rounded-full bg-blue-soft px-1.5 text-[10px] font-bold text-[#164ea1]">pickDday</span>}
              </a></li>; })}
          </ol>
        </div>
      </div>)}
      <span className="flex items-center gap-1.5 self-center pl-1 text-xs font-bold text-muted"><RotateCcw aria-hidden="true" size={16} />다음 회차로</span>
    </div>
  </nav>;
}

/** Labelled part of a phase card; the same parts line up across the cards of a row. */
function Zone({ icon: Icon, label, className = "", children }: { icon: LucideIcon; label: string; className?: string; children: ReactNode }) {
  return <div className={`min-w-0 ${className}`}>
    <p className="mb-1.5 inline-flex items-center gap-1 text-xs font-bold text-muted"><Icon aria-hidden="true" size={14} />{label}</p>
    {children}
  </div>;
}

/**
 * One phase as six fixed parts — title, work, question, offices, sources, pickDday links. From two columns up the card is a
 * subgrid over six shared rows, so each part starts at the same height as in the neighbouring cards; the minimum heights
 * fit the longest content, so the parts also start at the same height from one row of cards to the next.
 */
function PhaseCard({ phase }: { phase: Phase }) {
  return <li id={`phase-${phase.step}`} className="region-card flex scroll-mt-28 flex-col gap-4 md:row-span-6 md:grid md:grid-rows-subgrid md:gap-4">
    <div className="flex items-start gap-3">
      <IconBadge icon={PHASE_ICONS[phase.icon]} tone="navy" size={20} className="h-11 w-11" />
      <div className="min-w-0">
        <p className="text-xs font-bold text-muted">{phase.step}단계 · {STAGE_LABELS[phase.stage]}</p>
        <h2 className="text-lg font-extrabold leading-snug">{phase.title}</h2>
      </div>
    </div>
    <Zone icon={ListChecks} label="하는 일" className="md:min-h-[6.75rem]">
      <ul className="space-y-1 text-sm leading-6">
        {phase.work.map(w => <li key={w} className="flex gap-2"><span aria-hidden="true" className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-blue" />{w}</li>)}
      </ul>
    </Zone>
    <p className="flex items-start gap-2.5 rounded-xl bg-teal-soft/60 px-3 py-2.5 text-sm font-bold leading-6 md:min-h-[4.25rem]">
      <MessageCircleQuestion aria-hidden="true" size={18} className="mt-[3px] shrink-0 text-[#147a6f]" /><span><span className="sr-only">확인할 질문: </span>{phase.ask}</span>
    </p>
    <Zone icon={Users} label="협의할 곳">
      <ul className="flex flex-wrap gap-1.5">{phase.consult.map(c => <li key={c} className="rounded-full border border-ink/15 bg-white px-2.5 py-0.5 text-xs font-bold">{c}</li>)}</ul>
    </Zone>
    <Zone icon={BookOpen} label="원문" className="md:min-h-[5.5rem]">
      <ul className="space-y-0.5 text-sm">{phase.read.map(id => { const s = guideSource(id);
        return <li key={id}><a href={s.url} target="_blank" rel="noreferrer" className="inline-flex items-start gap-1 font-bold text-blue underline-offset-4 hover:underline">
          <span>{s.title}<span className="font-normal text-muted"> · {s.publisher} {s.kind}</span></span><ExternalLink aria-hidden="true" size={13} className="mt-1 shrink-0" /><span className="sr-only">(새 탭)</span>
        </a></li>; })}</ul>
    </Zone>
    {phase.explore.length > 0 ? <div className="flex flex-col items-start gap-2 border-t border-ink/10 pt-3">
      {phase.explore.map(e => { const task = guideTask(e.journey, e.view), Icon = TASK_ICONS[e.view];
        return <Link key={`${e.journey}-${e.view}`} href={START[e.journey]} className="region-button min-h-11 border-blue/30 bg-blue-soft/40 text-[#164ea1] hover:bg-blue-soft">
          <Icon aria-hidden="true" size={16} />{JOURNEYS[e.journey].name} · {task.title}
        </Link>; })}
    </div> : <div aria-hidden="true" className="hidden md:block" />}
  </li>;
}

export function PhaseList() {
  return <ol className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{PHASES.map(p => <PhaseCard key={p.step} phase={p} />)}</ol>;
}

export function SourcesNote() {
  const checked = [...new Set(PHASES.flatMap(p => p.read).map(id => guideSource(id).checkedOn))].sort().at(-1)!;
  return <p className="text-xs leading-5 text-muted">원문은 각 기관의 게시 페이지로 연결돼요({date(checked)} 확인). 심사 대상 금액·제출 기한 같은 기준은 사업과 시기에 따라 달라 원문과 담당 부서에서 확인해 주세요.</p>;
}
