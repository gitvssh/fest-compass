"use client";

export function PrintButton() {
  return (
    <button
      type="button"
      className="rounded-full bg-white px-5 py-3 text-sm font-bold shadow-card"
      onClick={() => window.print()}
    >
      인쇄·PDF 저장
    </button>
  );
}
