import type { Metadata } from "next";
import { ResourcesPanel } from "@/components/existing/ResourcesPanel";
import { festivalParam, festivalPath } from "@/components/existing/route-params";
import { canonicalUrl } from "@/lib/site";

export async function generateMetadata({ params }: { params: Promise<{ festival: string }> }): Promise<Metadata> {
  const id = festivalParam((await params).festival);
  return { title: "주변 관광자원 · 기존 축제", alternates: id ? { canonical: canonicalUrl(festivalPath(id, "resources")) } : undefined };
}

export default function ExistingResourcesPage() {
  return <ResourcesPanel />;
}
