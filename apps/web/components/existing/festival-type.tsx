import { Award, Landmark, Leaf, Palette, Sparkles, Wheat, type LucideIcon } from "lucide-react";
import { classificationLabel, festivalType, type FestivalTypeIcon } from "@/lib/existing/festival-types";

// One icon per festival type wherever a type is shown (search chips, result cards, a festival's header).
export const FESTIVAL_TYPE_ICONS: Readonly<Record<FestivalTypeIcon, LucideIcon>> = { award: Award, palette: Palette, wheat: Wheat, landmark: Landmark, leaf: Leaf, sparkles: Sparkles };

/** The registered classification of one festival as a small label; festival types carry their icon, other kinds only their name. */
export function TypeBadge({ code, className = "" }: { code: string | null | undefined; className?: string }) {
  const label = classificationLabel(code);
  if (!label) return null;
  const type = festivalType(code), Icon = type ? FESTIVAL_TYPE_ICONS[type.icon] : null;
  return <span className={`inline-flex w-fit items-center gap-1 rounded-full bg-paper px-2 py-0.5 text-xs font-bold text-ink/80 ${className}`}>
    {Icon && <Icon aria-hidden="true" size={13} strokeWidth={2.25} />}{type ? type.label : label}
  </span>;
}
