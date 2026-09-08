import type { Metadata } from "next";
import { PlanningWorkspace } from "@/components/PlanningWorkspace";
import { canonicalUrl } from "@/lib/site";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "올해 축제 기획 후보", description: "관광자료와 축제 비교 근거로 아이템·장소·시기 후보를 구성하고 선택 이유와 준비 과제를 기록합니다.", alternates: { canonical: canonicalUrl("/planning/options") } };
export default async function PlanningPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const year = Number(new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul", year: "numeric" }));
  const initialEvidence = typeof params.evidence === "string" && /^(region|comparison):[a-f0-9]{64}$/.test(params.evidence) ? params.evidence : "";
  return <PlanningWorkspace year={year} initialEvidence={initialEvidence} />;
}
