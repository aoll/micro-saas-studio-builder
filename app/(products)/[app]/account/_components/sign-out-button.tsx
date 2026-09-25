"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

// SA-07 (plan's design decision 4): a product-scoped sign-out leaf,
// mirroring components/backoffice/sign-out-button.tsx with the same
// authClient, redirecting to the product landing instead of the backoffice
// login page. `replace`, not `push`: signing out shouldn't leave the
// account page reachable via the back button once the session is gone.
export function AccountSignOutButton({ slug }: { slug: string }) {
  const t = useTranslations("account");
  const router = useRouter();

  async function handleSignOut() {
    try {
      const { error } = await authClient.signOut();
      if (error) {
        // Never navigate away on a failed sign-out, and never swallow the
        // error (CLAUDE.md): the session may still be active.
        toast.error(t("signOut.error"));
        console.error("[AccountSignOutButton] signOut() returned an error", error);
        return;
      }
    } catch (error) {
      toast.error(t("signOut.error"));
      console.error("[AccountSignOutButton] signOut() threw", error);
      return;
    }

    router.replace(`/${slug}`);
    router.refresh();
  }

  return (
    <Button type="button" variant="outline" onClick={handleSignOut}>
      {t("signOut.button")}
    </Button>
  );
}
