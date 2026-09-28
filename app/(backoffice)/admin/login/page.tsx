import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { env } from "@/lib/env";
import { LoginForm } from "./_components/login-form";

// BO-01 (specs/mockups/BO-01.png). Server Component, no session read: it
// stays static and never loops with the admin guard's redirect (this page
// must stay reachable without a session). The owner's credentials prefill
// the form when both SEED_OWNER_* variables are set (BO-01, human decision
// of 2026-09-28: easier demo); the admin's never appear.
export default function LoginPage() {
  const owner =
    env.SEED_OWNER_EMAIL && env.SEED_OWNER_PASSWORD
      ? { email: env.SEED_OWNER_EMAIL, password: env.SEED_OWNER_PASSWORD }
      : undefined;

  return (
    <main className="grid min-h-dvh place-items-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <h1 className="flex items-center gap-2 text-xl font-bold">
            <span aria-hidden="true">◆</span> SaaS Studio
          </h1>
          <p className="text-muted-foreground">Connexion au backoffice</p>
          {owner ? (
            <p role="note" className="mt-2 rounded-lg bg-secondary px-3 py-2 text-sm text-secondary-foreground">
              Démo : les identifiants du compte owner sont préremplis à partir des variables d&apos;environnement (
              <code className="font-mono text-xs">SEED_OWNER_EMAIL</code>,{" "}
              <code className="font-mono text-xs">SEED_OWNER_PASSWORD</code>) pour faciliter la visite. Il suffit de
              cliquer sur « Se connecter ».
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
