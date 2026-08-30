import type { MetadataRoute } from "next";
import { isPublicReadonly } from "@/lib/app-mode";
import { canonicalUrl } from "@/lib/site";

export const dynamic = "force-dynamic";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: isPublicReadonly()
      ? { userAgent: "*", allow: "/", disallow: ["/health/", "/logs", "/festivals/new"] }
      : { userAgent: "*", disallow: "/" },
    sitemap: canonicalUrl("/sitemap.xml"),
  };
}
