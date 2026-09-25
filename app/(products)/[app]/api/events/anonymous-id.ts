import "server-only";
import { z } from "zod";

// Shared by api/events (TRACKING) and, later, SA-02 and SA-03 (plan's
// Orchestrator decision 2): a single cookie name and shape, so the visit
// beacon and an authenticated generation or signup agree on the same
// anonymous id.
export const ANONYMOUS_ID_COOKIE = "anonymous_id";
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

// The nil (all-zero) and max (all-one) uuids are syntactically valid per
// z.uuid() but never a real, proxy.ts-minted identity (QA1-P1-B4 plan step
// 6): treating them as "no cookie" keeps readAnonymousId's guarantee that a
// non-null result always came from a real random identity.
const DEGENERATE_UUIDS = new Set(["00000000-0000-0000-0000-000000000000", "ffffffff-ffff-ffff-ffff-ffffffffffff"]);

// The cookie is server-authoritative: only a syntactically valid, non-nil,
// non-max uuid is trusted back from the client. A tampered or missing
// cookie reads as "no cookie" (null), never as a thrown error.
export function readAnonymousId(value: string | undefined): string | null {
  if (!value) return null;
  if (!z.uuid().safeParse(value).success) return null;
  if (DEGENERATE_UUIDS.has(value)) return null;
  return value;
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
