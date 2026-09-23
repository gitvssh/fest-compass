import type { MetadataRoute } from "next";
import { festivalPath } from "@/components/existing/route-params";
import { isPublicReadonly } from "@/lib/app-mode";
import { prisma } from "@/lib/db";
import { koreaDate } from "@/lib/region/calendar";
import { loadFestivals } from "@/lib/existing/server";
import { canonicalUrl } from "@/lib/site";

export const dynamic = "force-dynamic";

// Reviewed archive festivals only; current registrations change often and are reached through search.
async function existingFestivalPages(): Promise<MetadataRoute.Sitemap> {
  try {
    const year = koreaDate().slice(0, 4);
    const result = await loadFestivals({ q: "", province: null, district: null, start: `${year}-01-01`, end: `${year}-12-31`, page: 1, total: null, id: null });
    return result.archive.items.flatMap(festival => (["visits", "resources", "timing"] as const).map(view => ({
      url: canonicalUrl(festivalPath(festival.id, view)),
      changeFrequency: "weekly" as const,
      priority: view === "visits" ? 0.8 : 0.6,
    })));
  } catch {
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base: MetadataRoute.Sitemap = [
    { url: canonicalUrl("/existing/search"), changeFrequency: "weekly", priority: 0.9 },
    { url: canonicalUrl("/new"), changeFrequency: "weekly", priority: 0.9 },
    { url: canonicalUrl("/planning/proposal"), changeFrequency: "weekly", priority: 0.9 },
    { url: canonicalUrl("/planning/outcomes"), changeFrequency: "weekly", priority: 0.9 },
    { url: canonicalUrl("/planning/budget"), changeFrequency: "weekly", priority: 0.9 },
    { url: canonicalUrl("/planning/options"), changeFrequency: "weekly", priority: 0.9 },
    { url: canonicalUrl("/compare"), changeFrequency: "weekly", priority: 0.9 },
    { url: canonicalUrl("/compare/annual"), changeFrequency: "monthly", priority: 0.8 },
    { url: canonicalUrl("/regions"), changeFrequency: "weekly", priority: 0.9 },
    { url: canonicalUrl("/workspace"), changeFrequency: "weekly", priority: 0.9 },
    {
      url: canonicalUrl("/"),
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: canonicalUrl("/forecast"),
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: canonicalUrl("/forecast/records"),
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: canonicalUrl("/forecast/calendar"),
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: canonicalUrl("/forecast/history"),
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: canonicalUrl("/privacy"),
      changeFrequency: "monthly",
      priority: 0.3,
    },
  ];
  const fixed = [...base, ...(await existingFestivalPages())];
  if (!isPublicReadonly()) return fixed;

  try {
    const festivals = await prisma.festival.findMany({ select: { id: true, updatedAt: true } });
    return [
      ...fixed,
      ...festivals.flatMap((festival) =>
        (["evidence", "scenarios", "ledger", "report"] as const).map((tab) => ({
          url: canonicalUrl(`/festivals/${encodeURIComponent(festival.id)}/${tab}`),
          lastModified: festival.updatedAt,
          changeFrequency: "weekly" as const,
          priority: tab === "evidence" ? 0.8 : 0.6,
        })),
      ),
    ];
  } catch {
    return fixed;
  }
}
