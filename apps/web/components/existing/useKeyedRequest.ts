"use client";
import { useCallback, useEffect, useRef, useState } from "react";

// One request per applied condition. The URL is the condition: a response is applied only while its URL is
// still the latest one (and, when given, its server key equals the expected key), so a late answer for an
// earlier festival, region, edition or period never replaces the current view. Results are remembered for
// this tab (not across reloads) together with a failed refresh, so returning through the menu or browser
// history shows the same result, its original retrieval time and the pending retry.
export type RequestFailure = "network" | "invalid" | "notfound";
type Entry = { data: unknown; at: number; failure: RequestFailure | null };
const cache = new Map<string, Entry>();
const CACHE_LIMIT = 60, FRESH_MS = 10 * 60_000;

export type KeyedState<T> = {
  /** Data for exactly the requested URL, or null. Never data of another condition. */
  data: T | null;
  loading: boolean;
  /** Set when the latest attempt failed. With data present it means "showing the earlier result of this same condition". */
  failure: RequestFailure | null;
  retry: () => void;
};
type Internal<T> = { url: string | null; data: T | null; loading: boolean; failure: RequestFailure | null };

function entry(url: string | null): Entry | undefined { return url ? cache.get(url) : undefined; }
function remember(url: string, value: Entry) {
  cache.delete(url); cache.set(url, value);
  while (cache.size > CACHE_LIMIT) cache.delete(cache.keys().next().value!);
}
function initial<T>(url: string | null): Internal<T> {
  const hit = entry(url);
  return { url, data: (hit?.data as T | undefined) ?? null, loading: false, failure: hit?.data ? hit.failure : null };
}

/**
 * `merge` lets a panel keep an earlier successful source block of the same condition when a refresh of that
 * block fails, while accepting the blocks that did refresh. `expectedKey` is the canonical key the server
 * must echo for this condition.
 */
export function useKeyedRequest<T extends { key: string }>(url: string | null, merge?: (previous: T, next: T) => T, expectedKey?: string | null): KeyedState<T> {
  const [state, setState] = useState<Internal<T>>(() => initial<T>(url));
  const [attempt, setAttempt] = useState(0);
  const latest = useRef(state), serial = useRef(0), forced = useRef(false), mergeRef = useRef(merge), keyRef = useRef(expectedKey);
  latest.current = state; mergeRef.current = merge; keyRef.current = expectedKey;

  useEffect(() => {
    const id = ++serial.current, force = forced.current;
    forced.current = false;
    if (!url) { setState({ url: null, data: null, loading: false, failure: null }); return; }
    const hit = entry(url);
    const previous = latest.current.url === url && latest.current.data ? latest.current.data : (hit?.data as T | undefined) ?? null;
    if (!force && hit && Date.now() - hit.at < FRESH_MS) { setState({ url, data: hit.data as T, loading: false, failure: hit.failure }); return; }
    setState({ url, data: previous, loading: true, failure: null });
    const controller = new AbortController();
    const fail = (failure: RequestFailure) => {
      setState({ url, data: previous, loading: false, failure });
      // Keep the earlier success of this same condition, its time and the failed refresh for later returns.
      if (previous) remember(url, { data: previous, at: hit?.at ?? Date.now(), failure });
    };
    fetch(url, { signal: controller.signal, headers: { accept: "application/json" } }).then(async response => {
      const body = await response.json().catch(() => null);
      if (id !== serial.current) return;
      if (!response.ok || !body || typeof body.key !== "string") { fail(response.status === 400 ? "invalid" : response.status === 404 ? "notfound" : "network"); return; }
      if (keyRef.current && body.key !== keyRef.current) { fail("network"); return; }
      const next = previous && mergeRef.current ? mergeRef.current(previous, body as T) : (body as T);
      remember(url, { data: next, at: Date.now(), failure: null });
      setState({ url, data: next, loading: false, failure: null });
    }).catch(error => {
      if (id !== serial.current || (error as Error)?.name === "AbortError") return;
      fail("network");
    });
    return () => controller.abort();
  }, [url, attempt]);

  const retry = useCallback(() => { forced.current = true; setAttempt(n => n + 1); }, []);
  // Between a condition change and its effect, never expose the previous condition's data.
  if (state.url === url) return { data: state.data, loading: state.loading, failure: state.failure, retry };
  const pending = initial<T>(url);
  return { data: pending.data, loading: !!url && !pending.data, failure: pending.failure, retry };
}
