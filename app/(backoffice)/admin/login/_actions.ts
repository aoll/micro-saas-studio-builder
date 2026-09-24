"use server";

import { APIError } from "better-auth/api";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { adminLoginSchema } from "@/lib/schemas/admin-login";

export type LoginState = { error?: string };

const GENERIC_ERROR = "Identifiants invalides";

export async function login(_prevState: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = adminLoginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: GENERIC_ERROR };

  try {
    await auth.api.signInEmail({ body: parsed.data, headers: await headers() });
  } catch (err) {
    if (!(err instanceof APIError)) {
      // An infrastructure failure (DB outage, network error…), not an auth
      // rejection: the auth hook in lib/auth.ts and Better Auth itself only
      // ever throw APIError for a wrong password or a role=user account.
      // Log it server-side with context instead of swallowing it silently;
      // the UI still gets the same generic message, never a stack trace.
      console.error("[admin/login] unexpected error during sign-in", err);
      return { error: GENERIC_ERROR };
    }
    // Same message for a wrong password and for a role=user account: the
    // auth hook in lib/auth.ts already makes both fail the same way, and
    // this action never distinguishes them either (docs/07-modele-de-donnees.md).
    return { error: GENERIC_ERROR };
  }

  redirect("/admin");
}
