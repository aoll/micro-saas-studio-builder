import { expect, test } from "@playwright/test";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { users } from "../lib/db/auth-schema";
import { invoiceJobs, products, purchases } from "../lib/db/schema";
import { requireDatabaseUrl } from "../lib/require-database-url";
import { SEED_ADMIN } from "../scripts/seed";

// SA-09 (specs/SA-09-facture.md), played end to end against
// /lettre-pro/account/invoices. Written now, run in the E2E phase
// (docs/11-implementation.md › V4 Package) — NOT expected to pass standalone
// in the sa-09-front worktree this file was authored in: lib/dal/invoice-jobs.ts
// and lib/invoice/render.tsx are a parallel track's own C0 contract, still
// `throw new Error("not implemented")` stubs there. Run this once both
// SA-09 tracks (front + back) have merged.
//
// Same stand-in buyer as checkout.spec.ts (SA-03's magic-link sign-up isn't
// wired to an e2e flow yet): SEED_ADMIN through BO-01's /admin/login. Every
// authenticated test cleans up SEED_ADMIN's purchases and invoice_jobs on
// lettre-pro before and after running (checkout.spec.ts's own direct-Postgres
// pattern) — grouped and serialized for the same reason checkout.spec.ts's
// "admin-ledger purchases" group is: they share the same admin/lettre-pro
// rows checkout.spec.ts itself resets, so this whole file must never run
// concurrently with checkout.spec.ts's ledger group either.

function monthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

// The 10th of the month, months ago, in UTC — safely inside that month
// regardless of the day this suite actually runs on.
function closedMonth(monthsAgo: number): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - monthsAgo, 10));
}

