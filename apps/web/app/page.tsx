import type { Metadata } from "next";
import Link from "next/link";
import { EditorOnly } from "@/components/EditorOnly";
import { listFestivals } from "@/lib/queries";
import { canonicalUrl } from "@/lib/site";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  alternates: { canonical: canonicalUrl("/") },
};

export default async function HomePage() {
  const festivals = await listFestivals();
  const festivalNames = new Map(festivals.map((festival) => [festival.id, festival.name]));
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: siteConfig.name,
    description: siteConfig.description,
    url: canonicalUrl("/"),
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    inLanguage: "ko-KR",
    isAccessibleForFree: true,
  };

  return (
    <div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replaceAll("<", "\\u003c") }}
      />
      <div className="mb-8 flex items-end justify-between gap-4">
        <div>
          <p className="mb-2 text-xs font-extrabold uppercase tracking-[0.16em] text-blue">축제 의사결정 지원</p>
          <h1 className="text-4xl font-extrabold tracking-tight">올해의 축제가 내년의 나침반이 됩니다.</h1>
          <p className="mt-3 max-w-2xl text-muted">
            흥행 숫자를 맞히는 서비스가 아닙니다. 근거, 가정, 운영 대안, 승인, 실제 결과를 한 기록으로 남깁니다.
          </p>
        </div>
        <EditorOnly>
          <Link href="/festivals/new" className="rounded-full bg-navy px-5 py-3 text-sm font-bold text-white">
            새 축제
          </Link>
        </EditorOnly>
      </div>

      <div className="grid gap-4">
        {festivals.map((festival) => (
          <Link
            key={festival.id}
            href={`/festivals/${festival.id}/evidence`}
            className="rounded-3xl bg-white p-6 shadow-card transition hover:-translate-y-0.5"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="mb-2 flex flex-wrap gap-2">
                  {festival.isExample ? (
                    <span className="rounded-full bg-blue-soft px-2.5 py-0.5 text-[11px] font-extrabold text-blue">
                      예시 시나리오
                    </span>
                  ) : null}
                  {festival.isDemo ? (
                    <span className="rounded-full bg-teal-soft px-2.5 py-0.5 text-[11px] font-extrabold text-teal">
                      90초 데모
                    </span>
                  ) : null}
                  <span className="rounded-full bg-coral-soft px-2.5 py-0.5 text-[11px] font-extrabold text-coral">
                    {labelBadge(festival.labelLevel)}
                  </span>
                </div>
                <h2 className="text-2xl font-extrabold">{festival.name}</h2>
                <p className="mt-1 text-sm text-muted">
                  {festival.organization ?? "운영조직 없음"} · {festival.startDate ?? "일정 없음"}
                </p>
                {festival.clonedFromId ? (
                  <p className="mt-1 text-xs font-bold text-blue">
                    {festivalNames.get(festival.clonedFromId) ?? "이전 행사"}에서 복제
                  </p>
                ) : null}
              </div>
              <p className="text-sm text-muted">
                {festival.decisions[0] ? `최근 결정: ${festival.decisions[0].changeSummary}` : "아직 선택된 운영안 없음"}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function labelBadge(level: string) {
  if (level === "L2") return "L2 시간·구역 실측";
  if (level === "L1") return "L1 총계 실측";
  return "L0 가정 모드";
}
