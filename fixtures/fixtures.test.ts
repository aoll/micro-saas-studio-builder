import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { productConfigSchema } from "../lib/schemas/product-config";

// specs/DEMO-mode.md: the seeded story needs one config per locked
// product (lettre-pro, descri-pro, nom-de-marque), plus BioInsta's config
// as a fixture only — pasted live into the BO-05 form during the demo
// script, never seeded as a product row (docs/01 › Contenu des produits
// seedés). `bio-instagram.json` deliberately does not exist: no product
// row means no history to seed for it.
const CONFIG_SLUGS = ["lettre-pro", "descri-pro", "nom-de-marque", "bio-instagram"] as const;
const GENERATION_SLUGS = ["lettre-pro", "descri-pro", "nom-de-marque"] as const;

// The real themeId is only known once the seed inserts the theme row
// (scripts/seed.ts merges it in before parsing); a fixture's own JSON
// carries no themeId at all, exactly like lettre-pro.config.json.
const PLACEHOLDER_THEME_ID = "00000000-0000-0000-0000-000000000000";

const fixturesDir = new URL("./", import.meta.url);

function readConfig(slug: string): unknown {
  return JSON.parse(readFileSync(new URL(`${slug}.config.json`, fixturesDir), "utf8"));
}

function readGenerations(slug: string): unknown {
  return JSON.parse(readFileSync(new URL(`${slug}.json`, fixturesDir), "utf8"));
}

describe("product config fixtures", () => {
  it.each(CONFIG_SLUGS)("%s.config.json parses against productConfigSchema", (slug) => {
    const raw = readConfig(slug) as Record<string, unknown>;
    const parsed = productConfigSchema.safeParse({ ...raw, themeId: PLACEHOLDER_THEME_ID });
    expect(parsed.success).toBe(true);
  });

  it.each(CONFIG_SLUGS)("%s.config.json's slug field matches its file name", (slug) => {
    const raw = readConfig(slug) as { slug: string };
    expect(raw.slug).toBe(slug);
  });

  it("lettre-pro, descri-pro, nom-de-marque carry a non-empty systemPrompt", () => {
    for (const slug of ["lettre-pro", "descri-pro", "nom-de-marque"]) {
      const raw = readConfig(slug) as { generation: { systemPrompt?: string } };
      expect(raw.generation.systemPrompt?.length).toBeGreaterThan(0);
    }
  });

  it("nom-de-marque's output stays markdown (the frozen schema has no structured output)", () => {
    const raw = readConfig("nom-de-marque") as { generation: { outputType: string } };
    expect(raw.generation.outputType).toBe("markdown");
  });

  it("bio-instagram.config.json is locale en (docs/01: the demo creates it live, in English)", () => {
    const raw = readConfig("bio-instagram") as { locale: string };
    expect(raw.locale).toBe("en");
  });

  it("bio-instagram has no seeded generation fixture (never inserted as a product row)", () => {
    expect(() => readGenerations("bio-instagram")).toThrow();
  });
});

describe("generation fixtures", () => {
  it.each(GENERATION_SLUGS)("%s.json is a non-empty array of realistic generations", (slug) => {
    const generations = readGenerations(slug) as { input: Record<string, string>; text: string; usage: unknown }[];
    expect(Array.isArray(generations)).toBe(true);
    expect(generations.length).toBeGreaterThanOrEqual(5);
    for (const generation of generations) {
      expect(typeof generation.text).toBe("string");
      expect(generation.text.length).toBeGreaterThan(0);
      expect(generation.usage).toMatchObject({
        inputTokens: expect.any(Number),
        outputTokens: expect.any(Number),
        cachedInputTokens: expect.any(Number),
      });
    }
  });

  it.each(GENERATION_SLUGS)("%s.json's inputs only use the config's declared field keys", (slug) => {
    const config = readConfig(slug) as { inputs: { key: string; required: boolean }[] };
    const declaredKeys = new Set(config.inputs.map((input) => input.key));
    const requiredKeys = config.inputs.filter((input) => input.required).map((input) => input.key);
    const generations = readGenerations(slug) as { input: Record<string, string> }[];
    for (const generation of generations) {
      for (const key of Object.keys(generation.input)) {
        expect(declaredKeys.has(key)).toBe(true);
      }
      for (const key of requiredKeys) {
        expect(generation.input[key]).toBeTruthy();
      }
    }
  });
});
