import type { MetadataRoute } from "next";
import { isPublicReadonly } from "@/lib/app-mode";
import { prisma } from "@/lib/db";
import { canonicalUrl } from "@/lib/site";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const fixed: MetadataRoute.Sitemap = [
    {
      url: canonicalUrl("/"),
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: canonicalUrl("/privacy"),
      changeFrequency: "monthly",
      priority: 0.3,
    },
  ];
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
