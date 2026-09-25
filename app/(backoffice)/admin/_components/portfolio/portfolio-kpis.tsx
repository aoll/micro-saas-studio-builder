import { KpiCard } from "@/components/backoffice/kpi-card";
import type { PortfolioMetrics } from "@/lib/dal/metrics";
import { formatEuroCents, formatEuroMicros, formatNumber, formatPercent } from "./format";

// docs/02-ecrans.md › BO-02: "KPIs globaux en tête" (plan design decision
// 7 — 4 labels, no deltas). Gross margin is a rate (margin / revenue), not
// a euro amount: `null` (shown as "—") when there is no revenue to divide
// by.
function grossMarginRate(totals: PortfolioMetrics["totals"]): number | null {
  const revenueMicros = totals.revenueCents * 10_000;
  return revenueMicros > 0 ? totals.marginMicros / revenueMicros : null;
}

export function PortfolioKpis({ totals }: { totals: PortfolioMetrics["totals"] }) {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      <KpiCard label="Visites · 30 j" value={formatNumber(totals.visits)} />
      <KpiCard label="Revenu · 30 j" value={formatEuroCents(totals.revenueCents)} />
      <KpiCard label="Coût IA · 30 j" value={formatEuroMicros(totals.aiCostMicros)} />
      <KpiCard label="Marge brute" value={formatPercent(grossMarginRate(totals))} />
    </div>
  );
}
