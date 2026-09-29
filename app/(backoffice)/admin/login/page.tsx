import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { env } from "@/lib/env";
import { getSession } from "@/lib/dal/session";
import { LoginForm } from "./_components/login-form";

// Same admin/owner check as lib/dal/session.ts's requireAdmin, duplicated
// here on purpose (mirrors components/backoffice/admin-sidebar.tsx): an
// already-authenticated admin/owner hitting /admin/login is sent straight to
// /admin instead of seeing the form again. A role=user session (or none at
// all) still renders the form below, so requireAdmin()'s own redirect back
// to /admin/login from a protected page never loops.
const ADMIN_ROLES = new Set(["admin", "owner"]);

// BO-01 (specs/mockups/BO-01.png). The owner's credentials prefill the form
// when both SEED_OWNER_* variables are set (BO-01, human decision of
// 2026-09-28: easier demo); the admin's never appear.
// I18N-BACKOFFICE-STRINGS: `t.rich` renders the two env var names as
// <code> chunks (literal identifiers, not translated) inside the
// otherwise-translated prose, and interpolates the submit button's own
// translated label.
export default async function LoginPage() {
  const session = await getSession();
  if (session && ADMIN_ROLES.has(session.user.role)) {
    redirect("/admin");
  }

  const t = await getTranslations("backoffice-portfolio");
  const owner =
    env.SEED_OWNER_EMAIL && env.SEED_OWNER_PASSWORD
      ? { email: env.SEED_OWNER_EMAIL, password: env.SEED_OWNER_PASSWORD }
      : undefined;

  return (
    <main className="grid min-h-dvh place-items-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <h1 className="flex items-center gap-2 text-xl font-bold">
            <span aria-hidden="true">◆</span> {t("login.brand")}
          </h1>
          <p className="text-muted-foreground">{t("login.subtitle")}</p>
          {owner ? (
            <p role="note" className="mt-2 rounded-lg bg-secondary px-3 py-2 text-sm text-secondary-foreground">
              {t.rich("login.ownerPrefillNote", {
                email: (chunks) => <code className="font-mono text-xs">{chunks}</code>,
                password: (chunks) => <code className="font-mono text-xs">{chunks}</code>,
                submit: t("login.submit"),
              })}
            </p>
          ) : null}
        </CardHeader>
        <CardContent>
          <LoginForm prefill={owner} />
        </CardContent>
      </Card>
    </main>
  );
}
