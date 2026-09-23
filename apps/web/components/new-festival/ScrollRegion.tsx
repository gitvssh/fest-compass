import type { ReactNode } from "react";

/** Named, keyboard-focusable local scroll area so long or wide tables never make the page scroll sideways. */
export function ScrollRegion({ label, children, tall = false }: { label: string; children: ReactNode; tall?: boolean }) {
  return <div role="region" aria-label={label} tabIndex={0}
    className={`max-w-full overflow-auto rounded-xl border border-ink/10 focus:outline-none focus:ring-2 focus:ring-blue/30 ${tall ? "max-h-80" : ""}`}>{children}</div>;
}
