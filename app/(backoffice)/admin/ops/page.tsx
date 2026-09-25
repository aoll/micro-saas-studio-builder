import { notFound } from "next/navigation";
import { getSession, requireAdmin } from "@/lib/dal/session";
import { ResetForm } from "./_components/reset-form";

// A 60s timeout for the reset Server Action invoked from this page
// (resetDemoAction wipes and reseeds usage across 3 products, longer than
// the default action timeout might allow): the route segment config
// applies here rather than on `_actions.ts` itself — a build spike
// (plan's orchestrator decision 6) showed Turbopack rejects any
// non-async export from a `'use server'` file, `export const maxDuration`
// included.
export const maxDuration = 60;

// specs/DEMO-mode.md: not `ops/_ops` (a `_`-prefixed segment is never
// routable, docs/09-arborescence.md), reserved to the `owner` role, 404
// for anyone else — including a role="admin" caller, who gets a real
// admin session but is still not this repo's `owner` (docs/07 › `users`).
// No link anywhere points here: it stays "cachée" by omission.
export default async function OpsPage() {
  const session = await getSession();
  if (session?.user.role !== "owner") {
    notFound();
  }
  // Kept even though the check above is already stricter (require-admin
  // coverage test, app/(backoffice)/admin/require-admin-coverage.test.ts):
  // every /admin page calls requireAdmin() itself.
  await requireAdmin();

  return (
    <main className="mx-auto grid max-w-xl gap-6 p-6">
      <h1 className="text-2xl font-semibold">Opérations</h1>
      <p className="text-sm text-muted-foreground">
        Supprime les produits créés par les visiteurs et toute l&apos;activité, puis rejoue le seed (thèmes, LettrePro,
        DescriPro, NomDeMarque, comptes admin et owner, seuils par défaut).
      </p>
      <ResetForm />
    </main>
  );
}
