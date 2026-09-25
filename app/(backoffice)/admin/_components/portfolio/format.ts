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
// frozen `marginMicros` total already does (plan design decision 6). A
// generation costs a fraction of a cent, so the decimals grow until the
// first significant digit and the next one show (0,0012 €, up to 6): a
// non-zero cost never reads as 0,00 € (QA1 B8).
const MAX_MICROS_FRACTION_DIGITS = 6;

export function formatEuroMicros(micros: number, minimumFractionDigits = 2): string {
  const euros = micros / MICROS_PER_EURO;
  const leadingZeros = euros === 0 ? 0 : Math.ceil(-Math.log10(Math.abs(euros)));
  const maximumFractionDigits = Math.min(MAX_MICROS_FRACTION_DIGITS, Math.max(minimumFractionDigits, leadingZeros + 1));
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits,
    maximumFractionDigits,
  }).format(euros);
}

export function formatPercent(rate: number | null): string {
  return rate === null ? EM_DASH : PERCENT_FORMATTER.format(rate);
}

export function formatNumber(value: number): string {
  return NUMBER_FORMATTER.format(value);
}
