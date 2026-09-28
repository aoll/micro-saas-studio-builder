import type { ProductStatus } from "@/lib/schemas/product-config";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/components/utils";

// The 4 statuses stay identical in French and English: they're already
// English loanwords in the French UI, so the same literal is correct in
// both locales (specs/I18N-BACKOFFICE-STRINGS.md › Décisions de portée).
const LABELS: Record<ProductStatus, string> = {
  test: "Test",
  learn: "Learn",
  scale: "Scale",
  killed: "Killed",
};

// One colour per status (docs/02-ecrans.md › Badge de statut).
const COLORS: Record<ProductStatus, string> = {
  test: "border-transparent bg-muted text-muted-foreground",
  learn: "border-transparent bg-accent text-accent-foreground",
  scale: "border-transparent bg-primary text-primary-foreground",
  killed: "border-transparent bg-destructive text-white",
};

export function StatusBadge({ status }: { status: ProductStatus }) {
  return (
    <Badge data-testid="status-badge" data-status={status} className={cn(COLORS[status])}>
      {LABELS[status]}
    </Badge>
  );
}
