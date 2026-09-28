import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";
import frSheet from "@/messages/fr/backoffice-product-sheet.json";
import enSheet from "@/messages/en/backoffice-product-sheet.json";
import {
  formatCostMicros,
  formatDelta,
  formatRelative,
  generationStatus,
  movementLabel,
  purchaseSummaryLines,
  summarizeOutput,
  type Translate,
} from "./activity-format";

// I18N-BACKOFFICE-STRINGS: formatRelative/movementLabel/generationStatus/purchaseSummaryLines now
// take a translator (like `now`, this keeps them pure functions of their arguments) — a real
// next-intl translator built from the committed messages, so a wrong key or a missing message
// fails these tests, not a hand-rolled fake. `Translate`'s `key: string` is intentionally wider
// than next-intl's own `NamespacedMessageKeys` (activity-format.ts's own comment): sound at
// runtime, just not something `tsc` can verify through the structural type on its own.
const tFr = createTranslator({
  locale: "fr",
  messages: { "backoffice-product-sheet": frSheet },
  namespace: "backoffice-product-sheet",
}) as unknown as Translate;
const tEn = createTranslator({
  locale: "en",
  messages: { "backoffice-product-sheet": enSheet },
  namespace: "backoffice-product-sheet",
}) as unknown as Translate;

describe("formatCostMicros", () => {
  it("formats micros as euros with 3 decimals", () => {
    expect(formatCostMicros(4_000)).toBe("0,004 €");
    expect(formatCostMicros(5_000)).toBe("0,005 €");
  });

  it("adds decimals for a cost under a tenth of a cent", () => {
    expect(formatCostMicros(295)).toBe("0,0003 €");
  });

  it("shows 0,000 € for a null cost (a failed generation)", () => {
    expect(formatCostMicros(null)).toBe("0,000 €");
  });
});

