import { describe, expect, it } from "vitest";
import type { AccountPurchase } from "@/lib/dal/account";
import { invoiceableMonths } from "./invoiceable-months";

// SA-09 (specs/SA-09-facture.md): "chaque mois avec au moins un achat, du
// premier achat jusqu'au mois précédent le mois courant inclus (le mois en
// cours n'est jamais facturable, il n'est pas terminé)". Pure so the whole
// range logic is unit-tested without a database.
function purchase(overrides: Partial<AccountPurchase> = {}): AccountPurchase {
  return {
    id: "p1",
    createdAt: new Date("2026-01-15T10:00:00Z"),
    credits: 10,
    amountCents: 490,
    currency: "EUR",
    ...overrides,
  };
}

describe("invoiceableMonths", () => {
  it("returns an empty array for no purchases", () => {
    expect(invoiceableMonths([], new Date("2026-09-26T00:00:00Z"))).toEqual([]);
  });

  it("returns an empty array when every purchase happened in the current month", () => {
    const purchases = [
      purchase({ id: "p1", createdAt: new Date("2026-09-02T00:00:00Z") }),
      purchase({ id: "p2", createdAt: new Date("2026-09-25T23:59:59Z") }),
    ];
    expect(invoiceableMonths(purchases, new Date("2026-09-26T00:00:00Z"))).toEqual([]);
  });

  it("returns every closed month that has at least one purchase, spanning several months", () => {
    const purchases = [
      purchase({ id: "p1", createdAt: new Date("2026-06-10T00:00:00Z") }),
      purchase({ id: "p2", createdAt: new Date("2026-07-01T00:00:00Z") }),
      purchase({ id: "p3", createdAt: new Date("2026-08-20T00:00:00Z") }),
    ];
    expect(invoiceableMonths(purchases, new Date("2026-09-26T00:00:00Z"))).toEqual(["2026-06", "2026-07", "2026-08"]);
  });

  it("collapses several purchases in the same month into a single entry", () => {
    const purchases = [
      purchase({ id: "p1", createdAt: new Date("2026-06-01T00:00:00Z") }),
      purchase({ id: "p2", createdAt: new Date("2026-06-15T00:00:00Z") }),
      purchase({ id: "p3", createdAt: new Date("2026-06-28T00:00:00Z") }),
    ];
    expect(invoiceableMonths(purchases, new Date("2026-09-26T00:00:00Z"))).toEqual(["2026-06"]);
  });

  it("never includes the current month even alongside earlier closed months", () => {
    const purchases = [
      purchase({ id: "p1", createdAt: new Date("2026-08-01T00:00:00Z") }),
      purchase({ id: "p2", createdAt: new Date("2026-09-01T00:00:00Z") }),
    ];
    expect(invoiceableMonths(purchases, new Date("2026-09-26T00:00:00Z"))).toEqual(["2026-08"]);
  });

  it("returns months sorted ascending regardless of purchase order", () => {
    const purchases = [
      purchase({ id: "p1", createdAt: new Date("2026-08-01T00:00:00Z") }),
      purchase({ id: "p2", createdAt: new Date("2026-06-01T00:00:00Z") }),
      purchase({ id: "p3", createdAt: new Date("2026-07-01T00:00:00Z") }),
    ];
    expect(invoiceableMonths(purchases, new Date("2026-09-26T00:00:00Z"))).toEqual(["2026-06", "2026-07", "2026-08"]);
  });
});
