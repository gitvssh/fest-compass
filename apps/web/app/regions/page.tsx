import type { Metadata } from "next";
import { RegionExplorer } from "@/components/RegionExplorer";
import { canonicalUrl } from "@/lib/site";
export const metadata: Metadata = { title: "전국 관광지도", description: "남한 전국에서 시도와 시군구로 좁혀 관광자원·등록 행사·방문 추세를 조회하고 축제 기획 근거를 보관합니다.", alternates: { canonical: canonicalUrl("/regions") } };
export const dynamic = "force-dynamic";
export default function RegionsPage() { return <RegionExplorer year={Number(new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul", year: "numeric" }))} />; }
