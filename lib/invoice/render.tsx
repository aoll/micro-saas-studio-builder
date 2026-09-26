// Frozen contract (specs/SA-09-facture.md, C0): pure — no database, no
// "server-only" import needed. Takes already-fetched data (the caller reads
// `purchases` via lib/dal/account.ts's listPurchases, filtered to the
// requested month) and returns a rendered PDF buffer. @react-pdf/renderer is
// added by whichever branch implements the body (spec's Périmètre:
// package.json).
import type { AccountPurchase } from "@/lib/dal/account";

export type InvoicePdfInput = {
  productName: string;
  buyerEmail: string;
  month: string; // "YYYY-MM"
  purchases: AccountPurchase[];
};

export async function renderInvoicePdf(_input: InvoicePdfInput): Promise<Buffer> {
  throw new Error("not implemented");
}
