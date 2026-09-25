import { randomUUID } from "node:crypto";
import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";
import {
  ANONYMOUS_ID_COOKIE,
  anonymousIdCookie,
  readAnonymousId,
} from "./app/(products)/[app]/api/events/anonymous-id";

const ADMIN_LOGIN_PATH = "/admin/login";
const OPS_PATH = "/admin/ops";

// A minimal French 404, never the framework's own English fallback and
// never mentioning ops/owner (specs/qa/QA1-P1-B12-statut-http.md): a real
// HTTP 404, not a 200 body carrying NEXT_HTTP_ERROR_FALLBACK (this route
// would otherwise leave under the implicit Suspense of
// app/(backoffice)/admin/loading.tsx before the page's own notFound() call
// resolves — docs/04-nextjs.md's streaming HTTP contract).
const NOT_FOUND_HTML = `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <meta name="robots" content="noindex" />
    <title>Page introuvable</title>
  </head>
  <body>
    <h1>Page introuvable</h1>
  </body>
</html>
`;

function notFoundResponse(): NextResponse {
  return new NextResponse(NOT_FOUND_HTML, {
    status: 404,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

// QA1-P1-B12: an optimistic session guard for the backoffice, cookie
// presence only — never a DB query, never the role (docs/04-nextjs.md: no
// authorization in the proxy). It only turns a response that used to leave
// with HTTP 200 (NEXT_REDIRECT / NEXT_HTTP_ERROR_FALLBACK in the streamed
// body, see the QA1-P1-B12 plan's root cause) into the real status before
// any byte of the page is produced. The actual check stays `requireAdmin()`
// in the DAL: a stale or forged cookie passes here and is still caught
// there (plan's risk R6) — this function never imports `@/lib/auth` or
// `@/lib/dal`.
function adminSessionGuard(request: NextRequest): NextResponse | undefined {
  const { pathname } = request.nextUrl;
  if (pathname === ADMIN_LOGIN_PATH) return undefined;

  const hasSessionCookie = getSessionCookie(request) !== null;
  if (hasSessionCookie) return undefined;

  const isOps = pathname === OPS_PATH || pathname.startsWith(`${OPS_PATH}/`);
  if (isOps) return notFoundResponse();

  return NextResponse.redirect(new URL(ADMIN_LOGIN_PATH, request.url));
}

// QA1-P1-B4: mints the visitor's `anonymous_id` cookie on the first GET of
// a product page, before any beacon leaves the browser. Closes the race
// <TrackVisit>'s two concurrent cookieless beacons used to hit (docs/07's
// per-day dedupe only works once every beacon of a visit agrees on one,
// server-issued id). No DB access, no authorization here — docs/04-nextjs.md
// describes `proxy.ts` as the subdomain rewrite, the optimistic admin
// session guard above (QA1-P1-B12), and this cookie, all within that same
// description (docs/04 › Routing / the tree).
export function proxy(request: NextRequest): NextResponse {
  if (request.nextUrl.pathname.startsWith("/admin")) {
    return adminSessionGuard(request) ?? NextResponse.next();
  }

  const response = NextResponse.next();
  if (request.method !== "GET") return response;

  const existing = readAnonymousId(request.cookies.get(ANONYMOUS_ID_COOKIE)?.value);
  if (existing) return response;

  const secure = request.nextUrl.protocol === "https:";
  response.cookies.set(anonymousIdCookie(randomUUID(), secure));
  return response;
}

// Runs on product pages (`[app]` and its sub-pages, never `/api/*`, static
// assets, or a product's own `[app]/api/*` routes — a Set-Cookie on the
// beacon's own response would reopen the race the anonymous-id logic above
// exists to close) and, since QA1-P1-B12, on `/admin` and its sub-routes
// for adminSessionGuard. `/` alone (no slug) never matches either: there is
// no route there.
export const config = {
  matcher: ["/((?!_next/|api/|admin(?:/|$)|[^/]+/api/|.*\\.[^/]+$).+)", "/admin", "/admin/:path*"],
};
