import { NextRequest } from "next/server";
import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { describe, expect, it, vi } from "vitest";
import { ANONYMOUS_ID_COOKIE, readAnonymousId } from "./app/(products)/[app]/api/events/anonymous-id";
import { config, proxy } from "./proxy";

// next-intl's ESM build imports the bare specifier "next/server" from
// inside its own nested node_modules; Next.js's package has no "exports"
// map, so plain Node ESM resolution (used by Vitest's externalized deps,
// confirmed independent of Vite by reproducing the same failure with a bare
// `node --input-type=module -e "import('next-intl/middleware')"`) cannot
// resolve it — only a bundler with lenient extension probing (webpack,
// Turbopack) papers over it, which is exactly what `next build` uses for
// e2e/marketing-locale.spec.ts. This mock is a small, faithful
// reimplementation of next-intl's own documented contract for our routing
// (locale precedence: URL prefix > NEXT_LOCALE cookie > Accept-Language >
// defaultLocale; `as-needed` prefix; the same cookie-sync rule as
// next-intl's syncCookie.js — set the cookie when it's stale, or when the
// explicit choice differs from what Accept-Language alone would give), so
// these tests still exercise proxy.ts's own logic (the redirect passthrough,
// the rewrite to the unprefixed page, header and cookie copying) against
// real precedence rules. The rules themselves are re-verified end-to-end by
// a real, built Next.js server in e2e/marketing-locale.spec.ts.
vi.mock("next-intl/middleware", async () => {
  const { NextResponse } = await import("next/server");

  function negotiate(acceptLanguage: string | null): string | undefined {
    const primary = acceptLanguage?.split(",")[0]?.trim().split("-")[0]?.toLowerCase();
    return primary === "en" || primary === "fr" ? primary : undefined;
  }

  function stripPrefix(pathname: string, locales: readonly string[]): { locale?: string; rest: string } {
    for (const locale of locales) {
      if (pathname === `/${locale}`) return { locale, rest: "/" };
      if (pathname.startsWith(`/${locale}/`)) return { locale, rest: pathname.slice(locale.length + 1) };
    }
    return { rest: pathname };
  }

  type Routing = {
    locales: readonly string[];
    defaultLocale: string;
    localeCookie?: false | { name?: string; maxAge?: number; sameSite?: "lax" | "strict" | "none" };
  };

  return {
    default:
      (routing: Routing) =>
      (request: import("next/server").NextRequest): import("next/server").NextResponse => {
        const { locale: prefixLocale, rest } = stripPrefix(request.nextUrl.pathname, routing.locales);
        const cookieCfg: { name: string; sameSite: "lax" | "strict" | "none"; maxAge?: number } | null =
          routing.localeCookie === false
            ? null
            : { name: "NEXT_LOCALE", sameSite: "lax" as const, ...routing.localeCookie };
        const cookieValue = request.cookies.get(cookieCfg?.name ?? "NEXT_LOCALE")?.value;
        const cookieLocale = cookieValue && routing.locales.includes(cookieValue) ? cookieValue : undefined;
        const acceptLocale = negotiate(request.headers.get("accept-language"));
        const resolved = prefixLocale ?? cookieLocale ?? acceptLocale ?? routing.defaultLocale;
        const isDefault = resolved === routing.defaultLocale;

        let response: import("next/server").NextResponse;
        if (prefixLocale !== undefined) {
          const url = request.nextUrl.clone();
          url.pathname = rest;
          response = isDefault ? NextResponse.redirect(url) : NextResponse.next();
        } else if (isDefault) {
          response = NextResponse.next();
        } else {
          const url = request.nextUrl.clone();
          url.pathname = `/${resolved}${rest === "/" ? "" : rest}`;
          response = NextResponse.redirect(url);
        }

        if (cookieCfg) {
          const { name, ...attrs } = cookieCfg;
          if (cookieValue !== undefined) {
            if (cookieValue !== resolved) response.cookies.set(name, resolved, attrs);
          } else if (acceptLocale !== resolved) {
            response.cookies.set(name, resolved, attrs);
          }
        }
        return response;
      },
  };
});

