// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { screen } from "@testing-library/dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Theme } from "@/lib/dal/themes";
import type { ProductConfig } from "@/lib/schemas/product-config";
import type { ThemeTokens } from "@/lib/schemas/theme-tokens";

vi.mock("next/font/google", () => {
  const loader = () => ({ variable: "--font-theme", className: "font-mock" });
  return { Fraunces: loader, Space_Grotesk: loader, Inter: loader, Nunito: loader };
});

const { LandingPreview } = await import("./landing-preview");

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

const theme: Theme = {
  id: "theme-editorial",
  slug: "editorial",
  name: "Editorial",
  tokens,
  landingVariant: "centered",
  isSeed: true,
};

const landing: ProductConfig["landing"] = {
  headline: "Générez votre bio Instagram",
  subheadline: "En 10 secondes, sans compte",
  faq: [{ question: "Combien ça coûte ?", answer: "1 crédit par génération." }],
  seoTitle: "Générateur de bio Instagram",
  seoDescription: "Un outil IA pour votre bio.",
  exampleOutput: "🌱 Passionné(e) de café et de code",
};

const pricing: ProductConfig["pricing"] = {
  freeCreditsOnSignup: 3,
  anonymousFreeGenerations: 1,
  costPerGeneration: 1,
  packs: [{ id: "pack-10", credits: 10, priceCents: 490 }],
};

describe("LandingPreview", () => {
  it("is labelled as the landing preview", () => {
    render(<LandingPreview slug="bio-instagram" landing={landing} pricing={pricing} theme={theme} branding={{}} />);
    expect(screen.getByLabelText("Aperçu de la landing")).toBeTruthy();
  });

  it("shows the preview's title with the product's slug", () => {
    render(<LandingPreview slug="bio-instagram" landing={landing} pricing={pricing} theme={theme} branding={{}} />);
    expect(screen.getByText("Aperçu · /bio-instagram")).toBeTruthy();
  });

  it("shows the headline and subheadline live", () => {
    render(<LandingPreview slug="bio-instagram" landing={landing} pricing={pricing} theme={theme} branding={{}} />);
    expect(screen.getByText("Générez votre bio Instagram")).toBeTruthy();
    expect(screen.getByText("En 10 secondes, sans compte")).toBeTruthy();
  });

  it("applies the theme's background colour inline", () => {
    render(<LandingPreview slug="bio-instagram" landing={landing} pricing={pricing} theme={theme} branding={{}} />);
    const root = screen.getByLabelText("Aperçu de la landing");
    expect(root.style.backgroundColor).toBe("rgb(250, 247, 242)");
  });

  it("overrides the CTA's colour with the branding's primaryColor", () => {
    render(
      <LandingPreview
        slug="bio-instagram"
        landing={landing}
        pricing={pricing}
        theme={theme}
        branding={{ primaryColor: "#d946ef" }}
      />,
    );
    const cta = screen.getByTestId("landing-preview-cta");
    expect(cta.style.backgroundColor).toBe("rgb(217, 70, 239)");
  });

  it("shows the example output when present", () => {
    render(<LandingPreview slug="bio-instagram" landing={landing} pricing={pricing} theme={theme} branding={{}} />);
    expect(screen.getByText(/Passionné/)).toBeTruthy();
  });

  it("shows the FAQ entries", () => {
    render(<LandingPreview slug="bio-instagram" landing={landing} pricing={pricing} theme={theme} branding={{}} />);
    expect(screen.getByText("Combien ça coûte ?")).toBeTruthy();
    expect(screen.getByText("1 crédit par génération.")).toBeTruthy();
  });

  it("shows each pack's credits and formatted price", () => {
    render(<LandingPreview slug="bio-instagram" landing={landing} pricing={pricing} theme={theme} branding={{}} />);
    expect(screen.getByText(/10 crédits/)).toBeTruthy();
    expect(screen.getByText(/4,90/)).toBeTruthy();
  });
});
