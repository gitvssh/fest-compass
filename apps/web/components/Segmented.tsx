"use client";

/**
 * View criterion (year, ranking basis, visitor group): buttons in one bordered box, the chosen one navy. `columns` lays the
 * options out evenly on a phone; from the small breakpoint they sit in one row.
 */
export function Segmented<T extends string | number>({ label, value, options, onChange, columns }: { label: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; columns: string }) {
  return <div role="group" aria-label={label} className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
    <span aria-hidden="true" className="text-xs font-bold text-muted">{label}</span>
    <span className={`grid w-full gap-1 rounded-xl border border-ink/15 bg-white p-1 sm:inline-flex sm:w-auto ${columns}`}>
      {options.map(o => <button key={o.value} type="button" aria-pressed={o.value === value} onClick={() => onChange(o.value)}
        className={`inline-flex min-h-9 items-center justify-center rounded-lg px-1 text-sm font-bold tabular-nums transition-colors sm:px-3 ${o.value === value ? "bg-navy text-white" : "text-ink hover:bg-paper"}`}>{o.label}</button>)}
    </span>
  </div>;
}
