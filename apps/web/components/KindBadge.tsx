const STYLES = {
  observation: "bg-blue-soft text-blue",
  assumption: "bg-coral-soft text-coral",
  calculated: "bg-teal-soft text-teal",
  measured: "bg-lime text-ink",
} as const;

const LABELS = {
  observation: "API 관측값",
  assumption: "사용자 가정",
  calculated: "계산값",
  measured: "현장 실측값",
} as const;

export function KindBadge({ kind }: { kind: keyof typeof STYLES | string }) {
  const key = (kind in STYLES ? kind : "observation") as keyof typeof STYLES;
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-extrabold tracking-wide ${STYLES[key]}`}>
      {LABELS[key]}
    </span>
  );
}
