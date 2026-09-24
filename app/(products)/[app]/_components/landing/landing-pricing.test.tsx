// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { screen } from "@testing-library/dom";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it } from "vitest";
import fr from "@/messages/fr/landing.json";
import common from "@/messages/fr/common.json";
import type { Pack } from "@/lib/schemas/pack";
import { LandingPricing } from "./landing-pricing";

afterEach(cleanup);

function renderUi(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="fr" messages={{ landing: fr, common }}>
      {ui}
    </NextIntlClientProvider>,
  );
}

const packs: Pack[] = [
  { id: "pack-10", credits: 10, priceCents: 490 },
  { id: "pack-50", credits: 50, priceCents: 1490, recommended: true },
];

describe("LandingPricing", () => {
  it("renders the heading and one PackCard per pack", () => {
    renderUi(<LandingPricing slug="lettre-pro" packs={packs} costPerGeneration={1} freeCreditsOnSignup={3} />);
    expect(screen.getByText("Tarifs")).toBeTruthy();
    expect(screen.getByText("10 crédits")).toBeTruthy();
    expect(screen.getByText("50 crédits")).toBeTruthy();
    expect(screen.getByText("4,90 €")).toBeTruthy();
    expect(screen.getByText("Recommandé")).toBeTruthy();
  });

  it("links each pack's action to the product's tool page", () => {
    renderUi(<LandingPricing slug="lettre-pro" packs={packs} costPerGeneration={1} freeCreditsOnSignup={3} />);
    const links = screen.getAllByRole("link", { name: "Commencer" });
    expect(links).toHaveLength(2);
    for (const link of links) {
      expect((link as HTMLAnchorElement).getAttribute("href")).toBe("/lettre-pro/tool");
    }
  });

  it("shows the signup bonus line when freeCreditsOnSignup is positive", () => {
    renderUi(<LandingPricing slug="lettre-pro" packs={packs} costPerGeneration={1} freeCreditsOnSignup={3} />);
    expect(screen.getByText(/3 crédits offerts à l'inscription/)).toBeTruthy();
  });

  it("hides the signup bonus line when freeCreditsOnSignup is 0", () => {
    renderUi(<LandingPricing slug="lettre-pro" packs={packs} costPerGeneration={1} freeCreditsOnSignup={0} />);
    expect(screen.queryByText(/crédits offerts à l'inscription/)).toBeNull();
  });
});
