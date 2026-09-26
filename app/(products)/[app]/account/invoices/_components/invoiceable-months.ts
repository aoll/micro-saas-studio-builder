import type { AccountPurchase } from "@/lib/dal/account";

// SA-09 (specs/SA-09-facture.md): "un utilisateur … voit … la liste des mois
// facturables : chaque mois avec au moins un achat, du premier achat jusqu'au
// mois précédent le mois courant inclus (le mois en cours n'est jamais
// facturable, il n'est pas terminé)". Pure — `now` is a parameter, never
// `new Date()` read internally, so every boundary is testable without
// mocking the clock. UTC throughout, matching PurchaseList's own
// `timeZone: "UTC"` formatting (account/_components/purchase-list.tsx): a
// purchase's month never shifts with the server's local timezone.
export function monthKey(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

export function invoiceableMonths(purchases: AccountPurchase[], now: Date): string[] {
  const currentMonth = monthKey(now);
  const months = new Set<string>();
  for (const purchase of purchases) {
    const month = monthKey(purchase.createdAt);
    if (month < currentMonth) months.add(month);
  }
  return [...months].sort();
}
