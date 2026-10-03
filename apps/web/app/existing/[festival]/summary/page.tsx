import type { Metadata } from "next";
import { SummaryPanel } from "@/components/existing/SummaryPanel";
import { festivalParam, festivalPath } from "@/components/existing/route-params";
import { canonicalUrl } from "@/lib/site";

// A personal sheet of this tab's choices: reachable by address, never indexed.
export async function generateMetadata({ params }: { params: Promise<{ festival: string }> }): Promise<Metadata> {
  const id = festivalParam((await params).festival);
  return { title: "모아 보기 · 기존 축제", robots: { index: false }, alternates: id ? { canonical: canonicalUrl(festivalPath(id, "summary")) } : undefined };
}

export default function ExistingSummaryPage() {
  return <SummaryPanel />;
}
