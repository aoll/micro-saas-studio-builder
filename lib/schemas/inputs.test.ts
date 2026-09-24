import { describe, expect, it } from "vitest";
import {
  generateInputSchema,
  purchaseInputSchema,
  signupInputSchema,
  statusChangeInputSchema,
  thresholdsInputSchema,
  trackEventInputSchema,
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
});
