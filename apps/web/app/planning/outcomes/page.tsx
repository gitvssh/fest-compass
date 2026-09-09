import type { Metadata } from "next";
import { PlanningWorkspace } from "@/components/PlanningWorkspace";
import { canonicalUrl } from "@/lib/site";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "축제 비용·결과와 다음 회차", description: "공개 비용 사례를 조회하고 개인 행사 결과를 기획과 비교해 다음 회차 준비에 연결합니다.", alternates: { canonical: canonicalUrl("/planning/outcomes") } };
export default function OutcomesPage() { return <PlanningWorkspace year={Number(new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul", year: "numeric" }))} initialEvidence="" initialTab="outcomes" />; }
