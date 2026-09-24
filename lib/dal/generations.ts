import "server-only";

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

export const recordGeneration: (generation: NewGeneration) => Promise<{ id: string }> = async () => {
  throw new Error("not implemented");
};

export const saveGeneration: (generationId: string, result: GenerationResult) => Promise<void> = async () => {
  throw new Error("not implemented");
};

export const markGenerationFailed: (generationId: string) => Promise<void> = async () => {
  throw new Error("not implemented");
};
