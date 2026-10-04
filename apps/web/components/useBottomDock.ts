"use client";
import { useEffect, type RefObject } from "react";

// Fixed cards at the bottom of the screen (the consent banner, the first-visit intro offer) must not cover the end of
// the page. While one is shown it reserves its height, and AppShell adds that much room after the footer, so the footer
// (with "분석 동의 다시 보기" and the privacy link) can always be scrolled above the card.
export const BOTTOM_DOCK_PROPERTY = "--bottom-dock";
const GAP_PX = 12;
const docks = new Map<object, number>();

function apply() {
  document.documentElement.style.setProperty(BOTTOM_DOCK_PROPERTY, `${Math.max(0, ...docks.values())}px`);
}

/** Reserves room for `ref`'s fixed card while `active`: its height plus its distance from the bottom edge. */
export function useBottomDock(ref: RefObject<HTMLElement | null>, active: boolean) {
  useEffect(() => {
    const element = ref.current;
    if (!active || !element) return;
    const key = {};
    // offsetHeight ignores the entrance animation's transform, so the room is right from the first frame.
    const measure = () => {
      docks.set(key, Math.ceil(element.offsetHeight + (Number.parseFloat(getComputedStyle(element).bottom) || 0) + GAP_PX));
      apply();
    };
    measure();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    observer?.observe(element);
    window.addEventListener("resize", measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", measure);
      docks.delete(key);
      apply();
    };
  }, [ref, active]);
}
