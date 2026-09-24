import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { afterAll, describe, expect, it, vi } from "vitest";
import { accounts, users } from "@/lib/db/auth-schema";
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
const db = drizzle(sql, { schema: { users, accounts } });

afterAll(async () => {
  await sql.end({ timeout: 5 });
});

const formData = (fields: Record<string, string>): FormData => {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
};

const uniqueEmail = (label: string) => `${label}-${randomUUID()}@example.test`;

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
    const { login } = await import("./_actions");
    await expect(login({}, formData({ email: SEED_ADMIN.email, password: SEED_ADMIN.password }))).rejects.toThrow(
      "redirect:/admin",
    );
  });
});
