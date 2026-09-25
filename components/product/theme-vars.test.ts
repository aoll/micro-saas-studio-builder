import { describe, expect, it } from "vitest";
import { themeTokensSchema } from "@/lib/schemas/theme-tokens";
import { themeCssVars } from "./theme-vars";

const colors = {
  background: "#ffffff",
  foreground: "#111111",
  card: "#f5f5f5",
  cardForeground: "#101010",
  primary: "#ff0055",
  primaryForeground: "#ffffff",
  secondary: "#eeeeee",
  secondaryForeground: "#222222",
  muted: "#dddddd",
  mutedForeground: "#555555",
  accent: "#00ffaa",
  accentForeground: "#000000",
  destructive: "#cc0000",
  border: "#cccccc",
  input: "#bbbbbb",
  ring: "#aaaaaa",
};

const tokens = themeTokensSchema.parse({
  light: colors,
  dark: { ...colors, background: "#000000", primary: "#ff88aa" },
  fontKey: "serif",
  radius: "0.5rem",
});

describe("themeCssVars", () => {
  it("maps camelCase tokens to --light-* / --dark-* kebab-case CSS variables", () => {
    const vars = themeCssVars(tokens, {}) as Record<string, string>;
    expect(vars["--light-primary"]).toBe("#ff0055");
    expect(vars["--dark-primary"]).toBe("#ff88aa");
    expect(vars["--light-card-foreground"]).toBe("#101010");
    expect(vars["--dark-card-foreground"]).toBe("#101010");
  });

  it("carries the radius as --radius", () => {
    const vars = themeCssVars(tokens, {}) as Record<string, string>;
    expect(vars["--radius"]).toBe("0.5rem");
  });

  it("has exactly 16 x 2 color variables plus --radius", () => {
    const vars = themeCssVars(tokens, {}) as Record<string, string>;
    expect(Object.keys(vars)).toHaveLength(33);
  });

  it("overrides both primaries with branding.primaryColor", () => {
    const vars = themeCssVars(tokens, { primaryColor: "#123456" }) as Record<string, string>;
    expect(vars["--light-primary"]).toBe("#123456");
    expect(vars["--dark-primary"]).toBe("#123456");
  });

  it("passes values through verbatim (schema already rejects unsafe characters)", () => {
    const oklchTokens = themeTokensSchema.parse({
      light: { ...colors, primary: "oklch(0.6 0.2 30)" },
      dark: colors,
      fontKey: "sans",
      radius: "10px",
    });
    const vars = themeCssVars(oklchTokens, {}) as Record<string, string>;
    expect(vars["--light-primary"]).toBe("oklch(0.6 0.2 30)");
  });
});
