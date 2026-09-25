import { describe, expect, it } from "vitest";
import { drawable, resolveOgColors } from "./og-colors";

const LIGHT_TOKENS = {
  background: "#ffffff",
  foreground: "#111111",
  card: "#ffffff",
  cardForeground: "#111111",
  primary: "rgb(220 38 38)",
  primaryForeground: "#fef2f2",
  secondary: "#f4f4f5",
  secondaryForeground: "#111111",
  muted: "#f4f4f5",
  mutedForeground: "hsl(240 4% 46%)",
  accent: "#f4f4f5",
  accentForeground: "#111111",
  destructive: "#dc2626",
  border: "#e4e4e7",
  input: "#e4e4e7",
  ring: "#dc2626",
};

describe("drawable", () => {
  it("keeps a #hex color", () => {
    expect(drawable("#ff00aa", "#000000")).toBe("#ff00aa");
  });

  it("keeps rgb() and rgba() colors", () => {
    expect(drawable("rgb(220 38 38)", "#000000")).toBe("rgb(220 38 38)");
    expect(drawable("rgba(220, 38, 38, 0.5)", "#000000")).toBe("rgba(220, 38, 38, 0.5)");
  });

  it("keeps hsl() and hsla() colors", () => {
    expect(drawable("hsl(240 4% 46%)", "#000000")).toBe("hsl(240 4% 46%)");
    expect(drawable("hsla(240, 4%, 46%, 0.5)", "#000000")).toBe("hsla(240, 4%, 46%, 0.5)");
  });

  it("falls back for an oklch color", () => {
    expect(drawable("oklch(0.6 0.2 30)", "#fallback")).toBe("#fallback");
  });

  it("falls back for anything else, including css keywords and unsafe values", () => {
    expect(drawable("papayawhip", "#fallback")).toBe("#fallback");
    expect(drawable("url(javascript:alert(1))", "#fallback")).toBe("#fallback");
  });
});

describe("resolveOgColors", () => {
  it("reads primary, onPrimary, background, foreground and mutedForeground from the light tokens", () => {
    const colors = resolveOgColors(LIGHT_TOKENS, {});
    expect(colors).toEqual({
      primary: "rgb(220 38 38)",
      onPrimary: "#fef2f2",
      background: "#ffffff",
      foreground: "#111111",
      mutedForeground: "hsl(240 4% 46%)",
    });
  });

  it("lets the branding primary color override the theme's primary", () => {
    const colors = resolveOgColors(LIGHT_TOKENS, { primaryColor: "#00ff00" });
    expect(colors.primary).toBe("#00ff00");
    expect(colors.onPrimary).toBe("#fef2f2");
  });

  it("falls back to a safe default when a token is not a drawable color", () => {
    const colors = resolveOgColors({ ...LIGHT_TOKENS, primary: "oklch(0.6 0.2 30)" }, {});
    expect(colors.primary).not.toContain("oklch");
  });
});
