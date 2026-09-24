import { describe, expect, it } from "vitest";

// Temporary (specs/CONTRACT-types.md): every V1 stub throws
// `not implemented`. CONTRACT-data deletes this file in a single commit
// once real implementations land, with a message explaining why.

describe("credits", () => {
  it("debit throws not implemented", async () => {
    const { debit } = await import("./credits");
    await expect(
      debit({ userId: "u1", productId: "p1", cost: 1, generationId: "g1", idempotencyKey: "k1" }),
    ).rejects.toThrow("not implemented");
  });

  it("getBalance throws not implemented", async () => {
    const { getBalance } = await import("./credits");
    await expect(getBalance("u1", "p1")).rejects.toThrow("not implemented");
  });

  it("refund throws not implemented", async () => {
    const { refund } = await import("./credits");
    await expect(refund("g1")).rejects.toThrow("not implemented");
  });

  it("grantSignupBonus throws not implemented", async () => {
    const { grantSignupBonus } = await import("./credits");
    await expect(grantSignupBonus({ userId: "u1", productId: "p1" })).rejects.toThrow("not implemented");
  });

  it("purchase throws not implemented", async () => {
    const { purchase } = await import("./credits");
    await expect(purchase({ userId: "u1", productId: "p1", packId: "pack-10", idempotencyKey: "k1" })).rejects.toThrow(
      "not implemented",
    );
  });
});

describe("generations", () => {
  it("recordGeneration throws not implemented", async () => {
    const { recordGeneration } = await import("./generations");
    await expect(
      recordGeneration({
        productId: "p1",
        productVersion: 1,
        userId: null,
        anonymousId: "anon1",
        ipHash: "hash1",
        input: { poste: "Développeur" },
        idempotencyKey: "k1",
      }),
    ).rejects.toThrow("not implemented");
  });

  it("saveGeneration throws not implemented", async () => {
    const { saveGeneration } = await import("./generations");
    await expect(
      saveGeneration("g1", {
        output: "Lettre générée",
        model: "anthropic/claude-haiku-4.5",
        inputTokens: 100,
        outputTokens: 50,
        cachedInputTokens: 0,
        costMicros: 100,
      }),
    ).rejects.toThrow("not implemented");
  });

  it("markGenerationFailed throws not implemented", async () => {
    const { markGenerationFailed } = await import("./generations");
    await expect(markGenerationFailed("g1")).rejects.toThrow("not implemented");
  });
});

describe("events", () => {
  it("track throws not implemented", async () => {
    const { track } = await import("./events");
    await expect(track({ type: "visit", productId: "p1", userId: null, anonymousId: "anon1" })).rejects.toThrow(
      "not implemented",
    );
  });
});
