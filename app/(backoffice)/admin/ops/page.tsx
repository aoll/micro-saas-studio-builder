import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
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

// QA1-P2-N1: OpsPage itself stays synchronous, with no top-level `await`.
// getSession()/requireAdmin() read the session (io() + cookies()/headers(),
// lib/dal/session.ts) — a request-time read that Cache Components can't
// prerender into the route's static shell. Read directly here, it broke
// navigation prerendering ("uncached data during prerendering or a
// navigation … accessed outside of `<Suspense>`", reproduced on the dev
// server against an RSC prefetch of /admin/ops). Pushed into <OpsGate>
// under <Suspense> instead, matching the framework's own pattern (docs/04
// › Rendu et cache; node_modules/next/dist/docs/01-app/02-guides/
// authentication-with-cache-components.md › "Show the user without
// blocking the page").
export default function OpsPage() {
  return (
    <main className="mx-auto grid max-w-xl gap-6 p-6">
      <Suspense fallback={<OpsFallback />}>
        <OpsGate />
      </Suspense>
    </main>
  );
}

// I18N-BACKOFFICE-STRINGS: a plain Server Component (like
// components/product/demo-banner.tsx), so `useTranslations` from
// "next-intl" (not "next-intl/server") reads the ambient per-request
// config synchronously — no need to make this fallback itself async.
function OpsFallback() {
  const t = useTranslations("backoffice-portfolio");
  return <p className="text-sm text-muted-foreground">{t("ops.loading")}</p>;
}

// specs/DEMO-mode.md: not `ops/_ops` (a `_`-prefixed segment is never
// routable, docs/09-arborescence.md), reserved to the `owner` role, 404
// for anyone else — including a role="admin" caller, who gets a real
// admin session but is still not this repo's `owner` (docs/07 › `users`).
// No link anywhere points here: it stays "cachée" by omission.
async function OpsGate() {
  const session = await getSession();
  if (session?.user.role !== "owner") {
    notFound();
  }
  // Not dead code: the owner check above already 404s anyone who isn't
  // `owner`, but this still defends in depth on the owner path itself
  // (an owner session that somehow fails requireAdmin's own check —
  // e.g. expired between the two calls — is redirected to /admin/login
  // instead of falling through). It's also what keeps every /admin page
  // calling requireAdmin() itself true (require-admin coverage test,
  // app/(backoffice)/admin/require-admin-coverage.test.ts, which reads
  // this whole file's source, not just OpsPage's own body).
  await requireAdmin();
  const t = await getTranslations("backoffice-portfolio");

  return (
    <>
      <h1 className="text-2xl font-semibold">{t("ops.title")}</h1>
      <p className="text-sm text-muted-foreground">{t("ops.description")}</p>
      <ResetForm />
    </>
  );
}
