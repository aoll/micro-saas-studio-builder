import { useTranslations } from "next-intl";
import { env } from "@/lib/env";

// docs/01-produit.md › Mode démo public: a discreet banner reminding
// visitors payment and email are simulated. Renders nothing outside demo
// mode (local dev and tests run with DEMO_MODE=false).
export function DemoBanner() {
  const t = useTranslations("common.demo");
  if (!env.DEMO_MODE) return null;
  return <div className="bg-accent px-4 py-1 text-center text-xs text-accent-foreground">{t("banner")}</div>;
}
