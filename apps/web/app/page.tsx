import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { AnalyticsView } from "@/components/AnalyticsView";
import { EditorOnly } from "@/components/EditorOnly";
import { isPublicReadonly } from "@/lib/app-mode";
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
    <div className="mx-auto max-w-[1440px]">
      <AnalyticsView
        event="festival_list_view"
        properties={{ app_mode: isPublicReadonly() ? "public-readonly" : "editor" }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replaceAll("<", "\\u003c") }}
      />
      <section aria-labelledby="purpose-heading" className="mb-10">
        <p className="mb-2 text-sm font-bold text-muted">관광자료로 준비하는 다음 축제</p>
        <h1 id="purpose-heading" className="text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">어떤 축제를 준비하시나요?</h1>
        <ul className="mt-7 grid gap-6 md:grid-cols-2">
          <li className="flex min-w-0 flex-col rounded-2xl border border-ink/10 bg-white p-5 lg:p-7">
            <Image
              src="/images/purpose/existing-festival-v2.png"
              alt=""
              width={1536}
              height={1024}
              quality={75}
              sizes="(min-width: 1504px) 652px, (min-width: 1024px) calc((100vw - 144px) / 2), (min-width: 768px) calc((100vw - 148px) / 2), calc(100vw - 82px)"
              className="mb-6 h-48 w-full rounded-xl object-contain sm:h-60 lg:h-[300px]"
            />
            <h2 className="text-2xl font-extrabold">기존 축제 개선</h2>
            <p className="mb-6 mt-2 text-base leading-7 text-muted">지난 개최 때의 지역 방문과 주변 관광자원을 살펴보고, 다음 개최 시기를 비교합니다.</p>
            <Link href="/existing/search" className="region-button mt-auto min-h-11 self-start border-blue bg-blue px-5 text-white hover:border-[#164ea1] hover:bg-[#164ea1]">기존 축제 찾기 →</Link>
          </li>
          <li className="flex min-w-0 flex-col rounded-2xl border border-ink/10 bg-white p-5 lg:p-7">
            <Image
              src="/images/purpose/new-festival-v2.png"
              alt=""
              width={1536}
              height={1024}
              quality={75}
              sizes="(min-width: 1504px) 652px, (min-width: 1024px) calc((100vw - 144px) / 2), (min-width: 768px) calc((100vw - 148px) / 2), calc(100vw - 82px)"
              className="mb-6 h-48 w-full rounded-xl object-contain sm:h-60 lg:h-[300px]"
            />
            <h2 className="text-2xl font-extrabold">새 축제 기획</h2>
            <p className="mb-6 mt-2 text-base leading-7 text-muted">지역의 관광자원과 방문 추세를 탐색하고, 새로운 축제의 장소와 시기를 검토합니다.</p>
            <Link href="/new" className="region-button mt-auto min-h-11 self-start border-blue bg-blue px-5 text-white hover:border-[#164ea1] hover:bg-[#164ea1]">지역부터 살펴보기 →</Link>
          </li>
        </ul>
      </section>

      <section aria-label="조사와 기획 도구" className="mb-10 grid divide-y divide-ink/10 border-y border-ink/10 lg:grid-cols-3 lg:divide-x lg:divide-y-0">
        <div className="py-6 lg:pr-7">
          <h2 className="text-lg font-extrabold">자료 조사·비교</h2>
          <p className="mt-2 text-sm leading-6 text-muted">지역과 축제를 넓혀 살펴보고, 필요한 자료를 비교합니다.</p>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1">
            <Link href="/regions" className="inline-flex min-h-11 items-center text-sm font-bold hover:underline">관광지도 →</Link>
            <Link href="/compare" className="inline-flex min-h-11 items-center text-sm font-bold hover:underline">축제 비교 →</Link>
          </div>
        </div>
        <div className="py-6 lg:px-7">
          <h2 className="text-lg font-extrabold">기획 자료 정리</h2>
          <p className="mt-2 text-sm leading-6 text-muted">담아 둔 근거를 연결하고, 장소·시기·아이템 후보를 정리합니다.</p>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1">
            <Link href="/evidence" className="inline-flex min-h-11 items-center text-sm font-bold hover:underline">담은 근거 →</Link>
            <Link href="/planning/options" className="inline-flex min-h-11 items-center text-sm font-bold hover:underline">기획 후보 →</Link>
          </div>
        </div>
        <div className="py-6 lg:pl-7">
          <h2 className="text-lg font-extrabold">내 작업공간</h2>
          <p className="mt-2 text-sm leading-6 text-muted">운영안과 현장 기록, 실제 결과를 정리합니다.</p>
          <Link href="/workspace" className="mt-3 inline-flex min-h-11 items-center text-sm font-bold hover:underline">내 축제 작업 시작 →</Link>
          <p className="mt-1 text-sm text-muted">입력은 이 브라우저에 저장됩니다.</p>
          <EditorOnly><Link href="/festivals/new" className="mt-2 inline-flex min-h-11 items-center text-sm font-bold hover:underline">새 축제 기록 만들기 →</Link></EditorOnly>
        </div>
      </section>

      <details className="rounded-2xl border border-ink/10 bg-white px-5 sm:px-6">
        <summary className="min-h-14 cursor-pointer py-4 text-base font-bold">참고 자료</summary>
        <div className="border-t border-ink/10 py-6">
          <h2 className="mb-4 text-xl font-extrabold">실제 자료와 예측 살펴보기</h2>
          <div className="mb-8 grid gap-4 lg:grid-cols-2">
            <Link href="/forecast" className="block rounded-xl border border-ink/10 p-5 hover:bg-paper">
              <p className="text-sm text-muted">실제 자료로 학습한 예측 실험</p>
              <h3 className="mt-2 text-lg font-bold">논산딸기축제 방문 추세 비교 →</h3>
              <p className="mt-2 text-sm leading-6 text-muted">3년의 지역 방문 이력으로 만든 모델과 단순 기준의 오차를 확인하세요. 2025년 사례이며 운영 적용은 검증이 필요합니다.</p>
            </Link>
            <Link href="/forecast/records" className="block rounded-xl border border-ink/10 p-5 hover:bg-paper">
              <p className="text-sm text-muted">발행 당시 입력과 모델 보존</p>
              <h3 className="mt-2 text-lg font-bold">논산 수집 자료와 사전 예측 기록 →</h3>
              <p className="mt-2 text-sm leading-6 text-muted">수집 상태와 자료의 기준일·누락을 확인하고, 일반 날짜의 사전 예측을 이후 관측과 비교하세요.</p>
            </Link>
          </div>
          <h2 className="mb-2 text-xl font-extrabold">공개 운영 기록 예시</h2>
          <p className="mb-4 text-sm text-muted">근거·결정·결과가 연결된 기존 기록을 살펴보세요.</p>
          <div className="grid gap-3">
        {festivals.map((festival) => (
          <Link
            key={festival.id}
            href={`/festivals/${festival.id}/evidence`}
            className="rounded-xl border border-ink/10 p-5 hover:bg-paper"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="mb-2 flex flex-wrap gap-2">
                  {festival.isExample ? (
                    <span className="rounded-full bg-blue-soft px-2.5 py-0.5 text-sm font-bold text-[#164ea1]">
                      예시 시나리오
                    </span>
                  ) : null}
                  {festival.isDemo ? (
                    <span className="rounded-full bg-paper px-2.5 py-0.5 text-sm font-bold text-ink">
                      90초 데모
                    </span>
                  ) : null}
                  <span className="rounded-full bg-paper px-2.5 py-0.5 text-sm font-bold text-ink">
                    {labelBadge(festival.labelLevel)}
                  </span>
                </div>
                <h3 className="text-xl font-extrabold">{festival.name}</h3>
                <p className="mt-1 text-sm text-muted">
                  {festival.organization ?? "운영조직 없음"} · {festival.startDate ?? "일정 없음"}
                </p>
                {festival.clonedFromId ? (
                  <p className="mt-1 text-sm text-muted">
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
            {festivals.length === 0 ? <p className="py-3 text-sm text-muted">아직 공개된 운영 기록이 없습니다.</p> : null}
          </div>
        </div>
      </details>
    </div>
  );
}

function labelBadge(level: string) {
  if (level === "L2") return "L2 시간·구역 실측";
  if (level === "L1") return "L1 총계 실측";
  return "L0 가정 모드";
}
