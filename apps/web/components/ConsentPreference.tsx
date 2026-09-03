"use client";

import { useEffect, useState } from "react";
import { canManageConsent, openConsentSettings } from "@/lib/analytics/consent";

/**
 * Reopens the tag manager's consent modal. Rendering waits for hydration
 * because the button is useless before the tag manager has loaded, and a
 * visitor who refused analytics never loads it at all — showing a dead control
 * to exactly the people who opted out would be worse than showing nothing.
 */
export function ConsentPreference() {
  const [available, setAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    setAvailable(canManageConsent());
  }, []);

  if (available === null) {
    return null;
  }

  return (
    <div className="mt-3 rounded-2xl bg-paper p-4">
      {available ? (
        <button
          type="button"
          onClick={openConsentSettings}
          className="rounded-full bg-navy px-4 py-2 text-sm font-bold text-white"
        >
          분석 동의 설정 열기
        </button>
      ) : (
        <p className="text-sm text-muted">
          분석 동의 창을 열 수 없습니다. 분석을 거부하셨거나 브라우저가 태그 관리자를 차단한 상태이며,
          어느 쪽이든 <strong className="font-bold text-ink">아무것도 전송되지 않습니다</strong>.
        </p>
      )}
    </div>
  );
}
