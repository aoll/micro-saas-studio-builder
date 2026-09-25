import "server-only";
import { io } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { auth } from "@/lib/auth";

// Frozen contract (specs/SETUP-skeleton.md): signatures stay as-is for
// every spec built on top of the backoffice.
export type Session = typeof auth.$Infer.Session;

const ADMIN_ROLES = new Set(["admin", "owner"]);

// QA1-P1-B14 (.claude/plans/QA1-P1-B14.plan.md): auth.api.getSession() calls
// `new Date()` internally (Better Auth's own expiry check), which Cache
// Components flags as "unstable value new Date() while prerendering" even
// though headers() is already awaited first — the "postpone" signal from a
// Request-time API isn't guaranteed to unwind through arbitrary library
// code. `await io()` as the very first statement (node_modules/next/dist/docs/…
// /io.md) excludes everything after it from the static shell regardless,
// and resolves immediately outside prerendering (real requests, Server
// Actions, Route Handlers, Vitest), so no behaviour change for any caller.
export const getSession = cache(async (): Promise<Session | null> => {
  await io();
  const session = await auth.api.getSession({ headers: await headers() });
  return session ?? null;
});

export async function requireAdmin(): Promise<Session> {
  const session = await getSession();
  if (!session || !ADMIN_ROLES.has(session.user.role)) {
    redirect("/admin/login");
  }
  return session;
}
