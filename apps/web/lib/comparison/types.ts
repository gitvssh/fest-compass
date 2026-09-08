export type Source = { title: string; url: string; checkedAt: string; publishedAt: string | null; sha256: string | null; note: string };
export type VisitSeries = { metric: string; unit: string; method: string; regionCode: string; source: Source; snapshotId: string; collectedAt: string; points: { date: string; value: number | null }[] };
export type Cost = { id: string; label: string; amount: number; unit: "KRW"; year: number; stage: string; scopeId: string; scope: string; department: string; vat: "포함" | "별도" | "미확인"; source: Source; parts: { label: string; amount: number }[] | null; complete: boolean };
export type Edition = {
  id: string; festivalId: string; name: string; year: number; region: { province: string; district: string; name: string };
  origin: "archive" | "current"; start: string | null; end: string | null; status: string; statusNote: string;
  themes: string[]; address: string; source: Source; visits: VisitSeries | null; costs: Cost[];
  missing: string[]; statusSource?: Source; discoveredWith?: SearchContext;
};
export type SearchContext = { mode: "archive" | "current"; regions: string[]; start: string; end: string; keyword: string; theme: string; dateRule: "overlap" | "starts-within"; queriedAt: string | null };
export type Selection = { kind: "overview" } | { kind: "visits"; from: number; to: number } | { kind: "cost"; editionId: string; costId: string };
export type ComparisonEvidence = { version: 1; id: string; savedAt: string; title: string; context: SearchContext; editions: Edition[]; selection: Selection; note: string };
