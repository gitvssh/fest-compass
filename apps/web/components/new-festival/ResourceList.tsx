"use client";
import type { RefObject } from "react";
import { ResourceRows, type NumberedRow } from "@/components/resources/ResourceWorkspace";
import type { ResourceItem } from "@/lib/existing/types";

export type { NumberedRow };
export { AnchorControls } from "@/components/resources/ResourceWorkspace";

/** Name-ordered list (distance order only after an explicit anchor). Items without coordinates stay listed. */
export function ResourceList({ rows, listRef, detailId, comparedIds, anchored, onOpen, onCompare }: {
  rows: NumberedRow[]; listRef: RefObject<HTMLUListElement | null>; detailId: string | null; comparedIds: Set<string>; anchored: boolean;
  onOpen: (item: ResourceItem) => void; onCompare: (item: ResourceItem) => void;
}) {
  return <ResourceRows rows={rows} listRef={listRef} openId={detailId} anchored={anchored} onOpen={onOpen} compare={{ ids: comparedIds, onToggle: onCompare }} />;
}
