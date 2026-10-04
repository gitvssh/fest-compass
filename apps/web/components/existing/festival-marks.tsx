"use client";
import { Baby, Hand, Quote, Ticket, type LucideIcon } from "lucide-react";
import type { FestivalMarks, MarkKind } from "@/lib/existing/festival-marks";
import { SOURCE } from "@/lib/region/model";
import { timeLabel } from "./format";
import { InfoDialog } from "./ui";

// One icon per mark wherever marks are shown (search filter chips, result cards, a festival's header).
export const MARK_ICONS: Readonly<Record<MarkKind, LucideIcon>> = { experience: Hand, family: Baby, free: Ticket };
const TONES: Readonly<Record<MarkKind, string>> = {
  experience: "bg-teal-soft text-[#11564f]", family: "bg-amber-50 text-amber-900", free: "bg-blue-soft text-[#164ea1]",
};

/** The marks read from a registration's introduction as small labels; nothing when not read yet or none found. */
export function MarkBadges({ marks, className = "" }: { marks: FestivalMarks | null | undefined; className?: string }) {
  if (!marks?.items.length) return null;
  return <span className={`flex flex-wrap gap-1 ${className}`}>
    {marks.items.map(m => { const Icon = MARK_ICONS[m.kind];
      return <span key={m.kind} className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold ${TONES[m.kind]}`}><Icon aria-hidden="true" size={13} strokeWidth={2.25} />{m.label}</span>; })}
  </span>;
}

/** Where each mark comes from: the words of the registration's own introduction, and when they were read. */
export function MarkEvidence({ marks }: { marks: FestivalMarks | null | undefined }) {
  if (!marks?.items.length) return null;
  return <InfoDialog label="소개 글 근거" title="등록 소개 글에서 찾은 표시" buttonClassName="region-button no-print min-h-8 px-2 py-1 text-xs" buttonIcon={<Quote size={13} />}>
    <ul className="space-y-2">
      {marks.items.map(m => { const Icon = MARK_ICONS[m.kind];
        return <li key={m.kind} className="flex items-start gap-2">
          <span aria-hidden="true" className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg ${TONES[m.kind]}`}><Icon size={15} /></span>
          <span className="min-w-0"><span className="block font-bold">{m.label}</span><span className="block break-words text-muted">“{m.evidence}”</span></span>
        </li>; })}
    </ul>
    <p className="text-muted">한국관광공사 등록 정보의 행사 소개 글에 이 낱말이 있어요. 실제 운영 여부는 주최 측 안내를 확인해 주세요.</p>
    <p className="text-muted">{timeLabel(marks.checkedAt)} 확인 · <a className="font-bold text-blue underline" href={SOURCE} target="_blank" rel="noreferrer">공공데이터포털 관광정보 서비스 ↗</a></p>
  </InfoDialog>;
}
