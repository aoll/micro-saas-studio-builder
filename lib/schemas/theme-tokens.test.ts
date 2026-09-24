import { describe, expect, it } from "vitest";
import { landingVariantSchema, themeTokensSchema } from "./theme-tokens";

const colorTokens = {
  background: "#ffffff",
  foreground: "#0a0a0a",
  card: "#ffffff",
  cardForeground: "#0a0a0a",
  primary: "oklch(0.7 0.1 250)",
  primaryForeground: "#ffffff",
  secondary: "#f4f4f5",
  secondaryForeground: "#0a0a0a",
  muted: "#f4f4f5",
  mutedForeground: "#71717a",
  accent: "#f4f4f5",
  accentForeground: "#0a0a0a",
  destructive: "#ef4444",
  border: "#e4e4e7",
  input: "#e4e4e7",
  ring: "#a1a1aa",
};

const fullTokens = {
  light: colorTokens,
  dark: colorTokens,
  fontKey: "serif-editorial",
  radius: "0.5rem",
};

describe("themeTokensSchema", () => {
  it("parses a full light + dark token set", () => {
    expect(themeTokensSchema.safeParse(fullTokens).success).toBe(true);
  });

  it("rejects a token set missing dark", () => {
    const withoutDark: Partial<typeof fullTokens> = { ...fullTokens };
    delete withoutDark.dark;
    expect(themeTokensSchema.safeParse(withoutDark).success).toBe(false);
  });

  it("rejects a color value that could inject CSS", () => {
    const injected = { ...fullTokens, light: { ...colorTokens, primary: "red;}body{" } };
    expect(themeTokensSchema.safeParse(injected).success).toBe(false);
  });

  it("rejects a url() color value", () => {
    const injected = { ...fullTokens, light: { ...colorTokens, primary: "url(x)" } };
    expect(themeTokensSchema.safeParse(injected).success).toBe(false);
  });

  it("accepts a hex color", () => {
    const hex = { ...fullTokens, light: { ...colorTokens, primary: "#1a2b3c" } };
    expect(themeTokensSchema.safeParse(hex).success).toBe(true);
  });

  it("accepts an oklch color", () => {
    const oklch = { ...fullTokens, light: { ...colorTokens, primary: "oklch(0.7 0.1 250)" } };
    expect(themeTokensSchema.safeParse(oklch).success).toBe(true);
  });
});

describe("landingVariantSchema", () => {
  it.each(["centered", "split", "minimal"])("accepts %s", (value) => {
    expect(landingVariantSchema.safeParse(value).success).toBe(true);
  });

  it("rejects an unknown variant", () => {
    expect(landingVariantSchema.safeParse("hero").success).toBe(false);
  });
});
