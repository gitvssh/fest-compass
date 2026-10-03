import { BookOpen, MessageCircleQuestion, Route, Users } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import { PhaseList, PhaseRail, SourcesNote } from "@/components/guide/ProcessGuide";
import { canonicalUrl } from "@/lib/site";

export const metadata: Metadata = {
  title: "축제 준비 전체 과정",
  description: "축제를 처음 맡은 담당자를 위해 돌아보기부터 개최, 결과 정리까지 일곱 단계의 하는 일, 확인할 질문, 협의할 곳과 공식 원문을 한 화면에 모았습니다.",
  alternates: { canonical: canonicalUrl("/guide") },
};

export default function GuidePage() {
  return <div className="mx-auto max-w-[1440px] space-y-6">
    <header className="grid items-center gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,480px)]">
      <div className="space-y-3">
        <p className="inline-flex items-center gap-1.5 text-sm font-bold text-muted"><Route aria-hidden="true" size={16} className="text-blue" />처음 축제를 맡았다면</p>
        <h1 className="text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">축제 준비 전체 과정</h1>
        <p className="text-base leading-7 text-muted">돌아보기부터 다음 회차까지 일곱 단계예요. 기관마다 순서와 일정이 다르니 담당 부서와 맞춰 보세요.</p>
        <ul aria-label="카드 읽는 법" className="flex flex-wrap gap-2 pt-1 text-xs font-bold">
          <li className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 ring-1 ring-ink/10"><span aria-hidden="true" className="h-2 w-2 rounded-full bg-blue" />하는 일</li>
          <li className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 ring-1 ring-ink/10"><MessageCircleQuestion aria-hidden="true" size={14} className="text-[#147a6f]" />확인할 질문</li>
          <li className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 ring-1 ring-ink/10"><Users aria-hidden="true" size={14} className="text-muted" />협의할 곳</li>
          <li className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 ring-1 ring-ink/10"><BookOpen aria-hidden="true" size={14} className="text-muted" />원문</li>
          <li className="inline-flex items-center gap-1.5 rounded-full bg-blue-soft px-3 py-1.5 text-[#164ea1]">pickDday로 살펴볼 수 있는 단계</li>
        </ul>
      </div>
      <Image src="/images/guide/process.png" alt="" width={1536} height={1024} preload quality={75}
        sizes="(min-width: 1024px) 480px, calc(100vw - 40px)" className="h-auto w-full mix-blend-multiply" />
    </header>
    <PhaseRail />
    <PhaseList />
    <SourcesNote />
  </div>;
}
