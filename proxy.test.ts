import { NextRequest } from "next/server";
import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { describe, expect, it } from "vitest";
import { ANONYMOUS_ID_COOKIE, readAnonymousId } from "./app/(products)/[app]/api/events/anonymous-id";
import { config, proxy } from "./proxy";

function get(url: string, options: { method?: string; cookie?: string } = {}) {
  const headers = new Headers();
  if (options.cookie) headers.set("cookie", `${ANONYMOUS_ID_COOKIE}=${options.cookie}`);
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
    it.each(["http://demo.example/lettre-pro", "http://demo.example/lettre-pro/tool"])("matches %s", (url) => {
      expect(unstable_doesMiddlewareMatch({ config, url })).toBe(true);
    });

    it.each([
      "http://demo.example/admin",
      "http://demo.example/admin/products",
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
