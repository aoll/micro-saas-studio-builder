import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import { getSession } from "@/lib/dal/session";
import { NavLink } from "./nav-link";
import { SignOutButton } from "./sign-out-button";

// Same admin/owner check as lib/dal/session.ts's requireAdmin, duplicated
// here on purpose: requireAdmin() redirects to /admin/login, which would
// loop when this sidebar renders on the login page itself (it doesn't:
// (backoffice)/layout.tsx wraps /admin/login too). null (not a redirect)
// when there is no admin session.
const ADMIN_ROLES = new Set(["admin", "owner"]);

export async function AdminSidebar() {
  const session = await getSession();
  if (!session || !ADMIN_ROLES.has(session.user.role)) return null;

  const t = await getTranslations("backoffice-shell");
  // app/(backoffice)/layout.tsx only forwards the legacy "backoffice"
  // namespace to its own NextIntlClientProvider (I18N-BACKOFFICE, out of
  // this spec's périmètre): SignOutButton (a client leaf) gets its
  // "backoffice-shell" slice through this small nested provider instead of
  // widening the root one (I18N-BACKOFFICE-STRINGS).
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <nav className="flex w-56 shrink-0 flex-col justify-between border-r bg-card/60 p-4 backdrop-blur">
      <ul className="grid gap-1">
        <li>
          <NavLink href="/admin">{t("nav.portfolio")}</NavLink>
        </li>
        <li>
          <NavLink href="/admin/themes">{t("nav.themes")}</NavLink>
        </li>
        <li>
          <NavLink href="/admin/settings">{t("nav.settings")}</NavLink>
        </li>
      </ul>
      <NextIntlClientProvider locale={locale} messages={{ "backoffice-shell": messages["backoffice-shell"] }}>
        <SignOutButton />
      </NextIntlClientProvider>
    </nav>
  );
}
