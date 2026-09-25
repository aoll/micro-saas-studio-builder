import "server-only";
import { createHmac } from "node:crypto";
import { and, eq, isNull, ne, or, sql } from "drizzle-orm";
import { env } from "@/lib/env";
import { db } from "@/lib/db";
import { generations } from "@/lib/db/schema";
import { getSession } from "./session";

// Frozen contract (specs/CONTRACT-types.md): the generation write flow
// (docs/07 › `generations`, docs/05 › onFinish/onError). `recordGeneration`
// inserts a `pending` row before the debit and returns `{ id }` (idempotent
// on `idempotencyKey`); `saveGeneration` finalizes it in `after()` when the
// AI call succeeds; `markGenerationFailed` + `credits.refund(id)` run when
// it errors. Called only from `api/generate` (SA-02).

export type NewGeneration = {
  productId: string;
  productVersion: number;
  userId: string | null;
  anonymousId: string | null;
  ipHash: string;
  input: Record<string, string>;
  idempotencyKey: string;
};

// † docs/05's `onFinish` excerpt calls this step `saveGeneration`; not one
// of the contract table's named exports, added here to complete the flow.
export type GenerationResult = {
  output: string | Record<string, unknown>;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
  costMicros: number;
};

// V1 stub: a plain insertion, idempotent on `idempotencyKey` (docs/07,
// docs/11's contract table). The real implementation derives `userId` from
// the session (or accepts only `anonymousId` with no session), never from
// a client-supplied `userId` argument that could attribute a generation to
// another user — checked here too (CLAUDE.md: every DAL module checks the
// session).
export const recordGeneration: (generation: NewGeneration) => Promise<{ id: string }> = async (generation) => {
  const session = await getSession();
  if (generation.userId && generation.userId !== session?.user.id) {
    throw new Error("recordGeneration: userId does not match the caller's session");
  }

  const inserted = await db
    .insert(generations)
    .values({
      productId: generation.productId,
      productVersion: generation.productVersion,
      userId: generation.userId,
      anonymousId: generation.anonymousId,
      ipHash: generation.ipHash,
      input: generation.input,
      idempotencyKey: generation.idempotencyKey,
    })
    .onConflictDoNothing({ target: generations.idempotencyKey })
    .returning({ id: generations.id });
  if (inserted[0]) return { id: inserted[0].id };

  // Replay: the row already exists, read it back instead of inserting again.
  const existing = await db.query.generations.findFirst({
    where: eq(generations.idempotencyKey, generation.idempotencyKey),
  });
  return { id: existing!.id };
};

export const saveGeneration: (generationId: string, result: GenerationResult) => Promise<void> = async (
  generationId,
  result,
) => {
  await db
    .update(generations)
    .set({
      status: "succeeded",
      output: result.output,
      model: result.model,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      cachedInputTokens: result.cachedInputTokens,
      costMicros: result.costMicros,
    })
    .where(eq(generations.id, generationId));
};

export const markGenerationFailed: (generationId: string) => Promise<void> = async (generationId) => {
  await db.update(generations).set({ status: "failed" }).where(eq(generations.id, generationId));
};

// Additive export (SA-02 plan › orchestrator decision 1): the anonymous
// generation limit and the rate limit (SECURITY) both need an IP that never
// appears in plain text in `generations.ip_hash` (docs/07). Keyed with the
// app's own secret so the hash cannot be reproduced (or reversed by
// dictionary) without it.
export function hashIp(ip: string): string {
  return createHmac("sha256", env.BETTER_AUTH_SECRET).update(ip).digest("hex");
}

// Additive export: `api/generate` (SA-02) reads the existing row of a
// replayed idempotency key instead of calling the AI a second time.
export const findGenerationByKey: (
  idempotencyKey: string,
) => Promise<{ id: string; status: "pending" | "succeeded" | "failed" } | null> = async (idempotencyKey) => {
  const row = await db.query.generations.findFirst({
    where: eq(generations.idempotencyKey, idempotencyKey),
    columns: { id: true, status: true },
  });
  return row ?? null;
};

// Additive export: powers both the anonymous free-generation limit and the
// `first_generation` event (docs/01, docs/07). A `failed` row never used up
// anyone's free try or counted as a prior generation. For a signed-in
// caller, `userId` must match the session (CLAUDE.md: every DAL module
// checks the session) — never trusted from client input.
export const countPriorGenerations: (who: {
  productId: string;
  userId: string | null;
  anonymousId: string | null;
  ipHash: string | null;
}) => Promise<number> = async (who) => {
  if (who.userId) {
    const session = await getSession();
    if (who.userId !== session?.user.id) {
      throw new Error("countPriorGenerations: userId does not match the caller's session");
    }
    const rows = await db.query.generations.findMany({
      where: and(
        eq(generations.productId, who.productId),
        eq(generations.userId, who.userId),
        ne(generations.status, "failed"),
      ),
      columns: { id: true },
    });
    return rows.length;
  }

  const identityConditions = [];
  if (who.anonymousId) identityConditions.push(eq(generations.anonymousId, who.anonymousId));
  if (who.ipHash) identityConditions.push(eq(generations.ipHash, who.ipHash));
  if (identityConditions.length === 0) return 0;

  const rows = await db.query.generations.findMany({
    where: and(
      eq(generations.productId, who.productId),
      ne(generations.status, "failed"),
      isNull(generations.userId),
      or(...identityConditions),
    ),
    columns: { id: true },
  });
  return rows.length;
};

