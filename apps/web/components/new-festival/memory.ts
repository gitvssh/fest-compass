"use client";
import type { Anchor, Candidate } from "@/components/existing/memory";
import type { ResourceItem } from "@/lib/existing/types";

// Temporary exploration memory for this browser tab. It lives in the loaded client module, so it survives menu
// moves and back/forward, and disappears on reload (the address then restores only the durable conditions).
// Nothing here is written to storage or sent to the server.
export type NewView = "resources" | "visits" | "timing";

/** Selections that belong to one region. Another region gets a fresh object; stale writers only touch the old one. */
export type RegionMemory = {
  code: string;
  resources: { compared: ResourceItem[]; detail: ResourceItem | null; anchor: Anchor | null; radiusKm: number | null; sort: "name" | "distance"; display: "list" | "map" };
  visits: { observedMonth: string | null; returnFocus: string | null; open: Record<string, boolean> };
};

type TabMemory = {
  region: RegionMemory | null;
  /** Future candidate periods are region-independent: they stay when the region changes. */
  candidates: Candidate[];
  focusHeading: NewView | null;
  focusTitle: boolean;
};
export const tab: TabMemory = { region: null, candidates: [], focusHeading: null, focusTitle: false };

function fresh(code: string): RegionMemory {
  return {
    code,
    resources: { compared: [], detail: null, anchor: null, radiusKm: null, sort: "name", display: "list" },
    visits: { observedMonth: null, returnFocus: null, open: {} },
  };
}

/** Called once when a region shell mounts. Choosing another region clears the previous region's selections. */
export function regionMemory(code: string): RegionMemory {
  if (!tab.region || tab.region.code !== code) tab.region = fresh(code);
  return tab.region;
}
