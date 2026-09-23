import "server-only";
import type { Metadata } from "next";
import { isPublicReadonly } from "@/lib/app-mode";

const LOCAL_URL = "http://localhost:3000";
const PRODUCTION_URL = "https://pickday.damecasol.com";

export const siteConfig = {
  name: "pickDday",
  description: "지역 공무원이 공공데이터로 지역 관광자원과 방문 흐름을 살펴 축제를 기획·개선하도록 돕는 서비스",
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
