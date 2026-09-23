import type { Metadata } from "next";
import { durableParams } from "@/components/new-festival/durable";
import { NewStart } from "@/components/new-festival/NewStart";
import { canonicalUrl } from "@/lib/site";
import { toParams, type SearchParams } from "./params";

export const metadata: Metadata = {
  title: "새 축제 기획 · 지역 고르기",
  description: "시군구를 골라 지역의 관광자원, 지난 방문 흐름, 개최 시기 달력을 살펴봅니다.",
  alternates: { canonical: canonicalUrl("/new") },
};
export const dynamic = "force-dynamic";

export default async function NewFestivalStartPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  return <NewStart carried={durableParams(toParams(await searchParams)).toString()} />;
}
