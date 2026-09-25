import { describe, expect, it } from "vitest";
import { thresholdsInputSchema } from "@/lib/schemas/inputs";
import { issuesToErrors } from "./validation";

describe("issuesToErrors", () => {
  it("translates the minVisits lower bound", () => {
    const result = thresholdsInputSchema.safeParse({
      minVisits: 0,
      killMaxConversion: 0.02,
      scaleMinConversion: 0.05,
      scaleRequiresPositiveMargin: true,
    });
    expect(issuesToErrors(result.error!.issues)).toEqual({ minVisits: "Doit être au moins 1" });
  });

  it("translates kill >= scale to a French message on scaleMinConversion", () => {
    const result = thresholdsInputSchema.safeParse({
      minVisits: 1000,
      killMaxConversion: 0.06,
      scaleMinConversion: 0.05,
      scaleRequiresPositiveMargin: true,
    });
    expect(issuesToErrors(result.error!.issues)).toEqual({
      scaleMinConversion: "Le seuil « à scaler » doit être supérieur au seuil « à couper »",
    });
  });

  it("translates a NaN percent (cleared field) to a French message", () => {
    const result = thresholdsInputSchema.safeParse({
      minVisits: 1000,
      killMaxConversion: NaN,
      scaleMinConversion: 0.05,
      scaleRequiresPositiveMargin: true,
    });
    expect(issuesToErrors(result.error!.issues)).toEqual({ killMaxConversion: "Valeur invalide" });
  });

  it("keeps only the first message per path", () => {
    const result = thresholdsInputSchema.safeParse({
      minVisits: 0,
      killMaxConversion: 0.06,
      scaleMinConversion: 0.05,
      scaleRequiresPositiveMargin: true,
    });
    const errors = issuesToErrors(result.error!.issues);
    expect(Object.keys(errors)).toEqual(["minVisits", "scaleMinConversion"]);
  });
});
