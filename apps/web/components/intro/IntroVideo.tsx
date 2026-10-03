"use client";

import { Play } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { DialogHeader } from "@/components/existing/ui";
import { isConsentModalOpen } from "@/lib/analytics/consent";
import {
  INTRO_MEDIA,
  INTRO_TRANSCRIPT,
  hasHandledIntro,
  markIntroHandled,
  wantsIntroPlayback,
  withoutIntroQuery,
} from "@/lib/intro/intro";

const OFFER_QUIET_MS = 2000;
const CONSENT_POLL_MS = 500;
const CONSENT_WAIT_LIMIT_MS = 120_000;

/**
 * Home-page introduction video: a permanent entry point beside the heading,
 * a dismissible offer card for first-time visitors, and a modal player.
 * Nothing plays until the visitor asks, except through an explicit `?intro=play` link.
 */
export function IntroVideo() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [offerVisible, setOfferVisible] = useState(false);
  const [ended, setEnded] = useState(false);

  const openPlayer = useCallback((autoplay: boolean) => {
    const dialog = dialogRef.current, video = videoRef.current;
    if (!dialog || !video) return;
    markIntroHandled("played");
    setOfferVisible(false);
    setEnded(false);
    if (!dialog.open) dialog.showModal();
    if (autoplay) {
      // A shared link without a click may be refused autoplay with sound; the controls stay available.
      void video.play().catch(() => {});
    }
  }, []);

  const closePlayer = useCallback(() => {
    // Sound stops with the action itself; the close event that follows may arrive a frame later.
    videoRef.current?.pause();
    dialogRef.current?.close();
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const stop = () => videoRef.current?.pause();
    const onClose = () => {
      stop();
      triggerRef.current?.focus();
    };
    // Escape fires `cancel` at the key press; `close` is queued after it.
    dialog.addEventListener("cancel", stop);
    dialog.addEventListener("close", onClose);
    return () => {
      dialog.removeEventListener("cancel", stop);
      dialog.removeEventListener("close", onClose);
    };
  }, []);

  useEffect(() => {
    if (wantsIntroPlayback(window.location.search)) {
      window.history.replaceState(window.history.state, "", withoutIntroQuery(window.location.pathname, window.location.search, window.location.hash));
      openPlayer(true);
      return;
    }
    if (hasHandledIntro()) return;
    // The tag manager injects its consent modal a moment after load. Offer only once the
    // modal has stayed away for a while, so two overlays never compete on the first screen.
    const startedAt = Date.now();
    let clearSince = startedAt;
    const poll = window.setInterval(() => {
      const now = Date.now();
      if (isConsentModalOpen() && now - startedAt < CONSENT_WAIT_LIMIT_MS) {
        clearSince = now;
        return;
      }
      if (now - clearSince < OFFER_QUIET_MS) return;
      window.clearInterval(poll);
      if (!hasHandledIntro()) setOfferVisible(true);
    }, CONSENT_POLL_MS);
    return () => window.clearInterval(poll);
  }, [openPlayer]);

  const dismissOffer = () => {
    markIntroHandled("dismissed");
    setOfferVisible(false);
  };

  const replay = () => {
    const video = videoRef.current;
    if (!video) return;
    setEnded(false);
    video.currentTime = 0;
    void video.play().catch(() => {});
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => openPlayer(true)}
        className="group flex min-h-11 shrink-0 items-center gap-3 self-start rounded-2xl border border-ink/10 bg-white p-2 pr-4 text-left hover:border-blue/40 hover:bg-blue-soft/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue"
      >
        <span className="relative block h-[54px] w-24 shrink-0 overflow-hidden rounded-xl bg-navy">
          <img src={INTRO_MEDIA.poster} alt="" width={96} height={54} className="h-full w-full object-cover" />
          <span aria-hidden="true" className="absolute inset-0 grid place-items-center">
            <span className="grid h-7 w-7 place-items-center rounded-full bg-white/90 text-xs text-navy shadow">▶</span>
          </span>
        </span>
        <span>
          <span className="block text-sm font-extrabold text-ink">{INTRO_MEDIA.durationLabel} 소개 영상</span>
          <span className="block text-sm text-muted group-hover:text-ink">pickDday 둘러보기</span>
        </span>
      </button>

      {offerVisible ? (
        <aside
          aria-labelledby="intro-offer-title"
          className="no-print fixed inset-x-3 bottom-3 z-40 flex items-center gap-2 rounded-2xl border border-ink/10 bg-white p-2 pl-4 shadow-card motion-safe:animate-[intro-offer_300ms_ease-out] sm:inset-x-auto sm:bottom-6 sm:right-6 sm:w-[380px] sm:flex-wrap sm:gap-0 sm:p-4"
        >
          <img src={INTRO_MEDIA.poster} alt="" width={112} height={63} className="hidden h-[63px] w-28 shrink-0 rounded-lg object-cover sm:mr-4 sm:block" />
          <div className="min-w-0 flex-1">
            <h2 id="intro-offer-title" className="text-sm font-extrabold sm:text-base">pickDday가 처음이신가요?</h2>
            <p className="text-xs text-muted sm:mt-1 sm:text-sm sm:leading-6">{INTRO_MEDIA.durationLabel} 영상으로 <span className="hidden sm:inline">주요 기능을 먼저 </span>둘러보세요.</p>
          </div>
          <div className="flex shrink-0 gap-2 sm:mt-3 sm:w-full sm:justify-end">
            <button type="button" onClick={dismissOffer} className="region-button min-h-11 px-3 sm:px-4">닫기</button>
            <button type="button" onClick={() => openPlayer(true)} className="region-primary min-h-11 px-3 sm:px-4">영상 보기</button>
          </div>
        </aside>
      ) : null}

      <dialog
        ref={dialogRef}
        aria-labelledby="intro-player-title"
        onClick={(event) => { if (event.target === dialogRef.current) closePlayer(); }}
        className="ui-dialog ui-dialog-wide"
      >
        <DialogHeader titleId="intro-player-title" title={`pickDday ${INTRO_MEDIA.durationLabel} 소개`} icon={<Play size={18} />} onClose={closePlayer} />
        <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="relative aspect-video max-h-[calc(100dvh-10rem)] w-full bg-navy">
          <video
            ref={videoRef}
            controls
            playsInline
            preload="none"
            poster={INTRO_MEDIA.poster}
            onEnded={() => setEnded(true)}
            onPlay={() => {
              setEnded(false);
              // Playback that starts after the player closed (a late autoplay) must not keep sounding.
              if (!dialogRef.current?.open) videoRef.current?.pause();
            }}
            className="h-full w-full"
          >
            <source src={INTRO_MEDIA.video} type="video/mp4" />
            <track kind="captions" src={INTRO_MEDIA.captions} srcLang="ko" label="한국어" default />
          </video>
          {ended ? (
            <div className="absolute inset-0 grid place-items-center bg-navy/90 p-6 text-center text-white">
              <div>
                <p className="text-xl font-extrabold sm:text-2xl">어떤 축제를 준비하시나요?</p>
                <div className="mt-5 flex flex-wrap justify-center gap-3">
                  <Link href="/existing/search" onClick={closePlayer} className="region-button min-h-11 border-white bg-white px-5 text-navy">기존 축제 찾기 →</Link>
                  <Link href="/new" onClick={closePlayer} className="region-button min-h-11 border-white bg-white px-5 text-navy">지역부터 살펴보기 →</Link>
                </div>
                <button type="button" onClick={replay} className="mt-4 min-h-11 px-3 text-sm font-bold text-white underline underline-offset-4">다시 보기</button>
              </div>
            </div>
          ) : null}
        </div>
        <details className="px-4 py-2 sm:px-5">
          <summary className="min-h-11 cursor-pointer py-2 text-sm font-bold">영상 내용 글로 보기</summary>
          <ol className="grid gap-2 pb-3 text-sm leading-6 text-muted">
            {INTRO_TRANSCRIPT.map((line) => <li key={line}>{line}</li>)}
          </ol>
        </details>
        </div>
      </dialog>
    </>
  );
}
