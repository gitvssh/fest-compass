import type { Metadata } from "next";
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
    <div>
      <AnalyticsView
        event="festival_list_view"
        properties={{ app_mode: isPublicReadonly() ? "public-readonly" : "editor" }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replaceAll("<", "\\u003c") }}
      />
      <div className="mb-8 flex items-end justify-between gap-4">
        <div>
          <p className="mb-2 text-xs font-extrabold uppercase tracking-[0.16em] text-blue">축제 의사결정 지원</p>
          <h1 className="text-3xl font-extrabold leading-tight tracking-tight sm:text-5xl">축제 준비부터 결과 보고까지,<br className="hidden sm:block" /> 한곳에서 이어가세요.</h1>
          <p className="mt-3 max-w-2xl text-muted">
            과거 자료와 방문 추세 예측을 살펴보고, 근거, 가정, 운영 대안, 승인, 실제 결과를 한 기록으로 남깁니다.
          </p>
        </div>
        <EditorOnly>
          <Link href="/festivals/new" className="rounded-full bg-navy px-5 py-3 text-sm font-bold text-white">
            새 축제
          </Link>
        </EditorOnly>
      </div>

      <section className="mb-8 rounded-3xl border border-blue/20 bg-blue-soft p-6 sm:p-8">
        <p className="text-xs font-extrabold text-blue">공공데이터에서 시작하는 축제 기획</p>
        <h2 className="mt-3 text-2xl font-extrabold">전국에서 우리 지역으로, 기획 근거를 찾아보세요.</h2>
        <p className="mt-3 text-sm leading-7 text-muted">시도 → 시군구를 선택해 관광자원·등록 행사와 방문 추세를 조회하고, 출처와 함께 필요한 자료를 담으세요.</p>
        <Link href="/regions" className="region-primary mt-5">전국 관광지도 열기 →</Link>
        <Link href="/compare" className="region-button ml-2 mt-3">주변·과거 축제 비교 →</Link>
      </section>
      <section className="mb-8 rounded-3xl bg-navy p-6 text-white sm:p-8">
        <p className="text-xs font-bold text-white/70">직접 써보는 축제 작업공간</p>
        <h2 className="mt-3 text-2xl font-extrabold">우리 축제의 운영안을 만들어 볼까요?</h2>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-white/80">논산딸기축제 자료를 참고하거나 내 축제를 입력해 시작하세요. 운영안 선택, 현장 대응, 실제 결과와 다음 회차 준비까지 기록할 수 있습니다.</p>
        <Link href="/workspace" className="mt-5 inline-block rounded-xl bg-white px-5 py-3 text-sm font-extrabold text-navy">내 축제 작업 시작 →</Link>
        <p className="mt-3 text-xs text-white/70">입력은 이 브라우저에 저장됩니다. 파일 보관·인쇄 가능 · 공동 편집은 개발 예정</p>
        <ol className="mt-6 grid grid-cols-2 gap-3 border-t border-white/20 pt-5 text-sm sm:grid-cols-5">{["자료·준비", "운영안 비교", "결정·현장 기록", "결과 비교", "보고·다음 회차"].map((step, i) => <li key={step}><span className="mr-2 text-white/50">0{i + 1}</span>{step}</li>)}</ol>
      </section>

      <h2 className="mb-4 text-xl font-extrabold">실제 자료와 예측 살펴보기</h2>

      <Link href="/forecast" className="mb-6 block rounded-3xl border border-blue/20 bg-blue-soft p-6">
        <p className="text-xs font-extrabold text-blue">실제 자료로 학습한 예측 실험</p>
        <h2 className="mt-2 text-xl font-extrabold">논산딸기축제 방문 추세 비교 →</h2>
        <p className="mt-2 text-sm text-muted">3년의 지역 방문 이력으로 만든 모델과 단순 기준의 오차를 확인하세요. 2025년 사례이며 운영 적용은 검증이 필요합니다.</p>
      </Link>

      <Link href="/forecast/records" className="mb-6 block rounded-3xl border border-ink/10 bg-white p-6 shadow-card">
        <p className="text-xs font-extrabold text-blue">발행 당시 입력과 모델 보존</p>
        <h2 className="mt-2 text-xl font-extrabold">논산 수집 자료와 사전 예측 기록 →</h2>
        <p className="mt-2 text-sm text-muted">수집 상태와 자료의 기준일·누락을 확인하고, 일반 날짜의 사전 예측을 이후 관측과 비교하세요.</p>
      </Link>

      <h2 className="mb-4 text-xl font-extrabold">공개 운영 기록 예시</h2>
      <p className="mb-4 text-sm text-muted">근거·결정·결과가 연결된 기존 기록을 살펴보세요.</p>
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
