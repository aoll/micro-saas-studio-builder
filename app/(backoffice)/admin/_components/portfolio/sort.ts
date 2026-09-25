import type { ProductStatus } from "@/lib/schemas/product-config";
import type { PortfolioRow } from "./rows";

// The 6 sortable columns of the portfolio table (docs/02-ecrans.md ›
// BO-02: "statut, visites, conversion, revenu, coût IA, marge").
export type SortColumn = "status" | "visits" | "conversion" | "revenue" | "aiCost" | "margin";
export type SortDirection = "asc" | "desc";

// Test → Learn → Scale → Killed, the product's lifecycle order
// (docs/01-produit.md), not alphabetical.
const STATUS_ORDER: Record<ProductStatus, number> = { test: 0, learn: 1, scale: 2, killed: 3 };

function valueFor(row: PortfolioRow, column: SortColumn): number | null {
  switch (column) {
    case "status":
      return STATUS_ORDER[row.status];
    case "visits":
      return row.visits;
    case "conversion":
      return row.signupToPurchaseRate;
    case "revenue":
      return row.revenueCents;
    case "aiCost":
      return row.aiCostMicros;
    case "margin":
      return row.marginRate;
  }
}

export const DEFAULT_SORT: { column: SortColumn; direction: SortDirection } = { column: "revenue", direction: "desc" };

// Pure, non-mutating sort (specs/BO-02-portefeuille.md plan, design
// decision 6): a `null` conversion or margin always sorts last, whichever
// direction is asked for — it means "no data", not "the lowest value".
// Equal (or twice-null) rows break ties by name, for a stable order across
// re-sorts.
export function sortRows(rows: PortfolioRow[], column: SortColumn, direction: SortDirection): PortfolioRow[] {
  const sign = direction === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const valueA = valueFor(a, column);
    const valueB = valueFor(b, column);
    if (valueA === null && valueB === null) return a.name.localeCompare(b.name);
    if (valueA === null) return 1;
    if (valueB === null) return -1;
    if (valueA !== valueB) return (valueA - valueB) * sign;
    return a.name.localeCompare(b.name);
  });
}
