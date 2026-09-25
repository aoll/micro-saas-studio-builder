import { NextRequest } from "next/server";
import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { describe, expect, it } from "vitest";
import { ANONYMOUS_ID_COOKIE, readAnonymousId } from "./app/(products)/[app]/api/events/anonymous-id";
import { config, proxy } from "./proxy";

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
    it.each([
      "http://demo.example/lettre-pro",
      "http://demo.example/lettre-pro/tool",
      "http://demo.example/admin",
      "http://demo.example/admin/products",
      "http://demo.example/admin/login",
      "http://demo.example/admin/ops",
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
      "http://demo.example/",
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
});
