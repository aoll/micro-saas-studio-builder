import { describe, expect, it } from "vitest";
import { stepOfPath, toFrenchMessage, validateStep } from "./validation";

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
    // productConfigSchema's single `.superRefine` reports both the
    // duplicate-key issue (inputs.1.key, step 4) and the unknown-variable
    // issue (generation.promptTemplate, step 5) from the same parse: this
    // pins that validateStep's step filtering keeps only the step-5 issue,
    // rather than dropping it or leaking the step-4 one onto step 5.
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

  // QA1-P5-E2 (docs/01-produit.md › Bloc Pricing, « Valeurs positives »):
  // every bounded numeric field of the schema must report a French
  // message, never Zod's raw "Too small: expected number to be >=…".
  it("step 6: a cost per generation of -1 reports the minimum in French", () => {
    const errors = validateStep(6, {
      pricing: {
        freeCreditsOnSignup: 3,
        anonymousFreeGenerations: 1,
        costPerGeneration: -1,
        packs: [{ id: "pack-10", credits: 10, priceCents: 490 }],
      },
    });
    expect(errors["pricing.costPerGeneration"]).toBe("Minimum : 1");
  });

  it("step 6: a non-integer cost per generation reports the integer message in French", () => {
    const errors = validateStep(6, {
      pricing: {
        freeCreditsOnSignup: 3,
        anonymousFreeGenerations: 1,
        costPerGeneration: 1.5,
        packs: [{ id: "pack-10", credits: 10, priceCents: 490 }],
      },
    });
    expect(errors["pricing.costPerGeneration"]).toBe("Doit être un nombre entier");
  });

  it("step 6: a negative free-credits-on-signup reports the minimum in French", () => {
    const errors = validateStep(6, {
      pricing: {
        freeCreditsOnSignup: -1,
        anonymousFreeGenerations: 1,
        costPerGeneration: 1,
        packs: [{ id: "pack-10", credits: 10, priceCents: 490 }],
      },
    });
    expect(errors["pricing.freeCreditsOnSignup"]).toBe("Minimum : 0");
  });

  it("step 6: a negative anonymous-free-generations reports the minimum in French", () => {
    const errors = validateStep(6, {
      pricing: {
        freeCreditsOnSignup: 3,
        anonymousFreeGenerations: -1,
        costPerGeneration: 1,
        packs: [{ id: "pack-10", credits: 10, priceCents: 490 }],
      },
    });
    expect(errors["pricing.anonymousFreeGenerations"]).toBe("Minimum : 0");
  });

  it("step 6: a pack with 0 credits reports the French exclusive-minimum message", () => {
    const errors = validateStep(6, {
      pricing: {
        freeCreditsOnSignup: 3,
        anonymousFreeGenerations: 1,
        costPerGeneration: 1,
        packs: [{ id: "pack-10", credits: 0, priceCents: 490 }],
      },
    });
    expect(errors["pricing.packs.0.credits"]).toBe("Doit être supérieur à 0");
  });

  it("step 6: a pack with 0 priceCents reports the French exclusive-minimum message", () => {
    const errors = validateStep(6, {
      pricing: {
        freeCreditsOnSignup: 3,
        anonymousFreeGenerations: 1,
        costPerGeneration: 1,
        packs: [{ id: "pack-10", credits: 10, priceCents: 0 }],
      },
    });
    expect(errors["pricing.packs.0.priceCents"]).toBe("Doit être supérieur à 0");
  });

  it("step 6: a non-integer pack credits reports the integer message in French", () => {
    const errors = validateStep(6, {
      pricing: {
        freeCreditsOnSignup: 3,
        anonymousFreeGenerations: 1,
        costPerGeneration: 1,
        packs: [{ id: "pack-10", credits: 2.5, priceCents: 490 }],
      },
    });
    expect(errors["pricing.packs.0.credits"]).toBe("Doit être un nombre entier");
  });
});

describe("toFrenchMessage: number origin (QA1-P5-E2)", () => {
  it("translates an inclusive too_small (e.g. `.min(0)`) to a French minimum", () => {
    const message = toFrenchMessage({
      code: "too_small",
      origin: "number",
      minimum: 0,
      inclusive: true,
      path: ["pricing", "freeCreditsOnSignup"],
      message: "Too small: expected number to be >=0",
    });
    expect(message).toBe("Minimum : 0");
  });

  it("translates an exclusive too_small (e.g. `.positive()`) to a French strict minimum", () => {
    const message = toFrenchMessage({
      code: "too_small",
      origin: "number",
      minimum: 0,
      inclusive: false,
      path: ["pricing", "packs", 0, "credits"],
      message: "Too small: expected number to be >0",
    });
    expect(message).toBe("Doit être supérieur à 0");
  });

  it("translates an inclusive too_big to a French maximum", () => {
    const message = toFrenchMessage({
      code: "too_big",
      origin: "number",
      maximum: 100,
      inclusive: true,
      path: ["pricing", "someBoundedField"],
      message: "Too big: expected number to be <=100",
    });
    expect(message).toBe("Maximum : 100");
  });

  it("translates an exclusive too_big to a French strict maximum", () => {
    const message = toFrenchMessage({
      code: "too_big",
      origin: "number",
      maximum: 100,
      inclusive: false,
      path: ["pricing", "someBoundedField"],
      message: "Too big: expected number to be <100",
    });
    expect(message).toBe("Doit être inférieur à 100");
  });

  it("translates a non-integer number (`z.int()`) to a French integer message", () => {
    const message = toFrenchMessage({
      code: "invalid_type",
      expected: "int",
      path: ["pricing", "costPerGeneration"],
      message: "Invalid input: expected int, received number",
    });
    expect(message).toBe("Doit être un nombre entier");
  });

  it("leaves a non-int invalid_type issue untranslated (not a bounded number case)", () => {
    const message = toFrenchMessage({
      code: "invalid_type",
      expected: "string",
      path: ["name"],
      message: "Invalid input: expected string, received number",
    });
    expect(message).toBe("Invalid input: expected string, received number");
  });
});
