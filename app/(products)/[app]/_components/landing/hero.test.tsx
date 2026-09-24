// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { screen } from "@testing-library/dom";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it } from "vitest";
import fr from "@/messages/fr/landing.json";
import en from "@/messages/en/landing.json";
import { Hero } from "./hero";

afterEach(cleanup);

function renderWithLocale(locale: "fr" | "en", ui: React.ReactElement) {
  const messages = locale === "fr" ? { landing: fr } : { landing: en };
  return render(
    <NextIntlClientProvider locale={locale} messages={messages}>
      {ui}
    </NextIntlClientProvider>,
  );
}

const baseProps = {
  slug: "lettre-pro",
  headline: "Générez votre lettre de motivation en 30 secondes",
  subheadline: "Un outil IA qui rédige une lettre de motivation percutante.",
  eyebrow: "Générateur de lettre de motivation IA",
};

describe("Hero", () => {
  it("renders the headline as an h1, the subheadline and the eyebrow", () => {
    renderWithLocale("fr", <Hero {...baseProps} anonymousFreeGenerations={1} />);
    expect(screen.getByRole("heading", { level: 1, name: baseProps.headline })).toBeTruthy();
    expect(screen.getByText(baseProps.subheadline)).toBeTruthy();
    expect(screen.getByText(baseProps.eyebrow)).toBeTruthy();
  });

  it("links the CTA to the product's tool page", () => {
    renderWithLocale("fr", <Hero {...baseProps} anonymousFreeGenerations={1} />);
    const link = screen.getByRole("link", { name: "Essayer gratuitement" }) as HTMLAnchorElement;
    expect(link.getAttribute("href")).toBe("/lettre-pro/tool");
  });

  it("shows a free-generation hint when anonymousFreeGenerations is 1", () => {
    renderWithLocale("fr", <Hero {...baseProps} anonymousFreeGenerations={1} />);
    expect(screen.getByText(/1re génération offerte/)).toBeTruthy();
  });

  it("hides the free-generation hint when anonymousFreeGenerations is 0", () => {
    renderWithLocale("fr", <Hero {...baseProps} anonymousFreeGenerations={0} />);
    expect(screen.queryByText(/génération offerte/)).toBeNull();
    expect(screen.queryByText(/générations offertes/)).toBeNull();
  });

  it("renders the English CTA", () => {
    renderWithLocale("en", <Hero {...baseProps} anonymousFreeGenerations={1} />);
    expect(screen.getByRole("link", { name: "Try it free" })).toBeTruthy();
  });
});
