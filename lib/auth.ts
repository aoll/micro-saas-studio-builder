import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { magicLink } from "better-auth/plugins";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { accounts, magicLinkOutbox, sessions, users, verifications } from "@/lib/db/auth-schema";
import { env } from "@/lib/env";

const ADMIN_ROLES = new Set(["admin", "owner"]);

// The simulated email (docs/08-stack.md): store the link instead of sending
// it. Storing nothing for an admin/owner email means a magic link can never
// grant an admin session (bullet 5), and the response is otherwise
// identical for every email so this cannot be used to enumerate admins.
const sendMagicLink: Parameters<typeof magicLink>[0]["sendMagicLink"] = async ({ email, url }) => {
  const user = await db.query.users.findFirst({ where: eq(users.email, email) });
  if (user && ADMIN_ROLES.has(user.role)) return;
  await db.insert(magicLinkOutbox).values({ email, url });
};

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    usePlural: true,
    schema: { users, sessions, accounts, verifications },
  }),
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  user: {
    additionalFields: {
      role: { type: "string", input: false, defaultValue: "user" },
    },
  },
  emailAndPassword: {
    enabled: true,
    // Only the seeded admin signs in with a password (docs/07); nobody
    // signs up through this form (bullet 4, guarded further in Task 6).
    disableSignUp: true,
  },
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== "/sign-in/email") return;
      const email = (ctx.body as { email?: string } | undefined)?.email;
      const user = email ? await db.query.users.findFirst({ where: eq(users.email, email) }) : undefined;
      if (!user || !ADMIN_ROLES.has(user.role)) {
        // Same message as a bad password: role is never leaked (bullet 4).
        throw new APIError("UNAUTHORIZED", { message: "Invalid email or password" });
      }
    }),
  },
  plugins: [
    magicLink({ sendMagicLink }),
    nextCookies(), // must stay last: docs/09-arborescence.md
  ],
});
