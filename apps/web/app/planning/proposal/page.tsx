import type { Metadata } from "next";
import { PlanningWorkspace } from "@/components/PlanningWorkspace";
import { canonicalUrl } from "@/lib/site";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "축제 기획안 보관·출력", description: "후보·근거·예산·준비 기록을 같은 기획안 버전으로 보관하고 사업설명 자료와 준비 목록을 출력합니다.", alternates: { canonical: canonicalUrl("/planning/proposal") } };
export default function ProposalPage() {
  const year = Number(new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul", year: "numeric" }));
  return <PlanningWorkspace year={year} initialEvidence="" initialTab="proposal" />;
}
