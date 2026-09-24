"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

const SIGN_OUT_ERROR = "Impossible de se déconnecter";

// docs/02-ecrans.md › backoffice navigation: sign out, then leave the
// backoffice entirely (admin session data must not linger on screen).
export function SignOutButton() {
  const router = useRouter();

  async function handleSignOut() {
    try {
      const { error } = await authClient.signOut();
      if (error) {
        // Never navigate away on a failed sign-out, and never swallow the
        // error (CLAUDE.md): the admin session may still be active.
        toast.error(SIGN_OUT_ERROR);
        console.error("[SignOutButton] signOut() returned an error", error);
        return;
      }
    } catch (error) {
      toast.error(SIGN_OUT_ERROR);
      console.error("[SignOutButton] signOut() threw", error);
      return;
    }

    router.push("/admin/login");
    router.refresh();
  }

  return (
    <Button type="button" variant="outline" onClick={handleSignOut}>
      Se déconnecter
    </Button>
  );
}