function get(
  url: string,
  options: { method?: string; cookie?: string; sessionCookieName?: string; sessionCookieValue?: string } = {},
) {
  const headers = new Headers();
  const cookies: string[] = [];
  if (options.cookie) cookies.push(`${ANONYMOUS_ID_COOKIE}=${options.cookie}`);
  if (options.sessionCookieName) cookies.push(`${options.sessionCookieName}=${options.sessionCookieValue ?? "x"}`);
  if (cookies.length) headers.set("cookie", cookies.join("; "));
  return new NextRequest(url, { method: options.method ?? "GET", headers });
}

function marketingGet(
  url: string,
  options: { acceptLanguage?: string; nextLocale?: string; headers?: Record<string, string> } = {},
) {
  const headers = new Headers(options.headers);
  if (options.acceptLanguage) headers.set("accept-language", options.acceptLanguage);
  if (options.nextLocale) headers.set("cookie", `NEXT_LOCALE=${options.nextLocale}`);
  return new NextRequest(url, { headers });
}

// The exact header the marketing branch sets on the forwarded request
// (init.request.headers), surfaced by NextResponse as
// `x-middleware-request-<name>` (node_modules/next/.../response.js).
function forwardedHeader(response: Response, name: string): string | null {
  return response.headers.get(`x-middleware-request-${name}`);
}

// R5 (spec bullet 5): a single `proxy` export, plus `config` — no `default`
// or `middleware` export that Next could pick as the actual entry point
// instead of the named `proxy` export this file relies on throughout.
describe("proxy.ts module shape (R5)", () => {
  it("exports exactly config and proxy", async () => {
    const proxyModule: Record<string, unknown> = await import("./proxy");
    expect(Object.keys(proxyModule).sort()).toEqual(["config", "proxy"]);
  });
});

