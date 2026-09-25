// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { screen, within } from "@testing-library/dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Theme } from "@/lib/dal/themes";
import type { LandingVariant, ThemeTokens } from "@/lib/schemas/theme-tokens";
import { ThemeCard } from "./theme-card";

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

function theme(overrides: Partial<Theme> = {}): Theme {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    slug: "editorial",
    name: "Editorial",
    tokens,
    landingVariant: "split",
    isSeed: true,
    ...overrides,
  };
}

describe("ThemeCard", () => {
  it("shows the theme's name as a heading", () => {
    render(<ThemeCard theme={theme()} productNames={[]} />);
    expect(screen.getByRole("heading", { name: "Editorial" })).toBeTruthy();
  });

  it("renders a single thumbnail, without a duplicated name inside it", () => {
    render(<ThemeCard theme={theme()} productNames={[]} />);
    const thumbnails = screen.getAllByTestId("theme-thumbnail");
    expect(thumbnails).toHaveLength(1);
    expect(thumbnails[0]?.getAttribute("data-variant")).toBe("split");
    expect(within(thumbnails[0] as HTMLElement).queryByText("Editorial")).toBeNull();
  });

  it("shows the usage text and a machine-readable count for zero products", () => {
    render(<ThemeCard theme={theme()} productNames={[]} />);
    expect(screen.getByText("Aucun produit")).toBeTruthy();
    expect(screen.getByText("Aucun produit").closest("[data-count]")?.getAttribute("data-count")).toBe("0");
  });

  it("shows the usage text and count for one product", () => {
    render(<ThemeCard theme={theme()} productNames={["LettrePro"]} />);
    expect(screen.getByText("Utilisé par 1 produit · LettrePro")).toBeTruthy();
    expect(
      screen.getByText("Utilisé par 1 produit · LettrePro").closest("[data-count]")?.getAttribute("data-count"),
    ).toBe("1");
  });

  it("shows the usage text and count for several products", () => {
    render(<ThemeCard theme={theme()} productNames={["DescriPro", "LettrePro"]} />);
    expect(screen.getByText("Utilisé par 2 produits · DescriPro, LettrePro")).toBeTruthy();
    expect(
      screen
        .getByText("Utilisé par 2 produits · DescriPro, LettrePro")
        .closest("[data-count]")
        ?.getAttribute("data-count"),
    ).toBe("2");
  });

  it.each<[LandingVariant, string]>([
    ["centered", "Variante « hero centré »"],
    ["split", "Variante « hero + exemple »"],
    ["minimal", "Variante « minimal »"],
  ])("labels the %s landing variant as %s", (landingVariant, label) => {
    render(<ThemeCard theme={theme({ landingVariant })} productNames={[]} />);
    expect(screen.getByText(label)).toBeTruthy();
  });
});
