// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { screen } from "@testing-library/dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ThemeTokens } from "@/lib/schemas/theme-tokens";
import { ThemeThumbnail } from "./theme-thumbnail";

// next/font/google's real module only exists at Next.js build time
// (lib/fonts.test.ts's comment): mocked the same way here.
vi.mock("next/font/google", () => {
  const loader = () => ({ variable: "--font-theme", className: "font-mock" });
  return { Fraunces: loader, Space_Grotesk: loader, Inter: loader, Nunito: loader };
});

afterEach(cleanup);

const tokens: ThemeTokens = {
  light: {
    background: "#faf7f2",
    foreground: "#2b2620",
    card: "#ffffff",
    cardForeground: "#2b2620",
    primary: "#8a5a34",
    primaryForeground: "#ffffff",
    secondary: "#efe7da",
    secondaryForeground: "#2b2620",
    muted: "#efe7da",
    mutedForeground: "#6b6357",
    accent: "#cbb994",
    accentForeground: "#2b2620",
    destructive: "#b3261e",
    border: "#e3dccb",
    input: "#e3dccb",
    ring: "#8a5a34",
  },
  dark: {
    background: "#1c1712",
    foreground: "#f4efe4",
    card: "#251f18",
    cardForeground: "#f4efe4",
    primary: "#c98f5e",
    primaryForeground: "#1c1712",
    secondary: "#332a20",
    secondaryForeground: "#f4efe4",
    muted: "#332a20",
    mutedForeground: "#b3a891",
    accent: "#8a5a34",
    accentForeground: "#f4efe4",
    destructive: "#ff6961",
    border: "#3a3025",
    input: "#3a3025",
    ring: "#c98f5e",
  },
  fontKey: "serif",
  radius: "0.5rem",
};

describe("ThemeThumbnail", () => {
  it("is decorative: hidden from assistive tech", () => {
    render(<ThemeThumbnail tokens={tokens} landingVariant="centered" name="Editorial" />);
    const root = screen.getByTestId("theme-thumbnail");
    expect(root.getAttribute("aria-hidden")).toBe("true");
  });

  it("exposes the landing variant as a data attribute", () => {
    render(<ThemeThumbnail tokens={tokens} landingVariant="split" />);
    const root = screen.getByTestId("theme-thumbnail");
    expect(root.getAttribute("data-variant")).toBe("split");
  });

  it("renders the theme's name when given", () => {
    render(<ThemeThumbnail tokens={tokens} landingVariant="centered" name="Editorial" />);
    expect(screen.getByText("Editorial")).toBeTruthy();
  });

  it("paints the light background and primary tokens inline", () => {
    // jsdom normalizes a `#rrggbb` style value to `rgb(r, g, b)`: compare
    // through the same CSSStyleDeclaration parser instead of the raw string.
    const expected = (hex: string) => {
      const probe = document.createElement("div");
      probe.style.backgroundColor = hex;
      return probe.style.backgroundColor;
    };

    render(<ThemeThumbnail tokens={tokens} landingVariant="centered" />);
    const root = screen.getByTestId("theme-thumbnail");
    expect(root.style.backgroundColor).toBe(expected(tokens.light.background));
    const accent = screen.getByTestId("theme-thumbnail-accent");
    expect(accent.style.backgroundColor).toBe(expected(tokens.light.primary));
  });

  it("applies the theme's radius to the root", () => {
    render(<ThemeThumbnail tokens={tokens} landingVariant="centered" />);
    const root = screen.getByTestId("theme-thumbnail");
    expect(root.style.borderRadius).toBe(tokens.radius);
  });
});
