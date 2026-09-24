"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

// docs/02-ecrans.md › backoffice navigation: sign out, then leave the
// backoffice entirely (admin session data must not linger on screen).
export function SignOutButton() {
  const router = useRouter();

  async function handleSignOut() {
    await authClient.signOut();
    router.push("/admin/login");
    router.refresh();
  }

  return (
    <Button type="button" variant="outline" onClick={handleSignOut}>
      Se déconnecter
    </Button>
  );
}
