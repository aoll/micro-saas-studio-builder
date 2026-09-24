import { describe, expect, expectTypeOf, it } from "vitest";
import { MAX_INPUTS } from "./product-config";
import {
  generateInputSchema,
  purchaseInputSchema,
  signupInputSchema,
  statusChangeInputSchema,
  thresholdsInputSchema,
  trackEventInputSchema,
  type GenerateInput,
  type PurchaseInput,
  type SignupInput,
  type StatusChangeInput,
  type ThresholdsInput,
  type TrackEventInput,
} from "./inputs";

describe("generateInputSchema", () => {
  it("parses a valid input", () => {
    const result = generateInputSchema.safeParse({
      input: { poste: "Développeur", ton: "formel" },
      idempotencyKey: "3f3f3f3f-3f3f-4f3f-8f3f-3f3f3f3f3f3f",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a non-uuid idempotencyKey", () => {
    const result = generateInputSchema.safeParse({ input: { poste: "Développeur" }, idempotencyKey: "not-a-uuid" });
    expect(result.success).toBe(false);
  });

  it("accepts exactly MAX_INPUTS keys", () => {
    const input = Object.fromEntries(Array.from({ length: MAX_INPUTS }, (_, i) => [`field_${i}`, "value"]));
    const result = generateInputSchema.safeParse({
      input,
      idempotencyKey: "3f3f3f3f-3f3f-4f3f-8f3f-3f3f3f3f3f3f",
    });
    expect(result.success).toBe(true);
  });

  it("rejects MAX_INPUTS + 1 keys", () => {
    const input = Object.fromEntries(Array.from({ length: MAX_INPUTS + 1 }, (_, i) => [`field_${i}`, "value"]));
    const result = generateInputSchema.safeParse({
      input,
      idempotencyKey: "3f3f3f3f-3f3f-4f3f-8f3f-3f3f3f3f3f3f",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a key that does not look like an input field key", () => {
    const result = generateInputSchema.safeParse({
      input: { "Not A Key!": "value" },
      idempotencyKey: "3f3f3f3f-3f3f-4f3f-8f3f-3f3f3f3f3f3f",
    });
    expect(result.success).toBe(false);
  });
});

describe("signupInputSchema", () => {
  it("parses a valid email", () => {
    expect(signupInputSchema.safeParse({ email: "visitor@example.com" }).success).toBe(true);
  });

  it("rejects a malformed email", () => {
    expect(signupInputSchema.safeParse({ email: "not-an-email" }).success).toBe(false);
  });
});

describe("purchaseInputSchema", () => {
  it("parses a valid purchase input", () => {
    const result = purchaseInputSchema.safeParse({
      packId: "pack-10",
      idempotencyKey: "3f3f3f3f-3f3f-4f3f-8f3f-3f3f3f3f3f3f",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a pack id with a space", () => {
    const result = purchaseInputSchema.safeParse({
      packId: "pack 10",
      idempotencyKey: "3f3f3f3f-3f3f-4f3f-8f3f-3f3f3f3f3f3f",
    });
    expect(result.success).toBe(false);
  });
});

describe("trackEventInputSchema", () => {
  it("parses a valid visit event", () => {
    const result = trackEventInputSchema.safeParse({
      type: "visit",
      anonymousId: "3f3f3f3f-3f3f-4f3f-8f3f-3f3f3f3f3f3f",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an unknown event type", () => {
    const result = trackEventInputSchema.safeParse({
      type: "click",
      anonymousId: "3f3f3f3f-3f3f-4f3f-8f3f-3f3f3f3f3f3f",
    });
    expect(result.success).toBe(false);
  });

  it("accepts metadata with up to 10 keys", () => {
    const metadata = Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`key${i}`, "value"]));
    const result = trackEventInputSchema.safeParse({
      type: "purchase",
      anonymousId: "3f3f3f3f-3f3f-4f3f-8f3f-3f3f3f3f3f3f",
      metadata,
    });
    expect(result.success).toBe(true);
  });

  it("rejects metadata with more than 10 keys", () => {
    const metadata = Object.fromEntries(Array.from({ length: 11 }, (_, i) => [`key${i}`, "value"]));
    const result = trackEventInputSchema.safeParse({
      type: "purchase",
      anonymousId: "3f3f3f3f-3f3f-4f3f-8f3f-3f3f3f3f3f3f",
      metadata,
    });
    expect(result.success).toBe(false);
  });

  it("rejects a metadata key longer than 40 characters", () => {
    const result = trackEventInputSchema.safeParse({
      type: "purchase",
      anonymousId: "3f3f3f3f-3f3f-4f3f-8f3f-3f3f3f3f3f3f",
      metadata: { ["k".repeat(41)]: "value" },
    });
    expect(result.success).toBe(false);
  });

  it("rejects a metadata string value longer than 200 characters", () => {
    const result = trackEventInputSchema.safeParse({
      type: "purchase",
      anonymousId: "3f3f3f3f-3f3f-4f3f-8f3f-3f3f3f3f3f3f",
      metadata: { referrer: "a".repeat(201) },
    });
    expect(result.success).toBe(false);
  });
});

describe("statusChangeInputSchema", () => {
  it("parses a valid status change", () => {
    const result = statusChangeInputSchema.safeParse({ status: "scale", note: "Marge positive, on pousse." });
    expect(result.success).toBe(true);
  });

  it("accepts a null note", () => {
    const result = statusChangeInputSchema.safeParse({ status: "killed", note: null });
    expect(result.success).toBe(true);
  });

  it("rejects a note of 501 characters", () => {
    const result = statusChangeInputSchema.safeParse({ status: "killed", note: "a".repeat(501) });
    expect(result.success).toBe(false);
  });
});

describe("thresholdsInputSchema", () => {
  it("parses valid thresholds", () => {
    const result = thresholdsInputSchema.safeParse({
      minVisits: 1000,
      killMaxConversion: 0.02,
      scaleMinConversion: 0.05,
      scaleRequiresPositiveMargin: true,
    });
    expect(result.success).toBe(true);
  });

  it("rejects a conversion rate above 1", () => {
    const result = thresholdsInputSchema.safeParse({
      minVisits: 1000,
      killMaxConversion: 1.5,
      scaleMinConversion: 0.05,
      scaleRequiresPositiveMargin: true,
    });
    expect(result.success).toBe(false);
  });

  it("rejects killMaxConversion equal to scaleMinConversion", () => {
    const result = thresholdsInputSchema.safeParse({
      minVisits: 1000,
      killMaxConversion: 0.05,
      scaleMinConversion: 0.05,
      scaleRequiresPositiveMargin: true,
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    const issue = result.error.issues.find((i) => i.path.join(".") === "scaleMinConversion");
    expect(issue).toBeTruthy();
  });

  it("rejects killMaxConversion above scaleMinConversion (inverted)", () => {
    const result = thresholdsInputSchema.safeParse({
      minVisits: 1000,
      killMaxConversion: 0.1,
      scaleMinConversion: 0.05,
      scaleRequiresPositiveMargin: true,
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues.some((i) => i.path.join(".") === "scaleMinConversion")).toBe(true);
  });
});

describe("inferred types", () => {
  it("pins the shape of each input type", () => {
    expectTypeOf<GenerateInput>().toEqualTypeOf<{ input: Record<string, string>; idempotencyKey: string }>();
    expectTypeOf<SignupInput>().toEqualTypeOf<{ email: string }>();
    expectTypeOf<PurchaseInput>().toEqualTypeOf<{ packId: string; idempotencyKey: string }>();
    expectTypeOf<TrackEventInput["type"]>().toEqualTypeOf<
      "visit" | "first_generation" | "signup" | "generation" | "credits_exhausted" | "purchase"
    >();
    expectTypeOf<StatusChangeInput>().toEqualTypeOf<{
      status: "test" | "learn" | "scale" | "killed";
      note: string | null;
    }>();
    expectTypeOf<ThresholdsInput>().toEqualTypeOf<{
      minVisits: number;
      killMaxConversion: number;
      scaleMinConversion: number;
      scaleRequiresPositiveMargin: boolean;
    }>();
  });
});
