"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

// docs/02-ecrans.md › backoffice navigation: sign out, then leave the
// backoffice entirely (admin session data must not linger on screen).
// Rendered inside its own nested NextIntlClientProvider (admin-sidebar.tsx):
// the root backoffice layout only forwards the legacy "backoffice"
// namespace to the client, so this leaf carries its own "backoffice-shell"
// slice instead (I18N-BACKOFFICE-STRINGS).
export function SignOutButton() {
  const t = useTranslations("backoffice-shell");
  const router = useRouter();

  async function handleSignOut() {
    try {
      const { error } = await authClient.signOut();
      if (error) {
        // Never navigate away on a failed sign-out, and never swallow the
        // error (CLAUDE.md): the admin session may still be active.
        toast.error(t("signOut.error"));
        console.error("[SignOutButton] signOut() returned an error", error);
        return;
      }
    } catch (error) {
      toast.error(t("signOut.error"));
      console.error("[SignOutButton] signOut() threw", error);
      return;
    }

    router.push("/admin/login");
    router.refresh();
  }

  return (
    <Button type="button" variant="outline" onClick={handleSignOut}>
      {t("signOut.button")}
    </Button>
  );
}
