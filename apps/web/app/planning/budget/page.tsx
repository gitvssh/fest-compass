import type { Metadata } from "next";
import { PlanningWorkspace } from "@/components/PlanningWorkspace";
import { canonicalUrl } from "@/lib/site";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "축제 예산·준비 규모 비교", description: "기획 후보의 수량·기간·단가와 재원·지출을 구분하고 이전 예산·출처·준비 과제를 함께 비교합니다.", alternates: { canonical: canonicalUrl("/planning/budget") } };
export default function BudgetPage() {
  const year = Number(new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul", year: "numeric" }));
  return <PlanningWorkspace year={year} initialEvidence="" initialTab="budget" />;
}
