"use client";

import { useEffect, useRef } from "react";
import {
  trackAnalyticsEvent,
  type AnalyticsEventMap,
  type AnalyticsEventName,
} from "@/lib/analytics";

/**
 * Emits one declared view event after hydration and never again for the same
 * page instance. It renders nothing, so a blocked or absent Zaraz consent
 * changes neither the markup nor the layout.
 *
 * `app_mode` is passed in from the server component because the mode resolver
 * is server-only and the measurement boundary must not read it from the client.
 */
export function AnalyticsView<EventName extends AnalyticsEventName>({
  event,
  properties,
}: {
  event: EventName;
  properties: AnalyticsEventMap[EventName];
}) {
  const dispatched = useRef(false);
  const serialized = JSON.stringify(properties);

  useEffect(() => {
    if (dispatched.current) {
      return;
    }
    dispatched.current = true;
    trackAnalyticsEvent(event, JSON.parse(serialized) as AnalyticsEventMap[EventName]);
  }, [event, serialized]);

  return null;
}
