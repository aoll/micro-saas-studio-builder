// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { screen } from "@testing-library/dom";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it } from "vitest";
import fr from "@/messages/fr/common.json";
import { ProductFooter } from "./product-footer";

afterEach(cleanup);

describe("ProductFooter", () => {
  it("renders the product name and a link back to the studio", () => {
    render(
      <NextIntlClientProvider locale="fr" messages={{ common: fr }}>
        <ProductFooter name="LettrePro" />
      </NextIntlClientProvider>,
    );
    expect(screen.getByText("LettrePro")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Voir les autres produits du studio" })).toBeTruthy();
  });
});
