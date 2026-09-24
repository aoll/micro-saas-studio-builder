import { randomUUID } from "node:crypto";
import { desc, eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { afterAll, describe, expect, it, vi } from "vitest";
import { auth } from "@/lib/auth";
import { sessions, users } from "@/lib/db/auth-schema";
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

let currentHeaders = new Headers();
vi.mock("next/headers", () => ({
  headers: async () => currentHeaders,
}));

const sql = postgres(requireDatabaseUrl(), { max: 1, onnotice: () => {} });
const db = drizzle(sql, { schema: { users, sessions } });

const createdEmails: string[] = [];
const uniqueEmail = (label: string) => {
  const email = `${label}-${randomUUID()}@example.test`;
  createdEmails.push(email);
  return email;
};

afterAll(async () => {
  // Deleting a user cascades its sessions (onDelete: "cascade"): this also
  // removes the swapped session row from swapSessionToRoleUser below.
  if (createdEmails.length) await db.delete(users).where(inArray(users.email, createdEmails));
  // Signing SEED_ADMIN in for real leaves extra session rows for it: seed.ts
  // never inserts a session, so every row here is a test artifact, safe to
  // clear without touching the SEED_ADMIN user/account row itself.
  const admin = await db.query.users.findFirst({ where: eq(users.email, SEED_ADMIN.email) });
  if (admin) await db.delete(sessions).where(eq(sessions.userId, admin.id));
  await sql.end({ timeout: 5 });
});

/** Signs a user in through Better Auth and returns a Headers with the resulting session cookie. */
const cookieHeadersFor = async (email: string, password: string): Promise<Headers> => {
  const response = await auth.api.signInEmail({
    body: { email, password },
    headers: new Headers(),
    asResponse: true,
  });
  const cookie = response.headers
    .getSetCookie()
    .map((entry) => entry.split(";")[0])
    .join("; ");
  const headers = new Headers();
  headers.set("cookie", cookie);
  return headers;
};

/** Points the newest session row for `email` at a freshly created role=user account. */
const swapSessionToRoleUser = async (email: string): Promise<void> => {
  const admin = await db.query.users.findFirst({ where: eq(users.email, email) });
  const [session] = await db
    .select()
    .from(sessions)
    .where(eq(sessions.userId, admin!.id))
    .orderBy(desc(sessions.createdAt))
    .limit(1);

  const plainUserId = randomUUID();
  await db
    .insert(users)
    .values({ id: plainUserId, name: "Plain user", email: uniqueEmail("plain-user"), role: "user" });
  await db.update(sessions).set({ userId: plainUserId }).where(eq(sessions.id, session!.id));
};

describe("getSession", () => {
  it("returns null without a cookie", async () => {
    currentHeaders = new Headers();
    const { getSession } = await import("./session");
    expect(await getSession()).toBeNull();
  });

  it("returns the session for the seeded admin", async () => {
    currentHeaders = await cookieHeadersFor(SEED_ADMIN.email, SEED_ADMIN.password);
    const { getSession } = await import("./session");
    const session = await getSession();
    expect(session?.user.email).toBe(SEED_ADMIN.email);
    expect(session?.user.role).toBe("admin");
  });
});

describe("requireAdmin", () => {
  it("redirects to /admin/login without a session", async () => {
    currentHeaders = new Headers();
    const { requireAdmin } = await import("./session");
    await expect(requireAdmin()).rejects.toThrow("redirect:/admin/login");
  });

  it("redirects to /admin/login for a role=user session", async () => {
    // The password guard in lib/auth.ts already blocks role=user at
    // sign-in (lib/auth.test.ts); requireAdmin() must also refuse a
    // role=user session on its own, the way a session created by another
    // path (or a hand-crafted cookie) would look. Signing the admin in for
    // a real, validly-signed cookie, then swapping the session row to a
    // freshly created role=user account, exercises exactly that: same
    // cookie, same signature, different user underneath.
    currentHeaders = await cookieHeadersFor(SEED_ADMIN.email, SEED_ADMIN.password);
    await swapSessionToRoleUser(SEED_ADMIN.email);

    const { requireAdmin } = await import("./session");
    await expect(requireAdmin()).rejects.toThrow("redirect:/admin/login");
  });

  it("returns the session for an admin", async () => {
    currentHeaders = await cookieHeadersFor(SEED_ADMIN.email, SEED_ADMIN.password);
    const { requireAdmin } = await import("./session");
    const session = await requireAdmin();
    expect(session.user.role).toBe("admin");
  });
});
