import type { Route } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/backoffice/status-badge";
import { DecisionBadge } from "@/app/(backoffice)/admin/_components/portfolio/decision-badge";
import type { ProductSheetViewModel } from "./sheet";
import { StatusChange } from "./status/status-change";

// docs/02-ecrans.md › BO-03 état "produit killed" (plan design decisions 3 and 5): the
// DecisionBadge disappears (the decision is already made) and a closed banner explains what
// visitors see — the funnel data and the sub-app link stay, so the page never hides history.
function KilledBanner({ slug }: { slug: string }) {
  return (
    <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
      Produit fermé (Killed) : /{slug} affiche la page introuvable aux visiteurs (SA-08).
    </p>
  );
}

// BO-03's header (docs/02-ecrans.md): name, status, the same DecisionBadge the portfolio table
// shows, a link to the live sub-app and to the config editor, and the BO-06 status-change slot
// (plan design decisions 2, 6, 8).
export function SheetHeader({ sheet }: { sheet: ProductSheetViewModel }) {
  const isKilled = sheet.status === "killed";
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold">{sheet.name}</h1>
          <StatusBadge status={sheet.status} />
          {!isKilled ? <DecisionBadge decision={sheet.decision.badge} /> : null}
        </div>
        {/* specs/mockups/BO-06.png: "Changer de statut" sits top-right, next to "Modifier la config". */}
        <div className="flex items-center gap-2" data-testid="sheet-actions">
          <Button asChild variant="outline">
            <a href={`/${sheet.slug}`} target="_blank" rel="noopener noreferrer">
              Voir /{sheet.slug} ↗
            </a>
          </Button>
          <Button asChild>
            <Link href={`/admin/products/${sheet.slug}/edit` as Route}>Modifier la config</Link>
          </Button>
          <StatusChange
            productId={sheet.productId}
            slug={sheet.slug}
            name={sheet.name}
            status={sheet.status}
            decision={sheet.decision.badge}
            justification={sheet.decision.current}
          />
        </div>
      </div>
      {isKilled ? <KilledBanner slug={sheet.slug} /> : null}
    </div>
  );
}
