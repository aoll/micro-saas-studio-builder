import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { magicLinkOutbox, users } from "@/lib/db/auth-schema";
import { requireDatabaseUrl } from "@/lib/require-database-url";
import { SEED_ADMIN } from "@/scripts/seed";
import { initialSignupState } from "./_state";

// SA-03 (specs/SA-03-inscription.md), plan tasks 2-4: requestMagicLink
// against the real DB (getProduct reads the seeded lettre-pro, getLatestMagicLink
// reads the real outbox), guardRequest mocked to control ok/refused.

const guardRequest = vi.fn();
vi.mock("@/lib/security", () => ({ guardRequest: (kind: string) => guardRequest(kind) }));

// getProduct is `'use cache'` (docs/04-nextjs.md), unsupported outside a
// `cacheComponents` build (see app/(products)/[app]/api/events/route.test.ts
// for the same pattern): mocked here to a plausible lettre-pro-shaped
// product, never hitting the real cached implementation.
const getProduct = vi.fn();
vi.mock("@/lib/dal/products", () => ({ getProduct: (slug: string) => getProduct(slug) }));

vi.mock("next/headers", () => ({
  headers: async () => new Headers(),
}));

const LETTRE_PRO = { id: "product-1", slug: "lettre-pro", status: "test" };

const sql = postgres(requireDatabaseUrl(), { max: 1, onnotice: () => {} });
const db = drizzle(sql, { schema: { users, magicLinkOutbox } });

const createdEmails: string[] = [];
const uniqueEmail = (label: string) => {
  const email = `${label}-${randomUUID()}@example.test`;
  createdEmails.push(email);
  return email;
};

beforeEach(() => {
  getProduct.mockReset();
  getProduct.mockResolvedValue(LETTRE_PRO);
});

afterEach(() => {
  guardRequest.mockReset();
});

afterAll(async () => {
  if (createdEmails.length) {
    await db.delete(magicLinkOutbox).where(inArray(magicLinkOutbox.email, createdEmails));
    await db.delete(users).where(inArray(users.email, createdEmails));
  }
  await db.delete(magicLinkOutbox).where(eq(magicLinkOutbox.email, SEED_ADMIN.email));
  await sql.end({ timeout: 5 });
});

