"use client";

import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

// SA-07 (plan's design decision 5): a not-signed-in visitor sees the
// account page's content replaced by the SA-03 sign-up gate, and this leaf
// auto-opens it by replacing the URL once the page mounts, so
// `/${slug}/signup`'s intercepting route (@modal/(.)signup, SA-03) opens
// over the account page instead of leaving a dead end. `router.replace`,
// never `push`: closing the modal must not come back to a history entry
// that reopens it. Renders nothing — SignupPrompt's own EmptyState and
// link are the visible, no-JS fallback.
export function OpenSignupModal({ href }: { href: Route | string }) {
  const router = useRouter();
  const opened = useRef(false);

  useEffect(() => {
    if (opened.current) return;
    opened.current = true;
    router.replace(href as Route);
  }, [router, href]);

  return null;
}
