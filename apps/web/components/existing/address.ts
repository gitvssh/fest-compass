"use client";
import { festivalMemory, type View } from "./memory";

/**
 * Keep the address equal to the applied condition. `replace` for condition changes that should not add
 * history entries; `push` only where going back must return to the previous state (a past month link).
 */
export function writeAddress(params: URLSearchParams, mode: "replace" | "push" = "replace") {
  params.sort();
  const query = params.toString(), url = `${window.location.pathname}${query ? `?${query}` : ""}`;
  if (url === `${window.location.pathname}${window.location.search}`) return;
  if (mode === "push") window.history.pushState(null, "", url); else window.history.replaceState(null, "", url);
}
export function rememberView(festivalId: string, view: View, params: URLSearchParams) {
  params.sort();
  festivalMemory(festivalId).search[view] = params.toString();
}
