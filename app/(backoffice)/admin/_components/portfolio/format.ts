// French, server-side formatting (docs/08-stack.md: the backoffice stays in
// French, no next-intl there). Formatted here, not in the client table
// component, to avoid an `Intl` hydration mismatch (specs/BO-02-portefeuille
// plan, risk table).
const EURO_FORMATTER = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });
const PERCENT_FORMATTER = new Intl.NumberFormat("fr-FR", { style: "percent", maximumFractionDigits: 1 });
const NUMBER_FORMATTER = new Intl.NumberFormat("fr-FR");

const EM_DASH = "—";
const MICROS_PER_EURO = 1_000_000;

export function formatEuroCents(cents: number): string {
  return EURO_FORMATTER.format(cents / 100);
}

// AI cost and margin are stored in micros (millionths of a dollar,
// docs/07-modele-de-donnees.md); shown in € at USD = EUR 1:1, like the
// frozen `marginMicros` total already does (plan design decision 6).
export function formatEuroMicros(micros: number): string {
  return EURO_FORMATTER.format(micros / MICROS_PER_EURO);
}

export function formatPercent(rate: number | null): string {
  return rate === null ? EM_DASH : PERCENT_FORMATTER.format(rate);
}

export function formatNumber(value: number): string {
  return NUMBER_FORMATTER.format(value);
}
