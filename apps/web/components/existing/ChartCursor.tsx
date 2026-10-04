"use client";
import { useState, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";

// Day cursor of the visits charts. The pointer (or a tap) picks the day under it and the tooltip follows it; with the
// chart focused, ←/→/Home/End move day by day and Esc hides it. The tooltip itself is visual only: keyboard moves are
// read out through a polite live line, and the same values stay in the table.
export type DayCursor = { index: number; px: number; py: number; via: "pointer" | "touch" | "keyboard" };

export function useDayCursor() {
  const [cursor, setCursor] = useState<DayCursor | null>(null);
  /** `index` is the day under the pointer (null outside the plot); `figure` positions the tooltip. */
  function point(e: PointerEvent<Element>, index: number | null, figure: HTMLElement | null) {
    if (index === null || !figure) { if (e.pointerType !== "touch") setCursor(null); return; }
    const box = figure.getBoundingClientRect();
    setCursor({ index, px: e.clientX - box.left, py: e.clientY - box.top, via: e.pointerType === "touch" ? "touch" : "pointer" });
  }
  function leave(e: PointerEvent<Element>) { if (e.pointerType !== "touch") setCursor(null); }
  /** Handles ←/→/Home/End/Esc; `anchor` places the tooltip over a day for keyboard moves. Returns the day shown. */
  function key(e: KeyboardEvent<Element>, count: number, start: number, anchor: (index: number) => { px: number; py: number } | null): number | null {
    if (e.key === "Escape") { if (cursor) { e.preventDefault(); setCursor(null); } return null; }
    const from = cursor?.index ?? null;
    const next = e.key === "ArrowRight" ? (from === null ? start : Math.min(count - 1, from + 1))
      : e.key === "ArrowLeft" ? (from === null ? start : Math.max(0, from - 1))
      : e.key === "Home" ? 0 : e.key === "End" ? count - 1 : null;
    if (next === null) return null;
    e.preventDefault();
    const at = anchor(next);
    if (at) setCursor({ index: next, ...at, via: "keyboard" });
    return next;
  }
  return { cursor, point, leave, key, clear: () => setCursor(null) };
}

/** Small card beside the pointer; it flips to stay inside the chart and never takes the pointer. */
export function ChartTooltip({ cursor, width, children }: { cursor: DayCursor; width: number; children: ReactNode }) {
  const left = cursor.px > width * 0.6, below = cursor.py < 140;
  return <div aria-hidden="true" data-chart-tooltip=""
    className="pointer-events-none absolute z-20 w-max max-w-[19rem] rounded-xl border border-ink/10 bg-white px-3 py-2 text-sm shadow-[var(--shadow-pop)]"
    style={{ left: cursor.px, top: cursor.py, transform: `translate(${left ? "calc(-100% - 14px)" : "14px"}, ${below ? "18px" : "calc(-100% - 14px)"})` }}>
    {children}
  </div>;
}

/** Keyboard moves read out the day shown; pointer hovers stay silent. */
export function CursorAnnouncement({ text }: { text: string }) {
  return <p className="sr-only" aria-live="polite">{text}</p>;
}
