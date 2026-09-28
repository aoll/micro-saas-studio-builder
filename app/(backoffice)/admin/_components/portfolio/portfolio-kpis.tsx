import { getLocale, getTranslations } from "next-intl/server";
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

// I18N-BACKOFFICE-STRINGS: a Server Component (no client boundary between
// this and admin/page.tsx), so getTranslations/getLocale read the ambient
// per-request config directly — no explicit locale argument needed.
export async function PortfolioKpis({ totals }: { totals: PortfolioMetrics["totals"] }) {
  const t = await getTranslations("backoffice-portfolio");
  const locale = (await getLocale()) as "fr" | "en";
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      <KpiCard label={t("portfolio.kpis.visits")} value={formatNumber(totals.visits, locale)} />
      <KpiCard label={t("portfolio.kpis.revenue")} value={formatEuroCents(totals.revenueCents, locale)} />
      <KpiCard label={t("portfolio.kpis.aiCost")} value={formatEuroMicros(totals.aiCostMicros, 2, locale)} />
      <KpiCard label={t("portfolio.kpis.grossMargin")} value={formatPercent(grossMarginRate(totals), locale)} />
    </div>
  );
}
