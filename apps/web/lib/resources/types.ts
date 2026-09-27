/** Public, read-only tourism media. Every photo has its own verified reuse license. */
export type ResourcePhoto = {
  url: string;
  thumbnailUrl: string | null;
  title: string;
  license: "Type1" | "Type3";
  sourceUrl: string;
};
export type ResourceFact = { label: string; value: string };
export type ResourceSectionStatus = "complete" | "empty" | "unavailable";
