import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { afterAll, describe, expect, it } from "vitest";
import { accounts, magicLinkOutbox, sessions, users } from "@/lib/db/auth-schema";
import { requireDatabaseUrl } from "@/lib/require-database-url";
import { SEED_ADMIN } from "@/scripts/seed";
import { auth } from "./auth";

const sql = postgres(requireDatabaseUrl(), { max: 1, onnotice: () => {} });
const db = drizzle(sql, { schema: { users, accounts, magicLinkOutbox, sessions } });

// Every email this file creates a row for (user, account or outbox entry),
// tracked so afterAll can clean them up without ever touching `demo` or
// SEED_ADMIN.
const createdEmails: string[] = [];
const uniqueEmail = (label: string) => {
  const email = `${label}-${randomUUID()}@example.test`;
  createdEmails.push(email);
  return email;
};

// Session tokens created by this file for SEED_ADMIN, tracked precisely so
// afterAll deletes only the rows this file created. lib/dal/session.test.ts
// and admin/login/_actions.test.ts sign the same seeded admin in
// concurrently (separate worker threads, shared worktree DB): a blanket
// `delete(sessions).where(eq(sessions.userId, admin.id))` here would also
// remove sessions those files are mid-assertion on, and vice versa (a real
// observed flake in lib/dal/session.test.ts).
const createdAdminSessionTokens: string[] = [];

afterAll(async () => {
  // Deleting a user cascades its accounts and sessions (onDelete: "cascade").
  if (createdEmails.length) await db.delete(users).where(inArray(users.email, createdEmails));
  await db.delete(magicLinkOutbox).where(inArray(magicLinkOutbox.email, createdEmails));
  if (createdAdminSessionTokens.length) {
    await db.delete(sessions).where(inArray(sessions.token, createdAdminSessionTokens));
  }
  await sql.end({ timeout: 5 });
});

describe("auth plugins", () => {
  it("registers magic-link and ends with next-cookies", () => {
    const ids = auth.options.plugins?.map((plugin) => plugin.id) ?? [];
    expect(ids).toContain("magic-link");
    expect(ids[ids.length - 1]).toBe("next-cookies");
  });

  it("enables email+password sign-in without public sign-up", () => {
    expect(auth.options.emailAndPassword?.enabled).toBe(true);
    expect(auth.options.emailAndPassword?.disableSignUp).toBe(true);
  });
});

describe("password sign-in, admins only", () => {
  it("signs the seeded admin in with a session carrying role=admin", async () => {
    const result = await auth.api.signInEmail({
      body: { email: SEED_ADMIN.email, password: SEED_ADMIN.password },
      headers: new Headers(),
    });
    createdAdminSessionTokens.push(result.token);
    expect(result.user.role).toBe("admin");
  });

  it("rejects a wrong password for the admin", async () => {
    await expect(
      auth.api.signInEmail({
        body: { email: SEED_ADMIN.email, password: "not-the-password" },
        headers: new Headers(),
      }),
    ).rejects.toThrow();
  });

  it("rejects a role=user account with the correct password, creating no session", async () => {
    // Sign-up is disabled at the API (bullet 4/5), so a plain user account is
    // created directly, the same way the seed creates the admin account.
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

    await expect(auth.api.signInEmail({ body: { email, password }, headers: new Headers() })).rejects.toThrow();
  });
});

describe("sendMagicLink", () => {
  it("stores the link in the outbox instead of sending it", async () => {
    const email = uniqueEmail("magic");
    await auth.api.signInMagicLink({ body: { email }, headers: new Headers() });

    const rows = await db.select().from(magicLinkOutbox).where(eq(magicLinkOutbox.email, email));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.url).toContain("/api/auth/magic-link/verify?token=");
  });

  it("stores nothing for an admin or owner email (no elevation, no enumeration)", async () => {
    await auth.api.signInMagicLink({ body: { email: SEED_ADMIN.email }, headers: new Headers() });

    const rows = await db.select().from(magicLinkOutbox).where(eq(magicLinkOutbox.email, SEED_ADMIN.email));
    expect(rows).toHaveLength(0);
  });
});
