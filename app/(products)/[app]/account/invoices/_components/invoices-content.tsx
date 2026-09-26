import { listPurchases } from "@/lib/dal/account";
import { listInvoiceJobs } from "@/lib/dal/invoice-jobs";
import { getSession } from "@/lib/dal/session";
import { SignupPrompt } from "../../_components/signup-prompt";
import { InvoiceGenerator } from "./invoice-generator";
import { invoiceableMonths } from "./invoiceable-months";

// SA-09 (specs/SA-09-facture.md): the async leaf of /[app]/account/invoices,
// mirroring account-content.tsx — the only place that reads the session,
// kept under the page's <Suspense> boundary. No session: reuse SA-07's own
// SignupPrompt (same generic account-gate copy, no DAL call at all).
// Signed in: this user's own purchases (to compute the invoiceable months)
// and job list, fetched in parallel, both already scoped to the caller
// (listPurchases re-checks the session itself; listInvoiceJobs trusts this
// server component the same way a Server Action would, since it already
// checked the session above — lib/dal/invoice-jobs.ts's own doc comment).
export async function InvoicesContent({ slug, productId }: { slug: string; productId: string }) {
  const session = await getSession();
  if (!session) {
    return <SignupPrompt slug={slug} />;
  }

  const userId = session.user.id;
  const [purchases, jobs] = await Promise.all([
    listPurchases(userId, productId),
    listInvoiceJobs({ userId, productId }),
  ]);
  const months = invoiceableMonths(purchases, new Date());

  return <InvoiceGenerator slug={slug} months={months} initialJobs={jobs} />;
}
