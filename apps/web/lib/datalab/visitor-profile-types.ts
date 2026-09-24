// Public DataLab festival visitor profile for one reviewed edition. Pure types; safe for client imports.
// Percentages are the source's published shares of all domestic visitors; no visitor or search counts are carried.
export type VisitorProfileGroupId = "outside" | "local" | "all";
export type VisitorProfileBand = { ageBand: string; malePercent: number; femalePercent: number };
export type VisitorProfileResource = { id: string; kind: "12" | "14"; title: string };
/** Navigation-search rank in the source's display order (ties allowed); not visits or a route. */
export type VisitorProfileDestination = { id: string; rank: number; name: string; address: string; category: string; resource: VisitorProfileResource | null };
export type VisitorProfileDestinationGroup = { group: VisitorProfileGroupId; label: string; items: VisitorProfileDestination[] };
export type VisitorProfile = {
  editionId: string; year: number; start: string; end: string; areaName: string;
  demographics: VisitorProfileBand[];
  destinationGroups: VisitorProfileDestinationGroup[];
  source: { title: string; url: string; collectedAt: string };
};
