"use client";

import { useFormatter, useTranslations } from "next-intl";
import type { ReactNode } from "react";
import type { Pack } from "@/lib/schemas/pack";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/components/utils";

// docs/02-ecrans.md › Carte de pack: credits, price, price per generation,
// "recommended" variant.
export function PackCard({
  pack,
  costPerGeneration,
  action,
}: {
  pack: Pack;
  costPerGeneration: number;
  action: ReactNode;
}) {
  const t = useTranslations("common");
  const format = useFormatter();
  const priceEur = pack.priceCents / 100;
  const perGeneration = (priceEur / pack.credits) * costPerGeneration;
  const currency = (value: number) => format.number(value, { style: "currency", currency: "EUR" });

  return (
    <Card className={cn(pack.recommended && "border-primary")}>
      <CardHeader className="flex items-center justify-between">
        <p className="font-medium">{t("pack.credits", { count: pack.credits })}</p>
        {pack.recommended ? <Badge>{t("pack.recommended")}</Badge> : null}
      </CardHeader>
      <CardContent className="grid gap-1">
        <p className="text-2xl font-semibold">{currency(priceEur)}</p>
        <p className="text-sm text-muted-foreground">{t("pack.perGeneration", { price: currency(perGeneration) })}</p>
        {action}
      </CardContent>
    </Card>
  );
}
