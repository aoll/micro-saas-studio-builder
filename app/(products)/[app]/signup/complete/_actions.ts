"use server";

import { refresh } from "next/cache";
import { slugSchema } from "@/lib/schemas/product-config";
import { claimSignupBonus as claimSignupBonusForProduct } from "./_lib/claim";

// QA1-P1-Q2 (specs/qa/QA1-P1-Q2-inscription-par-produit.md), plan step 3:
// called once per browser per product by the client leaf (step 4), never
// waited on by anything the user must see succeed — a failed attempt just
// retries on the next real page load (plan's risk note). Mirrors
// checkout/_actions.ts's purchase(): validate the client-supplied slug,
// delegate to the DAL-adjacent helper, refresh() only once granted (same
// idiom used to update the header balance badge without a router.refresh()).
export type ClaimSignupBonusResult = { ok: true; balance: number } | { ok: false };

export async function claimSignupBonus(slug: string): Promise<ClaimSignupBonusResult> {
  const parsedSlug = slugSchema.safeParse(slug);
  if (!parsedSlug.success) return { ok: false };

  const result = await claimSignupBonusForProduct(parsedSlug.data);
  if (result.status !== "granted") return { ok: false };

  refresh();
  return { ok: true, balance: result.balance };
}
