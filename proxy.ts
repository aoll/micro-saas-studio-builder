import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import {
  ANONYMOUS_ID_COOKIE,
  anonymousIdCookie,
  readAnonymousId,
} from "./app/(products)/[app]/api/events/anonymous-id";

// QA1-P1-B4: mints the visitor's `anonymous_id` cookie on the first GET of
// a product page, before any beacon leaves the browser. Closes the race
// <TrackVisit>'s two concurrent cookieless beacons used to hit (docs/07's
// per-day dedupe only works once every beacon of a visit agrees on one,
// server-issued id). No DB access, no authorization here — docs/04-nextjs.md
// still describes `proxy.ts` as the subdomain rewrite; setting this cookie
// is neither, so it stays within that description, extended by one line in
// this PR (docs/04 › Routing / the tree).
export function proxy(request: NextRequest): NextResponse {
  const response = NextResponse.next();
  if (request.method !== "GET") return response;

  const existing = readAnonymousId(request.cookies.get(ANONYMOUS_ID_COOKIE)?.value);
  if (existing) return response;

  const secure = request.nextUrl.protocol === "https:";
  response.cookies.set(anonymousIdCookie(randomUUID(), secure));
  return response;
}

// Runs on product pages only (`[app]` and its sub-pages), never on
// `/admin`, `/api/*`, static assets, or a product's own `[app]/api/*`
// routes: a Set-Cookie on the beacon's own response would reopen the race
// this proxy exists to close (the beacon reads the request cookie sent
// *before* this response arrives). `/` alone (no slug) never matches
// either: there is no route there.
export const config = {
  matcher: "/((?!_next/|api/|admin(?:/|$)|[^/]+/api/|.*\\.[^/]+$).+)",
};
