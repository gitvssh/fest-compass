import type { Metadata } from "next";
import { SummaryView } from "@/components/new-festival/SummaryView";
import type { RegionParams } from "../../params";
import { viewMetadata } from "../view-metadata";

// A personal sheet of this tab's choices: reachable by address, never indexed.
export async function generateMetadata({ params }: { params: RegionParams }): Promise<Metadata> {
  return { ...(await viewMetadata(params, "summary")), robots: { index: false } };
}

export default function NewSummaryPage() {
  return <SummaryView />;
}
