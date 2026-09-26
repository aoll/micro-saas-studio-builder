import { describe, expect, it } from "vitest";
import type { AccountPurchase } from "@/lib/dal/account";
import { renderInvoicePdf } from "./render";

// Pure rendering (frozen contract, lib/invoice/render.tsx): no database, no
// session — just PDF bytes out of a plain input object.

function purchase(overrides: Partial<AccountPurchase> = {}): AccountPurchase {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    createdAt: new Date("2024-05-15T10:00:00Z"),
    credits: 50,
    amountCents: 1990,
    currency: "EUR",
    ...overrides,
  };
}

describe("renderInvoicePdf", () => {
  it("returns a real PDF buffer (starts with the %PDF- magic header)", async () => {
    const buffer = await renderInvoicePdf({
      productName: "LettrePro",
      buyerEmail: "buyer@example.com",
      month: "2024-05",
      purchases: [purchase()],
    });

    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  });

  it("succeeds for a month with zero purchases", async () => {
    const buffer = await renderInvoicePdf({
      productName: "LettrePro",
      buyerEmail: "buyer@example.com",
      month: "2024-06",
      purchases: [],
    });

    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  });

  it("renders several purchases and unicode product names without throwing", async () => {
    const buffer = await renderInvoicePdf({
      productName: "DescriPro — Générateur de descriptions produit",
      buyerEmail: "buyer@example.com",
      month: "2024-07",
      purchases: [
        purchase({ id: "22222222-2222-2222-2222-222222222222", credits: 10, amountCents: 490 }),
        purchase({ id: "33333333-3333-3333-3333-333333333333", credits: 100, amountCents: 2990, currency: "USD" }),
      ],
    });

    expect(buffer.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  });
});
