import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";
import { thresholdsInputSchema } from "@/lib/schemas/inputs";
import fr from "@/messages/fr/backoffice-settings.json";
import en from "@/messages/en/backoffice-settings.json";
import { issuesToErrors, type Translate } from "./validation";

// `Translate`'s `key: string` is intentionally wider than next-intl's own
// `NamespacedMessageKeys` (validation.ts's own comment): sound at runtime, just not something
// `tsc` can verify through the structural type on its own.
const tFr = createTranslator({
  locale: "fr",
  messages: { "backoffice-settings": fr },
  namespace: "backoffice-settings",
}) as unknown as Translate;
const tEn = createTranslator({
  locale: "en",
  messages: { "backoffice-settings": en },
  namespace: "backoffice-settings",
}) as unknown as Translate;

describe("issuesToErrors", () => {
  it("translates the minVisits lower bound (fr)", () => {
    const result = thresholdsInputSchema.safeParse({
      minVisits: 0,
      killMaxConversion: 0.02,
      scaleMinConversion: 0.05,
      scaleRequiresPositiveMargin: true,
    });
    expect(issuesToErrors(result.error!.issues, tFr)).toEqual({ minVisits: "Doit être au moins 1" });
  });

  it("translates the minVisits lower bound (en)", () => {
    const result = thresholdsInputSchema.safeParse({
      minVisits: 0,
      killMaxConversion: 0.02,
      scaleMinConversion: 0.05,
      scaleRequiresPositiveMargin: true,
    });
    expect(issuesToErrors(result.error!.issues, tEn)).toEqual({ minVisits: "Must be at least 1" });
  });

  it("translates kill >= scale to a message on scaleMinConversion (fr)", () => {
    const result = thresholdsInputSchema.safeParse({
      minVisits: 1000,
      killMaxConversion: 0.06,
      scaleMinConversion: 0.05,
      scaleRequiresPositiveMargin: true,
    });
    expect(issuesToErrors(result.error!.issues, tFr)).toEqual({
      scaleMinConversion: "Le seuil « à scaler » doit être supérieur au seuil « à couper »",
    });
  });

  it("translates kill >= scale to a message on scaleMinConversion (en)", () => {
    const result = thresholdsInputSchema.safeParse({
      minVisits: 1000,
      killMaxConversion: 0.06,
      scaleMinConversion: 0.05,
      scaleRequiresPositiveMargin: true,
    });
    expect(issuesToErrors(result.error!.issues, tEn)).toEqual({
      scaleMinConversion: 'The "scale" threshold must be greater than the "cut" threshold',
    });
  });

  it("translates a NaN percent (cleared field) to a message (fr)", () => {
    const result = thresholdsInputSchema.safeParse({
      minVisits: 1000,
      killMaxConversion: NaN,
      scaleMinConversion: 0.05,
      scaleRequiresPositiveMargin: true,
    });
    expect(issuesToErrors(result.error!.issues, tFr)).toEqual({ killMaxConversion: "Valeur invalide" });
  });

  it("translates a NaN percent (cleared field) to a message (en)", () => {
    const result = thresholdsInputSchema.safeParse({
      minVisits: 1000,
      killMaxConversion: NaN,
      scaleMinConversion: 0.05,
      scaleRequiresPositiveMargin: true,
    });
    expect(issuesToErrors(result.error!.issues, tEn)).toEqual({ killMaxConversion: "Invalid value" });
  });

  it("keeps only the first message per path", () => {
    const result = thresholdsInputSchema.safeParse({
      minVisits: 0,
      killMaxConversion: 0.06,
      scaleMinConversion: 0.05,
      scaleRequiresPositiveMargin: true,
    });
    const errors = issuesToErrors(result.error!.issues, tFr);
    expect(Object.keys(errors)).toEqual(["minVisits", "scaleMinConversion"]);
  });
});
