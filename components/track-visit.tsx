"use client";
import { useEffect } from "react";

// specs/TRACKING.md bullet 1: on mount, sends a `visit` beacon to the
// product's `api/events` (docs/04-nextjs.md: the landing stays static, so a
// client leaf does the write instead of a server-side `track()` call,
// which would force the page dynamic).
//
// QA1-P1-B4: this used to mint `crypto.randomUUID()` on every beacon, so
// StrictMode's doubled effect (or two tabs) produced two different ids and
// two visitors for one visit. Identity now only ever comes from the
// httpOnly `anonymous_id` cookie proxy.ts sets before this component ever
// mounts (docs/04's proxy.ts line); the body id is a fixed placeholder,
// still a syntactically valid uuid so it satisfies the frozen
// trackEventInputSchema, and api/events/route.ts ignores it entirely.
const PLACEHOLDER_ANONYMOUS_ID = "00000000-0000-0000-0000-000000000000";

export const TrackVisit: (props: { slug: string }) => null = ({ slug }) => {
  useEffect(() => {
    navigator.sendBeacon?.(
      `/${slug}/api/events`,
      new Blob([JSON.stringify({ type: "visit", anonymousId: PLACEHOLDER_ANONYMOUS_ID })], {
        type: "application/json",
      }),
    );
  }, [slug]);
  return null;
};
