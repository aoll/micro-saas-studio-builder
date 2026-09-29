// @vitest-environment jsdom
import { cleanup, fireEvent, render } from "@testing-library/react";
import { screen } from "@testing-library/dom";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import en from "@/messages/en/backoffice-product-form-a.json";
import fr from "@/messages/fr/backoffice-product-form-a.json";
import type { Theme } from "@/lib/dal/themes";
import type { ThemeTokens } from "@/lib/schemas/theme-tokens";

vi.mock("next/font/google", () => {
  const loader = () => ({ variable: "--font-theme", className: "font-mock" });
  return { Fraunces: loader, Space_Grotesk: loader, Inter: loader, Nunito: loader };
});

const { ThemeStep } = await import("./theme-step");

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

const themeOptions: Theme[] = [
  { id: "theme-editorial", slug: "editorial", name: "Editorial", tokens, landingVariant: "centered", isSeed: true },
  { id: "theme-neon", slug: "neon", name: "Neon", tokens, landingVariant: "split", isSeed: true },
];

// I18N-BACKOFFICE-STRINGS lot 4: ThemeStep now reads its labels through
// useTranslations("backoffice-product-form-a"), so every render needs the
// zone's messages in context.
function setup(overrides: Partial<React.ComponentProps<typeof ThemeStep>> = {}, uiLocale: "fr" | "en" = "fr") {
  const onChange = vi.fn();
  const props: React.ComponentProps<typeof ThemeStep> = {
    themes: themeOptions,
    themeId: "theme-editorial",
    errors: {},
    onChange,
    ...overrides,
  };
  const messages = uiLocale === "fr" ? fr : en;
  const view = render(
    <NextIntlClientProvider locale={uiLocale} messages={{ "backoffice-product-form-a": messages }}>
      <ThemeStep {...props} />
    </NextIntlClientProvider>,
  );
  return { onChange, ...view };
}

describe("ThemeStep", () => {
  it("renders one thumbnail per theme in a radiogroup, the current one checked", () => {
    setup();
    const group = screen.getByRole("radiogroup");
    const options = Array.from(group.querySelectorAll('[role="radio"]'));
    expect(options).toHaveLength(2);
    const checked = options.find((option) => option.getAttribute("aria-checked") === "true");
    expect(checked?.textContent).toContain("Editorial");
  });

  it("selects a theme on click", () => {
    const { onChange } = setup();
    fireEvent.click(screen.getByText("Neon"));
    expect(onChange).toHaveBeenCalledWith({ themeId: "theme-neon" });
  });

  it("labels only the selected theme as the current one", () => {
    setup();
    expect(screen.getAllByText("Thème actuel")).toHaveLength(1);
  });

  it("has no logo or colour field", () => {
    setup();
    expect(screen.queryByLabelText("Logo")).toBeNull();
    expect(screen.queryByLabelText("Couleur du thème")).toBeNull();
  });

  // I18N-BACKOFFICE-STRINGS: catches a label left hardcoded in French once
  // the admin_locale cookie is "en" (spec acceptance: no French text leaks).
  it("renders every label in English when the locale is en", () => {
    setup({}, "en");
    expect(screen.getByRole("radiogroup", { name: "Theme" })).toBeTruthy();
    expect(screen.getByText("Current theme")).toBeTruthy();
  });
});
