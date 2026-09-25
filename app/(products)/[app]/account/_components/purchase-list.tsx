"use client";

import { useFormatter, useTranslations } from "next-intl";
import type { AccountPurchase } from "@/lib/dal/account";
import { EmptyState } from "@/components/shared/empty-state";

// SA-07 (docs/03-maquettes.md › SA-07): the purchases list, newest first as
// returned by listPurchases. Price formatting mirrors PackCard
// (components/product/pack-card.tsx).
export function PurchaseList({ purchases }: { purchases: AccountPurchase[] }) {
  const t = useTranslations("account");
  const format = useFormatter();

  if (purchases.length === 0) {
    return <EmptyState title={t("purchases.empty")} />;
  }

  return (
    <div className="grid gap-2">
      <h2 className="font-medium">{t("purchases.title")}</h2>
      <ul className="grid gap-3">
        {purchases.map((purchase) => (
          <li key={purchase.id} className="flex items-center justify-between rounded-md border p-3 text-sm">
            <span>
              {t("purchases.pack", { count: purchase.credits })} ·{" "}
              {format.dateTime(purchase.createdAt, { dateStyle: "medium", timeZone: "UTC" })}
            </span>
            <span className="font-semibold">
              {format.number(purchase.amountCents / 100, { style: "currency", currency: purchase.currency })}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
