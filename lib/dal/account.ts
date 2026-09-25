import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { creditTransactions, purchases } from "@/lib/db/schema";
import { getSession } from "./session";

// SA-07 (specs/SA-07-compte.md), orchestrator round-2 decision: additive
// reads for the account page's ledger movements and purchases. No frozen
// signature in lib/dal/credits.ts is touched by this module.

export const ACCOUNT_LIST_LIMIT = 50;

export type CreditMovement = {
  id: string;
  createdAt: Date;
  delta: number;
  reason: "signup_bonus" | "purchase" | "generation" | "refund";
};

export type AccountPurchase = {
  id: string;
  createdAt: Date;
  credits: number;
  amountCents: number;
  currency: string;
};

// Every function here checks the caller owns `userId` before any query
// (CLAUDE.md), mirroring credits.ts's assertOwnUser: never trusts a
// client-supplied userId that could read another user's movements.
async function assertOwnUser(userId: string, fnName: string): Promise<void> {
  const session = await getSession();
  if (!session || session.user.id !== userId) {
    throw new Error(`${fnName}: userId does not match the caller's session`);
  }
}

// Newest first, capped at ACCOUNT_LIST_LIMIT; never returns idempotency_key,
// generation_id or purchase_id (SA-07's account page only shows date,
// reason and signed delta, docs/02-ecrans.md › SA-07).
export async function listCreditMovements(userId: string, productId: string): Promise<CreditMovement[]> {
  await assertOwnUser(userId, "listCreditMovements");
  const rows = await db.query.creditTransactions.findMany({
    where: and(eq(creditTransactions.userId, userId), eq(creditTransactions.productId, productId)),
    orderBy: [desc(creditTransactions.createdAt), desc(creditTransactions.id)],
    limit: ACCOUNT_LIST_LIMIT,
    columns: { id: true, createdAt: true, delta: true, reason: true },
  });
  return rows;
}

// Newest first, capped at ACCOUNT_LIST_LIMIT; never returns idempotency_key
// or pack_id (SA-07's account page only shows credits, amount and date).
export async function listPurchases(userId: string, productId: string): Promise<AccountPurchase[]> {
  await assertOwnUser(userId, "listPurchases");
  const rows = await db.query.purchases.findMany({
    where: and(eq(purchases.userId, userId), eq(purchases.productId, productId)),
    orderBy: [desc(purchases.createdAt), desc(purchases.id)],
    limit: ACCOUNT_LIST_LIMIT,
    columns: { id: true, createdAt: true, credits: true, amountCents: true, currency: true },
  });
  return rows;
}
