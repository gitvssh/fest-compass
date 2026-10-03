import { ArrowRight, ChevronRight, Printer, Route, Scale } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { JOURNEYS, type JourneyId } from "@/lib/guide/content";
import { IconBadge, JUDGMENT_ICONS, TASK_ICONS } from "./icons";

const IMAGES: Record<JourneyId, string> = { existing: "/images/purpose/existing-festival-v2.png", new: "/images/purpose/new-festival-v2.png" };

/**
 * Start-page map of one journey: the goal, the four tasks in the suggested order (free to take in any order),
 * what stays the officer's judgment and what the reader ends up with. Read-only; nothing here is a step to finish.
 */
export function FlowMap({ journey }: { journey: JourneyId }) {
  const guide = JOURNEYS[journey];
  return <section aria-labelledby={`${journey}-flow-heading`} className="region-card overflow-hidden p-0 sm:p-0">
    <div className="grid lg:grid-cols-[220px_minmax(0,1fr)]">
      <div aria-hidden="true" className="hidden items-center justify-center bg-[#f4f3ee] px-3 lg:flex">
        <Image src={IMAGES[journey]} alt="" width={1536} height={1024} sizes="200px" className="h-auto w-full mix-blend-multiply" />
      </div>
      <div className="min-w-0 space-y-4 p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
          <div className="flex min-w-0 gap-3">
            <IconBadge icon={Route} tone="navy" />
            <div className="min-w-0">
              <p className="text-xs font-bold text-muted">{guide.name} · 목표</p>
              <h2 id={`${journey}-flow-heading`} className="text-lg font-extrabold leading-snug">{guide.goal}</h2>
            </div>
          </div>
          <p className="inline-flex items-center gap-1.5 rounded-full bg-paper px-3 py-1.5 text-xs font-bold text-ink"><Route aria-hidden="true" size={14} className="text-blue" />처음이라면 이 순서로 · 순서는 자유</p>
        </div>
        <ol aria-label="할 일" className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {guide.tasks.map((task, i) => <li key={task.view} className="relative flex min-w-0 items-center gap-3 rounded-xl border border-ink/10 bg-[#fbfbf9] p-3">
            <IconBadge icon={TASK_ICONS[task.view]} tone={task.view === "summary" ? "teal" : "blue"} />
            <div className="min-w-0 leading-snug">
              <p className="text-sm font-extrabold">{task.title}</p>
              <p className="text-xs text-muted">{task.hint}</p>
            </div>
            {i < guide.tasks.length - 1 && <span aria-hidden="true" className="absolute -right-[13px] top-1/2 z-10 hidden h-6 w-6 -translate-y-1/2 place-items-center rounded-full border border-ink/10 bg-white text-muted xl:grid"><ChevronRight size={15} /></span>}
          </li>)}
        </ol>
        <div className="grid gap-3 border-t border-ink/10 pt-3 md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          <div className="flex min-w-0 gap-3">
            <IconBadge icon={Scale} tone="amber" />
            <div className="min-w-0">
              <p className="text-xs font-bold text-muted">판단은 담당자가 · 자료가 답하지 않아요</p>
              <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                {guide.judgments.map(j => { const Icon = JUDGMENT_ICONS[j.icon];
                  return <li key={j.text} className="inline-flex items-center gap-1.5"><Icon aria-hidden="true" size={15} className="shrink-0 text-amber-700" />{j.text}</li>; })}
              </ul>
            </div>
          </div>
          <div className="flex min-w-0 gap-3">
            <IconBadge icon={Printer} tone="teal" />
            <div className="min-w-0">
              <p className="text-xs font-bold text-muted">끝에 얻는 것</p>
              <p className="mt-1 text-sm font-bold">{guide.outcome}</p>
            </div>
          </div>
        </div>
        <Link href="/guide" className="inline-flex min-h-11 items-center gap-1.5 text-sm font-bold text-blue underline-offset-4 hover:underline">
          축제 준비 전체 과정 보기<ArrowRight aria-hidden="true" size={15} />
        </Link>
      </div>
    </div>
  </section>;
}
