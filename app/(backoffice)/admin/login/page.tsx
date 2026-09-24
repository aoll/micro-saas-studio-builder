import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { LoginForm } from "./_components/login-form";

// BO-01 (specs/mockups/BO-01.png). Server Component, no session read: it
// stays static and never loops with requireAdmin()'s redirect.
export default function LoginPage() {
  return (
    <main className="grid min-h-dvh place-items-center bg-muted p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <h1 className="flex items-center gap-2 text-xl font-bold">
            <span aria-hidden="true">◆</span> SaaS Studio
          </h1>
          <p className="text-muted-foreground">Connexion au backoffice</p>
        </CardHeader>
        <CardContent>
          <LoginForm />
        </CardContent>
      </Card>
    </main>
  );
}
