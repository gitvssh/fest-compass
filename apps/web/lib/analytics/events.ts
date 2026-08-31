// The published dictionary in lib/analytics-events.ts is the single source of
// truth for which events exist and which properties each may carry. This module
// enforces it at the send boundary so the privacy page and the wire can never
// drift apart, and so a future caller cannot widen an event by passing an extra
// field.
import {
  analyticsConsentBoundary,
  analyticsEventDictionary,
} from "@/lib/analytics-events";
import {
  dispatchAnalyticsEvent,
  type AnalyticsProperties,
  type AnalyticsScalar,
} from "./transport";

export type AppModeValue = "public-readonly" | "editor";
export type WorkspaceTab = "evidence" | "scenarios" | "ledger" | "report";

export interface AnalyticsEventMap {
  festival_list_view: { app_mode: AppModeValue };
  festival_workspace_view: { tab: WorkspaceTab; app_mode: AppModeValue };
  privacy_view: { app_mode: AppModeValue };
}

export type AnalyticsEventName = keyof AnalyticsEventMap;

const ALLOWED_PROPERTY_KEYS: ReadonlyMap<string, ReadonlySet<string>> = new Map(
  analyticsEventDictionary.map((entry) => [
    entry.name,
    new Set<string>(entry.allowedProperties),
  ]),
);

// Defence in depth. Even if a dictionary entry were edited to name one of these,
// the send boundary still drops it.
const FORBIDDEN_PROPERTY_KEYS: ReadonlySet<string> = new Set(
  analyticsConsentBoundary.forbiddenProperties,
);

// Every property is a closed enumeration. Nothing derived from user input,
// festival records, or the URL can reach an analytics event.
const ALLOWED_VALUES: Readonly<Record<string, ReadonlySet<string>>> = {
  app_mode: new Set<AppModeValue>(["public-readonly", "editor"]),
  tab: new Set<WorkspaceTab>(["evidence", "scenarios", "ledger", "report"]),
};

// A last resort shape check for anything that ever becomes free-form: reject
// URLs, addresses, and multi-line or over-long values outright.
const UNSAFE_STRING_VALUE = /(?:https?:\/\/|www\.|[\r\n]|@)/i;
const MAX_STRING_VALUE_LENGTH = 32;

export function isKnownAnalyticsEvent(name: string): name is AnalyticsEventName {
  return ALLOWED_PROPERTY_KEYS.has(name);
}

function sanitizeValue(key: string, value: unknown): AnalyticsScalar | null {
  if (typeof value !== "string") {
    return null;
  }
  if (value.length === 0 || value.length > MAX_STRING_VALUE_LENGTH) {
    return null;
  }
  if (UNSAFE_STRING_VALUE.test(value)) {
    return null;
  }
  return ALLOWED_VALUES[key]?.has(value) ? value : null;
}

export function buildAnalyticsEvent<EventName extends AnalyticsEventName>(
  eventName: EventName,
  properties: AnalyticsEventMap[EventName],
): { eventName: EventName; properties: AnalyticsProperties } {
  const allowedKeys = ALLOWED_PROPERTY_KEYS.get(eventName) ?? new Set<string>();
  const sanitized: Record<string, AnalyticsScalar> = {};

  for (const [key, value] of Object.entries(properties)) {
    if (!allowedKeys.has(key) || FORBIDDEN_PROPERTY_KEYS.has(key)) {
      continue;
    }
    const safeValue = sanitizeValue(key, value);
    if (safeValue !== null) {
      sanitized[key] = safeValue;
    }
  }

  return { eventName, properties: sanitized };
}

export function trackAnalyticsEvent<EventName extends AnalyticsEventName>(
  eventName: EventName,
  properties: AnalyticsEventMap[EventName],
): void {
  if (!isKnownAnalyticsEvent(eventName)) {
    return;
  }
  const event = buildAnalyticsEvent(eventName, properties);
  dispatchAnalyticsEvent(event.eventName, event.properties);
}
