"use client";

import { openConsentSettings } from "@/lib/analytics/consent";

/** Reopens the site's consent banner so a visitor can change or withdraw the analytics choice. */
export function ConsentSettingsButton({ className }: { className?: string }) {
  return (
    <button type="button" className={className} onClick={openConsentSettings}>
      분석 동의 다시 보기
    </button>
  );
}
