import type { Decision } from "@/lib/decision";
import { Badge } from "@/components/ui/badge";

type DecisionLabels = { cut: string; scale: string };

// docs/02-ecrans.md › BO-02: badge « à couper » / « à scaler » next to the
// status badge. Renders nothing when evaluate() suggests no change.
// I18N-BACKOFFICE-STRINGS (spec "Décisions de portée"): the decision
// triptyque translates word for word, "à couper" -> "cut", "à scaler" ->
// "scale". `labels` is an explicit prop, not useTranslations() here: this
// component is also imported directly by sheet-header.tsx (lot "Statut &
// Décision", outside this lot's Périmètre) without a NextIntlClientProvider
// ancestor for backoffice-portfolio — the spec's own "petite duplication…
// pour garder les lots indépendants" accepts that an unmodified caller
// keeps the old hard-coded French labels (the default) until its own lot
// threads its translation through.
const DEFAULT_LABELS: DecisionLabels = { cut: "à couper", scale: "à scaler" };

export function DecisionBadge({ decision, labels = DEFAULT_LABELS }: { decision: Decision; labels?: DecisionLabels }) {
  if (decision === null) return null;
  if (decision === "kill") return <Badge variant="destructive">{labels.cut}</Badge>;
  return <Badge variant="default">{labels.scale}</Badge>;
}
