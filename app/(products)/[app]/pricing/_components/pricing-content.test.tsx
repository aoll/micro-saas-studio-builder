// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { screen } from "@testing-library/dom";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it } from "vitest";
import fr from "@/messages/fr/common.json";
import en from "@/messages/en/common.json";
import frPricing from "@/messages/fr/pricing.json";
import enPricing from "@/messages/en/pricing.json";
import type { Product } from "@/lib/dal/products";
import { PricingContent } from "./pricing-content";

afterEach(cleanup);

const pricing: Product["pricing"] = {
  freeCreditsOnSignup: 3,
  anonymousFreeGenerations: 1,
  costPerGeneration: 1,
  packs: [
    { id: "pack-10", credits: 10, priceCents: 490 },
    { id: "pack-50", credits: 50, priceCents: 1490, recommended: true },
  ],
};

function renderWithLocale(locale: "fr" | "en", ui: React.ReactElement) {
  const messages = locale === "fr" ? { common: fr, pricing: frPricing } : { common: en, pricing: enPricing };
  return render(
    <NextIntlClientProvider locale={locale} messages={messages}>
      {ui}
    </NextIntlClientProvider>,
  );
}

describe("PricingContent", () => {
  it("lists the packs of the config: credits, price, price per generation", () => {
    renderWithLocale("fr", <PricingContent slug="lettre-pro" pricing={pricing} />);
    expect(screen.getByText("10 crédits")).toBeTruthy();
    expect(screen.getByText("4,90 €")).toBeTruthy();
    expect(screen.getByText(/0,49 € \/ génération/)).toBeTruthy();
    expect(screen.getByText("50 crédits")).toBeTruthy();
    expect(screen.getByText("14,90 €")).toBeTruthy();
    expect(screen.getByText(/0,30 € \/ génération/)).toBeTruthy();
  });

  it("renders the subtitle, note and both benefits", () => {
    renderWithLocale("fr", <PricingContent slug="lettre-pro" pricing={pricing} />);
    expect(screen.getByText("Paiement unique, pas d'abonnement. Vos crédits n'expirent pas.")).toBeTruthy();
    expect(screen.getByText("Paiement unique · crédits ajoutés immédiatement")).toBeTruthy();
    expect(screen.getByText("Historique illimité")).toBeTruthy();
    expect(screen.getByText("Remboursé si la génération échoue")).toBeTruthy();
  });

  it("renders one buy link per pack", () => {
    renderWithLocale("fr", <PricingContent slug="lettre-pro" pricing={pricing} />);
    expect(screen.getAllByRole("link")).toHaveLength(2);
  });

  it("renders prices and buy labels in English", () => {
    renderWithLocale("en", <PricingContent slug="lettre-pro" pricing={pricing} />);
    expect(screen.getByText("€4.90")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Buy 50 credits · €14.90/ })).toBeTruthy();
  });

  it("doubles the price per generation when costPerGeneration is 2", () => {
    renderWithLocale("fr", <PricingContent slug="lettre-pro" pricing={{ ...pricing, costPerGeneration: 2 }} />);
    expect(screen.getByText(/0,98 € \/ génération/)).toBeTruthy();
    expect(screen.getByText(/0,60 € \/ génération/)).toBeTruthy();
  });

  it("highlights the recommended pack exactly once, with a link to checkout", () => {
    renderWithLocale("fr", <PricingContent slug="lettre-pro" pricing={pricing} />);
    expect(screen.getAllByText("Recommandé")).toHaveLength(1);
    // Intl.NumberFormat("fr", …) puts a non-breaking space before "€": \s (not a literal
    // space) so the regex also matches the accessible name computed from aria-label.
    const link = screen.getByRole("link", { name: /Acheter 50 crédits · 14,90\s€/ }) as HTMLAnchorElement;
    expect(link.getAttribute("href")).toBe("/lettre-pro/checkout/pack-50");
    expect(link.getAttribute("data-variant")).toBe("default");
    const otherLink = screen.getByRole("link", { name: /Acheter 10 crédits · 4,90\s€/ }) as HTMLAnchorElement;
    expect(otherLink.getAttribute("href")).toBe("/lettre-pro/checkout/pack-10");
    expect(otherLink.getAttribute("data-variant")).toBe("outline");
  });

  it("renders no recommended badge and only outline buttons when no pack is recommended", () => {
    const noRecommended: Product["pricing"] = { ...pricing, packs: [{ id: "pack-10", credits: 10, priceCents: 490 }] };
    renderWithLocale("fr", <PricingContent slug="lettre-pro" pricing={noRecommended} />);
    expect(screen.queryByText("Recommandé")).toBeNull();
    const link = screen.getByRole("link") as HTMLAnchorElement;
    expect(link.getAttribute("data-variant")).toBe("outline");
  });

  // QA1-P1-B3 (.claude/plans/QA1-P1-B3.plan.md, step 4): CheckoutFlow reads
  // this marker to tell the full /pricing page apart from other checkout
  // backgrounds (tool paywall, direct access), where it must not refresh the
  // router while the modal is still mounted (see checkout-flow.tsx).
  it("marks its root with data-slot=pricing-content, containing the buy links", () => {
    const { container } = renderWithLocale("fr", <PricingContent slug="lettre-pro" pricing={pricing} />);
    const marker = container.querySelector('[data-slot="pricing-content"]');
    expect(marker).toBe(container.firstElementChild);
    expect(marker?.querySelectorAll("a")).toHaveLength(2);
  });
});
