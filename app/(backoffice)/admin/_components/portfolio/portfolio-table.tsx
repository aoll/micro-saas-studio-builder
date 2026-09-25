"use client";

import type { Route } from "next";
import Link from "next/link";
import { useState } from "react";
import { StatusBadge } from "@/components/backoffice/status-badge";
import { DecisionBadge } from "./decision-badge";
import type { PortfolioRow } from "./rows";
import { DEFAULT_SORT, sortRows, type SortColumn, type SortDirection } from "./sort";

const COLUMNS: { key: SortColumn; label: string }[] = [
  { key: "status", label: "Statut" },
  { key: "visits", label: "Visites" },
  { key: "conversion", label: "Conversion" },
  { key: "revenue", label: "Revenu" },
  { key: "aiCost", label: "Coût IA" },
  { key: "margin", label: "Marge" },
];

// Sort's ARIA vocabulary (docs/02-ecrans.md › BO-02 tableau triable):
// "none" for every header that is not the current sort key.
function ariaSortFor(
  column: SortColumn,
  current: SortColumn,
  direction: SortDirection,
): "ascending" | "descending" | "none" {
  if (column !== current) return "none";
  return direction === "asc" ? "ascending" : "descending";
}

// BO-03 (the product sheet at /admin/products/[slug]) has not landed yet:
// `as Route` dropped once it does (specs/BO-02-portefeuille.md plan,
// pattern: "Links to routes not merged yet").
function productHref(slug: string): Route {
  return `/admin/products/${slug}` as Route;
}

export function PortfolioTable({ rows }: { rows: PortfolioRow[] }) {
  const [sort, setSort] = useState<{ column: SortColumn; direction: SortDirection }>(DEFAULT_SORT);

  function toggleSort(column: SortColumn) {
    setSort((previous) => {
      if (previous.column !== column) return { column, direction: "asc" };
      return { column, direction: previous.direction === "asc" ? "desc" : "asc" };
    });
  }

  const sorted = sortRows(rows, sort.column, sort.direction);

  return (
    <div>
      <p className="mb-2 text-sm text-muted-foreground">Produits ({rows.length})</p>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left">
            {COLUMNS.map(({ key, label }) => (
              <th key={key} scope="col" aria-sort={ariaSortFor(key, sort.column, sort.direction)} className="py-2 pr-4">
                <button type="button" onClick={() => toggleSort(key)} className="font-medium hover:underline">
                  {label}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => (
            <tr key={row.productId} className="border-b last:border-0">
              <td className="py-2 pr-4">
                <div className="flex items-center gap-2">
                  <StatusBadge status={row.status} />
                  <DecisionBadge decision={row.decision} />
                </div>
              </td>
              <td className="py-2 pr-4">{row.display.visits}</td>
              <td className="py-2 pr-4">{row.display.conversion}</td>
              <td className="py-2 pr-4">{row.display.revenue}</td>
              <td className="py-2 pr-4">{row.display.aiCost}</td>
              <td className="py-2 pr-4">{row.display.margin}</td>
              <td className="py-2 pr-4">
                <Link href={productHref(row.slug)} className="font-medium hover:underline">
                  {row.name}
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