function formData(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

// A "use server" file may only export async functions: any other export
// (the initial state object did) fails every submission with a 500 (QA1 B2).
describe("signup/_actions module", () => {
  it("exports only async functions", async () => {
    const actions: Record<string, unknown> = await import("./_actions");
    for (const [name, value] of Object.entries(actions)) {
      expect(value, name).toBeTypeOf("function");
      expect((value as () => unknown).constructor.name, name).toBe("AsyncFunction");
    }
  });
});

describe("requestMagicLink: invalid input", () => {
  it("rejects an invalid email without calling the guard or sending anything", async () => {
    guardRequest.mockResolvedValue({ ok: true });
    const { auth } = await import("@/lib/auth");
    const spy = vi.spyOn(auth.api, "signInMagicLink");
    const { requestMagicLink } = await import("./_actions");

    const result = await requestMagicLink("lettre-pro", initialSignupState, formData({ email: "not-an-email" }));

    expect(result).toEqual({ status: "error", error: "invalid_email" });
    expect(guardRequest).not.toHaveBeenCalled();
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("rejects an invalid slug without calling the guard or sending anything", async () => {
    guardRequest.mockResolvedValue({ ok: true });
    const { auth } = await import("@/lib/auth");
    const spy = vi.spyOn(auth.api, "signInMagicLink");
    const { requestMagicLink } = await import("./_actions");

    const result = await requestMagicLink(
      "Not A Valid Slug!",
      initialSignupState,
      formData({ email: uniqueEmail("valid") }),
    );

    expect(result).toEqual({ status: "error", error: "unexpected" });
    expect(guardRequest).not.toHaveBeenCalled();
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe("requestMagicLink: unknown or killed product", () => {
  it("returns 'unexpected' and sends nothing for an unknown product", async () => {
    guardRequest.mockResolvedValue({ ok: true });
    getProduct.mockResolvedValue(null);
    const { auth } = await import("@/lib/auth");
    const spy = vi.spyOn(auth.api, "signInMagicLink");
    const { requestMagicLink } = await import("./_actions");

    const result = await requestMagicLink(
      "unknown-product",
      initialSignupState,
      formData({ email: uniqueEmail("unknown-product") }),
    );

    expect(result).toEqual({ status: "error", error: "unexpected" });
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("returns 'unexpected' and sends nothing for a killed product", async () => {
    guardRequest.mockResolvedValue({ ok: true });
    getProduct.mockResolvedValue({ ...LETTRE_PRO, status: "killed" });
    const { auth } = await import("@/lib/auth");
    const spy = vi.spyOn(auth.api, "signInMagicLink");
    const { requestMagicLink } = await import("./_actions");

    const result = await requestMagicLink(
      "lettre-pro",
      initialSignupState,
      formData({ email: uniqueEmail("killed-product") }),
    );

    expect(result).toEqual({ status: "error", error: "unexpected" });
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe("requestMagicLink: guard refusal", () => {
  it("returns the bot reason and sends nothing", async () => {
    guardRequest.mockResolvedValue({ ok: false, reason: "bot" });
    const { auth } = await import("@/lib/auth");
    const spy = vi.spyOn(auth.api, "signInMagicLink");
    const { requestMagicLink } = await import("./_actions");

    const result = await requestMagicLink(
      "lettre-pro",
      initialSignupState,
      formData({ email: uniqueEmail("guarded") }),
    );

    expect(result).toEqual({ status: "error", error: "bot" });
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("returns the rate_limited reason and calls the guard once with 'signup' before signInMagicLink", async () => {
    guardRequest.mockResolvedValue({ ok: false, reason: "rate_limited" });
    const { requestMagicLink } = await import("./_actions");

    const result = await requestMagicLink(
      "lettre-pro",
      initialSignupState,
      formData({ email: uniqueEmail("guarded2") }),
    );

    expect(result).toEqual({ status: "error", error: "rate_limited" });
    expect(guardRequest).toHaveBeenCalledTimes(1);
    expect(guardRequest).toHaveBeenCalledWith("signup");
  });
});

describe("requestMagicLink: happy path", () => {
  it("sends the link and returns a relative verify URL read from the outbox", async () => {
    guardRequest.mockResolvedValue({ ok: true });
    const email = uniqueEmail("happy");
    const { requestMagicLink } = await import("./_actions");

    const result = await requestMagicLink("lettre-pro", initialSignupState, formData({ email }));

    expect(result.status).toBe("sent");
    if (result.status !== "sent") throw new Error("expected status sent");
    expect(result.email).toBe(email);
    expect(result.magicLinkUrl).toMatch(/^\/api\/auth\/magic-link\/verify\?token=/);
    expect(result.magicLinkUrl).not.toContain("http");
  });

  it("reads the outbox once with the parsed email after sending", async () => {
    guardRequest.mockResolvedValue({ ok: true });
    const email = uniqueEmail("readonce");
    const magicLinkModule = await import("@/lib/dal/magic-link");
    const spy = vi.spyOn(magicLinkModule, "getLatestMagicLink");
    const { requestMagicLink } = await import("./_actions");

    await requestMagicLink("lettre-pro", initialSignupState, formData({ email }));

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(email);
    spy.mockRestore();
  });

  it("returns a null magicLinkUrl for the admin email (no outbox row, no elevation)", async () => {
    guardRequest.mockResolvedValue({ ok: true });
    const { requestMagicLink } = await import("./_actions");

    const result = await requestMagicLink("lettre-pro", initialSignupState, formData({ email: SEED_ADMIN.email }));

    expect(result).toEqual({ status: "sent", email: SEED_ADMIN.email, magicLinkUrl: null });
  });

  it("passes callbackURL and errorCallbackURL derived from the product slug", async () => {
    guardRequest.mockResolvedValue({ ok: true });
    const email = uniqueEmail("callbacks");
    const { auth } = await import("@/lib/auth");
    const spy = vi.spyOn(auth.api, "signInMagicLink");
    const { requestMagicLink } = await import("./_actions");

    await requestMagicLink("lettre-pro", initialSignupState, formData({ email }));

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({
          email,
          callbackURL: "/lettre-pro/signup/complete",
          errorCallbackURL: "/lettre-pro/signup",
        }),
      }),
    );
    spy.mockRestore();
  });

  it("logs and returns 'unexpected' for a generic (infrastructure) send failure", async () => {
    guardRequest.mockResolvedValue({ ok: true });
    const email = uniqueEmail("failure");
    const { auth } = await import("@/lib/auth");
    const infraError = new Error("ECONNREFUSED: could not reach Postgres");
    const authSpy = vi.spyOn(auth.api, "signInMagicLink").mockRejectedValueOnce(infraError);
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { requestMagicLink } = await import("./_actions");

    const result = await requestMagicLink("lettre-pro", initialSignupState, formData({ email }));

    expect(result).toEqual({ status: "error", error: "unexpected" });
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("[signup]"), infraError);

    authSpy.mockRestore();
    consoleSpy.mockRestore();
  });
});
