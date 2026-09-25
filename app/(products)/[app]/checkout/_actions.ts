"use server";

import { unstable_rethrow } from "next/navigation";
import { after } from "next/server";
import { purchase as purchaseCredits } from "@/lib/dal/credits";
import { track } from "@/lib/dal/events";
import { getProduct } from "@/lib/dal/products";
import { getSession } from "@/lib/dal/session";
import { slugSchema } from "@/lib/schemas/product-config";
import { purchaseInputSchema } from "@/lib/schemas/inputs";
import { guardRequest } from "@/lib/security";

// SA-05 (specs/SA-05-paiement.md): the checkout's only Server Action, called
// directly from CheckoutFlow (a plain async call, not a form action: there
// is no per-field validation state to carry, only a pack to buy). Order
// (plan's design decision 1): session → parse slug + purchaseInputSchema →
// guardRequest("purchase") → getProduct (killed counts as unknown) → pack
// checked against the config, before any write → ledger purchase() →
// after(track) → { ok: true, balance }; the router refresh is CheckoutFlow's,
// see QA1-P1-B3 (.claude/qa/reports/2026-09-25-full.md › B3): a server
// refresh() re-fetches the full /pricing page kept behind the checkout
// modal, which gets intercepted by @modal/(.)pricing and forces a hard
// reload (.claude/plans/QA1-P1-B3.plan.md, root cause).
export type PurchaseResult =
  | { ok: true; balance: number }
  | { ok: false; error: "unauthenticated" | "invalid_request" | "unknown_pack" | "bot" | "rate_limited" | "failed" };

export async function purchase(slug: string, packId: string, idempotencyKey: string): Promise<PurchaseResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: "unauthenticated" };

  const parsedSlug = slugSchema.safeParse(slug);
  const parsedInput = purchaseInputSchema.safeParse({ packId, idempotencyKey });
  if (!parsedSlug.success || !parsedInput.success) return { ok: false, error: "invalid_request" };

  const guard = await guardRequest("purchase");
  if (!guard.ok) return { ok: false, error: guard.reason };

  const product = await getProduct(parsedSlug.data);
  if (!product || product.status === "killed") return { ok: false, error: "invalid_request" };

  const pack = product.pricing.packs.find((candidate) => candidate.id === parsedInput.data.packId);
  if (!pack) return { ok: false, error: "unknown_pack" };

  try {
    const result = await purchaseCredits({
      userId: session.user.id,
      productId: product.id,
      packId: pack.id,
      idempotencyKey: parsedInput.data.idempotencyKey,
    });

    // Registered with after() (docs/04-nextjs.md: events are written after
    // the response, never adding latency); a rejection is logged, never
    // thrown, so a TRACKING outage can't turn a successful purchase into an
    // error for the buyer (plan's design decision 1).
    after(async () => {
      try {
        await track({
          type: "purchase",
          productId: product.id,
          userId: session.user.id,
          anonymousId: null,
          metadata: {
            packId: pack.id,
            credits: pack.credits,
            amountCents: pack.priceCents,
            purchaseKey: parsedInput.data.idempotencyKey,
          },
        });
      } catch (error) {
        console.error("[checkout] purchase tracking failed", error);
      }
    });

    return { ok: true, balance: result.balance };
  } catch (error) {
    unstable_rethrow(error);
    console.error("[checkout] purchase failed", error);
    return { ok: false, error: "failed" };
  }
}
