import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { Theme } from "@/lib/dal/themes";
import { parseImportedConfig, resolveImportedThemeId } from "./import-config";

const themeId = "3f6a6a1e-6b0b-4e9a-8b1a-2f6a1a2b3c4d";
const otherThemeId = "8b1a6a1e-6b0b-4e9a-8b1a-2f6a1a2b3c99";

const themes: Theme[] = [
  {
    id: themeId,
    slug: "neon",
    name: "Neon",
    tokens: {} as Theme["tokens"],
    landingVariant: "centered",
    isSeed: true,
  },
  {
    id: otherThemeId,
    slug: "editorial",
    name: "Editorial",
    tokens: {} as Theme["tokens"],
    landingVariant: "centered",
    isSeed: true,
  },
];

const fallbackThemeId = otherThemeId;

const bioInstagramFixture = readFileSync(join(process.cwd(), "fixtures/bio-instagram.config.json"), "utf-8");

describe("resolveImportedThemeId", () => {
  it("keeps a candidate that matches an existing theme's real id", () => {
    expect(resolveImportedThemeId(themeId, themes, fallbackThemeId)).toBe(themeId);
  });

  it("resolves a candidate matching an existing theme's name, case-insensitively", () => {
    expect(resolveImportedThemeId("Neon", themes, fallbackThemeId)).toBe(themeId);
    expect(resolveImportedThemeId("neon", themes, fallbackThemeId)).toBe(themeId);
  });

  it("falls back when the candidate matches neither an id nor a name", () => {
    expect(resolveImportedThemeId("unknown-theme", themes, fallbackThemeId)).toBe(fallbackThemeId);
  });

  it("falls back when the candidate is missing entirely", () => {
    expect(resolveImportedThemeId(undefined, themes, fallbackThemeId)).toBe(fallbackThemeId);
  });

  it("falls back when the candidate is not a string", () => {
    expect(resolveImportedThemeId(42, themes, fallbackThemeId)).toBe(fallbackThemeId);
  });
});

describe("parseImportedConfig", () => {
  it("reports malformed JSON as a form error", () => {
    const result = parseImportedConfig("not json", themes, fallbackThemeId);
    expect(result).toEqual({ ok: false, formError: "Configuration JSON illisible" });
  });

  it("reports a non-object JSON value as a form error", () => {
    const result = parseImportedConfig("42", themes, fallbackThemeId);
    expect(result).toEqual({ ok: false, formError: "Configuration JSON illisible" });
  });

  it("imports the bio-instagram fixture (no themeId) with the fallback theme, every field intact", () => {
    const result = parseImportedConfig(bioInstagramFixture, themes, fallbackThemeId);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok: true");
    expect(result.config.themeId).toBe(fallbackThemeId);
    expect(result.config.slug).toBe("bio-instagram");
    expect(result.config.landing.exampleOutput).toContain("Coffee-first designer");
    expect(result.config.landing.steps).toHaveLength(3);
    expect(result.config.generation.systemPrompt).toContain("social media copywriter");
  });

  it("keeps an unchanged themeId that matches an existing theme's real id", () => {
    const raw = JSON.stringify({ ...JSON.parse(bioInstagramFixture), themeId });
    const result = parseImportedConfig(raw, themes, fallbackThemeId);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok: true");
    expect(result.config.themeId).toBe(themeId);
  });

  it("resolves a themeId given as a theme name instead of an id", () => {
    const raw = JSON.stringify({ ...JSON.parse(bioInstagramFixture), themeId: "Neon" });
    const result = parseImportedConfig(raw, themes, fallbackThemeId);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok: true");
    expect(result.config.themeId).toBe(themeId);
  });

  it("falls back to the current theme when themeId matches neither an id nor a name", () => {
    const raw = JSON.stringify({ ...JSON.parse(bioInstagramFixture), themeId: "unknown-theme" });
    const result = parseImportedConfig(raw, themes, fallbackThemeId);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok: true");
    expect(result.config.themeId).toBe(fallbackThemeId);
  });

  it("returns per-step errors keyed like saveProduct's own, for a structurally invalid config", () => {
    const invalid = {
      ...JSON.parse(bioInstagramFixture),
      landing: { ...JSON.parse(bioInstagramFixture).landing, headline: "" },
    };
    const result = parseImportedConfig(JSON.stringify(invalid), themes, fallbackThemeId);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected ok: false");
    expect("errors" in result && result.errors["landing.headline"]).toBe("Ce champ est requis");
  });
});
