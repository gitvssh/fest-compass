import type { Metadata } from "next";
import { FestivalPeriodTrend } from "@/components/FestivalPeriodTrend";
import { festivalBundle, festivalSummaries, festivalTrend } from "@/lib/datalab/festival-bundles";
import { axisYears, parseMetric } from "@/lib/datalab/model";
import { defaultRegionProfiles } from "@/lib/datalab/region-profiles";
import { canonicalUrl } from "@/lib/site";

export const metadata: Metadata = { title: "축제별 방문 자료", description: "문화관광축제의 개최연도별 방문, 축제 기간과 평소의 차이, 방문객 성·연령, 목적지 검색순위를 한국관광 데이터랩 원문과 함께 봅니다.", alternates: { canonical: canonicalUrl("/compare/annual") } };
// The picker gets every festival's name and place; only the requested festival's values are sent with the page.
const data = {
  festivals: festivalSummaries, axisYears: axisYears(festivalTrend.festivals), rawHeader: festivalTrend.rawHeader, scope: festivalTrend.scope,
  source: { title: festivalTrend.source.title, officialUrl: festivalTrend.source.officialUrl }, regionOfficialUrl: defaultRegionProfiles?.officialUrl ?? null,
};

export default async function AnnualTrendPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams, requested = typeof params.festival === "string" ? params.festival : null;
  const initial = requested ? festivalBundle(requested) : null;
  return <FestivalPeriodTrend data={data} initial={initial} initialMetric={parseMetric(params.metric)} missingRequest={requested !== null && initial === null} />;
}
