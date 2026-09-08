import type { Metadata } from "next";
import { RegionEvidence } from "@/components/RegionEvidence";
import { ComparisonEvidence } from "@/components/ComparisonEvidence";
export const metadata: Metadata = { title: "담은 기획 근거", robots: { index: false, follow: false } };
export default function EvidencePage() { return <><RegionEvidence /><ComparisonEvidence /></>; }
