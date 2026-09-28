import Link from "next/link";
import { getTranslations } from "next-intl/server";
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
// I18N-BACKOFFICE-STRINGS: async Server Component (no client boundary
// between this and admin/page.tsx), so getTranslations reads the ambient
// per-request locale directly.
export async function PortfolioView({ totals, rows }: { totals: PortfolioMetrics["totals"]; rows: PortfolioRow[] }) {
  const t = await getTranslations("backoffice-portfolio");
  return (
    <div className="grid gap-6">
      <PortfolioKpis totals={totals} />
      {rows.length === 0 ? (
        <EmptyState
          title={t("portfolio.empty.title")}
          description={t("portfolio.empty.description")}
          action={
            <Button asChild>
              <Link href={NEW_PRODUCT_HREF}>{t("portfolio.empty.cta")}</Link>
            </Button>
          }
        />
      ) : (
        <PortfolioTable rows={rows} />
      )}
    </div>
  );
}
