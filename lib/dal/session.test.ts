import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
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
// QA1-P1-B14 (.claude/plans/QA1-P1-B14.plan.md, step 1): both mocks record
// their call into the same array, so a test can assert `io()` (the fix for
// "unstable value new Date() while prerendering", .claude/qa/reports/2026-09-25-full.md
// › B14) runs before headers() — before the sync IO Better Auth performs
// internally inside auth.api.getSession, per node_modules/next/dist/docs/…/io.md
// ("call io() before reading a value").
const ioOrder: string[] = [];
vi.mock("next/cache", () => ({
  io: async () => {
    ioOrder.push("io");
  },
}));
vi.mock("next/headers", () => ({
  headers: async () => {
    ioOrder.push("headers");
    return currentHeaders;
  },
}));

const sql = postgres(requireDatabaseUrl(), { max: 1, onnotice: () => {} });
const db = drizzle(sql, { schema: { users, sessions } });

const createdEmails: string[] = [];
const uniqueEmail = (label: string) => {
  const email = `${label}-${randomUUID()}@example.test`;
  createdEmails.push(email);
  return email;
};

// Session tokens created by this file for SEED_ADMIN, tracked precisely so
// afterAll deletes only the rows this file created. lib/auth.test.ts and
// admin/login/_actions.test.ts sign the same seeded admin in concurrently
// (separate worker threads, shared worktree DB): a blanket
// `delete(sessions).where(eq(sessions.userId, admin.id))` here would also
// remove sessions those files are mid-assertion on (and vice versa), a real
// observed flake (a concurrent file's blanket delete removed the row this
// file was about to read).
const createdAdminSessionTokens: string[] = [];

afterAll(async () => {
  // Deleting a user cascades its sessions (onDelete: "cascade"): this also
  // removes the swapped session row from swapSessionToRoleUser below.
  if (createdEmails.length) await db.delete(users).where(inArray(users.email, createdEmails));
  if (createdAdminSessionTokens.length) {
    await db.delete(sessions).where(inArray(sessions.token, createdAdminSessionTokens));
  }
  await sql.end({ timeout: 5 });
});

/** Signs a user in through Better Auth and returns a Headers with the resulting session cookie. */
const cookieHeadersFor = async (email: string, password: string): Promise<Headers> => {
  const response = await auth.api.signInEmail({
    body: { email, password },
    headers: new Headers(),
    asResponse: true,
  });
  // The response body carries the plain session token (see better-auth's
  // sign-in route), the same value stored in `sessions.token`: reading it
  // here identifies exactly the session this call created, no query by
  // user id and recency needed (and no race with concurrent sign-ins).
  const body = (await response.clone().json()) as { token: string };
  createdAdminSessionTokens.push(body.token);
  const cookie = response.headers
    .getSetCookie()
    .map((entry) => entry.split(";")[0])
    .join("; ");
  const headers = new Headers();
  headers.set("cookie", cookie);
  return headers;
};

/** Points the session created by the most recent cookieHeadersFor() call at a freshly created role=user account. */
const swapSessionToRoleUser = async (): Promise<void> => {
  const token = createdAdminSessionTokens.at(-1);
  const [session] = await db.select().from(sessions).where(eq(sessions.token, token!)).limit(1);

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

  it("calls io() before reading headers(), so any sync IO inside auth.api.getSession stays outside the static shell", async () => {
    currentHeaders = new Headers();
    ioOrder.length = 0;
    const { getSession } = await import("./session");
    await getSession();
    expect(ioOrder).toEqual(["io", "headers"]);
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
    await swapSessionToRoleUser();

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
