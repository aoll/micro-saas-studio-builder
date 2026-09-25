import { describe, expect, it } from "vitest";
import { landingVariantSchema, themeTokensSchema } from "@/lib/schemas/theme-tokens";
import { z } from "zod";
import { toThemeErrors } from "./theme-errors";

const VALID_COLOR_SET = {
  background: "#fff",
  foreground: "#fff",
  card: "#fff",
  cardForeground: "#fff",
  primary: "#fff",
  primaryForeground: "#fff",
  secondary: "#fff",
  secondaryForeground: "#fff",
  muted: "#fff",
  mutedForeground: "#fff",
  accent: "#fff",
  accentForeground: "#fff",
  destructive: "#fff",
  border: "#fff",
  input: "#fff",
  ring: "#fff",
};

const schema = z.object({ tokens: themeTokensSchema, landingVariant: landingVariantSchema });

function parseErrors(overrides: { light?: Partial<typeof VALID_COLOR_SET>; radius?: string; landingVariant?: string }) {
  const candidate = {
    tokens: {
      light: { ...VALID_COLOR_SET, ...overrides.light },
      dark: VALID_COLOR_SET,
      fontKey: "sans",
      radius: overrides.radius ?? "0.5rem",
    },
    landingVariant: overrides.landingVariant ?? "centered",
  };
  const result = schema.safeParse(candidate);
  if (result.success) throw new Error("expected a validation failure in this test fixture");
  return result.error.issues;
}

describe("toThemeErrors", () => {
  it("translates an invalid color into a French message keyed by its dotted path", () => {
    const errors = toThemeErrors(parseErrors({ light: { background: "notacolor" } }));
    expect(errors["tokens.light.background"]).toBe("Doit être une couleur CSS valide (#hex ou oklch/hsl/rgb…)");
  });

  it("translates an invalid radius into a French message", () => {
    const errors = toThemeErrors(parseErrors({ radius: "not-a-length" }));
    expect(errors["tokens.radius"]).toBe("Doit être une longueur CSS en rem ou px (ex. 0.5rem)");
  });

  it("keeps the first message per path when several issues share the same path", () => {
    const issues = parseErrors({ light: { background: "notacolor" } });
    const doubled = [...issues, { ...issues[0]!, message: "a second, later issue on the same path" }];
    const errors = toThemeErrors(doubled);
    expect(errors["tokens.light.background"]).toBe("Doit être une couleur CSS valide (#hex ou oklch/hsl/rgb…)");
  });

  it("keeps an unmapped issue message as-is (falls back to the raw Zod message)", () => {
    const errors = toThemeErrors(parseErrors({ landingVariant: "not-a-variant" }));
    expect(errors.landingVariant).toBe('Invalid option: expected one of "centered"|"split"|"minimal"');
  });

  it("returns an empty object for an empty issue list", () => {
    expect(toThemeErrors([])).toEqual({});
  });
});
