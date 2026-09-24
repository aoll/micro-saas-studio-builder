import { describe, expectTypeOf, it } from "vitest";
import type { EventType } from "@/lib/schemas/event-type";
import type { DebitResult, Purchase } from "./credits";

// Permanent contract tests (specs/CONTRACT-types.md): pin the *type* of
// every frozen signature with `expectTypeOf`. Unlike stubs.test.ts, this
// file stays valid once a real implementation replaces a stub's body.

describe("credits", () => {
  it("debit takes a single Debit argument and returns a DebitResult", async () => {
    const { debit } = await import("./credits");
    expectTypeOf(debit).parameters.toEqualTypeOf<[import("./credits").Debit]>();
    expectTypeOf(debit).returns.resolves.toEqualTypeOf<DebitResult>();
  });

  it("DebitResult's refusal is a value, never an exception", () => {
    expectTypeOf<Extract<DebitResult, { ok: false }>>().toEqualTypeOf<{
      ok: false;
      reason: "insufficient_balance";
    }>();
  });

  it("getBalance takes a userId and a productId and returns a number", async () => {
    const { getBalance } = await import("./credits");
    expectTypeOf(getBalance).parameters.toEqualTypeOf<[userId: string, productId: string]>();
    expectTypeOf(getBalance).returns.resolves.toEqualTypeOf<number>();
  });

  it("refund takes a generationId and returns void", async () => {
    const { refund } = await import("./credits");
    expectTypeOf(refund).parameters.toEqualTypeOf<[generationId: string]>();
    expectTypeOf(refund).returns.resolves.toEqualTypeOf<void>();
  });

  it("grantSignupBonus takes { userId, productId } and returns a balance", async () => {
    const { grantSignupBonus } = await import("./credits");
    expectTypeOf(grantSignupBonus).parameters.toEqualTypeOf<[args: { userId: string; productId: string }]>();
    expectTypeOf(grantSignupBonus).returns.resolves.toEqualTypeOf<{ balance: number }>();
  });

  it("purchase takes a single Purchase argument and returns a balance", async () => {
    const { purchase } = await import("./credits");
    expectTypeOf(purchase).parameters.toEqualTypeOf<[Purchase]>();
    expectTypeOf(purchase).returns.resolves.toEqualTypeOf<{ balance: number }>();
  });
});

describe("generations", () => {
  it("recordGeneration takes a NewGeneration and returns an id", async () => {
    const { recordGeneration } = await import("./generations");
    expectTypeOf(recordGeneration).parameters.toEqualTypeOf<[import("./generations").NewGeneration]>();
    expectTypeOf(recordGeneration).returns.resolves.toEqualTypeOf<{ id: string }>();
  });

  it("saveGeneration takes a generationId and a GenerationResult", async () => {
    const { saveGeneration } = await import("./generations");
    expectTypeOf(saveGeneration).parameters.toEqualTypeOf<
      [generationId: string, result: import("./generations").GenerationResult]
    >();
    expectTypeOf(saveGeneration).returns.resolves.toEqualTypeOf<void>();
  });

  it("markGenerationFailed takes a generationId", async () => {
    const { markGenerationFailed } = await import("./generations");
    expectTypeOf(markGenerationFailed).parameters.toEqualTypeOf<[generationId: string]>();
    expectTypeOf(markGenerationFailed).returns.resolves.toEqualTypeOf<void>();
  });
});

describe("events", () => {
  it("track takes a TrackEvent with a typed EventType", async () => {
    const { track } = await import("./events");
    expectTypeOf(track).parameters.toEqualTypeOf<[import("./events").TrackEvent]>();
    expectTypeOf(track).returns.resolves.toEqualTypeOf<void>();
    expectTypeOf<import("./events").TrackEvent["type"]>().toEqualTypeOf<EventType>();
  });
});
