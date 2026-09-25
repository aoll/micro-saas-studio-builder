import "server-only";
import { z } from "zod";

// Shared by api/events (TRACKING) and, later, SA-02 and SA-03 (plan's
// Orchestrator decision 2): a single cookie name and shape, so the visit
// beacon and an authenticated generation or signup agree on the same
// anonymous id.
export const ANONYMOUS_ID_COOKIE = "anonymous_id";
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

// The cookie is server-authoritative: only a syntactically valid uuid is
// trusted back from the client. A tampered or missing cookie reads as "no
// cookie" (null), never as a thrown error.
export function readAnonymousId(value: string | undefined): string | null {
  if (!value) return null;
  return z.uuid().safeParse(value).success ? value : null;
}

export function anonymousIdCookie(value: string, secure: boolean) {
  return {
    name: ANONYMOUS_ID_COOKIE,
    value,
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge: ONE_YEAR_SECONDS,
    secure,
  };
}
