import "server-only";
import type { Route } from "next";
import { notFound, redirect } from "next/navigation";
import { claimSignupBonus } from "./_lib/claim";

// SA-03 (specs/SA-03-inscription.md), plan step 3: Better Auth's magic-link
// `callbackURL` for this flow. It verifies the token, sets the session
// cookie itself (nextCookies plugin, lib/auth.ts), then redirects here
// (plain GET, no user-supplied body to validate).
//
// Refactored by QA1-P1-Q2 (specs/qa/QA1-P1-Q2-inscription-par-produit.md,
// plan step 2, behavior-preserving) to delegate the "resolve product ->
// resolve session -> grant bonus -> track signup" logic to the shared
// claimSignupBonus helper (_lib/claim.ts), now also used by the new
// cross-product Server Action. The three branches below are unchanged.
export async function GET(_request: Request, { params }: RouteContext<"/[app]/signup/complete">) {
  const { app: slug } = await params;
  const result = await claimSignupBonus(slug);

  if (result.status === "not_found") notFound();
  if (result.status === "no_session") redirect(`/${slug}/signup` as Route);

  redirect(`/${slug}/tool` as Route);
}
