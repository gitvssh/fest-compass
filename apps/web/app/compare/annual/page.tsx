import type { Metadata } from "next";
import { FestivalPeriodTrend } from "@/components/FestivalPeriodTrend";
import raw from "@/data/datalab-festival-trend.json";
import { defaultFestivalProfiles } from "@/lib/datalab/festival-profiles";
import { parseFestivalPeriodDataset, parseMetric } from "@/lib/datalab/model";
import { defaultRegionProfiles } from "@/lib/datalab/region-profiles";
import { canonicalUrl } from "@/lib/site";

export const metadata: Metadata = { title: "축제별 방문 자료", description: "문화관광축제의 개최연도별 방문, 축제 기간과 평소의 차이, 방문객 성·연령, 목적지 검색순위를 한국관광 데이터랩 원문과 함께 봅니다.", alternates: { canonical: canonicalUrl("/compare/annual") } };
const dataset = parseFestivalPeriodDataset(raw);

export default async function AnnualTrendPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams, requested = typeof params.festival === "string" ? params.festival : null;
  const initialId = requested && dataset.festivals.some(f => f.id === requested) ? requested : null;
  return <FestivalPeriodTrend dataset={dataset} profiles={defaultFestivalProfiles} regions={defaultRegionProfiles} initialId={initialId} initialMetric={parseMetric(params.metric)} missingRequest={requested !== null && initialId === null} />;
}
