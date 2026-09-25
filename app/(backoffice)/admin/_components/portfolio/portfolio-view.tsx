import Link from "next/link";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import type { PortfolioMetrics } from "@/lib/dal/metrics";
import { PortfolioKpis } from "./portfolio-kpis";
import { PortfolioTable } from "./portfolio-table";
import type { PortfolioRow } from "./rows";

const NEW_PRODUCT_HREF = "/admin/products/new";

// docs/02-ecrans.md › BO-02 état "Vide (aucun produit)": KPIs stay (all
// zero), the table is replaced by an empty state with a create action
// (specs/BO-02-portefeuille.md plan, design decision 8).
export function PortfolioView({ totals, rows }: { totals: PortfolioMetrics["totals"]; rows: PortfolioRow[] }) {
  return (
    <div className="grid gap-6">
      <PortfolioKpis totals={totals} />
      {rows.length === 0 ? (
        <EmptyState
          title="Aucun produit"
          description="Créez votre premier produit pour voir apparaître ses métriques ici."
          action={
            <Button asChild>
              <Link href={NEW_PRODUCT_HREF}>Créer un produit</Link>
            </Button>
          }
        />
      ) : (
        <PortfolioTable rows={rows} />
      )}
    </div>
  );
}
