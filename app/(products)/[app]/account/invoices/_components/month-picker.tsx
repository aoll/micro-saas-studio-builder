"use client";

import { Loader2Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import { startTransition, useState } from "react";
import { Button } from "@/components/ui/button";
import { generateInvoices } from "../_actions";

// SA-09 (specs/SA-09-facture.md): checkboxes over the server-computed
// invoiceable months (invoiceable-months.ts, run by InvoicesContent), a
// "Générer" button that calls generateInvoices via startTransition
// (checkout-flow.tsx's handlePay pattern). No checkbox primitive exists yet
// in components/ui (ponytail: a plain <input type="checkbox"> is enough,
// no new dependency for this).
export function MonthPicker({
  slug,
  months,
  onGenerated,
}: {
  slug: string;
  months: string[];
  onGenerated: () => void;
}) {
  const t = useTranslations("invoices");
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);

  function toggle(month: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(month)) next.delete(month);
      else next.add(month);
      return next;
    });
  }

  function handleGenerate() {
    if (pending || selected.size === 0) return;
    setPending(true);
    setError(false);

    startTransition(async () => {
      const result = await generateInvoices(slug, [...selected]);
      setPending(false);
      if (result.ok) {
        setSelected(new Set());
        onGenerated();
      } else {
        setError(true);
      }
    });
  }

  if (months.length === 0) {
    return <p className="text-sm text-muted-foreground">{t("months.empty")}</p>;
  }

  return (
    <div className="grid gap-3">
      <h2 className="font-medium">{t("months.title")}</h2>
      <ul className="grid gap-2">
        {months.map((month) => (
          <li key={month} className="flex items-center gap-2">
            <input
              type="checkbox"
              id={`invoice-month-${month}`}
              className="size-4"
              checked={selected.has(month)}
              onChange={() => toggle(month)}
            />
            <label htmlFor={`invoice-month-${month}`}>{month}</label>
          </li>
        ))}
      </ul>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {t("generate.error")}
        </p>
      ) : null}
      <Button type="button" onClick={handleGenerate} disabled={pending || selected.size === 0}>
        {pending ? (
          <>
            <Loader2Icon className="size-4 animate-spin" aria-hidden="true" />
            {t("generate.pending")}
          </>
        ) : (
          t("generate.button")
        )}
      </Button>
    </div>
  );
}
