export type Region = { provinceCode: string; provinceName: string; districtCode: string; districtName: string };
export type Query = { province: string; district: string; start: string; end: string; kind: "12" | "14" | "15" };
export type Resource = { id: string; title: string; address: string; longitude: number | null; latitude: number | null; start: string | null; end: string | null; modifiedAt: string | null };
export type ResourceResult = { status: "complete" | "empty" | "unavailable"; message: string; items: Resource[]; total: number | null; pages: number; collectedAt: string; source: string };
export type Observation = { date: string; value: number | null; quality: string; snapshotId: string | null; collectedAt: string | null };
export type History = { status: "available" | "unavailable"; message: string; source: string; unit: string; metric: string; points: Observation[] };
export type RegionResult = { query: Query; region: Region; resources: ResourceResult; history: History };
export type Evidence = { version: 1; id: string; savedAt: string; title: string; result: RegionResult; selection: { resourceId: string; mapBounds?: [number, number, number, number]; boundary?: import("./boundaries").BoundaryReference } | { dates: string[] }; note: string };
