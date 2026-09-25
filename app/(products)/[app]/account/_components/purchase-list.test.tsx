// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { screen } from "@testing-library/dom";
import { createTranslator } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import frAccount from "@/messages/fr/account.json";
import type { AccountPurchase } from "@/lib/dal/account";

afterEach(cleanup);

// PurchaseList has no interactivity (review fix, MEDIUM): a Server
// Component like history-list.tsx, not a 'use client' leaf, so this test
// calls it directly (async, like signup-prompt.test.tsx). next-intl/server
// picks its "react-server" export via a condition Vitest's node/jsdom
// environments don't set (history-list.test.tsx's comment): mocked with a
// real translator, and a formatter built from Intl directly (dateTime and
// number, since PurchaseList also formats the price).
vi.mock("next-intl/server", () => ({
  getTranslations: async (namespace: "account") =>
    createTranslator({ locale: "fr", messages: { account: frAccount }, namespace }),
  getFormatter: async () => ({
    dateTime: (date: Date, options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("fr", options).format(date),
    number: (value: number, options: Intl.NumberFormatOptions) => new Intl.NumberFormat("fr", options).format(value),
  }),
}));

const purchases: AccountPurchase[] = [
  { id: "p1", createdAt: new Date("2026-09-14T10:00:00.000Z"), credits: 10, amountCents: 490, currency: "EUR" },
  { id: "p2", createdAt: new Date("2026-09-01T10:00:00.000Z"), credits: 50, amountCents: 1490, currency: "EUR" },
];

describe("PurchaseList", () => {
  it("renders each purchase's pack, date and price, in the given order", async () => {
    const { PurchaseList } = await import("./purchase-list");
    const ui = await PurchaseList({ purchases });
    render(ui);

    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[0]!.textContent).toContain("Pack 10 crédits");
    expect(items[0]!.textContent).toContain("4,90");
    expect(items[1]!.textContent).toContain("Pack 50 crédits");
    expect(items[1]!.textContent).toContain("14,90");
  });

  it("shows the empty state when there is no purchase", async () => {
    const { PurchaseList } = await import("./purchase-list");
    const ui = await PurchaseList({ purchases: [] });
    render(ui);
    expect(screen.getByText("Aucun achat pour le moment")).toBeTruthy();
  });
});
