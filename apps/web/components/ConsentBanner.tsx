"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  CONSENT_BANNER_ATTRIBUTE,
  getConsentApi,
  OPEN_CONSENT_EVENT,
  setConsentTakeover,
  submitConsentChoice,
  watchDefaultModal,
  whenConsentApiReady,
} from "@/lib/analytics/consent";
import { PRIVACY_LINK } from "@/lib/nav";

type ConsentView = "hidden" | "choose" | "unavailable";

const noop = () => undefined;

/**
 * Site-owned analytics consent banner. Zaraz keeps the consent record; this component asks an
 * undecided visitor in the product's own words instead of the zone's default modal, relays
 * allow/deny as a whole, and reopens from "분석 동의 다시 보기" so the choice can be changed later.
 * A small fixed card at the bottom: no overlay, no blur, no focus trap, no layout shift.
 */
export function ConsentBanner() {
  const [view, setView] = useState<ConsentView>("hidden");
  const regionRef = useRef<HTMLElement>(null);
  const stopWatchRef = useRef<() => void>(noop);
  const focusOnOpenRef = useRef(false);

  useEffect(() => {
    const cancelReadyWait = whenConsentApiReady((api) => {
      stopWatchRef.current = watchDefaultModal(api, () => setView("choose"));
    });
    const onOpenRequest = () => {
      focusOnOpenRef.current = true;
      setView(getConsentApi() ? "choose" : "unavailable");
    };
    window.addEventListener(OPEN_CONSENT_EVENT, onOpenRequest);
    return () => {
      cancelReadyWait();
      stopWatchRef.current();
      window.removeEventListener(OPEN_CONSENT_EVENT, onOpenRequest);
    };
  }, []);

  // Only a reopen from a link moves focus; the first-visit banner must not interrupt.
  useEffect(() => {
    if (view === "hidden" || !focusOnOpenRef.current) return;
    focusOnOpenRef.current = false;
    regionRef.current?.focus();
  }, [view]);

  if (view === "hidden") return null;

  const close = () => {
    stopWatchRef.current();
    stopWatchRef.current = noop;
    setView("hidden");
    setConsentTakeover(false);
  };

  const choose = (allow: boolean) => {
    // The banner closes first so an error while relaying cannot leave it on screen.
    close();
    const api = getConsentApi();
    if (!api) return;
    try {
      submitConsentChoice(api, allow);
    } catch {
      // Consent plumbing must never break the page; Zaraz asks again on the next visit.
    }
  };

  const choosing = view === "choose";

  return (
    <section
      ref={regionRef}
      {...{ [CONSENT_BANNER_ATTRIBUTE]: "" }}
      tabIndex={-1}
      aria-labelledby="consent-banner-title"
      aria-describedby="consent-banner-text"
      className="no-print fixed inset-x-3 bottom-3 z-40 grid gap-3 rounded-2xl border border-ink/10 bg-white p-4 shadow-card motion-safe:animate-[intro-offer_300ms_ease-out] sm:bottom-6 sm:left-6 sm:right-auto sm:w-[min(36rem,calc(100vw-3rem))] sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-x-5 sm:p-5"
    >
      <div className="min-w-0">
        <h2 id="consent-banner-title" className="text-base font-extrabold">
          {choosing ? "방문 분석을 허용하시겠어요?" : "방문 분석 동의"}
        </h2>
        {choosing ? (
          <p id="consent-banner-text" className="mt-1 text-sm leading-6 text-muted">
            어떤 화면을 열어 봤는지에 대한 이용 통계만 모읍니다. 축제 이름·입력 내용은 보내지 않고, 거부해도 모든 기능을 똑같이 쓸 수 있습니다.{" "}
            <Link href={PRIVACY_LINK.href} className="font-bold text-blue underline underline-offset-2">개인정보·분석 안내</Link>
          </p>
        ) : (
          <p id="consent-banner-text" className="mt-1 text-sm leading-6 text-muted">
            이 주소에서는 방문 분석을 쓰지 않아 고를 것이 없습니다.
          </p>
        )}
      </div>
      <div className="flex gap-2 sm:shrink-0">
        {choosing ? (
          <>
            <button type="button" onClick={() => choose(false)} className="region-button min-h-11 flex-1 px-4 sm:flex-none">거부</button>
            <button type="button" onClick={() => choose(true)} className="region-primary min-h-11 flex-1 px-4 sm:flex-none">허용</button>
          </>
        ) : (
          <button type="button" onClick={close} className="region-button min-h-11 flex-1 px-4 sm:flex-none">닫기</button>
        )}
      </div>
    </section>
  );
}
