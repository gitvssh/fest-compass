import type { SourceBlock } from "@/lib/existing/types";

export type Stale = { refreshFailed?: boolean };
/**
 * Same condition, independent source: when a refresh of one source fails but an earlier answer of the same
 * condition succeeded, keep that earlier block and mark it so the area shows the update failure and a retry.
 */
export function keepBlock<B extends SourceBlock>(previous: B | undefined, next: B): B & Stale {
  if (next.status === "unavailable" && previous && (previous.status === "complete" || previous.status === "empty")) return { ...previous, refreshFailed: true };
  return next;
}
export const isStale = (block: object) => (block as Stale).refreshFailed === true;
