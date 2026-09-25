import { describe, expect, it } from "vitest";
import type { ThemeTokens } from "@/lib/schemas/theme-tokens";
import { previewCssVars } from "./preview-vars";

const COLOR_SET = {
  background: "#111111",
  foreground: "#222222",
  card: "#333333",
  cardForeground: "#444444",
  primary: "#555555",
  primaryForeground: "#666666",
  secondary: "#777777",
  secondaryForeground: "#888888",
  muted: "#999999",
  mutedForeground: "#aaaaaa",
  accent: "#bbbbbb",
  accentForeground: "#cccccc",
  destructive: "#dddddd",
  border: "#eeeeee",
  input: "#ffffff",
  ring: "#000000",
};

const TOKENS: ThemeTokens = {
  light: { ...COLOR_SET },
  dark: { ...COLOR_SET, background: "#000000", foreground: "#ffffff" },
  fontKey: "sans",
  radius: "0.75rem",
};

describe("previewCssVars", () => {
  it("maps every camelCase color key of the chosen mode to a kebab-case shadcn variable", () => {
    const vars = previewCssVars(TOKENS, "light") as Record<string, string>;
    expect(vars["--background"]).toBe("#111111");
    expect(vars["--card-foreground"]).toBe("#444444");
    expect(vars["--primary-foreground"]).toBe("#666666");
    expect(vars["--muted-foreground"]).toBe("#aaaaaa");
    expect(vars["--accent-foreground"]).toBe("#cccccc");
  });

  it("switches mode to dark's own tokens", () => {
    const vars = previewCssVars(TOKENS, "dark") as Record<string, string>;
    expect(vars["--background"]).toBe("#000000");
    expect(vars["--foreground"]).toBe("#ffffff");
  });

  it("includes --radius from the tokens, not the per-mode colors", () => {
    const vars = previewCssVars(TOKENS, "light") as Record<string, string>;
    expect(vars["--radius"]).toBe("0.75rem");
  });

  it("produces exactly the 16 shadcn color variables plus --radius (17 keys)", () => {
    const vars = previewCssVars(TOKENS, "light");
    expect(Object.keys(vars)).toHaveLength(17);
  });
});
