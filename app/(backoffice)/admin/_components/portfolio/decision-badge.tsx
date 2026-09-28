import { useTranslations } from "next-intl";
import type { Decision } from "@/lib/decision";
import { Badge } from "@/components/ui/badge";

// docs/02-ecrans.md › BO-02: badge « à couper » / « à scaler » next to the
// status badge. Renders nothing when evaluate() suggests no change.
// I18N-BACKOFFICE-STRINGS (spec "Décisions de portée"): the decision
// triptyque translates word for word, "à couper" -> "cut", "à scaler" ->
// "scale" — nested under a 'use client' parent (PortfolioTable), so
// useTranslations reads the root NextIntlClientProvider's
// backoffice-portfolio namespace.
export function DecisionBadge({ decision }: { decision: Decision }) {
  const t = useTranslations("backoffice-portfolio");
  if (decision === null) return null;
  if (decision === "kill") return <Badge variant="destructive">{t("portfolio.decision.cut")}</Badge>;
  return <Badge variant="default">{t("portfolio.decision.scale")}</Badge>;
}
