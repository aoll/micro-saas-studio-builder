"use client";
import { useEffect } from "react";

// specs/TRACKING.md bullet 1: on mount, sends a `visit` beacon to the
// product's `api/events` (docs/04-nextjs.md: the landing stays static, so a
// client leaf does the write instead of a server-side `track()` call,
// which would force the page dynamic). `crypto.randomUUID()` needs a
// secure context — fine in production (https) and on localhost.
export const TrackVisit: (props: { slug: string }) => null = ({ slug }) => {
  useEffect(() => {
    navigator.sendBeacon?.(
      `/${slug}/api/events`,
      new Blob([JSON.stringify({ type: "visit", anonymousId: crypto.randomUUID() })], { type: "application/json" }),
    );
  }, [slug]);
  return null;
};
