// Pure comparisons between two reviewed visitor profiles. Safe for client imports; no data, no server code.
import type { VisitorProfileDestination, VisitorProfileResource } from "./visitor-profile-types";

/**
 * Percentage-point change between two published one-decimal shares, computed on tenths so the result is exactly what
 * the two displayed numbers imply (7.0 -> 7.3 is 0.3, never 0.29999999999999982).
 */
export function percentagePointChange(before: number, after: number): number {
  return (Math.round(after * 10) - Math.round(before * 10)) / 10;
}

/** One place across two editions. A rank is null when the place is not in that edition's list; then rankChange is null too. */
export type DestinationComparison = {
  id: string; name: string; address: string; category: string; resource: VisitorProfileResource | null;
  beforeRank: number | null; afterRank: number | null;
  /** beforeRank - afterRank: positive moved up, negative moved down, 0 same. */
  rankChange: number | null;
};

/**
 * Union of two rank lists joined by exact place ID only (never by name). Latest-edition places come first in their
 * source order, then places only in the older list in theirs. Name, address, category and resource come from the latest
 * edition the place appears in; a missing rank stays null rather than becoming a change.
 */
export function compareDestinations(beforeItems: VisitorProfileDestination[], afterItems: VisitorProfileDestination[]): DestinationComparison[] {
  const before = new Map(beforeItems.map(i => [i.id, i.rank])), after = new Set(afterItems.map(i => i.id));
  const row = (latest: VisitorProfileDestination, beforeRank: number | null, afterRank: number | null): DestinationComparison => ({
    id: latest.id, name: latest.name, address: latest.address, category: latest.category,
    resource: latest.resource && { id: latest.resource.id, kind: latest.resource.kind, title: latest.resource.title },
    beforeRank, afterRank, rankChange: beforeRank !== null && afterRank !== null ? beforeRank - afterRank : null,
  });
  return [...afterItems.map(i => row(i, before.get(i.id) ?? null, i.rank)), ...beforeItems.filter(i => !after.has(i.id)).map(i => row(i, i.rank, null))];
}
