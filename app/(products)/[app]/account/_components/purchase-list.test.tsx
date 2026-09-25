// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { screen } from "@testing-library/dom";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it } from "vitest";
import fr from "@/messages/fr/common.json";
import frAccount from "@/messages/fr/account.json";
import type { AccountPurchase } from "@/lib/dal/account";

afterEach(cleanup);

function renderUi(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="fr" messages={{ common: fr, account: frAccount }}>
      {ui}
    </NextIntlClientProvider>,
  );
}

const purchases: AccountPurchase[] = [
  { id: "p1", createdAt: new Date("2026-09-14T10:00:00.000Z"), credits: 10, amountCents: 490, currency: "EUR" },
  { id: "p2", createdAt: new Date("2026-09-01T10:00:00.000Z"), credits: 50, amountCents: 1490, currency: "EUR" },
];

describe("PurchaseList", () => {
  it("renders each purchase's pack, date and price, in the given order", async () => {
    const { PurchaseList } = await import("./purchase-list");
    renderUi(<PurchaseList purchases={purchases} />);

    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[0]!.textContent).toContain("Pack 10 crédits");
    expect(items[0]!.textContent).toContain("4,90");
    expect(items[1]!.textContent).toContain("Pack 50 crédits");
    expect(items[1]!.textContent).toContain("14,90");
  });

  it("shows the empty state when there is no purchase", async () => {
    const { PurchaseList } = await import("./purchase-list");
    renderUi(<PurchaseList purchases={[]} />);
    expect(screen.getByText("Aucun achat pour le moment")).toBeTruthy();
  });
});
