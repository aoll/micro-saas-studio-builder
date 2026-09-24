import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { auth } from "@/lib/auth";

// Frozen contract (specs/SETUP-skeleton.md): signatures stay as-is for
// every spec built on top of the backoffice.
export type Session = typeof auth.$Infer.Session;

const ADMIN_ROLES = new Set(["admin", "owner"]);

export const getSession = cache(async (): Promise<Session | null> => {
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