async function signInAsAdmin(page: import("@playwright/test").Page): Promise<void> {
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(SEED_ADMIN.email);
  await page.getByLabel("Mot de passe").fill(SEED_ADMIN.password);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

async function cleanupInvoiceFixturesOnLettrePro(): Promise<void> {
  const sql = postgres(requireDatabaseUrl(), { max: 1, onnotice: () => {} });
  const db = drizzle(sql, { schema: { products, users, purchases, invoiceJobs } });
  try {
    const product = await db.query.products.findFirst({ where: eq(products.slug, "lettre-pro") });
    const admin = await db.query.users.findFirst({ where: eq(users.email, SEED_ADMIN.email) });
    if (!product || !admin) return;
    await db.delete(invoiceJobs).where(and(eq(invoiceJobs.productId, product.id), eq(invoiceJobs.userId, admin.id)));
    await db.delete(purchases).where(and(eq(purchases.productId, product.id), eq(purchases.userId, admin.id)));
  } finally {
    await sql.end();
  }
}

/** Seeds one purchase each in the two closed months right before the current one, and returns their "YYYY-MM" keys, oldest first. */
async function seedTwoClosedMonthsOfPurchases(): Promise<[string, string]> {
  const sql = postgres(requireDatabaseUrl(), { max: 1, onnotice: () => {} });
  const db = drizzle(sql, { schema: { products, users, purchases } });
  try {
    const product = await db.query.products.findFirst({ where: eq(products.slug, "lettre-pro") });
    const admin = await db.query.users.findFirst({ where: eq(users.email, SEED_ADMIN.email) });
    if (!product || !admin) throw new Error("Seed missing: lettre-pro / admin (run pnpm db:seed)");

    const twoMonthsAgo = closedMonth(2);
    const oneMonthAgo = closedMonth(1);
    await db.insert(purchases).values([
      {
        userId: admin.id,
        productId: product.id,
        packId: "pack-10",
        credits: 10,
        amountCents: 490,
        idempotencyKey: `e2e-invoices-${monthKey(twoMonthsAgo)}`,
        createdAt: twoMonthsAgo,
      },
      {
        userId: admin.id,
        productId: product.id,
        packId: "pack-10",
        credits: 10,
        amountCents: 490,
        idempotencyKey: `e2e-invoices-${monthKey(oneMonthAgo)}`,
        createdAt: oneMonthAgo,
      },
    ]);
    return [monthKey(twoMonthsAgo), monthKey(oneMonthAgo)];
  } finally {
    await sql.end();
  }
}

/** Inserts an already-`failed` invoice_jobs row directly, to exercise the retry button without waiting on a real 15s timeout. */
async function seedFailedJob(month: string): Promise<void> {
  const sql = postgres(requireDatabaseUrl(), { max: 1, onnotice: () => {} });
  const db = drizzle(sql, { schema: { products, users, invoiceJobs } });
  try {
    const product = await db.query.products.findFirst({ where: eq(products.slug, "lettre-pro") });
    const admin = await db.query.users.findFirst({ where: eq(users.email, SEED_ADMIN.email) });
    if (!product || !admin) throw new Error("Seed missing: lettre-pro / admin (run pnpm db:seed)");

    await db.insert(invoiceJobs).values({
      userId: admin.id,
      productId: product.id,
      month,
      status: "failed",
      error: "Délai dépassé (15 s)",
      idempotencyKey: `${admin.id}:${product.id}:${month}`,
    });
  } finally {
    await sql.end();
  }
}

test.describe("Invoices (/lettre-pro/account/invoices)", () => {
  test("a not-signed-in visitor is sent to the sign-up modal", async ({ page }) => {
    await page.goto("/lettre-pro/account/invoices");
    await expect(page).toHaveURL(/\/lettre-pro\/signup$/);
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
  });

  test.describe("admin purchases and jobs on lettre-pro", () => {
    test.describe.configure({ mode: "serial" });

    test("shows the invoiceable months, generates jobs for the selected ones, and each reaches done live", async ({
      page,
    }) => {
      await cleanupInvoiceFixturesOnLettrePro();
      try {
        const [monthTwoAgo, monthOneAgo] = await seedTwoClosedMonthsOfPurchases();
        await signInAsAdmin(page);
        await page.goto("/lettre-pro/account/invoices");

        await expect(page.getByRole("heading", { level: 1 })).toHaveText("Mes factures");
        const checkboxTwoAgo = page.getByLabel(monthTwoAgo);
        const checkboxOneAgo = page.getByLabel(monthOneAgo);
        await expect(checkboxTwoAgo).toBeVisible();
        await expect(checkboxOneAgo).toBeVisible();
        // The current month never has a purchase behind it in this fixture
        // and is never invoiceable regardless: no third checkbox appears.
        await expect(page.getByRole("checkbox")).toHaveCount(2);

        await checkboxTwoAgo.check();
        await checkboxOneAgo.check();
        await page.getByRole("button", { name: "Générer" }).click();

        // Visible in direct succession, without re-selecting or re-clicking
        // anything (spec's explicit acceptance bullet): queued/processing at
        // some point before done — a soft, short-timeout check, since a fast
        // pool may settle before the next poll even observes the
        // intermediate state.
        await expect(page.getByText(/^(En attente|En cours)$/).first())
          .toBeVisible({ timeout: 5000 })
          .catch(() => undefined);

        for (const month of [monthTwoAgo, monthOneAgo]) {
          const row = page.locator("li").filter({ hasText: month });
          await expect(row.getByText("Terminé")).toBeVisible({ timeout: 20_000 });
          await expect(row.getByRole("link", { name: "Télécharger" })).toBeVisible();
        }
      } finally {
        await cleanupInvoiceFixturesOnLettrePro();
      }
    });

    test("a failed job's retry button re-queues it and it eventually completes", async ({ page }) => {
      await cleanupInvoiceFixturesOnLettrePro();
      try {
        const [monthTwoAgo] = await seedTwoClosedMonthsOfPurchases();
        await seedFailedJob(monthTwoAgo);
        await signInAsAdmin(page);
        await page.goto("/lettre-pro/account/invoices");

        const row = page.locator("li").filter({ hasText: monthTwoAgo });
        await expect(row.getByText("Échec")).toBeVisible();
        await row.getByRole("button", { name: "Réessayer" }).click();

        await expect(row.getByText("Terminé")).toBeVisible({ timeout: 20_000 });
        await expect(row.getByRole("link", { name: "Télécharger" })).toBeVisible();
      } finally {
        await cleanupInvoiceFixturesOnLettrePro();
      }
    });
  });
});
