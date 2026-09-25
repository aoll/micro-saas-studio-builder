"use client";

import { useFormatter, useTranslations } from "next-intl";
import type { CreditMovement } from "@/lib/dal/account";
import { EmptyState } from "@/components/shared/empty-state";

// SA-07 (docs/03-maquettes.md › SA-07): the ledger movements list, newest
// first as returned by listCreditMovements. Per the plan's design decision
// 5, a generation's label is the plain reason word — no per-generation
// input summary (that would need the tool's field config, out of scope
// here).
export function MovementList({ movements }: { movements: CreditMovement[] }) {
  const t = useTranslations("account");
  const format = useFormatter();

  if (movements.length === 0) {
    return <EmptyState title={t("movements.empty")} />;
  }

  return (
    <div className="grid gap-2">
      <h2 className="font-medium">{t("movements.title")}</h2>
      <ul className="grid gap-3">
        {movements.map((movement) => (
          <li key={movement.id} className="flex items-center justify-between border-b pb-2 text-sm">
            <span className={movement.delta > 0 ? "font-semibold text-green-600" : "font-semibold text-red-600"}>
              {movement.delta > 0 ? "+" : "−"}
              {Math.abs(movement.delta)}
            </span>
            <span className="flex-1 px-3">{t(`movement.${movement.reason}`, { count: movement.delta })}</span>
            <span className="text-muted-foreground">
              {format.dateTime(movement.createdAt, { dateStyle: "medium", timeZone: "UTC" })}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
