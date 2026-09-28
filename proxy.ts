import { randomUUID } from "node:crypto";
import { getSessionCookie } from "better-auth/cookies";
import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import {
  ANONYMOUS_ID_COOKIE,
  anonymousIdCookie,
  readAnonymousId,
} from "./app/(products)/[app]/api/events/anonymous-id";
import { marketingPath, marketingRouting, type MarketingPath } from "./i18n/marketing-routing";

const ADMIN_LOGIN_PATH = "/admin/login";
const OPS_PATH = "/admin/ops";

// The exact header next-intl's lazy `requestLocale` getter reads
// (node_modules/next-intl/dist/.../shared/constants.js: HEADER_LOCALE_NAME),
// set here on the forwarded *request* so i18n/request.ts's marketing branch
// can read it via `headers()`. Named so both this file and that comment
// agree on the one string that couples them (plan risk R-I).
const NEXT_INTL_LOCALE_HEADER = "x-next-intl-locale";

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

// R-H (I18N-MARKETING plan, Orchestrator decisions): the backoffice never
// legitimately carries this header — only the marketing branch below sets
// it, for `/` and `/making-of`. Without this, a request could forge
// `x-next-intl-locale: en` straight to `/admin` and hit i18n/request.ts's
// marketing branch (which only checks the header's value against
// `marketingRouting.locales`, not who set it), overriding the backoffice's
// own `admin_locale` cookie. Stripped unconditionally on every `/admin`
// request, before either adminSessionGuard's decision or a pass-through.
function stripInboundLocaleHeader(request: NextRequest): Headers {
  const headers = new Headers(request.headers);
  headers.delete(NEXT_INTL_LOCALE_HEADER);
  return headers;
}

// docs/08-stack.md's "Landing et making-of": `fr` unprefixed, `en` under
// `/en`, detected once from Accept-Language, then persisted in the
// `NEXT_LOCALE` cookie (next-intl's default name and detection).
const handleMarketingI18n = createMiddleware(marketingRouting);

// Chains next-intl's middleware for `/` and `/making-of` only. Two things
// this function must NOT reuse from next-intl's own response, both because
// there is no `[locale]` route segment in this app (plan finding 1):
// - Its *rewrite target*: without a `pathnames` config, next-intl's default
//   internal representation of `/en` is `/en` itself (the convention
//   assumes a `[locale]` segment handles that prefix downstream). Here it
//   would 404 on `[app]` treating "en" as a product slug. This function
//   discards that target and rewrites to the true unprefixed page
//   (`marketing.pathname`, from the pure parse in marketingPath()) instead.
// - Its *decision to redirect or not*: that part IS next-intl's job
//   (Accept-Language detection, the NEXT_LOCALE cookie, explicit `/fr`
//   always redirecting to the unprefixed form) — a redirect response is
//   returned as-is, Set-Cookie and all.
// What IS reused when there is no redirect: next-intl's cookies (it syncs
// NEXT_LOCALE when the explicit choice differs from detection, see
// syncCookie.js) and its `Link` header (alternate-locale links, docs/08).
function marketingI18n(request: NextRequest, marketing: MarketingPath): NextResponse {
  const routed = handleMarketingI18n(request);
  if (routed.headers.get("location")) return routed;

  const locale = marketing.locale ?? marketingRouting.defaultLocale;
  const headers = new Headers(request.headers);
  headers.set(NEXT_INTL_LOCALE_HEADER, locale);

  const url = request.nextUrl.clone();
  url.pathname = marketing.pathname;
  const response =
    marketing.locale === undefined
      ? NextResponse.next({ request: { headers } })
      : NextResponse.rewrite(url, { request: { headers } });

  for (const cookie of routed.cookies.getAll()) response.cookies.set(cookie);
  const link = routed.headers.get("link");
  if (link) response.headers.set("link", link);
  return response;
}

// QA1-P1-B4: mints the visitor's `anonymous_id` cookie on the first GET of
// a product page, before any beacon leaves the browser. Closes the race
// <TrackVisit>'s two concurrent cookieless beacons used to hit (docs/07's
// per-day dedupe only works once every beacon of a visit agrees on one,
// server-issued id). No DB access, no authorization here — docs/04-nextjs.md
// describes `proxy.ts` as the subdomain rewrite, the optimistic admin
// session guard above (QA1-P1-B12), and this cookie, all within that same
// description (docs/04 › Routing / the tree).
//
// Order: the marketing i18n branch (I18N-MARKETING) runs first — `/` and
// `/making-of` never reach the admin guard or the anonymous_id cookie below,
// and R4 keeps every other path (products, `/admin*`, `/api/*`) out of it.
export function proxy(request: NextRequest): NextResponse {
  const marketing = marketingPath(request.nextUrl.pathname);
  if (marketing) return marketingI18n(request, marketing);

  if (request.nextUrl.pathname.startsWith("/admin")) {
    const guard = adminSessionGuard(request);
    if (guard) return guard;
    return NextResponse.next({ request: { headers: stripInboundLocaleHeader(request) } });
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
// exists to close), on `/admin` and its sub-routes for adminSessionGuard
// (QA1-P1-B12), and, since I18N-MARKETING (R5), on `/` and `/making-of` for
// the marketing i18n branch: unlike the other two, `/` and `/making-of` are
// now real routes (`app/(marketing)/page.tsx` and `making-of/page.tsx`), so
// `/` needs its own literal matcher entry — the first pattern's `.+` never
// matches an empty capture. `/en`, `/fr` and their `/making-of` variants
// already match that first pattern (no exclusion applies to them), same as
// any other unprefixed marketing or product path.
export const config = {
  matcher: ["/", "/((?!_next/|api/|admin(?:/|$)|[^/]+/api/|.*\\.[^/]+$).+)", "/admin", "/admin/:path*"],
};
