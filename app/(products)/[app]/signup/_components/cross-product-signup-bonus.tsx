import { getSession } from "@/lib/dal/session";
import { ClaimCrossProductBonus } from "./claim-cross-product-bonus";

// QA1-P1-Q2 (specs/qa/QA1-P1-Q2-inscription-par-produit.md), plan step 5:
// streamed under its own <Suspense> in the product layout (step 6), same
// pattern as components/product/header-balance.tsx -- the only part of
// this gate that reads the session, so the rest of the page (including the
// statically pre-rendered landing) stays unaffected. Renders nothing for
// an anonymous visitor: the client leaf never mounts, so it never runs in
// the pre-rendered shell either.
//
// Security review follow-up (MEDIUM): only a `role: 'user'` session
// auto-claims a bonus here. The backoffice's admin and owner roles share
// Better Auth's session with the sub-apps (docs/07's `users.role`): without
// this check, browsing a product's pages while signed into /admin would
// silently grant a bonus and a signup event on every product visited,
// polluting the funnel (and, during a public demo, docs/01's "Mode démo
// public", crediting accounts never meant to buy anything). The explicit
// magic-link path (signup/complete/route.ts) is unaffected -- it already
// accepts any signed-in user reaching that URL (SA-03 review round), and
// stays that way.
export async function CrossProductSignupBonus({ slug }: { slug: string }) {
  const session = await getSession();
  if (!session || session.user.role !== "user") return null;

  return <ClaimCrossProductBonus slug={slug} />;
}
