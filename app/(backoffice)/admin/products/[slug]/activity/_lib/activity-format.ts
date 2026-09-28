import { formatEuroCents, formatEuroMicros } from "@/app/(backoffice)/admin/_components/portfolio/format";
import { excerpt, summarizeInput } from "@/app/(products)/[app]/history/_lib/summarize";
import type { ActivityGeneration, ActivityMovement, PurchaseSummary } from "@/lib/dal/activity";

// I18N-BACKOFFICE-STRINGS: a minimal structural type (sheet.ts's `Translate`, defined again here
// rather than imported: the two files are unrelated feature areas that happen to share a message
// zone, and importing across them would be an artificial coupling for ~3 lines).
export type Translate = (key: string, values?: Record<string, string | number>) => string;

// BO-04 (specs/BO-04-activite.md), pure view formatting — no DB, no
// session — colocated under the route (plan § "Pure helpers"). Re-uses two
// read-only helpers from SA-06's private `_lib` (plan design decision 4)
// instead of duplicating truncation logic: `summarizeInput` for the
// "Entrée" column, `excerpt` for "Sortie".

const EM_DASH = "—";

// AI cost with at least 3 decimals ("0,004 €", plan design decision 4),
// more when needed so a sub-millieuro generation never reads 0,000 €
// (QA1 B8): the portfolio's adaptive `formatEuroMicros`.
export function formatCostMicros(costMicros: number | null): string {
  return formatEuroMicros(costMicros ?? 0, 3);
}

const MS_PER_MINUTE = 60_000;
const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;

// "il y a 2 min" / "il y a 1 h" / "il y a 3 j" (mockup, specs/mockups/BO-04.png): abbreviated
// units, not Intl.RelativeTimeFormat's full words ("il y a 2 minutes"). `now` is passed in (plan
// design decision 8: created once, after requireAdmin(), by the caller) rather than read here, so
// this stays a pure function of its arguments — `t` the same way (I18N-BACKOFFICE-STRINGS): the
// minutes/hours branches are invariant in both languages (no ICU plural needed, "min"/"h" don't
// inflect), the days branch does (English "day"/"days" genuinely differs, `activity.relative.days`
// is ICU plural — not a calque of the French).
export function formatRelative(date: Date, now: Date, t: Translate): string {
  const diffMinutes = Math.max(0, Math.floor((now.getTime() - date.getTime()) / MS_PER_MINUTE));
  if (diffMinutes < 1) return t("activity.relative.now");
  if (diffMinutes < MINUTES_PER_HOUR) return t("activity.relative.minutes", { count: diffMinutes });
  const diffHours = Math.floor(diffMinutes / MINUTES_PER_HOUR);
  if (diffHours < HOURS_PER_DAY) return t("activity.relative.hours", { count: diffHours });
  const diffDays = Math.floor(diffHours / HOURS_PER_DAY);
  return t("activity.relative.days", { count: diffDays });
}

const MINUS_SIGN = "−"; // U+2212, not a hyphen (plan § "Pure helpers": "formatDelta (U+2212)").

export function formatDelta(delta: number): string {
  return delta >= 0 ? `+${delta}` : `${MINUS_SIGN}${Math.abs(delta)}`;
}

// "Achat pack 10", "Génération", "Remboursement", "Bonus inscription"
// (mockup's "Mouvements de crédits" card).
export function movementLabel(movement: Pick<ActivityMovement, "reason" | "packCredits">, t: Translate): string {
  switch (movement.reason) {
    case "purchase":
      return movement.packCredits !== null
        ? t("activity.movements.reason.purchase", { credits: movement.packCredits })
        : t("activity.movements.reason.purchaseNoPack");
    case "generation":
      return t("activity.movements.reason.generation");
    case "refund":
      return t("activity.movements.reason.refund");
    case "signup_bonus":
      return t("activity.movements.reason.signup_bonus");
  }
}

export type GenerationStatusView = { label: string; variant: "ok" | "error" | "pending" };

// "OK" (green), "Erreur · remboursé" (red, mockup) when a failed generation
// was refunded, "Erreur" for a failed one that hasn't been (yet), "En
// cours" for a still-pending row.
export function generationStatus(
  entry: Pick<ActivityGeneration, "status" | "refunded">,
  t: Translate,
): GenerationStatusView {
  if (entry.status === "succeeded") return { label: t("activity.generations.status.ok"), variant: "ok" };
  if (entry.status === "pending") return { label: t("activity.generations.status.pending"), variant: "pending" };
  return {
    label: entry.refunded ? t("activity.generations.status.errorRefunded") : t("activity.generations.status.error"),
    variant: "error",
  };
}

// The "Sortie" column: an em dash for a generation with no output yet (a
// failed or pending row, mockup), the joined items of a structured output
// (docs/07: "output … Texte ou objet structuré"), otherwise the excerpted
// text.
export function summarizeOutput(output: unknown, max = 80): string {
  if (output === null || output === undefined) return EM_DASH;
  if (typeof output === "string") return excerpt(output, max);
  if (Array.isArray(output)) return excerpt(output.map((item) => String(item)).join(", "), max);
  return excerpt(JSON.stringify(output), max);
}

export { excerpt, summarizeInput };

// The "Achats · 30 j" card (mockup): a headline ("14 achats · 72 €", ICU plural —
// I18N-BACKOFFICE-STRINGS: "1 purchase" vs "14 purchases" genuinely differ in English) and, when
// at least one pack was sold, a breakdown line ("Pack 10 : 11 · Pack 50 : 3"). Returned as lines
// (not a single string) so the component decides how to lay them out, mirroring the mockup's
// two-line card. The amount itself stays formatEuroCents (fr-FR, portfolio/format.ts): outside
// this lot's Périmètre, not yet locale-aware (see this spec's report).
export function purchaseSummaryLines(summary: PurchaseSummary, t: Translate): string[] {
  const headline = t("activity.purchases.headline", {
    count: summary.count,
    amount: formatEuroCents(summary.revenueCents),
  });
  if (summary.byPack.length === 0) return [headline];
  const breakdown = summary.byPack
    .map((pack) => t("activity.purchases.packBreakdown", { credits: pack.credits, count: pack.count }))
    .join(" · ");
  return [headline, breakdown];
}
