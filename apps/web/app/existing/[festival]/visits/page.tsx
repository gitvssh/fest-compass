import type { Metadata } from "next";
import { HistoryPanel } from "@/components/existing/HistoryPanel";
import { festivalParam, festivalPath } from "@/components/existing/route-params";
import { canonicalUrl } from "@/lib/site";

export async function generateMetadata({ params }: { params: Promise<{ festival: string }> }): Promise<Metadata> {
  const id = festivalParam((await params).festival);
  return { title: "과거 방문 흐름 · 기존 축제", alternates: id ? { canonical: canonicalUrl(festivalPath(id, "visits")) } : undefined };
}

export default function ExistingVisitsPage() {
  return <HistoryPanel />;
}
