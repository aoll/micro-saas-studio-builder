// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { screen } from "@testing-library/dom";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ThemeTokens } from "@/lib/schemas/theme-tokens";
import en from "@/messages/en/backoffice-themes.json";
import fr from "@/messages/fr/backoffice-themes.json";
import { ThemePreview } from "./theme-preview";

// next/font/google's real module only exists at Next.js build time
// (lib/fonts.test.ts's comment).
vi.mock("next/font/google", () => {
  const loader = () => ({ variable: "--font-theme", className: "font-mock" });
  return { Fraunces: loader, Space_Grotesk: loader, Inter: loader, Nunito: loader };
});

afterEach(cleanup);

// I18N-BACKOFFICE-STRINGS (lot 7): ThemePreview is only ever imported by
// theme-editor.tsx ('use client'), so it is part of the client bundle and
// can call useTranslations() itself, like signup-prompt.test.tsx's
// NextIntlClientProvider wrapper.
function renderUi(ui: React.ReactElement, locale: "fr" | "en" = "fr") {
  return render(
    <NextIntlClientProvider locale={locale} messages={{ "backoffice-themes": locale === "en" ? en : fr }}>
      {ui}
    </NextIntlClientProvider>,
  );
}

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
    renderUi(<ThemePreview tokens={tokens} landingVariant="centered" mode="light" sampleProductName="LettrePro" />);
    expect(screen.getByText("LettrePro")).toBeTruthy();
  });

  it("falls back to a generic headline when there is no product on the theme", () => {
    renderUi(<ThemePreview tokens={tokens} landingVariant="centered" mode="light" />);
    expect(screen.getByText("Produit exemple")).toBeTruthy();
  });

  it("exposes the mode as a data attribute", () => {
    renderUi(<ThemePreview tokens={tokens} landingVariant="centered" mode="dark" />);
    expect(screen.getByTestId("theme-preview").getAttribute("data-mode")).toBe("dark");
  });

  it("exposes the landing variant as a data attribute", () => {
    renderUi(<ThemePreview tokens={tokens} landingVariant="split" mode="light" />);
    expect(screen.getByTestId("theme-preview").getAttribute("data-variant")).toBe("split");
  });

  it("applies the theme's font className", () => {
    renderUi(<ThemePreview tokens={tokens} landingVariant="centered" mode="light" />);
    expect(screen.getByTestId("theme-preview").className).toContain("font-mock");
  });

  it("sets the chosen mode's tokens as CSS custom properties on the root", () => {
    renderUi(<ThemePreview tokens={tokens} landingVariant="centered" mode="dark" />);
    const root = screen.getByTestId("theme-preview");
    expect(root.style.getPropertyValue("--background")).toBe("#1c1712");
    expect(root.style.getPropertyValue("--primary")).toBe(tokens.light.primary);
    expect(root.style.getPropertyValue("--radius")).toBe(tokens.radius);
  });

  it("hides the subheadline for the minimal variant", () => {
    renderUi(<ThemePreview tokens={tokens} landingVariant="minimal" mode="light" sampleProductName="NomDeMarque" />);
    expect(screen.queryByText(/Un sous-titre de démonstration/)).toBeNull();
  });

  it("shows the subheadline for the centered and split variants", () => {
    renderUi(<ThemePreview tokens={tokens} landingVariant="centered" mode="light" />);
    expect(screen.getByText(/Un sous-titre de démonstration/)).toBeTruthy();
  });

  it("shows an example aside only for the split variant", () => {
    renderUi(<ThemePreview tokens={tokens} landingVariant="split" mode="light" />);
    expect(screen.getByTestId("theme-preview-example")).toBeTruthy();
  });

  it("does not show the example aside for centered or minimal", () => {
    renderUi(<ThemePreview tokens={tokens} landingVariant="centered" mode="light" />);
    expect(screen.queryByTestId("theme-preview-example")).toBeNull();
  });

  it("renders a components column with a primary and a destructive swatch", () => {
    renderUi(<ThemePreview tokens={tokens} landingVariant="centered" mode="light" />);
    const primary = screen.getByTestId("theme-preview-button-primary");
    const destructive = screen.getByTestId("theme-preview-badge-destructive");
    expect(primary.style.backgroundColor).toBe("var(--primary)");
    expect(destructive.style.backgroundColor).toBe("var(--destructive)");
  });

  it("renders every string translated for the en locale", () => {
    renderUi(<ThemePreview tokens={tokens} landingVariant="split" mode="light" />, "en");
    expect(screen.getByText("Sample product")).toBeTruthy();
    expect(screen.getByText("A sample subheadline for the preview.")).toBeTruthy();
    expect(screen.getByText("Try it")).toBeTruthy();
    expect(screen.getByText("Sample result")).toBeTruthy();
    expect(screen.getByTestId("theme-preview-button-primary").textContent).toBe("Primary");
    expect(screen.getByTestId("theme-preview-button-secondary").textContent).toBe("Secondary");
    expect(screen.getByTestId("theme-preview-badge-accent").textContent).toBe("Accent");
    expect(screen.getByTestId("theme-preview-badge-destructive").textContent).toBe("Error");
  });
});
