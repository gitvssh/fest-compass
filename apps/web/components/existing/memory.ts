"use client";
import type { Point, ResourceItem } from "@/lib/existing/types";

// Temporary exploration memory for this browser tab. It survives menu moves and back/forward because it
// lives in the loaded client module, and it disappears on a reload, which then restores only the address.
// Nothing here is written to storage or sent to the server.
export type View = "visits" | "resources" | "timing";
export type Anchor = { point: Point; label: string; source: "resource" | "map"; resourceId?: string };
export type Candidate = { id: string; start: string; end: string };

export type FestivalMemory = {
  festivalId: string;
  /** Last applied address query of each view, used by the view menu. */
  search: Partial<Record<View, string>>;
  resources: { selected: ResourceItem | null; anchor: Anchor | null; radiusKm: number | null; sort: "name" | "distance"; display: "list" | "map" };
  timing: { candidates: Candidate[]; observedMonth: string | null; returnTo: { month: string | null; focusId: string } | null };
  /** Opened tables and source panels, restored when coming back to the same view. */
  open: Record<string, boolean>;
  focusHeading: View | null;
};

/** Conditions that stay when another festival is chosen (resource types, observation year, calendar month). */
export const shared: { types: string | null; year: string | null; month: string | null; search: string | null; focusTitle: boolean } = { types: null, year: null, month: null, search: null, focusTitle: false };

let active: FestivalMemory | null = null;
function fresh(festivalId: string): FestivalMemory {
  return {
    festivalId, search: {}, focusHeading: null, open: {},
    resources: { selected: null, anchor: null, radiusKm: null, sort: "name", display: "list" },
    timing: { candidates: [], observedMonth: null, returnTo: null },
  };
}
/** Choosing another festival clears the previous festival's selections, center and candidate periods. */
export function festivalMemory(festivalId: string): FestivalMemory {
  if (!active || active.festivalId !== festivalId) active = fresh(festivalId);
  return active;
}

export function viewHref(festivalId: string, view: View): string {
  const memory = festivalMemory(festivalId), base = `/existing/${encodeURIComponent(festivalId)}/${view}`;
  let query = memory.search[view];
  if (query === undefined) {
    const params = new URLSearchParams();
    if (view === "resources" && shared.types) params.set("types", shared.types);
    if (view === "timing") { if (shared.year) params.set("year", shared.year); if (shared.month) params.set("month", shared.month); }
    query = params.toString();
  }
  return query ? `${base}?${query}` : base;
}
