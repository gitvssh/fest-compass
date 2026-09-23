import type { Metadata } from "next";
import { FestivalPeriodTrend } from "@/components/FestivalPeriodTrend";
import raw from "@/data/datalab-festival-trend.json";
import { parseFestivalPeriodDataset, parseMetric } from "@/lib/datalab/model";
import { canonicalUrl } from "@/lib/site";

export const metadata: Metadata = { title: "개최연도별 방문 흐름", description: "문화관광축제의 개최연도별 개최기간 방문자 수를 한국관광 데이터랩 원문과 함께 봅니다.", alternates: { canonical: canonicalUrl("/compare/annual") } };
const dataset = parseFestivalPeriodDataset(raw);

export default async function AnnualTrendPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams, requested = typeof params.festival === "string" ? params.festival : null;
  const initialId = requested && dataset.festivals.some(f => f.id === requested) ? requested : null;
  return <FestivalPeriodTrend dataset={dataset} initialId={initialId} initialMetric={parseMetric(params.metric)} missingRequest={requested !== null && initialId === null} />;
}
