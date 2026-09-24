import { describe, expect, expectTypeOf, it } from "vitest";
import {
  RESERVED_SLUGS,
  productConfigSchema,
  slugSchema,
  templateVariables,
  type ProductConfig,
} from "./product-config";

const validConfig = {
  slug: "lettre-motivation",
  name: "LettrePro",
  status: "test",
  themeId: "3f3f3f3f-3f3f-4f3f-8f3f-3f3f3f3f3f3f",
  locale: "fr",
  branding: { logoUrl: "https://example.com/logo.png", primaryColor: "#1a2b3c" },
  landing: {
    headline: "Une lettre de motivation en 2 minutes",
    subheadline: "Générée par IA, prête à envoyer",
    faq: [{ question: "Combien ça coûte ?", answer: "3 crédits offerts à l'inscription" }],
    seoTitle: "Générateur de lettre de motivation",
    seoDescription: "Créez une lettre de motivation percutante en quelques secondes grâce à l'IA.",
  },
  inputs: [
    { key: "poste", label: "Poste visé", type: "text", required: true },
    { key: "ton", label: "Ton", type: "select", required: false, options: ["formel", "dynamique"] },
  ],
  generation: {
    model: "anthropic/claude-haiku-4.5",
    promptTemplate: "Rédige une lettre de motivation pour {{poste}}, avec un ton {{ton}}.",
    outputType: "markdown",
  },
  pricing: {
    freeCreditsOnSignup: 3,
    anonymousFreeGenerations: 1,
    costPerGeneration: 1,
    packs: [
      { id: "pack-10", credits: 10, priceCents: 490 },
      { id: "pack-50", credits: 50, priceCents: 1490 },
    ],
  },
};

describe("productConfigSchema", () => {
  it("parses a config shaped like the LettrePro fixture", () => {
    const result = productConfigSchema.safeParse(validConfig);
    expect(result.success).toBe(true);
  });

  it("types status as the product status union", () => {
    expectTypeOf<ProductConfig["status"]>().toEqualTypeOf<"test" | "learn" | "scale" | "killed">();
  });

  it("rejects a {{variable}} with no matching input field", () => {
    const config = {
      ...validConfig,
      generation: { ...validConfig.generation, promptTemplate: "Rédige un post pour {{entreprise}}." },
    };
    const result = productConfigSchema.safeParse(config);
    expect(result.success).toBe(false);
    if (result.success) return;
    const issue = result.error.issues.find((i) => i.path.join(".") === "generation.promptTemplate");
    expect(issue?.message).toBe("Variable {{entreprise}} sans champ correspondant");
  });

  it("accepts a {{ variable }} with surrounding spaces that matches a field", () => {
    const config = {
      ...validConfig,
      generation: { ...validConfig.generation, promptTemplate: "Rédige une lettre pour {{ poste }}." },
    };
    expect(productConfigSchema.safeParse(config).success).toBe(true);
  });
});

describe("slugSchema", () => {
  it.each(RESERVED_SLUGS)("rejects the reserved slug %s", (slug) => {
    const result = slugSchema.safeParse(slug);
    expect(result.success).toBe(false);
  });

  it.each(["Lettre-Pro", "lettre_pro", "-x", "x-", "a--b", "sitemap.xml", "a"])(
    "rejects the malformed slug %s",
    (slug) => {
      expect(slugSchema.safeParse(slug).success).toBe(false);
    },
  );

  it("accepts a well-formed kebab-case slug", () => {
    expect(slugSchema.safeParse("lettre-pro").success).toBe(true);
  });

  it("rejects a config whose slug is reserved, with the slug path", () => {
    const config = { ...validConfig, slug: "admin" };
    const result = productConfigSchema.safeParse(config);
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues.some((i) => i.path.join(".") === "slug")).toBe(true);
  });
});

describe("productConfigSchema remaining refinements", () => {
  it("rejects duplicate input keys", () => {
    const config = {
      ...validConfig,
      inputs: [
        { key: "poste", label: "Poste visé", type: "text", required: true },
        { key: "poste", label: "Poste dupliqué", type: "text", required: true },
      ],
    };
    const result = productConfigSchema.safeParse(config);
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues.some((i) => i.path.join(".") === "inputs.1.key")).toBe(true);
  });

  it("rejects a select field with no options", () => {
    const config = {
      ...validConfig,
      inputs: [{ key: "ton", label: "Ton", type: "select", required: false, options: [] }],
      generation: { ...validConfig.generation, promptTemplate: "Rédige un texte, ton {{ton}}." },
    };
    expect(productConfigSchema.safeParse(config).success).toBe(false);
  });

  it("rejects duplicate pack ids", () => {
    const config = {
      ...validConfig,
      pricing: {
        ...validConfig.pricing,
        packs: [
          { id: "pack-10", credits: 10, priceCents: 490 },
          { id: "pack-10", credits: 50, priceCents: 1490 },
        ],
      },
    };
    const result = productConfigSchema.safeParse(config);
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues.some((i) => i.path.join(".") === "pricing.packs.1.id")).toBe(true);
  });

  it("rejects a costPerGeneration of zero", () => {
    const config = { ...validConfig, pricing: { ...validConfig.pricing, costPerGeneration: 0 } };
    expect(productConfigSchema.safeParse(config).success).toBe(false);
  });

  it("rejects an empty packs array", () => {
    const config = { ...validConfig, pricing: { ...validConfig.pricing, packs: [] } };
    expect(productConfigSchema.safeParse(config).success).toBe(false);
  });

  it("rejects a seoTitle of 61 characters", () => {
    const config = { ...validConfig, landing: { ...validConfig.landing, seoTitle: "a".repeat(61) } };
    expect(productConfigSchema.safeParse(config).success).toBe(false);
  });

  it("rejects a primaryColor that is not a hex color", () => {
    const config = { ...validConfig, branding: { ...validConfig.branding, primaryColor: "blue" } };
    expect(productConfigSchema.safeParse(config).success).toBe(false);
  });
});

describe("templateVariables", () => {
  it("extracts the deduplicated list of variables in order of appearance", () => {
    expect(templateVariables("{{a}} {{ b }} {{a}}")).toEqual(["a", "b"]);
  });
});
