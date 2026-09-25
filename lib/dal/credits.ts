import "server-only";
import { and, eq, gte, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { balances, creditTransactions, generations, productVersions, products, purchases } from "@/lib/db/schema";
import type { ProductConfig } from "@/lib/schemas/product-config";
import { getSession } from "./session";

// Frozen contract (specs/CONTRACT-types.md): the ledger's signatures. V1
// stub values (docs/11 › Les contrats gelés en V1: "Solde fixe à 10,
// remboursement et bonus sans effet, debit() toujours ok") replaced here by
// the real insert-only ledger (docs/07-modele-de-donnees.md carries the
// real Drizzle extract this file mirrors).

// † docs/07's excerpt names this field `key`; frozen here as
// `idempotencyKey` to match `credit_transactions.idempotency_key` and the
// other Debit-like inputs (Purchase, generations) in this contract.
export type Debit = {
  userId: string;
  productId: string;
  cost: number;
  generationId: string;
  idempotencyKey: string;
};

export type DebitResult =
  { ok: true; balance: number } | { ok: true; replay: true } | { ok: false; reason: "insufficient_balance" };

export type Purchase = {
  userId: string;
  productId: string;
  packId: string;
  idempotencyKey: string;
};

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

// Rolls the transaction back on an insufficient balance without confusing
// it with a real database error (docs/07: "on lève une erreur maison
// plutôt que tx.rollback()").
class InsufficientBalance extends Error {}

// Private copy of session.ts's admin roles (that file isn't exported for
// reuse outside requireAdmin's redirect): only getBalance needs the
// admin/owner exception (BO-04, docs/02 › fiche produit activité).
const ADMIN_ROLES = new Set(["admin", "owner"]);

const uuidSchema = z.uuid();

// Every function taking a `userId` argument checks it against the caller's
// session (CLAUDE.md: every DAL module checks the session); never trusts a
// client-supplied userId that could target another user's balance.
async function assertOwnUser(userId: string, fnName: string): Promise<void> {
  const session = await getSession();
  if (!session || session.user.id !== userId) {
    throw new Error(`${fnName}: userId does not match the caller's session`);
  }
}

// getBalance additionally allows an admin or owner to read another user's
// balance (BO-04's activity screen).
async function assertReadableBalance(userId: string, fnName: string): Promise<void> {
  const session = await getSession();
  if (!session || (session.user.id !== userId && !ADMIN_ROLES.has(session.user.role))) {
    throw new Error(`${fnName}: caller cannot read this balance`);
  }
}

// Incoming credits (bonus, purchase, refund): creates the `balances` row if
// it's missing (docs/07's upsert), only ever called after its ledger row
// was inserted in the same transaction.
async function credit(tx: Tx, { userId, productId, delta }: { userId: string; productId: string; delta: number }) {
  const [row] = await tx
    .insert(balances)
    .values({ userId, productId, balance: delta })
    .onConflictDoUpdate({
      target: [balances.userId, balances.productId],
      set: { balance: sql`${balances.balance} + ${delta}`, updatedAt: new Date() },
    })
    .returning({ balance: balances.balance });
  return row!.balance;
}

async function readBalance(tx: Tx, userId: string, productId: string): Promise<number> {
  const row = await tx.query.balances.findFirst({
    where: and(eq(balances.userId, userId), eq(balances.productId, productId)),
  });
  return row?.balance ?? 0;
}

// Reads the product's current config inside the caller's transaction (no
// `'use cache'` in a write transaction, docs/04): `pricing.freeCreditsOnSignup`
// for grantSignupBonus, `pricing.packs` for purchase.
async function readConfig(tx: Tx, productId: string): Promise<ProductConfig> {
  const product = await tx.query.products.findFirst({ where: eq(products.id, productId) });
  if (!product) throw new Error(`readConfig: product ${productId} not found`);
  const version = await tx.query.productVersions.findFirst({
    where: and(eq(productVersions.productId, productId), eq(productVersions.version, product.currentVersion)),
  });
  if (!version) throw new Error(`readConfig: product ${productId} has no version ${product.currentVersion}`);
  return version.config;
}

// Reads the caller's own balance: the real implementation checks the
// session user matches `userId` (CLAUDE.md: every DAL module checks the
// session), except for the admin activity screens (BO-04).
export const getBalance: (userId: string, productId: string) => Promise<number> = async (userId, productId) => {
  await assertReadableBalance(userId, "getBalance");
  const row = await db.query.balances.findFirst({
    where: and(eq(balances.userId, userId), eq(balances.productId, productId)),
  });
  return row?.balance ?? 0;
};

// Called by `api/generate` (SA-02) after the caller is authenticated (or
// resolved as anonymous); never called directly by a Server Action. The
// real implementation derives `userId` from the session (or accepts it
// only for an anonymous generation with no session), never from a
// client-supplied argument that could target another user's balance.
export const debit: (args: Debit) => Promise<DebitResult> = async ({
  userId,
  productId,
  cost,
  generationId,
  idempotencyKey,
}) => {
  await assertOwnUser(userId, "debit");
  if (!Number.isInteger(cost) || cost <= 0) {
    throw new Error("debit: cost must be a positive integer");
  }

  try {
    return await db.transaction(async (tx) => {
      // 0. The generation must belong to this user and this product: a
      // client-supplied generationId could otherwise point at someone
      // else's (or another product's) generation and attach a debit to it.
      const generation = await tx.query.generations.findFirst({ where: eq(generations.id, generationId) });
      if (!generation || generation.userId !== userId || generation.productId !== productId) {
        throw new Error("debit: generationId does not belong to this user and product");
      }

      // 1. The ledger row first: if the key already exists (retry), nothing
      // is inserted and the debit replays without touching the balance.
      const inserted = await tx
        .insert(creditTransactions)
        .values({ userId, productId, delta: -cost, reason: "generation", generationId, idempotencyKey })
        .onConflictDoNothing({ target: creditTransactions.idempotencyKey })
        .returning({ id: creditTransactions.id });
      if (inserted.length === 0) return { ok: true as const, replay: true as const };

      // 2. Then the balance, only if it's sufficient. No `balances` row
      // means a balance of 0, so the update matches nothing and refuses.
      const [row] = await tx
        .update(balances)
        .set({ balance: sql`${balances.balance} - ${cost}`, updatedAt: new Date() })
        .where(and(eq(balances.userId, userId), eq(balances.productId, productId), gte(balances.balance, cost)))
        .returning({ balance: balances.balance });
      if (!row) throw new InsufficientBalance();
      return { ok: true as const, balance: row.balance };
    });
  } catch (error) {
    if (error instanceof InsufficientBalance) return { ok: false, reason: "insufficient_balance" };
    throw error;
  }
};

// Idempotency key derived from `generationId` (docs/07): a failed
// generation is refunded exactly once. No session check: the amount and the
// target user come from the original ledger row, not from the caller, and
// this runs from `onError`/`after()` (SA-02) where an expired session must
// not lose a refund.
export const refund: (generationId: string) => Promise<void> = async (generationId) => {
  // A non-uuid generationId (e.g. a stub id from an older caller) can't
  // match any ledger row: resolve with no effect instead of letting an
  // invalid uuid literal reach Postgres.
  if (!uuidSchema.safeParse(generationId).success) return;

  const original = await db.query.creditTransactions.findFirst({
    where: and(eq(creditTransactions.generationId, generationId), eq(creditTransactions.reason, "generation")),
  });
  if (!original) return;

  const idempotencyKey = `refund:${generationId}`;
  await db.transaction(async (tx) => {
    const inserted = await tx
      .insert(creditTransactions)
      .values({
        userId: original.userId,
        productId: original.productId,
        delta: -original.delta,
        reason: "refund",
        generationId,
        idempotencyKey,
      })
      .onConflictDoNothing({ target: creditTransactions.idempotencyKey })
      .returning({ id: creditTransactions.id });
    if (inserted.length === 0) return;
    await credit(tx, { userId: original.userId, productId: original.productId, delta: -original.delta });
  });
};

// Called once by the signup action (SA-03), right after account creation.
// The real implementation derives `userId` from the just-created session,
// never from a client-supplied argument.
export const grantSignupBonus: (args: { userId: string; productId: string }) => Promise<{ balance: number }> = async ({
  userId,
  productId,
}) => {
  await assertOwnUser(userId, "grantSignupBonus");

  return db.transaction(async (tx) => {
    const config = await readConfig(tx, productId);
    const bonus = config.pricing.freeCreditsOnSignup;
    // A zero bonus has nothing to write: `credit_transactions.delta` must
    // be non-zero (docs/07's CHECK), so skip the ledger row entirely.
    if (bonus === 0) return { balance: await readBalance(tx, userId, productId) };

    const idempotencyKey = `signup_bonus:${userId}:${productId}`;
    const inserted = await tx
      .insert(creditTransactions)
      .values({ userId, productId, delta: bonus, reason: "signup_bonus", idempotencyKey })
      .onConflictDoNothing({ target: creditTransactions.idempotencyKey })
      .returning({ id: creditTransactions.id });
    if (inserted.length === 0) return { balance: await readBalance(tx, userId, productId) };

    return { balance: await credit(tx, { userId, productId, delta: bonus }) };
  });
};

// Called by the checkout Server Action (SA-05) for the session user; a pack
// id is only unique within a product, hence `productId` alongside `packId`.
// The real implementation checks `userId` matches the session, never
// trusts it from client input.
export const purchase: (args: Purchase) => Promise<{ balance: number }> = async ({
  userId,
  productId,
  packId,
  idempotencyKey,
}) => {
  await assertOwnUser(userId, "purchase");

  return db.transaction(async (tx) => {
    const config = await readConfig(tx, productId);
    const pack = config.pricing.packs.find((candidate) => candidate.id === packId);
    if (!pack) throw new Error(`purchase: unknown pack ${packId}`);

    // The purchase and its price/credits, recopied from the pack so a later
    // config change never affects an existing purchase (docs/07's invariant).
    const inserted = await tx
      .insert(purchases)
      .values({
        userId,
        productId,
        packId,
        credits: pack.credits,
        amountCents: pack.priceCents,
        idempotencyKey,
      })
      .onConflictDoNothing({ target: purchases.idempotencyKey })
      .returning({ id: purchases.id });
    if (inserted.length === 0) return { balance: await readBalance(tx, userId, productId) };

    const purchaseId = inserted[0]!.id;
    await tx.insert(creditTransactions).values({
      userId,
      productId,
      delta: pack.credits,
      reason: "purchase",
      purchaseId,
      idempotencyKey: `purchase:${purchaseId}`,
    });
    return { balance: await credit(tx, { userId, productId, delta: pack.credits }) };
  });
};
