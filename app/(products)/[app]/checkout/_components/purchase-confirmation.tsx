import { useFormatter, useTranslations } from "next-intl";
import { CheckIcon } from "lucide-react";
import type { Pack } from "@/lib/schemas/pack";
import { Button } from "@/components/ui/button";

// SA-05 (specs/mockups/SA-05-confirmation.png): +N credits, the pack, its
// price and the new balance, then "Reprendre ma génération".
export function PurchaseConfirmation({
  pack,
  balance,
  onResume,
}: {
  pack: Pack;
  balance: number;
  onResume: () => void;
}) {
  const t = useTranslations("checkout.confirmation");
  const format = useFormatter();
  const price = format.number(pack.priceCents / 100, { style: "currency", currency: "EUR" });

  return (
    <div className="grid gap-6 text-center">
      <div className="grid justify-items-center gap-3">
        <span aria-hidden="true" className="flex size-16 items-center justify-center rounded-full bg-primary/20">
          <CheckIcon className="size-8 text-primary" />
        </span>
        <p className="text-3xl font-bold">{t("added", { count: pack.credits })}</p>
        <p className="text-muted-foreground">{t("addedNote")}</p>
      </div>
      <dl className="grid gap-2 rounded-lg border p-4 text-left text-sm">
        <div className="flex justify-between">
          <dt className="text-muted-foreground">{t("pack")}</dt>
          <dd>{pack.credits}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted-foreground">{t("amount")}</dt>
          <dd>{price}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted-foreground">{t("newBalance")}</dt>
          <dd className="font-semibold">{balance}</dd>
        </div>
      </dl>
      <Button type="button" onClick={onResume}>
        {t("resume")}
      </Button>
    </div>
  );
}
