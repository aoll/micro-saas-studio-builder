import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// SA-05 (specs/mockups/SA-05.png): the prefilled test card. Every field is
// read-only display, not a real form input (plan's design decision 4): no
// `name` attribute, so nothing here is ever submitted or autofilled by the
// browser as if it were a real card.
export function TestCardFields() {
  const t = useTranslations("checkout.card");

  return (
    <div className="grid gap-4">
      <div className="grid gap-1.5">
        <Label htmlFor="checkout-card-number">{t("number")}</Label>
        <Input id="checkout-card-number" readOnly value={t("numberValue")} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-1.5">
          <Label htmlFor="checkout-card-expiration">{t("expiration")}</Label>
          <Input id="checkout-card-expiration" readOnly value={t("expirationValue")} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="checkout-card-cvc">{t("cvc")}</Label>
          <Input id="checkout-card-cvc" readOnly value={t("cvcValue")} />
        </div>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="checkout-card-holder">{t("holder")}</Label>
        <Input id="checkout-card-holder" readOnly value={t("holderValue")} />
      </div>
    </div>
  );
}
