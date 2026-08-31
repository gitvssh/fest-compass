// Cloudflare Zaraz is the only analytics transport. The app never embeds a
// vendor measurement ID or a CMP purpose ID: the GA4 connection and the consent
// purpose live in the Cloudflare console, and `window.zaraz.track` only exists
// after the visitor has consented, so a refused or withdrawn consent silently
// drops every call here.
export type AnalyticsScalar = string | number;
export type AnalyticsProperties = Readonly<Record<string, AnalyticsScalar>>;

interface ZarazClient {
  track: (
    eventName: string,
    properties?: Record<string, AnalyticsScalar>,
  ) => void | Promise<unknown>;
}

declare global {
  interface Window {
    zaraz?: ZarazClient;
  }
}

function ignoreRejectedDispatch(result: void | Promise<unknown>): void {
  if (result && typeof (result as Promise<unknown>).catch === "function") {
    void (result as Promise<unknown>).catch(() => undefined);
  }
}

export function dispatchAnalyticsEvent(
  eventName: string,
  properties: AnalyticsProperties,
): void {
  if (typeof window === "undefined" || typeof window.zaraz?.track !== "function") {
    return;
  }

  try {
    ignoreRejectedDispatch(window.zaraz.track(eventName, { ...properties }));
  } catch {
    // Analytics must never interrupt a public read-only page render.
  }
}
