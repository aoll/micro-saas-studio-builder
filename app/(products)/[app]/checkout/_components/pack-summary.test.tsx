// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { screen } from "@testing-library/dom";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it } from "vitest";
import fr from "@/messages/fr/common.json";
import en from "@/messages/en/common.json";
import checkoutFr from "@/messages/fr/checkout.json";
import checkoutEn from "@/messages/en/checkout.json";
import type { Pack } from "@/lib/schemas/pack";
import { PackSummary } from "./pack-summary";

afterEach(cleanup);

const pack: Pack = { id: "pack-50", credits: 50, priceCents: 1490, recommended: true };

function renderWithLocale(locale: "fr" | "en", ui: React.ReactElement) {
  const messages = locale === "fr" ? { common: fr, checkout: checkoutFr } : { common: en, checkout: checkoutEn };
  return render(
    <NextIntlClientProvider locale={locale} messages={messages}>
      {ui}
    </NextIntlClientProvider>,
  );
}

describe("PackSummary", () => {
  it("shows the product name, credits and price in French", () => {
    renderWithLocale("fr", <PackSummary productName="BioInsta" pack={pack} costPerGeneration={1} />);
    expect(screen.getByText("BioInsta · pack")).toBeTruthy();
    expect(screen.getByText("50 crédits")).toBeTruthy();
    expect(screen.getByText("14,90 €")).toBeTruthy();
    expect(screen.getByText(/0,30 € \/ génération/)).toBeTruthy();
  });

  it("renders in English", () => {
    renderWithLocale("en", <PackSummary productName="BioInsta" pack={pack} costPerGeneration={1} />);
    expect(screen.getByText("€14.90")).toBeTruthy();
  });
});