describe("formatRelative", () => {
  const now = new Date("2026-01-01T12:00:00.000Z");

  it("shows minutes under an hour, in French", () => {
    expect(formatRelative(new Date("2026-01-01T11:58:00.000Z"), now, tFr)).toBe("il y a 2 min");
    expect(formatRelative(new Date("2026-01-01T11:51:00.000Z"), now, tFr)).toBe("il y a 9 min");
  });

  it("shows hours under a day, in French", () => {
    expect(formatRelative(new Date("2026-01-01T11:00:00.000Z"), now, tFr)).toBe("il y a 1 h");
    expect(formatRelative(new Date("2026-01-01T09:00:00.000Z"), now, tFr)).toBe("il y a 3 h");
  });

  it("shows days for a full day or more, in French (no plural marker)", () => {
    expect(formatRelative(new Date("2025-12-30T12:00:00.000Z"), now, tFr)).toBe("il y a 2 j");
  });

  it("shows a dedicated label for under a minute, in French", () => {
    expect(formatRelative(new Date("2026-01-01T11:59:30.000Z"), now, tFr)).toBe("à l'instant");
  });

  it("shows minutes and hours in English, not a French calque", () => {
    expect(formatRelative(new Date("2026-01-01T11:58:00.000Z"), now, tEn)).toBe("2 min ago");
    expect(formatRelative(new Date("2026-01-01T11:00:00.000Z"), now, tEn)).toBe("1h ago");
    expect(formatRelative(new Date("2026-01-01T11:59:30.000Z"), now, tEn)).toBe("just now");
  });

  // The ICU plural this spec requires: English "day"/"days" genuinely inflects (unlike the
  // abbreviated French "j", invariant), so 1 day and 2 days must render differently in English.
  it("pluralizes days in English (ICU plural), singular for exactly one day", () => {
    expect(formatRelative(new Date("2025-12-31T12:00:00.000Z"), now, tEn)).toBe("1 day ago");
    expect(formatRelative(new Date("2025-12-30T12:00:00.000Z"), now, tEn)).toBe("2 days ago");
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
  it("labels a purchase movement with its pack size, in French", () => {
    expect(movementLabel({ reason: "purchase", packCredits: 10 }, tFr)).toBe("Achat pack 10");
  });

  it("falls back to a generic label when a purchase movement has no pack credits", () => {
    expect(movementLabel({ reason: "purchase", packCredits: null }, tFr)).toBe("Achat");
  });

  it("labels the other three reasons, in French", () => {
    expect(movementLabel({ reason: "generation", packCredits: null }, tFr)).toBe("Génération");
    expect(movementLabel({ reason: "refund", packCredits: null }, tFr)).toBe("Remboursement");
    expect(movementLabel({ reason: "signup_bonus", packCredits: null }, tFr)).toBe("Bonus inscription");
  });

  it("labels every reason in English", () => {
    expect(movementLabel({ reason: "purchase", packCredits: 10 }, tEn)).toBe("Pack 10 purchase");
    expect(movementLabel({ reason: "purchase", packCredits: null }, tEn)).toBe("Purchase");
    expect(movementLabel({ reason: "generation", packCredits: null }, tEn)).toBe("Generation");
    expect(movementLabel({ reason: "refund", packCredits: null }, tEn)).toBe("Refund");
    expect(movementLabel({ reason: "signup_bonus", packCredits: null }, tEn)).toBe("Signup bonus");
  });
});

describe("generationStatus", () => {
  it("succeeded -> OK, in French and English", () => {
    expect(generationStatus({ status: "succeeded", refunded: false }, tFr)).toEqual({ label: "OK", variant: "ok" });
    expect(generationStatus({ status: "succeeded", refunded: false }, tEn)).toEqual({ label: "OK", variant: "ok" });
  });

  it("pending -> En cours / In progress", () => {
    expect(generationStatus({ status: "pending", refunded: false }, tFr)).toEqual({
      label: "En cours",
      variant: "pending",
    });
    expect(generationStatus({ status: "pending", refunded: false }, tEn)).toEqual({
      label: "In progress",
      variant: "pending",
    });
  });

  it("failed and refunded -> Erreur · remboursé / Error · refunded", () => {
    expect(generationStatus({ status: "failed", refunded: true }, tFr)).toEqual({
      label: "Erreur · remboursé",
      variant: "error",
    });
    expect(generationStatus({ status: "failed", refunded: true }, tEn)).toEqual({
      label: "Error · refunded",
      variant: "error",
    });
  });

  it("failed and not (yet) refunded -> Erreur / Error", () => {
    expect(generationStatus({ status: "failed", refunded: false }, tFr)).toEqual({
      label: "Erreur",
      variant: "error",
    });
    expect(generationStatus({ status: "failed", refunded: false }, tEn)).toEqual({
      label: "Error",
      variant: "error",
    });
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
  it("shows only the headline when there are no purchases, in French", () => {
    expect(purchaseSummaryLines({ count: 0, revenueCents: 0, byPack: [] }, tFr)).toEqual(["0 achat · 0,00 €"]);
  });

  it("pluralizes achats and shows the pack breakdown, matching the mockup", () => {
    expect(
      purchaseSummaryLines(
        {
          count: 14,
          revenueCents: 7_200,
          byPack: [
            { credits: 10, count: 11 },
            { credits: 50, count: 3 },
          ],
        },
        tFr,
      ),
    ).toEqual(["14 achats · 72,00 €", "Pack 10 : 11 · Pack 50 : 3"]);
  });

  it("does not pluralize a single purchase, in French", () => {
    expect(purchaseSummaryLines({ count: 1, revenueCents: 490, byPack: [{ credits: 10, count: 1 }] }, tFr)).toEqual([
      "1 achat · 4,90 €",
      "Pack 10 : 1",
    ]);
  });

  // The ICU plural this spec requires for purchases: "1 purchase" vs "14 purchases" in English.
  // The amount itself stays fr-FR formatted (formatEuroCents, portfolio/format.ts): that helper
  // is outside this lot's Périmètre and not yet locale-aware — a follow-up dependency, not a bug
  // here (see this spec's report).
  it("pluralizes purchases in English (ICU plural), singular for exactly one", () => {
    expect(purchaseSummaryLines({ count: 1, revenueCents: 490, byPack: [] }, tEn)).toEqual(["1 purchase · 4,90 €"]);
    expect(purchaseSummaryLines({ count: 14, revenueCents: 7_200, byPack: [{ credits: 10, count: 11 }] }, tEn)).toEqual(
      ["14 purchases · 72,00 €", "Pack 10: 11"],
    );
  });
});
