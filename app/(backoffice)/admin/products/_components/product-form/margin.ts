import type { Pack } from "@/lib/schemas/pack";

// Cents → micro-dollars/euros (docs/07's `cost_micros`: 1 cent = 10 000
// micro-currency, "évite les arrondis"). The plan's orchestrator decision
// 4: EUR prices and USD AI cost treated 1:1, shown as an estimate.
const MICROS_PER_CENT = 10_000;

// BO-05 step 6's estimated margin (docs/02-ecrans.md): what one generation
// earns from a given pack, in micro-currency. A generation costs
// `costPerGeneration` credits; a pack's revenue per credit is its price
// spread evenly over its credits.
export function revenuePerGenerationMicros(pack: Pack, costPerGeneration: number): number {
  // QA1-P6-E3 (B-P6-1): a pack still mid-edit can carry 0 (or negative)
  // credits before the form blocks "Suivant" on it; dividing by zero would
  // otherwise produce Infinity, shown as "$Infinity" in the margin panel.
  if (pack.credits <= 0) return NaN;
  const revenuePerCreditMicros = (pack.priceCents * MICROS_PER_CENT) / pack.credits;
  return revenuePerCreditMicros * costPerGeneration;
}

export type PackMargin = { packId: string; revenuePerGenerationMicros: number; marginMicros: number };

// One margin per pack (revenue minus the AI cost of one generation, in
// micro-currency); can be negative (docs/02-ecrans.md's "marge estimée par
// génération" is shown either way, red when negative — the component's
// concern, not this pure function's).
export function estimateMargins(packs: Pack[], costPerGeneration: number, aiCostMicros: number): PackMargin[] {
  return packs.map((pack) => {
    const revenue = revenuePerGenerationMicros(pack, costPerGeneration);
    return { packId: pack.id, revenuePerGenerationMicros: revenue, marginMicros: revenue - aiCostMicros };
  });
}

// I18N-BACKOFFICE-STRINGS (lot 5, "décisions de portée" › formatting): the
// admin's chosen backoffice locale, not a hardcoded "fr-FR" — defaulted so
// every other call site (still French-only until its own lot passes a real
// locale) keeps its current behaviour.
// A pack's price, or a margin converted back to euros for display
// (cents → euros).
export function formatEur(cents: number, locale = "fr-FR"): string {
  return new Intl.NumberFormat(locale, { style: "currency", currency: "EUR" }).format(cents / 100);
}

// The AI cost (or a margin) in micro-dollars, formatted with 6 decimals: a
// single generation costs a fraction of a cent (docs/05's "moins de 0,5
// centime"), so 2 decimals of a plain dollar amount would round every
// figure in this panel down to $0.00.
export function formatUsd(micros: number): string {
  const dollars = Math.abs(micros) / 1_000_000;
  const sign = micros < 0 ? "-" : "";
  return `${sign}$${dollars.toFixed(6)}`;
}
