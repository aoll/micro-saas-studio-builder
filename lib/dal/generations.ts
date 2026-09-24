import "server-only";
import { eq } from "drizzle-orm";
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
