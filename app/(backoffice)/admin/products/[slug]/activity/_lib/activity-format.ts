import { formatEuroCents } from "@/app/(backoffice)/admin/_components/portfolio/format";
import { excerpt, summarizeInput } from "@/app/(products)/[app]/history/_lib/summarize";
import type { ActivityGeneration, ActivityMovement, PurchaseSummary } from "@/lib/dal/activity";

// BO-04 (specs/BO-04-activite.md), pure view formatting — no DB, no
// session — colocated under the route (plan § "Pure helpers"). Re-uses two
// read-only helpers from SA-06's private `_lib` (plan design decision 4)
// instead of duplicating truncation logic: `summarizeInput` for the
// "Entrée" column, `excerpt` for "Sortie".

const EM_DASH = "—";

// AI cost needs 3 decimals ("0,004 €", plan design decision 4): the
// portfolio's `formatEuroMicros` rounds to 2, hiding a sub-cent generation.
const COST_FORMATTER = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 3,
  maximumFractionDigits: 3,
});
const MICROS_PER_EURO = 1_000_000;

export function formatCostMicros(costMicros: number | null): string {
  return COST_FORMATTER.format((costMicros ?? 0) / MICROS_PER_EURO);
}

const MS_PER_MINUTE = 60_000;
const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;

// "il y a 2 min" / "il y a 1 h" / "il y a 3 j" (mockup, specs/mockups/BO-04.png): abbreviated
// French units, not Intl.RelativeTimeFormat's full words ("il y a 2 minutes"). `now` is passed in
// (plan design decision 8: created once, after requireAdmin(), by the caller) rather than read
// here, so this stays a pure function of its two arguments.
export function formatRelative(date: Date, now: Date): string {
  const diffMinutes = Math.max(0, Math.floor((now.getTime() - date.getTime()) / MS_PER_MINUTE));
  if (diffMinutes < 1) return "à l'instant";
  if (diffMinutes < MINUTES_PER_HOUR) return `il y a ${diffMinutes} min`;
  const diffHours = Math.floor(diffMinutes / MINUTES_PER_HOUR);
  if (diffHours < HOURS_PER_DAY) return `il y a ${diffHours} h`;
  const diffDays = Math.floor(diffHours / HOURS_PER_DAY);
  return `il y a ${diffDays} j`;
}

const MINUS_SIGN = "−"; // U+2212, not a hyphen (plan § "Pure helpers": "formatDelta (U+2212)").

export function formatDelta(delta: number): string {
  return delta >= 0 ? `+${delta}` : `${MINUS_SIGN}${Math.abs(delta)}`;
}

// "Achat pack 10", "Génération", "Remboursement", "Bonus inscription"
// (mockup's "Mouvements de crédits" card).
export function movementLabel(movement: Pick<ActivityMovement, "reason" | "packCredits">): string {
  switch (movement.reason) {
    case "purchase":
      return movement.packCredits !== null ? `Achat pack ${movement.packCredits}` : "Achat";
    case "generation":
      return "Génération";
    case "refund":
      return "Remboursement";
    case "signup_bonus":
      return "Bonus inscription";
  }
}

export type GenerationStatusView = { label: string; variant: "ok" | "error" | "pending" };

// "OK" (green), "Erreur · remboursé" (red, mockup) when a failed generation
// was refunded, "Erreur" for a failed one that hasn't been (yet), "En
// cours" for a still-pending row.
export function generationStatus(entry: Pick<ActivityGeneration, "status" | "refunded">): GenerationStatusView {
  if (entry.status === "succeeded") return { label: "OK", variant: "ok" };
  if (entry.status === "pending") return { label: "En cours", variant: "pending" };
  return { label: entry.refunded ? "Erreur · remboursé" : "Erreur", variant: "error" };
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

// The "Achats · 30 j" card (mockup): a headline ("14 achats · 72 €") and,
// when at least one pack was sold, a breakdown line ("Pack 10 : 11 · Pack
// 50 : 3"). Returned as lines (not a single string) so the component
// decides how to lay them out, mirroring the mockup's two-line card.
export function purchaseSummaryLines(summary: PurchaseSummary): string[] {
  const headline = `${summary.count} achat${summary.count > 1 ? "s" : ""} · ${formatEuroCents(summary.revenueCents)}`;
  if (summary.byPack.length === 0) return [headline];
  const breakdown = summary.byPack.map((pack) => `Pack ${pack.credits} : ${pack.count}`).join(" · ");
  return [headline, breakdown];
}
