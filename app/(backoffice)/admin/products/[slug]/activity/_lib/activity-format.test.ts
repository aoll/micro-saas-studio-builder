import { describe, expect, it } from "vitest";
import {
  formatCostMicros,
  formatDelta,
  formatRelative,
  generationStatus,
  movementLabel,
  purchaseSummaryLines,
  summarizeOutput,
} from "./activity-format";

describe("formatCostMicros", () => {
  it("formats micros as euros with 3 decimals", () => {
    expect(formatCostMicros(4_000)).toBe("0,004 €");
    expect(formatCostMicros(5_000)).toBe("0,005 €");
  });

  it("shows 0,000 € for a null cost (a failed generation)", () => {
    expect(formatCostMicros(null)).toBe("0,000 €");
  });
});

describe("formatRelative", () => {
  const now = new Date("2026-01-01T12:00:00.000Z");

  it("shows minutes under an hour", () => {
    expect(formatRelative(new Date("2026-01-01T11:58:00.000Z"), now)).toBe("il y a 2 min");
    expect(formatRelative(new Date("2026-01-01T11:51:00.000Z"), now)).toBe("il y a 9 min");
  });

  it("shows hours under a day", () => {
    expect(formatRelative(new Date("2026-01-01T11:00:00.000Z"), now)).toBe("il y a 1 h");
    expect(formatRelative(new Date("2026-01-01T09:00:00.000Z"), now)).toBe("il y a 3 h");
  });

  it("shows days for a full day or more", () => {
    expect(formatRelative(new Date("2025-12-30T12:00:00.000Z"), now)).toBe("il y a 2 j");
  });

  it("shows a dedicated label for under a minute", () => {
    expect(formatRelative(new Date("2026-01-01T11:59:30.000Z"), now)).toBe("à l'instant");
  });
});

describe("formatDelta", () => {
  it("prefixes a positive delta with +", () => {
    expect(formatDelta(10)).toBe("+10");
    expect(formatDelta(3)).toBe("+3");
  });

  it("prefixes a negative delta with U+2212, not a hyphen", () => {
    expect(formatDelta(-1)).toBe("−1");
    expect(formatDelta(-1)).not.toBe("-1");
  });

  it("treats zero as positive", () => {
    expect(formatDelta(0)).toBe("+0");
  });
});

describe("movementLabel", () => {
  it("labels a purchase movement with its pack size", () => {
    expect(movementLabel({ reason: "purchase", packCredits: 10 })).toBe("Achat pack 10");
  });

  it("falls back to a generic label when a purchase movement has no pack credits", () => {
    expect(movementLabel({ reason: "purchase", packCredits: null })).toBe("Achat");
  });

  it("labels the other three reasons", () => {
    expect(movementLabel({ reason: "generation", packCredits: null })).toBe("Génération");
    expect(movementLabel({ reason: "refund", packCredits: null })).toBe("Remboursement");
    expect(movementLabel({ reason: "signup_bonus", packCredits: null })).toBe("Bonus inscription");
  });
});

describe("generationStatus", () => {
  it("succeeded -> OK", () => {
    expect(generationStatus({ status: "succeeded", refunded: false })).toEqual({ label: "OK", variant: "ok" });
  });

  it("pending -> En cours", () => {
    expect(generationStatus({ status: "pending", refunded: false })).toEqual({ label: "En cours", variant: "pending" });
  });

  it("failed and refunded -> Erreur · remboursé", () => {
    expect(generationStatus({ status: "failed", refunded: true })).toEqual({
      label: "Erreur · remboursé",
      variant: "error",
    });
  });

  it("failed and not (yet) refunded -> Erreur", () => {
    expect(generationStatus({ status: "failed", refunded: false })).toEqual({ label: "Erreur", variant: "error" });
  });
});

describe("summarizeOutput", () => {
  it("shows an em dash for a null output", () => {
    expect(summarizeOutput(null)).toBe("—");
    expect(summarizeOutput(undefined)).toBe("—");
  });

  it("excerpts a string output", () => {
    expect(summarizeOutput("Bonjour, voici votre lettre.")).toBe("Bonjour, voici votre lettre.");
  });

  it("joins a structured array output", () => {
    expect(summarizeOutput(["Brewtiful", "Grain Gang", "Moka"])).toBe("Brewtiful, Grain Gang, Moka");
  });

  it("truncates a long joined output by code point, at the given max", () => {
    const names = Array.from({ length: 20 }, (_, index) => `Nom${index}`);
    const result = summarizeOutput(names, 20);
    expect(Array.from(result.replace("…", "")).length).toBeLessThanOrEqual(20);
    expect(result.endsWith("…")).toBe(true);
  });

  it("stringifies a non-array structured output", () => {
    expect(summarizeOutput({ a: 1 })).toBe('{"a":1}');
  });
});

describe("purchaseSummaryLines", () => {
  it("shows only the headline when there are no purchases", () => {
    expect(purchaseSummaryLines({ count: 0, revenueCents: 0, byPack: [] })).toEqual(["0 achat · 0,00 €"]);
  });

  it("pluralizes achats and shows the pack breakdown, matching the mockup", () => {
    expect(
      purchaseSummaryLines({
        count: 14,
        revenueCents: 7_200,
        byPack: [
          { credits: 10, count: 11 },
          { credits: 50, count: 3 },
        ],
      }),
    ).toEqual(["14 achats · 72,00 €", "Pack 10 : 11 · Pack 50 : 3"]);
  });

  it("does not pluralize a single purchase", () => {
    expect(purchaseSummaryLines({ count: 1, revenueCents: 490, byPack: [{ credits: 10, count: 1 }] })).toEqual([
      "1 achat · 4,90 €",
      "Pack 10 : 1",
    ]);
  });
});
