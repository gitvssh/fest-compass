import type { Metadata } from "next";
import { TimingPanel } from "@/components/existing/TimingPanel";
import { festivalParam, festivalPath } from "@/components/existing/route-params";
import { canonicalUrl } from "@/lib/site";

export async function generateMetadata({ params }: { params: Promise<{ festival: string }> }): Promise<Metadata> {
  const id = festivalParam((await params).festival);
  return { title: "개최 시기 · 기존 축제", alternates: id ? { canonical: canonicalUrl(festivalPath(id, "timing")) } : undefined };
}

export default function ExistingTimingPage() {
  return <TimingPanel />;
}
