import { getSession } from "@/lib/dal/session";
import { ClaimCrossProductBonus } from "./claim-cross-product-bonus";

// QA1-P1-Q2 (specs/qa/QA1-P1-Q2-inscription-par-produit.md), plan step 5:
// streamed under its own <Suspense> in the product layout (step 6), same
// pattern as components/product/header-balance.tsx -- the only part of
// this gate that reads the session, so the rest of the page (including the
// statically pre-rendered landing) stays unaffected. Renders nothing for
// an anonymous visitor: the client leaf never mounts, so it never runs in
// the pre-rendered shell either.
export async function CrossProductSignupBonus({ slug }: { slug: string }) {
  const session = await getSession();
  if (!session) return null;

  return <ClaimCrossProductBonus slug={slug} />;
}
