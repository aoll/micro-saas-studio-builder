"use client";

import { useTranslations } from "next-intl";
import { createContext, startTransition, useContext, useOptimistic } from "react";
import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";

type BalanceContextValue = { delta: number; addDelta: (delta: number) => void };

const BalanceContext = createContext<BalanceContextValue | null>(null);

// Fallback for <Suspense> around HeaderBalance (docs/04-nextjs.md: the
// session-reading balance badge streams so the landing shell stays static).
export function BalanceBadgeSkeleton() {
  return <Skeleton aria-hidden="true" className="h-6 w-16 rounded-full" />;
}

// The outil applies -1 optimistically on "Générer" (docs/01-produit.md ›
// Mécanique des crédits, docs/04-nextjs.md); once the transition settles
// (the real generate() call resolved, or failed and refunded), the badge
// discards the optimistic overlay and shows the server value again.
export function BalanceProvider({ children }: { children: ReactNode }) {
  const [delta, dispatchDelta] = useOptimistic(0, (current: number, applied: number) => current + applied);

  function addDelta(applied: number) {
    startTransition(async () => {
      dispatchDelta(applied);
      // Yields once so the optimistic render commits before the transition
      // (and this overlay) settles back to the real `balance` prop.
      await Promise.resolve();
    });
  }

  return <BalanceContext.Provider value={{ delta, addDelta }}>{children}</BalanceContext.Provider>;
}

export function useBalanceDelta(): (delta: number) => void {
  const ctx = useContext(BalanceContext);
  if (!ctx) throw new Error("useBalanceDelta must be used within a BalanceProvider");
  return ctx.addDelta;
}

export function BalanceBadge({ balance }: { balance: number }) {
  const ctx = useContext(BalanceContext);
  const t = useTranslations("common.header");
  // Never below zero (docs/01-produit.md: "aucun solde négatif"): at 0, the
  // optimistic -1 of "Générer" would show "-1" until the 402 opens the
  // paywall (QA1 B11).
  const displayed = Math.max(0, balance + (ctx?.delta ?? 0));
  return (
    <span key={displayed} className="animate-[badge-pop_0.3s_ease-out] rounded-full border px-2 py-0.5 text-sm">
      {t("credits", { count: displayed })}
    </span>
  );
}
