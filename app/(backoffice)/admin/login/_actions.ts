"use server";

import { APIError } from "better-auth/api";
import { getTranslations } from "next-intl/server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { adminLoginSchema } from "@/lib/schemas/admin-login";
import type { ProductConfig } from "@/lib/schemas/product-config";

export type LoginState = { error?: string };
type Locale = ProductConfig["locale"];

// I18N-BACKOFFICE-STRINGS (spec "Server Actions"): `locale` is the action's
// first argument (bound client-side by LoginForm's `login.bind(null,
// locale)`, from useLocale()) — next/root-params isn't available in a
// Server Action, and neither is re-reading the admin_locale cookie here
// (docs/08-stack.md › i18n), so it's received explicitly like every other
// action of this lot. login/page.tsx never calls requireAdmin() (the login
// page must stay reachable without a session), so there is no guard to
// keep getTranslations() after here.
export async function login(locale: Locale, _prevState: LoginState, formData: FormData): Promise<LoginState> {
  const t = await getTranslations({ locale, namespace: "backoffice-portfolio" });
  const genericError = t("login.genericError");

  const parsed = adminLoginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: genericError };

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
      return { error: genericError };
    }
    // Same message for a wrong password and for a role=user account: the
    // auth hook in lib/auth.ts already makes both fail the same way, and
    // this action never distinguishes them either (docs/07-modele-de-donnees.md).
    return { error: genericError };
  }

  redirect("/admin");
}
