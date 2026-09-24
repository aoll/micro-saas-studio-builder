import "server-only";

// Frozen contract (specs/CONTRACT-types.md): the ledger's signatures. V1
// stubs, replaced by the real implementation in the credits lot (docs/11 ›
// Les contrats gelés en V1). Every export below is a typed const whose body
// throws, so the shape of the API is fixed before the transaction logic
// lands (docs/07-modele-de-donnees.md carries the real Drizzle extract).

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

// Reads the caller's own balance: the real implementation checks the
// session user matches `userId` (CLAUDE.md: every DAL module checks the
// session), except for the admin activity screens (BO-04).
export const getBalance: (userId: string, productId: string) => Promise<number> = async () => {
  throw new Error("not implemented");
};

// Called by `api/generate` (SA-02) after the caller is authenticated (or
// resolved as anonymous); never called directly by a Server Action. The
// real implementation derives `userId` from the session (or accepts it
// only for an anonymous generation with no session), never from a
// client-supplied argument that could target another user's balance.
export const debit: (args: Debit) => Promise<DebitResult> = async () => {
  throw new Error("not implemented");
};

// Idempotency key derived from `generationId` (docs/07): a failed
// generation is refunded exactly once.
export const refund: (generationId: string) => Promise<void> = async () => {
  throw new Error("not implemented");
};

// Called once by the signup action (SA-03), right after account creation.
// The real implementation derives `userId` from the just-created session,
// never from a client-supplied argument.
export const grantSignupBonus: (args: {
  userId: string;
  productId: string;
}) => Promise<{ balance: number }> = async () => {
  throw new Error("not implemented");
};

// Called by the checkout Server Action (SA-05) for the session user; a pack
// id is only unique within a product, hence `productId` alongside `packId`.
// The real implementation checks `userId` matches the session, never
// trusts it from client input.
export const purchase: (args: Purchase) => Promise<{ balance: number }> = async () => {
  throw new Error("not implemented");
};
