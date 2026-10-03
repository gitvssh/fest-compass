"use client";
import { ArrowRight, NotebookPen, Printer, Route, Users, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useId, useState, type ReactNode, type RefObject } from "react";
import { isStale } from "@/components/existing/blocks";
import { daysBetween, fullDate, koreaToday, periodLabel, timeLabel } from "@/components/existing/format";
import type { Candidate } from "@/components/existing/memory";
import { mergeSchedule } from "@/components/existing/ScheduleCalendar";
import { LoadState } from "@/components/existing/ui";
import { useKeyedRequest } from "@/components/existing/useKeyedRequest";
import { ResourcePhotoCredit, ResourceThumbnail } from "@/components/resources/ResourceGallery";
import { parseSchedule, scheduleKey } from "@/lib/existing/request";
import { RESOURCE_KIND_LABELS, type RegionRef, type ResourceItem, type ScheduleResponse } from "@/lib/existing/types";
import { CHECK_KINDS, type NextCheck } from "@/lib/guide/content";
import { CHECK_ICONS, IconBadge } from "./icons";

// Building blocks of the 모아 보기 sheet. It gathers only what the reader chose in this tab, shows each number with its
// region, unit and source, and prints as a personal review sheet. Nothing here scores, recommends or completes.

export function SheetHeader({ heading, title, subject }: { heading: RefObject<HTMLHeadingElement | null>; title: string; subject: string | null }) {
  return <div className="flex flex-wrap items-end justify-between gap-3">
    <div className="min-w-0">
      <h2 id="summary-heading" ref={heading} tabIndex={-1} className="text-xl font-extrabold sm:text-2xl">{title}</h2>
      <p className="mt-1 text-sm text-muted">{subject ? `${subject} · ` : ""}지금 고른 내용만 모아요 · 개인 검토 자료이며 공식 문서가 아니에요</p>
      <p className="print-only mt-1 text-xs">pickDday · {koreaToday().replaceAll("-", ".")} 출력</p>
    </div>
    <button type="button" className="region-primary no-print min-h-11 px-4" onClick={() => window.print()}><Printer aria-hidden="true" size={17} />인쇄하기</button>
  </div>;
}

export function SheetSection({ icon, tone = "blue", title, children, className = "" }: { icon: LucideIcon; tone?: "blue" | "teal" | "amber" | "navy"; title: string; children: ReactNode; className?: string }) {
  const id = useId();
  return <section aria-labelledby={id} className={`region-card min-w-0 space-y-3 ${className}`}>
    <h3 id={id} className="flex items-center gap-2.5 text-base font-extrabold"><IconBadge icon={icon} tone={tone} size={16} className="h-8 w-8" />{title}</h3>
    {children}
  </section>;
}

