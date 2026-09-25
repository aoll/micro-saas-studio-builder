"use client";

import { useFormatter, useTranslations } from "next-intl";
import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTransition, useRef, useState } from "react";
import { Loader2Icon } from "lucide-react";
import { useBalanceDelta } from "@/components/product/balance";
import { RouteModal } from "@/components/product/route-modal";
import { Button } from "@/components/ui/button";
import type { Pack } from "@/lib/schemas/pack";
import { purchase, type PurchaseResult } from "../_actions";
import { PackSummary } from "./pack-summary";
import { PurchaseConfirmation } from "./purchase-confirmation";
import { TestCardFields } from "./test-card-fields";

type Status = "idle" | "pending" | "confirmed" | "error";
type PurchaseError = Extract<PurchaseResult, { ok: false }>["error"];

// SA-05 (specs/SA-05-paiement.md): the single component rendered by both
// checkout pages (full page and intercepted modal, docs/04-nextjs.md's
// "modales en intercepting routes"). `variant` picks the wrapper because
// only this component knows the current status, and the modal's title
// changes on confirmation (plan's design decision 4: RouteModal's title
// "Paiement" / "Paiement confirmé", the page's own <h1> instead).
export function CheckoutFlow({
  variant,
  slug,
  productName,
  pack,
  costPerGeneration,
}: {
  variant: "modal" | "page";
  slug: string;
  productName: string;
  pack: Pack;
  costPerGeneration: number;
}) {
  const t = useTranslations("checkout");
  const format = useFormatter();
  const router = useRouter();
  const addDelta = useBalanceDelta();

  const [status, setStatus] = useState<Status>("idle");
  const [errorCode, setErrorCode] = useState<PurchaseError | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  // ??= (never regenerated during render, decision 2): a failed attempt
  // retries with the very purchase the buyer already tried, so a replay
  // after a transient failure still dedupes on the ledger's idempotency key.
  const keyRef = useRef<string | null>(null);

  function handlePay() {
    if (status === "pending") return;
    keyRef.current ??= crypto.randomUUID();
    const key = keyRef.current;
    setStatus("pending");
    setErrorCode(null);

    startTransition(async () => {
      addDelta(pack.credits);
      const result = await purchase(slug, pack.id, key);
      if (result.ok) {
        setBalance(result.balance);
        setStatus("confirmed");
      } else {
        setStatus("error");
        setErrorCode(result.error);
      }
    });
  }

  function handleResume() {
    router.replace(`/${slug}/tool` as Route);
  }

  const price = format.number(pack.priceCents / 100, { style: "currency", currency: "EUR" });
  const confirmed = status === "confirmed" && balance !== null;

  const content = confirmed ? (
    <PurchaseConfirmation pack={pack} balance={balance} onResume={handleResume} />
  ) : (
    <div className="grid gap-6">
      <PackSummary productName={productName} pack={pack} costPerGeneration={costPerGeneration} />
      <p role="status" className="rounded-md border border-dashed border-amber-500/60 bg-amber-500/10 p-3 text-sm">
        {t("notice")}
      </p>
      <TestCardFields />
      {status === "error" && errorCode ? (
        <p role="alert" className="text-sm text-destructive">
          {t(`errors.${errorCode}`)}
          {errorCode === "unauthenticated" ? (
            <>
              {" "}
              <Link href={`/${slug}/signup` as Route} className="underline">
                {t("signIn")}
              </Link>
            </>
          ) : null}
        </p>
      ) : null}
      <Button type="button" onClick={handlePay} disabled={status === "pending"}>
        {status === "pending" ? (
          <>
            <Loader2Icon className="size-4 animate-spin" aria-hidden="true" />
            {t("paying")}
          </>
        ) : (
          t("pay", { price })
        )}
      </Button>
      <p className="text-center text-xs text-muted-foreground">{t("stayNotice")}</p>
    </div>
  );

  if (variant === "page") {
    return (
      <section className="mx-auto grid max-w-md gap-6 px-4 py-8">
        <h1 className="text-2xl font-bold">{confirmed ? t("modal.titleConfirmed") : t("page.title")}</h1>
        {content}
      </section>
    );
  }

  return <RouteModal title={confirmed ? t("modal.titleConfirmed") : t("modal.title")}>{content}</RouteModal>;
}
