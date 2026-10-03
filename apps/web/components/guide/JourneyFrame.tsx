"use client";
import { ArrowRight, EyeOff, Info, MessageCircleQuestion, Route, Target, type LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { guideTask, JOURNEYS, nextTask, type JourneyId, type TaskView } from "@/lib/guide/content";
import { IconBadge, TASK_ICONS } from "./icons";

export type TaskHrefs = Readonly<Record<TaskView, string>>;

/**
 * Task tabs of one journey: no numbers or visited marks, any tab in any order. Each tab names the task (large) and
 * the data it shows (small); the address, Back and `aria-current` behave as plain links.
 */
export function TaskTabs({ label, journey, current, hrefs, onSelect }: {
  label: string; journey: JourneyId; current: TaskView | null; hrefs: TaskHrefs; onSelect: (view: TaskView) => void;
}) {
  // `relative` keeps the visually hidden separators inside the scrolling list (they would widen the page otherwise).
  return <nav aria-label={label} className="no-print relative -mx-1 overflow-x-auto px-1 pt-1">
    <ul className="flex min-w-max gap-2 border-b border-ink/10 pb-3">
      {JOURNEYS[journey].tasks.map(task => {
        const Icon = TASK_ICONS[task.view], on = current === task.view;
        return <li key={task.view}>
          <Link href={hrefs[task.view]} aria-current={on ? "page" : undefined} onClick={() => onSelect(task.view)}
            className={`flex min-h-[52px] items-center gap-2.5 rounded-xl border py-1.5 pl-1.5 pr-4 transition-colors ${on ? "border-navy bg-navy text-white" : "border-ink/15 bg-white text-ink hover:border-blue/40 hover:bg-[#f3f7ff]"}`}>
            <span aria-hidden="true" className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${on ? "bg-white/15 text-white" : "bg-blue-soft text-blue"}`}><Icon size={18} /></span>
            <span className="text-left leading-tight">
              <span className="block text-sm font-extrabold">{task.title}</span>
              <span className="sr-only"> · </span>
              <span className={`mt-0.5 block text-xs ${on ? "text-white/75" : "text-muted"}`}>{task.data}</span>
            </span>
          </Link>
        </li>;
      })}
    </ul>
  </nav>;
}

function GuideItem({ icon, tone, label, children }: { icon: LucideIcon; tone: "blue" | "amber" | "teal"; label: string; children: ReactNode }) {
  return <div className="flex min-w-0 gap-3">
    <IconBadge icon={icon} tone={tone} />
    <div className="min-w-0 text-sm leading-6">
      <p className="text-xs font-bold text-muted">{label}</p>
      {children}
    </div>
  </div>;
}

/** The goal of this screen, what its data cannot tell, and two plain questions; read without any input. */
export function TaskGuide({ journey, view, note }: { journey: JourneyId; view: TaskView; note?: string | null }) {
  const task = guideTask(journey, view);
  return <section aria-label={`${task.title} 안내`} className="no-print rounded-2xl border border-ink/10 bg-white px-4 py-3 sm:px-5 sm:py-4">
    <div className={`grid gap-x-6 gap-y-3 ${task.questions.length ? "lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.8fr)_minmax(0,1.3fr)]" : ""}`}>
      <GuideItem icon={Target} tone="blue" label="목표"><p className="font-bold">{task.goal}</p></GuideItem>
      {task.unknown.length > 0 && <GuideItem icon={EyeOff} tone="amber" label="이 자료로 알 수 없어요"><p>{task.unknown.join(" · ")}</p></GuideItem>}
      {task.questions.length > 0 && <GuideItem icon={MessageCircleQuestion} tone="teal" label="살펴볼 질문">
        <ul className="space-y-0.5">{task.questions.map(q => <li key={q}>{q}</li>)}</ul>
      </GuideItem>}
    </div>
    {note && <p className="mt-3 flex items-start gap-2 border-t border-ink/10 pt-2.5 text-sm text-muted"><Info aria-hidden="true" size={16} className="mt-0.5 shrink-0" />{note}</p>}
  </section>;
}

/**
 * Bottom row of every task: the next task in the recommended order stands out, the other tasks stay one click away.
 * After the last task the row continues to the preparation process as a whole.
 */
export function NextRow({ journey, view, hrefs, onSelect }: { journey: JourneyId; view: TaskView; hrefs: TaskHrefs; onSelect: (view: TaskView) => void }) {
  const next = nextTask(journey, view), others = JOURNEYS[journey].tasks.filter(t => t.view !== view && t.view !== next?.view);
  const NextIcon = next ? TASK_ICONS[next.view] : Route;
  const content = <>
    <span aria-hidden="true" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/15"><NextIcon size={20} /></span>
    <span className="min-w-0 leading-tight">
      <span className="block text-xs font-bold text-white/70">이어서</span>
      <span className="block font-extrabold">{next ? next.title : "축제 준비 전체 과정"}</span>
    </span>
    <span className="hidden text-sm text-white/80 sm:inline">{next ? next.hint : "예산·안전 등 다음 단계 보기"}</span>
    <ArrowRight aria-hidden="true" size={18} className="shrink-0 transition-transform group-hover:translate-x-0.5" />
  </>;
  const nextClass = "group inline-flex min-h-14 max-w-full items-center gap-3 self-start rounded-2xl bg-navy py-2 pl-2 pr-5 text-left text-white transition-colors hover:bg-blue";
  return <nav aria-label="다음 할 일" className="no-print flex flex-col gap-3 border-t border-ink/10 pt-5 lg:flex-row lg:items-center lg:justify-between">
    {next ? <Link href={hrefs[next.view]} onClick={() => onSelect(next.view)} className={nextClass}>{content}</Link>
      : <Link href="/guide" className={nextClass}>{content}</Link>}
    <ul className="flex flex-wrap gap-2">
      {others.map(t => { const Icon = TASK_ICONS[t.view];
        return <li key={t.view}><Link href={hrefs[t.view]} onClick={() => onSelect(t.view)} className="region-button min-h-11"><Icon aria-hidden="true" size={16} className="text-blue" />{t.title}</Link></li>; })}
    </ul>
  </nav>;
}
