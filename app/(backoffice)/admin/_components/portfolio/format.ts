import type { ProductConfig } from "@/lib/schemas/product-config";

// I18N-BACKOFFICE-STRINGS (spec "Décisions de portée" › formatage des
// nombres et devises): the locale comes from the caller (`getLocale()` on
// the server, `useLocale()` on the client) instead of a hard-coded
// "fr-FR". Formatted here, not in the client table component, to avoid an
// `Intl` hydration mismatch (specs/BO-02-portefeuille plan, risk table).
//
// `locale` defaults to "fr" (not a required, breaking parameter):
// decision-gauge.tsx, decision-copy.ts, sheet.ts (lot "Statut & Décision")
// and activity-format.ts, purchases-card.tsx (lot "Fiche produit &
// Activité") import these functions too and are outside this lot's
// Périmètre — the spec's own "Décisions de portée" asks each of those
// lots to make the same change in their own files. Until they do, an
// unmodified call keeps its exact pre-existing French formatting; this
// lot's own call sites (rows.ts, portfolio-kpis.tsx) always pass an
// explicit locale.
type Locale = ProductConfig["locale"];

const EM_DASH = "—";
const MICROS_PER_EURO = 1_000_000;

export function formatEuroCents(cents: number, locale: Locale = "fr"): string {
  return new Intl.NumberFormat(locale, { style: "currency", currency: "EUR" }).format(cents / 100);
}

// AI cost and margin are stored in micros (millionths of a dollar,
// docs/07-modele-de-donnees.md); shown in € at USD = EUR 1:1, like the
// frozen `marginMicros` total already does (plan design decision 6). A
// generation costs a fraction of a cent, so the decimals grow until the
// first significant digit and the next one show (0,0012 €, up to 6): a
// non-zero cost never reads as 0,00 € (QA1 B8).
const MAX_MICROS_FRACTION_DIGITS = 6;

// `minimumFractionDigits` stays the second positional parameter (not
// `locale`): activity-format.ts's existing `formatEuroMicros(costMicros ??
// 0, 3)` call (outside this lot's Périmètre, docs "Décisions de portée")
// must keep working unmodified, at its old default locale, until its own
// lot threads a locale through — `locale` is appended third instead.
export function formatEuroMicros(micros: number, minimumFractionDigits = 2, locale: Locale = "fr"): string {
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

export function formatPercent(rate: number | null, locale: Locale = "fr"): string {
  if (rate === null) return EM_DASH;
  return new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 1 }).format(rate);
}

export function formatNumber(value: number, locale: Locale = "fr"): string {
  return new Intl.NumberFormat(locale).format(value);
}