describe("proxy (QA1-P1-B4): sets the anonymous_id cookie before the first beacon", () => {
  it("GET /lettre-pro without a cookie: sets a valid, HttpOnly, Path=/, SameSite=Lax, one-year cookie", () => {
    const response = proxy(get("http://demo.example/lettre-pro"));

    const setCookie = response.headers.get("set-cookie");
    expect(setCookie).toContain(`${ANONYMOUS_ID_COOKIE}=`);
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("Path=/");
    expect(setCookie?.toLowerCase()).toContain("samesite=lax");
    expect(setCookie).toContain("Max-Age=31536000");
    const value = response.cookies.get(ANONYMOUS_ID_COOKIE)?.value;
    expect(readAnonymousId(value)).toBe(value);
  });

  it("marks the cookie Secure on an https request", () => {
    const response = proxy(get("https://demo.example/lettre-pro"));
    expect(response.headers.get("set-cookie")).toContain("Secure");
  });

  it("does not mark the cookie Secure on an http request", () => {
    const response = proxy(get("http://demo.example/lettre-pro"));
    expect(response.headers.get("set-cookie")).not.toContain("Secure");
  });

  it("GET /lettre-pro/tool without a cookie also sets one", () => {
    const response = proxy(get("http://demo.example/lettre-pro/tool"));
    expect(response.headers.get("set-cookie")).toContain(`${ANONYMOUS_ID_COOKIE}=`);
  });

  it("a valid existing cookie: no Set-Cookie", () => {
    const response = proxy(get("http://demo.example/lettre-pro", { cookie: crypto.randomUUID() }));
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it.each(["not-a-uuid", "00000000-0000-0000-0000-000000000000", "ffffffff-ffff-ffff-ffff-ffffffffffff"])(
    "replaces an invalid cookie (%s) with a fresh one",
    (invalid) => {
      const response = proxy(get("http://demo.example/lettre-pro", { cookie: invalid }));
      const setCookie = response.headers.get("set-cookie");
      expect(setCookie).toContain(`${ANONYMOUS_ID_COOKIE}=`);
      expect(setCookie).not.toContain(`${ANONYMOUS_ID_COOKIE}=${invalid}`);
    },
  );

  it("a non-GET request: no Set-Cookie", () => {
    const response = proxy(get("http://demo.example/lettre-pro", { method: "POST" }));
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  describe("matcher", () => {
    // QA1-P1-B12 (own commit, see its message): /admin and /admin/products
    // moved here from "does not match" below — the matcher now also runs
    // adminSessionGuard, so it must match the backoffice too. `proxy()`
    // itself still never touches the anonymous_id cookie on these paths
    // (see the "adminSessionGuard" describe block).
    //
    // I18N-MARKETING (R5, own commit, see its message): "/" moved here too
    // — `/` is now a real route (app/(marketing)/page.tsx), no longer the
    // no-route path the old "does not match" comment described.
    it.each([
      "http://demo.example/lettre-pro",
      "http://demo.example/lettre-pro/tool",
      "http://demo.example/admin",
      "http://demo.example/admin/products",
      "http://demo.example/admin/login",
      "http://demo.example/admin/ops",
      "http://demo.example/",
    ])("matches %s", (url) => {
      expect(unstable_doesMiddlewareMatch({ config, url })).toBe(true);
    });

    it.each([
      "http://demo.example/api/auth/session",
      "http://demo.example/_next/static/x.js",
      "http://demo.example/lettre-pro/api/events",
      "http://demo.example/lettre-pro/api/generate",
      "http://demo.example/robots.txt",
      "http://demo.example/favicon.ico",
    ])("does not match %s", (url) => {
      expect(unstable_doesMiddlewareMatch({ config, url })).toBe(false);
    });
  });
});

describe("adminSessionGuard (QA1-P1-B12): optimistic cookie-presence check for /admin", () => {
  it("GET /admin without a session cookie: 307 to /admin/login", () => {
    const response = proxy(get("http://demo.example/admin"));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://demo.example/admin/login");
  });

  it("GET /admin/products/x without a session cookie: 307 to /admin/login", () => {
    const response = proxy(get("http://demo.example/admin/products/x"));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://demo.example/admin/login");
  });

  it.each(["http://demo.example/admin/ops", "http://demo.example/admin/ops/"])(
    "GET %s without a session cookie: a French 404, not a redirect",
    (url) => {
      const response = proxy(get(url));
      expect(response.status).toBe(404);
      expect(response.headers.get("content-type")).toContain("text/html");
    },
  );

  it("the 404 body is a minimal French page: lang=fr, noindex, Page introuvable", async () => {
    const response = proxy(get("http://demo.example/admin/ops"));
    const body = await response.text();
    expect(body).toContain('lang="fr"');
    expect(body).toContain("Page introuvable");
    expect(body.toLowerCase()).toContain('name="robots" content="noindex"');
    expect(body).not.toContain("NEXT_HTTP_ERROR_FALLBACK");
  });

  it("GET /admin/login without a session cookie: passes through, no redirect", () => {
    const response = proxy(get("http://demo.example/admin/login"));
    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });

  it.each(["better-auth.session_token", "__Secure-better-auth.session_token"])(
    "GET /admin with a %s cookie: passes through",
    (name) => {
      const response = proxy(get("http://demo.example/admin", { sessionCookieName: name }));
      expect(response.status).toBe(200);
      expect(response.headers.get("location")).toBeNull();
    },
  );

  it.each(["better-auth.session_token", "__Secure-better-auth.session_token"])(
    "GET /admin/ops with a %s cookie: passes through, no 404",
    (name) => {
      const response = proxy(get("http://demo.example/admin/ops", { sessionCookieName: name }));
      expect(response.status).toBe(200);
    },
  );

  it("never sets the anonymous_id cookie on /admin routes", () => {
    const response = proxy(get("http://demo.example/admin", { sessionCookieName: "better-auth.session_token" }));
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  // R-H (I18N-MARKETING plan, Orchestrator decisions): only the marketing
  // branch legitimately sets this header. A forged inbound copy must never
  // reach the downstream request, or it could spoof the backoffice's locale
  // via i18n/request.ts's marketing branch.
  it("strips a forged inbound x-next-intl-locale header before forwarding", () => {
    const request = new NextRequest("http://demo.example/admin", {
      headers: { cookie: "better-auth.session_token=x", "x-next-intl-locale": "en" },
    });
    const response = proxy(request);
    expect(response.status).toBe(200);
    expect(forwardedHeader(response, "x-next-intl-locale")).toBeNull();
  });
});

describe("marketing i18n (I18N-MARKETING): / and /making-of only", () => {
  it("first visit, en-US, no cookie: 307 to /en, no NEXT_LOCALE cookie set", () => {
    const response = proxy(marketingGet("http://demo.example/", { acceptLanguage: "en-US" }));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://demo.example/en");
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("first visit, de-DE (unsupported): no redirect, locale fr", () => {
    const response = proxy(marketingGet("http://demo.example/", { acceptLanguage: "de-DE" }));
    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
    expect(forwardedHeader(response, "x-next-intl-locale")).toBe("fr");
  });

  it("first visit, fr-FR: no redirect, locale fr", () => {
    const response = proxy(marketingGet("http://demo.example/", { acceptLanguage: "fr-FR" }));
    expect(response.status).toBe(200);
    expect(forwardedHeader(response, "x-next-intl-locale")).toBe("fr");
  });

  it("NEXT_LOCALE=en beats fr-FR detection: 307 to /en", () => {
    const response = proxy(marketingGet("http://demo.example/", { acceptLanguage: "fr-FR", nextLocale: "en" }));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://demo.example/en");
  });

  it("/making-of with NEXT_LOCALE=fr and en-US: no redirect, locale fr", () => {
    const response = proxy(
      marketingGet("http://demo.example/making-of", { acceptLanguage: "en-US", nextLocale: "fr" }),
    );
    expect(response.status).toBe(200);
    expect(forwardedHeader(response, "x-next-intl-locale")).toBe("fr");
  });

  it("/en: rewrites to / with locale en", () => {
    const response = proxy(marketingGet("http://demo.example/en"));
    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-rewrite")).toBe("http://demo.example/");
    expect(forwardedHeader(response, "x-next-intl-locale")).toBe("en");
  });

  it("/en/making-of: rewrites to /making-of with locale en", () => {
    const response = proxy(marketingGet("http://demo.example/en/making-of"));
    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-rewrite")).toBe("http://demo.example/making-of");
    expect(forwardedHeader(response, "x-next-intl-locale")).toBe("en");
  });

  it("/en with fr-FR and no cookie: sets a one-year NEXT_LOCALE=en cookie", () => {
    const response = proxy(marketingGet("http://demo.example/en", { acceptLanguage: "fr-FR" }));
    const setCookie = response.headers.get("set-cookie");
    expect(setCookie).toContain("NEXT_LOCALE=en");
    expect(setCookie).toContain("Max-Age=31536000");
    expect(setCookie?.toLowerCase()).toContain("samesite=lax");
    expect(setCookie).toContain("Path=/");
  });

  it("/fr/making-of with NEXT_LOCALE=en: 307 to /making-of plus NEXT_LOCALE=fr", () => {
    const response = proxy(marketingGet("http://demo.example/fr/making-of", { nextLocale: "en" }));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://demo.example/making-of");
    expect(response.headers.get("set-cookie")).toContain("NEXT_LOCALE=fr");
  });

  describe("R4: never runs for products, admin or api", () => {
    it("/lettre-pro with en-US and NEXT_LOCALE=en: no redirect, no locale header, anonymous_id still minted", () => {
      const response = proxy(marketingGet("http://demo.example/lettre-pro", { acceptLanguage: "en-US" }));
      expect(response.status).toBe(200);
      expect(response.headers.get("location")).toBeNull();
      expect(response.headers.get("set-cookie")).not.toContain("NEXT_LOCALE");
      expect(forwardedHeader(response, "x-next-intl-locale")).toBeNull();
      expect(response.headers.get("set-cookie")).toContain(`${ANONYMOUS_ID_COOKIE}=`);
    });

    it("/lettre-pro/tool with en-US: no redirect, no NEXT_LOCALE cookie", () => {
      const response = proxy(marketingGet("http://demo.example/lettre-pro/tool", { acceptLanguage: "en-US" }));
      expect(response.status).toBe(200);
      expect(response.headers.get("location")).toBeNull();
      expect(response.headers.get("set-cookie")).not.toContain("NEXT_LOCALE");
    });

    it("/en/lettre-pro is not treated as marketing (falls through to the product path)", () => {
      const response = proxy(marketingGet("http://demo.example/en/lettre-pro", { acceptLanguage: "en-US" }));
      expect(response.status).toBe(200);
      expect(response.headers.get("location")).toBeNull();
      expect(forwardedHeader(response, "x-next-intl-locale")).toBeNull();
    });

    it("/admin with en-US: 307 to /admin/login, unchanged, no locale header", () => {
      const response = proxy(marketingGet("http://demo.example/admin", { acceptLanguage: "en-US" }));
      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toBe("http://demo.example/admin/login");
      expect(forwardedHeader(response, "x-next-intl-locale")).toBeNull();
    });
  });

  describe("matcher additions", () => {
    it.each([
      "http://demo.example/en",
      "http://demo.example/en/making-of",
      "http://demo.example/fr",
      "http://demo.example/making-of",
    ])("matches %s", (url) => {
      expect(unstable_doesMiddlewareMatch({ config, url })).toBe(true);
    });
  });
});
