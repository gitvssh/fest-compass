"use client";

import { useEffect, useState } from "react";
import {
  readStoredConsent,
  recordConsent,
  type ConsentChoice,
} from "@/lib/analytics/consent";

const LABEL: Record<ConsentChoice, string> = {
  granted: "허용함",
  denied: "거부함",
};

/** Lets a visitor change or withdraw the decision after the banner is gone. */
export function ConsentPreference() {
  const [choice, setChoice] = useState<ConsentChoice | null | "unknown">("unknown");

  useEffect(() => {
    setChoice(readStoredConsent());
  }, []);

  if (choice === "unknown") {
    return null;
  }

  function decide(next: ConsentChoice) {
    recordConsent(next);
    setChoice(next);
  }

  return (
    <div className="mt-3 rounded-2xl bg-paper p-4">
      <p className="text-sm">
        현재 상태:{" "}
        <strong className="font-extrabold">
          {choice === null ? "아직 선택하지 않음 (분석 꺼짐)" : LABEL[choice]}
        </strong>
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => decide("granted")}
          disabled={choice === "granted"}
          className="rounded-full bg-navy px-4 py-2 text-sm font-bold text-white disabled:opacity-40"
        >
          분석 허용
        </button>
        <button
          type="button"
          onClick={() => decide("denied")}
          disabled={choice === "denied"}
          className="rounded-full bg-white px-4 py-2 text-sm font-bold text-ink shadow-card disabled:opacity-40"
        >
          거부·철회
        </button>
      </div>
    </div>
  );
}
