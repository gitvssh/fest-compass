"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { tab } from "./memory";
import { RegionPicker } from "./RegionPicker";

/** First step of the new-festival journey: only a 시도·시군구 choice; no name, theme, audience, login or saving. */
export function NewStart({ carried }: { carried: string }) {
  const router = useRouter(), heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { if (tab.focusTitle) { tab.focusTitle = false; heading.current?.focus(); } }, []);
  function pick(code: string) {
    tab.focusTitle = true;
    router.push(`/new/${encodeURIComponent(code)}/resources${carried ? `?${carried}` : ""}`);
  }
  return <section aria-labelledby="new-start-heading" className="space-y-4">
    <Link href="/" className="inline-flex text-sm font-bold text-blue underline underline-offset-4">← 처음으로</Link>
    <div className="space-y-1">
      <p className="text-sm font-bold text-muted">새 축제 기획</p>
      <h1 id="new-start-heading" ref={heading} tabIndex={-1} className="text-2xl font-extrabold leading-tight sm:text-3xl">어느 지역의 축제를 구상하시나요?</h1>
      <p className="text-sm text-muted">시군구를 고르면 그 지역의 관광자원부터 방문 흐름, 개최 시기 달력까지 살펴볼 수 있어요.</p>
    </div>
    <div className="region-card">
      <RegionPicker submitLabel="지역 살펴보기" onPick={pick} />
    </div>
  </section>;
}
