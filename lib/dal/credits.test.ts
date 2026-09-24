import { describe, expect, it } from "vitest";

// V1 stub values (specs/CONTRACT-data.md, docs/11 › Les contrats gelés en
// V1: "Solde fixe à 10, remboursement et bonus sans effet, debit() toujours
// ok"). Replaced by the real ledger transactions in the credits lot.

describe("getBalance", () => {
  it("returns the fixed stub balance", async () => {
    const { getBalance } = await import("./credits");
    expect(await getBalance("u1", "p1")).toBe(10);
  });
});

describe("debit", () => {
  it("always succeeds with the fixed stub balance", async () => {
    const { debit } = await import("./credits");
    const result = await debit({ userId: "u1", productId: "p1", cost: 1, generationId: "g1", idempotencyKey: "k1" });
    expect(result).toEqual({ ok: true, balance: 10 });
  });
});

describe("refund", () => {
  it("resolves without effect", async () => {
    const { refund } = await import("./credits");
    expect(await refund("g1")).toBeUndefined();
  });
});

describe("grantSignupBonus", () => {
  it("returns the fixed stub balance", async () => {
    const { grantSignupBonus } = await import("./credits");
    expect(await grantSignupBonus({ userId: "u1", productId: "p1" })).toEqual({ balance: 10 });
  });
});

describe("purchase", () => {
  it("returns a fixed, higher stub balance (docs/11)", async () => {
    const { purchase } = await import("./credits");
    const result = await purchase({ userId: "u1", productId: "p1", packId: "pack-10", idempotencyKey: "k1" });
    expect(result).toEqual({ balance: 20 });
  });
});
