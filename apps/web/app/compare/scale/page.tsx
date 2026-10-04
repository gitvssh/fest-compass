import type { Metadata } from "next";
import { FestivalScale } from "@/components/FestivalScale";
import { festivalTrend } from "@/lib/datalab/festival-bundles";
import { scaleFestivals, scaleParams } from "@/lib/datalab/scale";
import { canonicalUrl } from "@/lib/site";

export const metadata: Metadata = { title: "문화관광축제 방문 규모", description: "문화관광축제의 개최기간 방문자 규모와 현지인·외지인 구성을 한국관광 데이터랩 자료로 비교합니다.", alternates: { canonical: canonicalUrl("/compare/scale") } };
// Per-year values only: the ranking needs no raw rows or source evidence.
const dataset = { title: festivalTrend.source.title, officialUrl: festivalTrend.source.officialUrl, festivals: scaleFestivals(festivalTrend.festivals) };

export default async function FestivalScalePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams, { year, sort, province } = scaleParams(dataset, params.year, params.sort, params.province);
  return <FestivalScale key={`${year}:${sort}:${province ?? ""}`} dataset={dataset} initialYear={year} initialSort={sort} initialProvince={province} />;
}
