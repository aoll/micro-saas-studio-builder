"use client";

import { useFormatter, useTranslations } from "next-intl";
import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTransition, useEffect, useRef, useState } from "react";
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
  // QA1-P1-B3 (.claude/plans/QA1-P1-B3.plan.md, design decisions 2-3): true
  // when the checkout modal opened over the full /pricing page — the only
  // background where refreshing the router while the modal is still mounted
  // re-fetches the intercepted /pricing background and reproduces B3
  // (.claude/qa/reports/2026-09-25-full.md › B3). Set once, at the moment
  // of paying, so handleResume reads the same value handlePay computed.
  const overPricingPageRef = useRef(false);
  // QA1-P1-B3 (plan step 6): set only when a purchase over /pricing
  // succeeded while the refresh was skipped above. Read once, on unmount.
  const refreshOnLeaveRef = useRef(false);

  useEffect(() => {
    return () => {
      // Runs after the router's action queue holds the restored /pricing
      // tree (modal slot back to default, no interception route): the
      // refresh then sends no Next-Url, and /pricing renders as a page
      // instead of the modal that caused B3 (design decision 3). Covers
      // Reprendre, Escape / backdrop / the close button (RouteModal's own
      // router.back()), and the browser's back button — every way this
      // component can unmount after a successful purchase over /pricing.
      if (refreshOnLeaveRef.current) router.refresh();
    };
    // useRouter() is stable; this cleanup must run only on unmount, not on
    // every render (a `router` dependency would re-run it needlessly).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handlePay() {
    if (status === "pending") return;
    keyRef.current ??= crypto.randomUUID();
    const key = keyRef.current;
    if (variant === "modal") {
      overPricingPageRef.current = document.querySelector('main [data-slot="pricing-content"]') !== null;
    }
    setStatus("pending");
    setErrorCode(null);

    startTransition(async () => {
      addDelta(pack.credits);
      const result = await purchase(slug, pack.id, key);
      if (result.ok) {
        setBalance(result.balance);
        setStatus("confirmed");
        // purchase() no longer calls refresh() itself (root cause: a server
        // refresh re-fetches the /pricing background kept behind the modal,
        // gets intercepted by @modal/(.)pricing, and forces a hard reload).
        // Refreshing here is safe everywhere except over the full /pricing
        // page, where the modal is still mounted right after this call: the
        // unmount effect above refreshes once it has left instead.
        if (overPricingPageRef.current) refreshOnLeaveRef.current = true;
        else router.refresh();
      } else {
        setStatus("error");
        setErrorCode(result.error);
      }
    });
  }

  function handleResume() {
    // Over /pricing, history is [/pricing, /checkout/pack-N] and the
    // purchase pushed nothing, so back() lands on /pricing without a
    // reload — the same route RouteModal's own close already takes
    // (design decision 4). Everywhere else, replace to the tool.
    if (overPricingPageRef.current) router.back();
    else router.replace(`/${slug}/tool` as Route);
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
