import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { afterAll, describe, expect, it, vi } from "vitest";
import { accounts, sessions, users } from "@/lib/db/auth-schema";
import { requireDatabaseUrl } from "@/lib/require-database-url";
import { SEED_ADMIN } from "@/scripts/seed";

class RedirectMarker extends Error {
  constructor(public url: string) {
    super(`redirect:${url}`);
  }
}

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new RedirectMarker(url);
  },
}));

vi.mock("next/headers", () => ({
  headers: async () => new Headers(),
}));

const sql = postgres(requireDatabaseUrl(), { max: 1, onnotice: () => {} });
const db = drizzle(sql, { schema: { users, accounts, sessions } });

const createdEmails: string[] = [];
const uniqueEmail = (label: string) => {
  const email = `${label}-${randomUUID()}@example.test`;
  createdEmails.push(email);
  return email;
};

// Session tokens created by this file for SEED_ADMIN, tracked precisely so
// afterAll deletes only the rows this file created. lib/dal/session.test.ts
// and lib/auth.test.ts sign the same seeded admin in concurrently (separate
// worker threads, shared worktree DB): a blanket
// `delete(sessions).where(eq(sessions.userId, admin.id))` here would also
// remove sessions those files are mid-assertion on, and vice versa (a real
// observed flake in lib/dal/session.test.ts).
const createdAdminSessionTokens: string[] = [];

afterAll(async () => {
  // Deleting a user cascades its accounts and sessions (onDelete: "cascade").
  if (createdEmails.length) await db.delete(users).where(inArray(users.email, createdEmails));
  if (createdAdminSessionTokens.length) {
    await db.delete(sessions).where(inArray(sessions.token, createdAdminSessionTokens));
  }
  await sql.end({ timeout: 5 });
});

const formData = (fields: Record<string, string>): FormData => {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
};

describe("login action", () => {
  it("returns an error without calling auth for an invalid email", async () => {
    const { auth } = await import("@/lib/auth");
    const spy = vi.spyOn(auth.api, "signInEmail");
    const { login } = await import("./_actions");

    const result = await login({}, formData({ email: "not-an-email", password: "whatever" }));
    expect(result.error).toBeTruthy();
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("returns an error without calling auth for an empty password", async () => {
    const { auth } = await import("@/lib/auth");
    const spy = vi.spyOn(auth.api, "signInEmail");
    const { login } = await import("./_actions");

    const result = await login({}, formData({ email: "someone@example.test", password: "" }));
    expect(result.error).toBeTruthy();
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("returns a generic error for bad credentials", async () => {
    const { login } = await import("./_actions");
    const result = await login({}, formData({ email: SEED_ADMIN.email, password: "not-the-password" }));
    expect(result.error).toBe("Identifiants invalides");
  });

  it("returns the same generic error for a role=user account", async () => {
    const email = uniqueEmail("plain-user");
    const password = "correct-horse-battery-staple";
    const userId = randomUUID();
    await db.insert(users).values({ id: userId, name: "Plain user", email, role: "user" });
    await db.insert(accounts).values({
      id: randomUUID(),
      accountId: userId,
      providerId: "credential",
      userId,
      password: await hashPassword(password),
    });

    const { login } = await import("./_actions");
    const result = await login({}, formData({ email, password }));
    expect(result.error).toBe("Identifiants invalides");
  });

  it("redirects to /admin for the seeded admin", async () => {
    const { auth } = await import("@/lib/auth");
    // Wrap (not mock) signInEmail so the real session gets created as
    // before, and its token captured for a precise afterAll cleanup instead
    // of a blanket delete of every session for this admin.
    const original = auth.api.signInEmail.bind(auth.api);
    const spy = vi.spyOn(auth.api, "signInEmail").mockImplementation(async (...args) => {
      const result = await original(...args);
      createdAdminSessionTokens.push((result as { token: string }).token);
      return result;
    });
    const { login } = await import("./_actions");

    await expect(login({}, formData({ email: SEED_ADMIN.email, password: SEED_ADMIN.password }))).rejects.toThrow(
      "redirect:/admin",
    );

    spy.mockRestore();
  });

  it("logs and still returns the generic error for a non-auth (infrastructure) failure", async () => {
    const { auth } = await import("@/lib/auth");
    const infraError = new Error("ECONNREFUSED: could not reach Postgres");
    const authSpy = vi.spyOn(auth.api, "signInEmail").mockRejectedValueOnce(infraError);
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { login } = await import("./_actions");

    const result = await login({}, formData({ email: SEED_ADMIN.email, password: SEED_ADMIN.password }));

    expect(result.error).toBe("Identifiants invalides");
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("admin/login"), infraError);

    authSpy.mockRestore();
    consoleSpy.mockRestore();
  });

  it("returns the same generic error for an unknown email", async () => {
    const { login } = await import("./_actions");
    const result = await login({}, formData({ email: uniqueEmail("unknown"), password: "whatever-password" }));
    expect(result.error).toBe("Identifiants invalides");
  });

  it("never names the faulty field: wrong password, unknown email and invalid input give the exact same error", async () => {
    const { login } = await import("./_actions");

    const wrongPassword = await login({}, formData({ email: SEED_ADMIN.email, password: "not-the-password" }));
    const unknownEmail = await login({}, formData({ email: uniqueEmail("unknown"), password: "whatever-password" }));
    const invalidInput = await login({}, formData({ email: "not-an-email", password: "whatever" }));

    expect(wrongPassword.error).toBe(unknownEmail.error);
    expect(unknownEmail.error).toBe(invalidInput.error);
    for (const result of [wrongPassword, unknownEmail, invalidInput]) {
      expect(result.error).toBeTruthy();
      expect(result.error).not.toMatch(/email|mot de passe|password/i);
    }
  });
});
