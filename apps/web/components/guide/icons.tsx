import {
  ArrowLeftRight, Building2, CalendarDays, ChartColumn, ChartLine, ClipboardList, Compass, FileCheck2, Handshake, Landmark,
  Lightbulb, MapPin, Repeat, Search, ShieldCheck, Tent, Users, Wallet, type LucideIcon,
} from "lucide-react";
import type { CheckKind, JudgmentIcon, TaskView } from "@/lib/guide/content";
import type { PhaseIcon } from "@/lib/guide/process";

// One icon per meaning across the journeys, the summary sheet and the preparation guide.
export const TASK_ICONS: Readonly<Record<TaskView, LucideIcon>> = { visits: ChartLine, resources: MapPin, timing: CalendarDays, summary: ClipboardList };
export const CHECK_ICONS: Readonly<Record<CheckKind, LucideIcon>> = { law: Landmark, dept: Building2, plan: Lightbulb };
export const JUDGMENT_ICONS: Readonly<Record<JudgmentIcon, LucideIcon>> = { keep: Repeat, people: Users, limits: Wallet, difference: ArrowLeftRight };
export const PHASE_ICONS: Readonly<Record<PhaseIcon, LucideIcon>> = {
  look: Search, direction: Compass, review: FileCheck2, contract: Handshake, prepare: ShieldCheck, run: Tent, result: ChartColumn,
};

/** Tinted square behind an icon; the icon itself is decorative and the text next to it carries the meaning. */
export function IconBadge({ icon: Icon, tone = "blue", size = 18, className = "" }: { icon: LucideIcon; tone?: "blue" | "amber" | "teal" | "navy" | "coral" | "muted"; size?: number; className?: string }) {
  const tones = {
    blue: "bg-blue-soft text-blue", amber: "bg-amber-50 text-amber-700", teal: "bg-teal-soft text-[#147a6f]",
    navy: "bg-navy text-white", coral: "bg-coral-soft text-[#b4321f]", muted: "bg-paper text-muted",
  };
  return <span aria-hidden="true" className={`icon-badge ${tones[tone]} ${className}`}><Icon size={size} strokeWidth={2} /></span>;
}
