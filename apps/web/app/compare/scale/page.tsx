import type { Metadata } from "next";
import { FestivalScale } from "@/components/FestivalScale";
import raw from "@/data/datalab-festival-trend.json";
import { parseFestivalPeriodDataset } from "@/lib/datalab/model";
import { scaleParams } from "@/lib/datalab/scale";
import { canonicalUrl } from "@/lib/site";

export const metadata: Metadata = { title: "문화관광축제 방문 규모", description: "문화관광축제의 개최기간 방문자 규모와 현지인·외지인 구성을 한국관광 데이터랩 자료로 비교합니다.", alternates: { canonical: canonicalUrl("/compare/scale") } };
const dataset = parseFestivalPeriodDataset(raw);

export default async function FestivalScalePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams, { year, sort } = scaleParams(dataset, params.year, params.sort);
  return <FestivalScale key={`${year}:${sort}`} dataset={dataset} initialYear={year} initialSort={sort} />;
}
