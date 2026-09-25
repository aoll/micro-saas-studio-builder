import "server-only";
import { cookies } from "next/headers";
import { after } from "next/server";
import { grantSignupBonus } from "@/lib/dal/credits";
import { track } from "@/lib/dal/events";
import { getProduct } from "@/lib/dal/products";
import { getSession } from "@/lib/dal/session";
import { ANONYMOUS_ID_COOKIE, readAnonymousId } from "../../../api/events/anonymous-id";

// QA1-P1-Q2 (specs/qa/QA1-P1-Q2-inscription-par-produit.md), plan step 1:
// the "resolve product -> resolve session -> grant bonus -> track signup"
// logic shared by signup/complete/route.ts (SA-03's magic-link redirect
// target, unchanged behavior) and the new claimSignupBonus Server Action
// (plan step 3, fired automatically for a session that is already
// connected but has never signed up on this product, QA scenario 5.10.4).
// No new DAL export: only the already-idempotent grantSignupBonus and
// track (their own idempotency keys, lib/dal/credits.ts and
// lib/dal/events.ts), unchanged.
export type ClaimResult = { status: "not_found" } | { status: "no_session" } | { status: "granted"; balance: number };

export async function claimSignupBonus(slug: string): Promise<ClaimResult> {
  const product = await getProduct(slug);
  if (!product || product.status === "killed") return { status: "not_found" };

  const session = await getSession();
  if (!session) return { status: "no_session" };

  // Credits are per (user, product) — every SaaS is independent for the
  // user (docs/01-produit.md, docs/07-modele-de-donnees.md) — and
  // grantSignupBonus is idempotent (its own key, lib/dal/credits.ts): a
  // session already signed in elsewhere gets at most the same
  // once-per-product bonus that filling out this product's own signup form
  // would grant, no more.
  const { balance } = await grantSignupBonus({ userId: session.user.id, productId: product.id });

  // The anonymous cookie set by a prior anonymous generation or visit
  // (docs/04-nextjs.md, shared with api/generate and api/events): a
  // tampered or missing cookie reads as null (readAnonymousId), never
  // thrown.
  const cookieStore = await cookies();
  const anonymousId = readAnonymousId(cookieStore.get(ANONYMOUS_ID_COOKIE)?.value);
  const userId = session.user.id;
  const productId = product.id;

  after(async () => {
    await track({ type: "signup", productId, userId, anonymousId });
  });

  return { status: "granted", balance };
}
