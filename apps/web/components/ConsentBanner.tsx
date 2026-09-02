"use client";

import { useEffect, useState } from "react";
import {
  readStoredConsent,
  recordConsent,
  applyConsent,
  type ConsentChoice,
} from "@/lib/analytics/consent";

/**
 * Asks once, then stays out of the way. Nothing renders on the server and
 * nothing renders for a visitor who already answered, so the banner cannot
 * shift the first paint for returning visitors.
 *
 * A previous decision is re-applied on every load because the app, not the
 * tag manager, is the record of what the visitor chose.
 */
export function ConsentBanner() {
  const [choice, setChoice] = useState<ConsentChoice | null | "unknown">("unknown");

  useEffect(() => {
    const stored = readStoredConsent();
    setChoice(stored);
    if (stored) {
      applyConsent(stored);
    }
  }, []);

  if (choice === "unknown" || choice !== null) {
    return null;
  }

  function decide(next: ConsentChoice) {
    recordConsent(next);
    setChoice(next);
  }

  return (
    <aside
      role="region"
      aria-label="선택 분석 동의"
      className="no-print fixed inset-x-0 bottom-0 z-40 border-t border-ink/10 bg-white/95 px-5 py-4 shadow-card backdrop-blur-xl"
    >
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="text-sm">
          <p className="font-extrabold">선택적 방문 분석</p>
          <p className="mt-1 text-muted">
            동의하시면 어떤 화면이 열렸는지만 익명으로 기록합니다. 축제 이름, 식별자, 입력한 내용은
            보내지 않습니다.{" "}
            <a href="/privacy" className="font-bold text-blue underline underline-offset-2">
              수집 범위 보기
            </a>
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => decide("denied")}
            className="rounded-full bg-paper px-5 py-2.5 text-sm font-bold text-ink shadow-card"
          >
            거부
          </button>
          <button
            type="button"
            onClick={() => decide("granted")}
            className="rounded-full bg-navy px-5 py-2.5 text-sm font-bold text-white"
          >
            분석 허용
          </button>
        </div>
      </div>
    </aside>
  );
}
