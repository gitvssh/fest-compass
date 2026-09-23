import type { Metadata } from "next";
import { FestivalSearch } from "@/components/existing/FestivalSearch";
import { canonicalUrl } from "@/lib/site";

export const metadata: Metadata = {
  title: "기존 축제 찾기",
  description: "축제 이름이나 지역으로 기존 축제를 찾아 지난 개최 때의 지역 방문, 주변 관광자원, 다음 개최 시기를 살펴봅니다.",
  alternates: { canonical: canonicalUrl("/existing/search") },
};
export const dynamic = "force-dynamic";

export default function ExistingSearchPage() {
  return <FestivalSearch />;
}
