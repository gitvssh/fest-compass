import type { Metadata } from "next";
import { PersonalWorkspace } from "@/components/PersonalWorkspace";
import { loadRuntimeSummary } from "@/lib/forecast/runtime";
import { canonicalUrl } from "@/lib/site";

export const metadata: Metadata = { title: "내 축제 작업공간", description: "축제 자료 확인부터 운영안 비교, 결정과 현장 기록, 결과 보고와 다음 회차 준비까지 직접 체험하세요.", alternates: { canonical: canonicalUrl("/workspace") } };
export const dynamic = "force-dynamic";
export default async function WorkspacePage() {
  const { summary, source, workerAlive } = await loadRuntimeSummary();
  return <PersonalWorkspace evidence={{ latest: summary.monitor.coverage.latestObservation, missing: summary.monitor.coverage.missingDates.length, collected: summary.generatedAt, source, alive: workerAlive }} />;
}
