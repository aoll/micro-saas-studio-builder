import { describe, expect, it } from "vitest";
import { stepOfPath, validateStep } from "./validation";

describe("stepOfPath", () => {
  it("maps a slug path to step 1", () => {
    expect(stepOfPath(["slug"])).toBe(1);
  });

  it("maps a branding path to step 2", () => {
    expect(stepOfPath(["branding", "primaryColor"])).toBe(2);
  });

  it("maps a landing path to step 3", () => {
    expect(stepOfPath(["landing", "faq", 0, "answer"])).toBe(3);
  });

  it("maps an inputs path to step 4", () => {
    expect(stepOfPath(["inputs", 1, "key"])).toBe(4);
  });
});

describe("validateStep", () => {
  it("step 1: a reserved slug reports only slug", () => {
    const errors = validateStep(1, { slug: "admin" });
    expect(errors).toEqual({ slug: "Ce slug est réservé" });
  });

  it("step 4: duplicate keys report the second occurrence, even though other steps are still blank", () => {
    const errors = validateStep(4, {
      inputs: [
        { key: "sujet", label: "Sujet", type: "text", required: true },
        { key: "sujet", label: "Autre", type: "text", required: false },
      ],
    });
    expect(errors).toEqual({ "inputs.1.key": "Clé déjà utilisée" });
  });

  it("step 3: a 61-character SEO title reports the 60-character limit", () => {
    const errors = validateStep(3, {
      landing: {
        headline: "H",
        subheadline: "S",
        faq: [],
        seoTitle: "x".repeat(61),
        seoDescription: "D",
      },
    });
    expect(errors["landing.seoTitle"]).toBe("60 caractères maximum");
  });

  it("keeps only the first message per path", () => {
    const errors = validateStep(1, { slug: "Admin " });
    expect(Object.keys(errors).filter((path) => path === "slug")).toHaveLength(1);
  });

  it("returns no error for a fully valid step", () => {
    const errors = validateStep(1, { slug: "lettre-pro-2" });
    expect(errors).toEqual({});
  });

  it("step 5: an unknown {{variable}} reports generation.promptTemplate, even with a step-4 issue in the same patch", () => {
    // Zod 4 skips `.superRefine` entirely when the base object already has
    // an issue (product-config.ts's comment): the duplicate inputs key
    // below makes that happen, so this only passes if validateStep checks
    // the template's variables directly instead of relying on the schema's
    // cross-field refinement.
    const errors = validateStep(5, {
      inputs: [
        { key: "sujet", label: "Sujet", type: "text", required: true },
        { key: "sujet", label: "Autre", type: "text", required: false },
      ],
      generation: { model: "anthropic/claude-haiku-4.5", promptTemplate: "Bonjour {{ton}}", outputType: "markdown" },
    });
    expect(errors["generation.promptTemplate"]).toBe("Variable {{ton}} sans champ correspondant");
  });

  it("step 5: an empty template reports the required error", () => {
    const errors = validateStep(5, {
      generation: { model: "anthropic/claude-haiku-4.5", promptTemplate: "", outputType: "markdown" },
    });
    expect(errors["generation.promptTemplate"]).toBeTruthy();
  });

  it("step 5: a template whose variables all match a field reports no error", () => {
    const errors = validateStep(5, {
      generation: {
        model: "anthropic/claude-haiku-4.5",
        promptTemplate: "Sujet : {{sujet}}",
        outputType: "markdown",
      },
    });
    expect(errors["generation.promptTemplate"]).toBeUndefined();
  });

  it("step 6: a cost per generation of 0 reports the minimum", () => {
    const errors = validateStep(6, {
      pricing: {
        freeCreditsOnSignup: 3,
        anonymousFreeGenerations: 1,
        costPerGeneration: 0,
        packs: [{ id: "pack-10", credits: 10, priceCents: 490 }],
      },
    });
    expect(errors["pricing.costPerGeneration"]).toBeTruthy();
  });

  it("step 6: a duplicate pack id reports the second occurrence", () => {
    const errors = validateStep(6, {
      pricing: {
        freeCreditsOnSignup: 3,
        anonymousFreeGenerations: 1,
        costPerGeneration: 1,
        packs: [
          { id: "pack-10", credits: 10, priceCents: 490 },
          { id: "pack-10", credits: 50, priceCents: 1490 },
        ],
      },
    });
    expect(errors["pricing.packs.1.id"]).toBe("Identifiant de pack déjà utilisé");
  });

  it("step 6: an empty packs array reports pricing.packs", () => {
    const errors = validateStep(6, {
      pricing: { freeCreditsOnSignup: 3, anonymousFreeGenerations: 1, costPerGeneration: 1, packs: [] },
    });
    expect(errors["pricing.packs"]).toBeTruthy();
  });
});