/** Nothing chosen yet: a short line and the task that fills this part (screen only). */
export function SheetEmpty({ text, href, label, icon: Icon }: { text: string; href?: string; label?: string; icon?: LucideIcon }) {
  return <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-xl border border-dashed border-ink/20 bg-[#fafaf8] px-3 py-2.5 text-sm">
    <p className="text-muted">{text}</p>
    {href && label && <Link href={href} className="no-print inline-flex min-h-10 items-center gap-1.5 font-bold text-blue underline-offset-4 hover:underline">
      {Icon && <Icon aria-hidden="true" size={16} />}{label}<ArrowRight aria-hidden="true" size={15} />
    </Link>}
  </div>;
}

/** Facts of one chosen place, with its public photo and credit when it has one. */
export function PlaceCard({ item, note }: { item: ResourceItem; note?: ReactNode }) {
  return <article className="flex min-w-0 gap-3 rounded-xl border border-ink/10 p-3">
    <ResourceThumbnail photo={item.photo} className="shrink-0" />
    <div className="min-w-0 space-y-0.5 text-sm">
      <h4 className="break-words font-extrabold">{item.title}</h4>
      <p className="text-muted">{RESOURCE_KIND_LABELS[item.kind]} · {item.address || "주소 정보 없음"}</p>
      {note && <p>{note}</p>}
      {item.photo && <ResourcePhotoCredit photo={item.photo} className="text-xs" />}
    </div>
  </article>;
}

/** Free memo kept only in this tab until printed; it is never saved or sent. */
export function MemoField({ label, placeholder, value, onChange }: { label: string; placeholder: string; value: string; onChange: (value: string) => void }) {
  const id = useId(), [text, setText] = useState(value);
  return <div className="space-y-1.5">
    <label htmlFor={id} className="sr-only">{label}</label>
    <textarea id={id} className="workspace-input no-print min-h-28 resize-y leading-6" maxLength={1000} value={text} placeholder={placeholder}
      onChange={e => { setText(e.target.value); onChange(e.target.value); }} />
    <p className="no-print flex items-center gap-1.5 text-xs text-muted"><NotebookPen aria-hidden="true" size={13} />저장되지 않아요 · 새로 고치면 지워져요 · 인쇄에 함께 나와요</p>
    <p className="print-only whitespace-pre-wrap text-sm">{text.trim() || "(메모 없음)"}</p>
  </div>;
}

/** Next things to confirm: an action, the place to ask and its kind. No checkbox, count or completion. */
export function CheckList({ checks }: { checks: readonly NextCheck[] }) {
  const tone = { law: "navy", dept: "teal", plan: "amber" } as const;
  return <div className="space-y-3">
    <ul className="space-y-2">
      {checks.map(c => <li key={c.action} className="flex min-w-0 gap-3 rounded-xl border border-ink/10 p-3">
        <IconBadge icon={CHECK_ICONS[c.kind]} tone={tone[c.kind]} size={16} className="h-8 w-8" />
        <div className="min-w-0 text-sm">
          <p className="font-bold">{c.action}</p>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
            <span className="inline-flex items-center gap-1"><Users aria-hidden="true" size={13} />{c.consult}</span>
            <span className="rounded-full bg-paper px-2 py-0.5 font-bold text-ink">{CHECK_KINDS[c.kind]}</span>
          </p>
        </div>
      </li>)}
    </ul>
    <Link href="/guide" className="no-print inline-flex min-h-10 items-center gap-1.5 text-sm font-bold text-blue underline-offset-4 hover:underline">
      <Route aria-hidden="true" size={16} />축제 준비 전체 과정에서 단계별로 보기<ArrowRight aria-hidden="true" size={15} />
    </Link>
  </div>;
}

/** One candidate period with the neutral lookup of that whole range: weekend days, holidays and registered events. */
export function CandidateBrief({ region, candidate: c }: { region: RegionRef; candidate: Candidate }) {
  const params = new URLSearchParams({ province: region.province, district: region.district, start: c.start, end: c.end });
  const key = (() => { try { return scheduleKey(parseSchedule(params)); } catch { return null; } })();
  const result = useKeyedRequest<ScheduleResponse>(key ? `/api/existing/schedule?${params}` : null, mergeSchedule, key), data = result.data;
  const holidays = data?.summary.holidays, events = data?.events, counted = data?.summary.events;
  return <article className="min-w-0 space-y-2 rounded-xl border border-ink/10 p-3 text-sm">
    <h4 className="font-extrabold">후보 {c.id} · {periodLabel(c.start, c.end)} · {daysBetween(c.start, c.end)}일</h4>
    <LoadState loading={result.loading} failure={result.failure} hasData={!!data} retrievedAt={data?.retrievedAt} subject="이 기간의 일정을" onRetry={result.retry} />
    {data && <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1">
      <dt className="text-muted">토·일요일</dt><dd>{data.summary.weekendDays}일</dd>
      <dt className="text-muted">공휴일</dt><dd>{holidays?.status === "complete"
        ? holidays.dates.length ? holidays.dates.map(d => `${fullDate(d.date)} ${d.labels.join("·")}`).join(", ") : "없음"
        : holidays?.status === "partial" ? "일부 날짜의 공휴일 정보를 불러올 수 없어요" : "공휴일 정보를 불러올 수 없어요"}</dd>
      <dt className="text-muted">등록 행사</dt><dd>{events?.status === "unavailable" ? "행사 일정을 불러오지 못했어요"
        : counted && counted.count !== null ? <>{counted.count === 0 ? "이 기간에 등록된 행사가 없어요" : `기간과 겹치는 등록 행사 ${counted.overlapping ?? 0}건`}
          {events && events.items.length > 0 && <span className="block text-xs text-muted">{events.items.filter(e => e.scheduleStatus !== "cancelled").slice(0, 3).map(e => e.title).join(" · ")}</span>}
          {events && isStale(events) && <span className="block text-xs text-muted">{timeLabel(events.collectedAt)} 기준</span>}</>
        : "전체 기간의 일정을 확인하지 못했어요"}</dd>
    </dl>}
  </article>;
}

/** Line under a number block: region, unit, basis and source with its collection time (printed with it). */
export function SourceLine({ children }: { children: ReactNode }) {
  return <p className="border-t border-ink/10 pt-2 text-xs leading-5 text-muted">{children}</p>;
}
