import type { Metadata } from "next";
import { canonicalUrl } from "@/lib/site";
import { routeCode } from "@/components/new-festival/region-route";
import { regionParam, type RegionParams } from "../params";

const TITLES = { resources: "지역 관광자원", visits: "지역 방문 흐름", timing: "개최 시기" } as const;

export async function viewMetadata(params: RegionParams, view: keyof typeof TITLES): Promise<Metadata> {
  const region = await regionParam(params);
  if (!region) return { title: "지역을 찾지 못했어요 · 새 축제 기획", robots: { index: false } };
  return { title: `${region.name} ${TITLES[view]} · 새 축제 기획`, alternates: { canonical: canonicalUrl(`/new/${routeCode(region)}/${view}`) } };
}
