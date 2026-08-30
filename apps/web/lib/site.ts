import "server-only";
import type { Metadata } from "next";
import { isPublicReadonly } from "@/lib/app-mode";

const LOCAL_URL = "http://localhost:3000";
const PRODUCTION_URL = "https://kto.damecasol.com";

export const siteConfig = {
  name: "FEST Compass",
  description: "공공 관광데이터 기반 축제 의사결정 지원 서비스",
  url: resolveSiteUrl(process.env.SITE_URL, process.env.NODE_ENV),
} as const;

export type FestivalTab = "evidence" | "scenarios" | "ledger" | "report";

export function canonicalUrl(pathname: string): string {
  return new URL(pathname, siteConfig.url).toString();
}

export function festivalPageMetadata(id: string, tab: FestivalTab): Metadata {
  return {
    alternates: { canonical: canonicalUrl(`/festivals/${encodeURIComponent(id)}/${tab}`) },
  };
}

export function siteRobots(): Metadata["robots"] {
  return isPublicReadonly()
    ? { index: true, follow: true }
    : { index: false, follow: false, noarchive: true, nocache: true };
}

export function resolveSiteUrl(value?: string, nodeEnv = process.env.NODE_ENV): URL {
  const fallback = nodeEnv === "production" ? PRODUCTION_URL : LOCAL_URL;
  try {
    const url = new URL(value?.trim() || fallback);
    if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("unsupported protocol");
    url.pathname = "/";
    url.search = "";
    url.hash = "";
    return url;
  } catch {
    return new URL(fallback);
  }
}
