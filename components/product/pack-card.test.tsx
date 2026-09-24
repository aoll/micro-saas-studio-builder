// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { screen } from "@testing-library/dom";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it } from "vitest";
import fr from "@/messages/fr/common.json";
import en from "@/messages/en/common.json";
import type { Pack } from "@/lib/schemas/pack";
import { PackCard } from "./pack-card";

afterEach(cleanup);

const pack: Pack = { id: "pack-10", credits: 10, priceCents: 490 };
const recommendedPack: Pack = { id: "pack-50", credits: 50, priceCents: 1490, recommended: true };

function renderWithLocale(locale: "fr" | "en", ui: React.ReactElement) {
  const messages = locale === "fr" ? { common: fr } : { common: en };
  return render(
    <NextIntlClientProvider locale={locale} messages={messages}>
      {ui}
    </NextIntlClientProvider>,
  );
}

describe("PackCard", () => {
  it("renders credits, price and price per generation in French", () => {
    renderWithLocale("fr", <PackCard pack={pack} costPerGeneration={1} action={<button>Acheter</button>} />);
    expect(screen.getByText("10 crédits")).toBeTruthy();
    expect(screen.getByText("4,90 €")).toBeTruthy();
    expect(screen.getByText(/0,49 € \/ génération/)).toBeTruthy();
  });

  it("renders the price in English", () => {
    renderWithLocale("en", <PackCard pack={pack} costPerGeneration={1} action={<button>Buy</button>} />);
    expect(screen.getByText("€4.90")).toBeTruthy();
  });

  it("shows a recommended badge and the action", () => {
    renderWithLocale("fr", <PackCard pack={recommendedPack} costPerGeneration={1} action={<button>Acheter</button>} />);
    expect(screen.getByText("Recommandé")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Acheter" })).toBeTruthy();
  });

  it("does not show a recommended badge for a non-recommended pack", () => {
    renderWithLocale("fr", <PackCard pack={pack} costPerGeneration={1} action={<button>Acheter</button>} />);
    expect(screen.queryByText("Recommandé")).toBeNull();
  });
});
