import type { ProductConfig } from "@/lib/schemas/product-config";

// I18N-BACKOFFICE-STRINGS (spec "Décisions de portée" › formatage des
// nombres et devises): the locale comes from the caller (`getLocale()` on
// the server, `useLocale()` on the client) instead of a hard-coded
// "fr-FR". Formatted here, not in the client table component, to avoid an
// `Intl` hydration mismatch (specs/BO-02-portefeuille plan, risk table).
type Locale = ProductConfig["locale"];

const EM_DASH = "—";
const MICROS_PER_EURO = 1_000_000;

export function formatEuroCents(cents: number, locale: Locale): string {
  return new Intl.NumberFormat(locale, { style: "currency", currency: "EUR" }).format(cents / 100);
}

// AI cost and margin are stored in micros (millionths of a dollar,
// docs/07-modele-de-donnees.md); shown in € at USD = EUR 1:1, like the
// frozen `marginMicros` total already does (plan design decision 6). A
// generation costs a fraction of a cent, so the decimals grow until the
// first significant digit and the next one show (0,0012 €, up to 6): a
// non-zero cost never reads as 0,00 € (QA1 B8).
const MAX_MICROS_FRACTION_DIGITS = 6;

export function formatEuroMicros(micros: number, locale: Locale, minimumFractionDigits = 2): string {
  const euros = micros / MICROS_PER_EURO;
  const leadingZeros = euros === 0 ? 0 : Math.ceil(-Math.log10(Math.abs(euros)));
  const maximumFractionDigits = Math.min(MAX_MICROS_FRACTION_DIGITS, Math.max(minimumFractionDigits, leadingZeros + 1));
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits,
    maximumFractionDigits,
  }).format(euros);
}

export function formatPercent(rate: number | null, locale: Locale): string {
  if (rate === null) return EM_DASH;
  return new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 1 }).format(rate);
}

export function formatNumber(value: number, locale: Locale): string {
  return new Intl.NumberFormat(locale).format(value);
}
