// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { screen } from "@testing-library/dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ThemeTokens } from "@/lib/schemas/theme-tokens";
import { ThemePreview } from "./theme-preview";

// next/font/google's real module only exists at Next.js build time
// (lib/fonts.test.ts's comment).
vi.mock("next/font/google", () => {
  const loader = () => ({ variable: "--font-theme", className: "font-mock" });
  return { Fraunces: loader, Space_Grotesk: loader, Inter: loader, Nunito: loader };
});

afterEach(cleanup);

const COLOR_SET = {
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
};

const tokens: ThemeTokens = {
  light: { ...COLOR_SET },
  dark: { ...COLOR_SET, background: "#1c1712", foreground: "#f4efe4" },
  fontKey: "serif",
  radius: "0.5rem",
};

describe("ThemePreview", () => {
  it("shows the given sample product's name as the mini landing's headline", () => {
    render(<ThemePreview tokens={tokens} landingVariant="centered" mode="light" sampleProductName="LettrePro" />);
    expect(screen.getByText("LettrePro")).toBeTruthy();
  });

  it("falls back to a generic headline when there is no product on the theme", () => {
    render(<ThemePreview tokens={tokens} landingVariant="centered" mode="light" />);
    expect(screen.getByText("Produit exemple")).toBeTruthy();
  });

  it("exposes the mode as a data attribute", () => {
    render(<ThemePreview tokens={tokens} landingVariant="centered" mode="dark" />);
    expect(screen.getByTestId("theme-preview").getAttribute("data-mode")).toBe("dark");
  });

  it("exposes the landing variant as a data attribute", () => {
    render(<ThemePreview tokens={tokens} landingVariant="split" mode="light" />);
    expect(screen.getByTestId("theme-preview").getAttribute("data-variant")).toBe("split");
  });

  it("applies the theme's font className", () => {
    render(<ThemePreview tokens={tokens} landingVariant="centered" mode="light" />);
    expect(screen.getByTestId("theme-preview").className).toContain("font-mock");
  });

  it("sets the chosen mode's tokens as CSS custom properties on the root", () => {
    render(<ThemePreview tokens={tokens} landingVariant="centered" mode="dark" />);
    const root = screen.getByTestId("theme-preview");
    expect(root.style.getPropertyValue("--background")).toBe("#1c1712");
    expect(root.style.getPropertyValue("--primary")).toBe(tokens.light.primary);
    expect(root.style.getPropertyValue("--radius")).toBe(tokens.radius);
  });

  it("hides the subheadline for the minimal variant", () => {
    render(<ThemePreview tokens={tokens} landingVariant="minimal" mode="light" sampleProductName="NomDeMarque" />);
    expect(screen.queryByText(/Un sous-titre de démonstration/)).toBeNull();
  });

  it("shows the subheadline for the centered and split variants", () => {
    render(<ThemePreview tokens={tokens} landingVariant="centered" mode="light" />);
    expect(screen.getByText(/Un sous-titre de démonstration/)).toBeTruthy();
  });

  it("shows an example aside only for the split variant", () => {
    render(<ThemePreview tokens={tokens} landingVariant="split" mode="light" />);
    expect(screen.getByTestId("theme-preview-example")).toBeTruthy();
  });

  it("does not show the example aside for centered or minimal", () => {
    render(<ThemePreview tokens={tokens} landingVariant="centered" mode="light" />);
    expect(screen.queryByTestId("theme-preview-example")).toBeNull();
  });

  it("renders a components column with a primary and a destructive swatch", () => {
    render(<ThemePreview tokens={tokens} landingVariant="centered" mode="light" />);
    const primary = screen.getByTestId("theme-preview-button-primary");
    const destructive = screen.getByTestId("theme-preview-badge-destructive");
    expect(primary.style.backgroundColor).toBe("var(--primary)");
    expect(destructive.style.backgroundColor).toBe("var(--destructive)");
  });
});
