import { describe, expect, it } from "vitest";
import type { PortfolioRow } from "./rows";
import { DEFAULT_SORT, sortRows } from "./sort";

function row(overrides: Partial<PortfolioRow> = {}): PortfolioRow {
  return {
    productId: overrides.name ?? "p",
    slug: "slug",
    name: "P",
    status: "test",
    decision: null,
    visits: 0,
    signupToPurchaseRate: null,
    revenueCents: 0,
    aiCostMicros: 0,
    marginPerGenerationMicros: null,
    display: { visits: "0", conversion: "—", revenue: "0,00 €", aiCost: "0,00 €", margin: "—" },
    ...overrides,
  };
}

describe("sortRows", () => {
  it("sorts by status in the lifecycle order (test < learn < scale < killed), both ways", () => {
    const rows = [
      row({ name: "a", status: "killed" }),
      row({ name: "b", status: "test" }),
      row({ name: "c", status: "scale" }),
    ];
    expect(sortRows(rows, "status", "asc").map((r) => r.status)).toEqual(["test", "scale", "killed"]);
    expect(sortRows(rows, "status", "desc").map((r) => r.status)).toEqual(["killed", "scale", "test"]);
  });

  it("sorts by visits, both ways", () => {
    const rows = [row({ name: "a", visits: 10 }), row({ name: "b", visits: 30 }), row({ name: "c", visits: 20 })];
    expect(sortRows(rows, "visits", "asc").map((r) => r.visits)).toEqual([10, 20, 30]);
    expect(sortRows(rows, "visits", "desc").map((r) => r.visits)).toEqual([30, 20, 10]);
  });

  it("sorts by conversion, nulls last regardless of direction", () => {
    const rows = [
      row({ name: "a", signupToPurchaseRate: 0.5 }),
      row({ name: "b", signupToPurchaseRate: null }),
      row({ name: "c", signupToPurchaseRate: 0.1 }),
    ];
    expect(sortRows(rows, "conversion", "asc").map((r) => r.signupToPurchaseRate)).toEqual([0.1, 0.5, null]);
    expect(sortRows(rows, "conversion", "desc").map((r) => r.signupToPurchaseRate)).toEqual([0.5, 0.1, null]);
  });

  it("sorts by revenue, both ways", () => {
    const rows = [
      row({ name: "a", revenueCents: 100 }),
      row({ name: "b", revenueCents: 300 }),
      row({ name: "c", revenueCents: 200 }),
    ];
    expect(sortRows(rows, "revenue", "asc").map((r) => r.revenueCents)).toEqual([100, 200, 300]);
    expect(sortRows(rows, "revenue", "desc").map((r) => r.revenueCents)).toEqual([300, 200, 100]);
  });

  it("sorts by AI cost, both ways", () => {
    const rows = [
      row({ name: "a", aiCostMicros: 100 }),
      row({ name: "b", aiCostMicros: 300 }),
      row({ name: "c", aiCostMicros: 200 }),
    ];
    expect(sortRows(rows, "aiCost", "asc").map((r) => r.aiCostMicros)).toEqual([100, 200, 300]);
    expect(sortRows(rows, "aiCost", "desc").map((r) => r.aiCostMicros)).toEqual([300, 200, 100]);
  });

  it("sorts by margin, nulls last regardless of direction", () => {
    const rows = [
      row({ name: "a", marginPerGenerationMicros: 500 }),
      row({ name: "b", marginPerGenerationMicros: null }),
      row({ name: "c", marginPerGenerationMicros: -200 }),
    ];
    expect(sortRows(rows, "margin", "asc").map((r) => r.marginPerGenerationMicros)).toEqual([-200, 500, null]);
    expect(sortRows(rows, "margin", "desc").map((r) => r.marginPerGenerationMicros)).toEqual([500, -200, null]);
  });

  it("breaks ties by name", () => {
    const rows = [row({ name: "Zed", visits: 10 }), row({ name: "Alpha", visits: 10 })];
    expect(sortRows(rows, "visits", "asc").map((r) => r.name)).toEqual(["Alpha", "Zed"]);
  });

  it("defaults to revenue, descending", () => {
    expect(DEFAULT_SORT).toEqual({ column: "revenue", direction: "desc" });
  });

  it("does not mutate its input array", () => {
    const rows = [row({ name: "a", visits: 10 }), row({ name: "b", visits: 20 })];
    const original = [...rows];
    sortRows(rows, "visits", "desc");
    expect(rows).toEqual(original);
  });
});
