import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { anonymousIdCookie, readAnonymousId } from "./anonymous-id";

describe("readAnonymousId", () => {
  it("returns a valid v4 uuid unchanged", () => {
    const id = randomUUID();
    expect(readAnonymousId(id)).toBe(id);
  });

  it.each([undefined, "", "not-a-uuid"])("returns null for %s", (value) => {
    expect(readAnonymousId(value)).toBeNull();
  });

  // QA1-P1-B4 plan step 6: a well-formed but degenerate uuid (all zeros or
  // all ones) is syntactically valid per z.uuid() but never a real
  // identity — reading it back as "no cookie" keeps the same server-issued
  // guarantee proxy.ts relies on.
  it.each(["00000000-0000-0000-0000-000000000000", "ffffffff-ffff-ffff-ffff-ffffffffffff"])(
    "returns null for the degenerate uuid %s",
    (value) => {
      expect(readAnonymousId(value)).toBeNull();
    },
  );
});

describe("anonymousIdCookie", () => {
  it("builds a one-year, HttpOnly, Path=/, SameSite=Lax cookie", () => {
    const id = randomUUID();
    const cookie = anonymousIdCookie(id, false);

    expect(cookie).toMatchObject({
      name: "anonymous_id",
      value: id,
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      secure: false,
    });
  });

  it("marks the cookie secure when asked", () => {
    expect(anonymousIdCookie(randomUUID(), true).secure).toBe(true);
  });
});