export type RecordAnonymousGenerationArgs = {
  productId: string;
  productVersion: number;
  anonymousId: string;
  ipHash: string;
  input: Record<string, string>;
  idempotencyKey: string;
  limit: number;
};

export type RecordAnonymousGenerationResult =
  { ok: true; id: string; freeGenerationsLeft: number; isFirst: boolean } | { ok: false; reason: "signup_required" };

// Additive export (security review, SA-02): `countPriorGenerations` then
// `recordGeneration` as two separate statements let N concurrent anonymous
// requests all read the same "under the limit" count before any of them
// commits an insert (TOCTOU). This combines the count and the insert in one
// transaction, serialized by a Postgres advisory lock on *both* identity
// keys the anonymous limit is checked against (docs/01: "cookie + IP") —
// two concurrent calls sharing either the cookie or the IP always
// serialize, in the same fixed lock order, so they can never deadlock each
// other.
export const recordAnonymousGeneration: (
  args: RecordAnonymousGenerationArgs,
) => Promise<RecordAnonymousGenerationResult> = async (args) => {
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`anon-gen:${args.productId}:${args.anonymousId}`}, 0))`,
    );
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`anon-gen-ip:${args.productId}:${args.ipHash}`}, 0))`,
    );

    // A replay of an idempotency key already recorded under this lock (or
    // an earlier request) is not a new attempt: return it as-is, without
    // touching the count.
    const existing = await tx.query.generations.findFirst({
      where: eq(generations.idempotencyKey, args.idempotencyKey),
      columns: { id: true },
    });
    if (existing) return { ok: true, id: existing.id, freeGenerationsLeft: 0, isFirst: false };

    const priorRows = await tx.query.generations.findMany({
      where: and(
        eq(generations.productId, args.productId),
        ne(generations.status, "failed"),
        isNull(generations.userId),
        or(eq(generations.anonymousId, args.anonymousId), eq(generations.ipHash, args.ipHash)),
      ),
      columns: { id: true },
    });
    if (priorRows.length >= args.limit) return { ok: false, reason: "signup_required" };

    const inserted = await tx
      .insert(generations)
      .values({
        productId: args.productId,
        productVersion: args.productVersion,
        userId: null,
        anonymousId: args.anonymousId,
        ipHash: args.ipHash,
        input: args.input,
        idempotencyKey: args.idempotencyKey,
      })
      .onConflictDoNothing({ target: generations.idempotencyKey })
      .returning({ id: generations.id });

    if (!inserted[0]) {
      // Lost a race on the idempotency key itself (a genuine double
      // submission of the very same key, not the free-try race this
      // function exists to close): read back the row the other call wrote.
      const raced = await tx.query.generations.findFirst({
        where: eq(generations.idempotencyKey, args.idempotencyKey),
        columns: { id: true },
      });
      return { ok: true, id: raced!.id, freeGenerationsLeft: 0, isFirst: false };
    }

    return {
      ok: true,
      id: inserted[0].id,
      freeGenerationsLeft: args.limit - priorRows.length - 1,
      isFirst: priorRows.length === 0,
    };
  });
};

// Additive export (SECURITY plan, decision 1): the Postgres rate limiter
// (lib/rate-limit.ts) counts generations of the last `windowSeconds`, by
// user and by ip_hash, using the existing `(user_id, created_at)` and
// `(ip_hash, created_at)` indexes. The window is anchored on the database
// clock (`now()`), not Node's, so it is correct even if the two clocks
// drift. Every status counts, unlike `countPriorGenerations`'s free-trial
// count: a failed generation still used up IA time and is still an attempt
// to rate-limit. For a signed-in caller, `userId` must match the session
// (CLAUDE.md: every DAL module checks the session) — never trusted from
// client input.
export const countRecentGenerations: (who: {
  userId: string | null;
  ipHash: string;
  windowSeconds: number;
}) => Promise<{ byUser: number; byIp: number }> = async (who) => {
  if (who.userId) {
    const session = await getSession();
    if (who.userId !== session?.user.id) {
      throw new Error("countRecentGenerations: userId does not match the caller's session");
    }
  }

  const withinWindow = sql`${generations.createdAt} > now() - make_interval(secs => ${who.windowSeconds})`;

  const byIpRows = await db.query.generations.findMany({
    where: and(eq(generations.ipHash, who.ipHash), withinWindow),
    columns: { id: true },
  });

  let byUser = 0;
  if (who.userId) {
    const byUserRows = await db.query.generations.findMany({
      where: and(eq(generations.userId, who.userId), withinWindow),
      columns: { id: true },
    });
    byUser = byUserRows.length;
  }

  return { byUser, byIp: byIpRows.length };
};
