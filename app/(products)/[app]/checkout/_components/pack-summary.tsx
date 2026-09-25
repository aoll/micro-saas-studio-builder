import { useFormatter, useTranslations } from "next-intl";
import type { Pack } from "@/lib/schemas/pack";
import { Card, CardContent } from "@/components/ui/card";

// SA-05 (specs/mockups/SA-05.png): "BioInsta · pack" over the credits and
// price, mirroring PackCard's per-generation line but without an action
// (the checkout flow's own "Payer" button, next to it, plays that role).
export function PackSummary({
  productName,
  pack,
  costPerGeneration,
}: {
  productName: string;
  pack: Pack;
  costPerGeneration: number;
}) {
  const t = useTranslations();
  const format = useFormatter();
  const priceEur = pack.priceCents / 100;
  const perGeneration = (priceEur / pack.credits) * costPerGeneration;
  const currency = (value: number) => format.number(value, { style: "currency", currency: "EUR" });

  return (
    <Card>
      <CardContent className="flex items-center justify-between">
        <div className="grid gap-1">
          <p className="text-sm text-muted-foreground">{t("checkout.packLine", { name: productName })}</p>
          <p className="text-xl font-semibold">{t("common.pack.credits", { count: pack.credits })}</p>
          <p className="text-sm text-muted-foreground">
            {t("common.pack.perGeneration", { price: currency(perGeneration) })}
          </p>
        </div>
        <p className="text-2xl font-bold">{currency(priceEur)}</p>
      </CardContent>
    </Card>
  );
}
