import { expect, test } from "@playwright/test";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { users } from "../lib/db/auth-schema";
import { balances, creditTransactions, events, products, purchases } from "../lib/db/schema";
import { requireDatabaseUrl } from "../lib/require-database-url";
import { SEED_ADMIN } from "../scripts/seed";

// SA-05 (specs/SA-05-paiement.md). Not run yet (written now, run in the E2E
// phase, docs/11-implementation.md › V4 Package): playwright.config.ts's
// webServer does `pnpm build && pnpm start` against the seeded lettre-pro
// product (pack-10: 10 credits / 4,90 €, pack-50: 50 credits / 14,90 €,
// recommended — fixtures/lettre-pro.config.json).
//
// SA-03 (signup) hasn't merged yet: the authenticated journeys below sign
// in as SEED_ADMIN through BO-01's /admin/login (plan's orchestrator
// decision 3), the only credentialed seeded account, as a stand-in buyer.
// Once SA-03 merges, a real magic-link user should replace it here.
//
// Every authenticated journey cleans up SEED_ADMIN's ledger on lettre-pro
// before and after running, so repeated runs never accumulate purchases or
// change the admin's balance for other specs (themes.spec.ts's same
// direct-Postgres pattern).

async function resetAdminLedgerOnLettrePro(): Promise<void> {
  const sql = postgres(requireDatabaseUrl(), { max: 1, onnotice: () => {} });
  const db = drizzle(sql, { schema: { products, users, purchases, creditTransactions, balances, events } });
  try {
    const product = await db.query.products.findFirst({ where: eq(products.slug, "lettre-pro") });
    const admin = await db.query.users.findFirst({ where: eq(users.email, SEED_ADMIN.email) });
    if (!product || !admin) throw new Error("Seed missing: lettre-pro / admin (run pnpm db:seed)");

    await db.delete(events).where(and(eq(events.productId, product.id), eq(events.userId, admin.id)));
    await db
      .delete(creditTransactions)
      .where(and(eq(creditTransactions.productId, product.id), eq(creditTransactions.userId, admin.id)));
    await db.delete(purchases).where(and(eq(purchases.productId, product.id), eq(purchases.userId, admin.id)));
    await db.delete(balances).where(and(eq(balances.productId, product.id), eq(balances.userId, admin.id)));
  } finally {
    await sql.end();
  }
}

async function signInAsAdmin(page: import("@playwright/test").Page): Promise<void> {
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(SEED_ADMIN.email);
  await page.getByLabel("Mot de passe").fill(SEED_ADMIN.password);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

test.describe("Checkout (simulated payment)", () => {
  test("the full page shows the pack summary, the test card and the notice, no dialog", async ({ page }) => {
    await page.goto("/lettre-pro/checkout/pack-10");

    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Paiement");
    await expect(page.getByText("LettrePro · pack")).toBeVisible();
    await expect(page.getByLabel("Carte")).toHaveValue("4242 4242 4242 4242");
    await expect(page.getByText(/Paiement simulé pour la démo/)).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test("an unauthenticated visitor is asked to sign in when paying", async ({ page }) => {
    await page.goto("/lettre-pro/checkout/pack-10");

    await page.getByRole("button", { name: /Payer/ }).click();

    await expect(page.getByText("Connectez-vous pour acheter des crédits")).toBeVisible();
    await expect(page.getByRole("link", { name: "Se connecter" })).toHaveAttribute("href", "/lettre-pro/signup");
  });

  test("opens as a modal from the pricing page, and Escape returns to /pricing", async ({ page }) => {
    await page.goto("/lettre-pro/pricing");

    await page.getByRole("link", { name: /Acheter 50 crédits/ }).click();

    await expect(page).toHaveURL("/lettre-pro/checkout/pack-50");
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("LettrePro · pack")).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(page).toHaveURL("/lettre-pro/pricing");
  });

  test("a signed-in buyer completes a purchase and resumes to the tool", async ({ page }) => {
    await resetAdminLedgerOnLettrePro();
    try {
      await signInAsAdmin(page);
      await page.goto("/lettre-pro/checkout/pack-10");

      await page.getByRole("button", { name: /Payer/ }).click();

      await expect(page.getByText("+10 crédits")).toBeVisible();
      await expect(page.getByText("Ajoutés à votre compte")).toBeVisible();
      await expect(page.getByText("Nouveau solde")).toBeVisible();

      await page.getByRole("button", { name: "Reprendre ma génération →" }).click();
      await expect(page).toHaveURL(/\/lettre-pro\/tool$/);
    } finally {
      await resetAdminLedgerOnLettrePro();
    }
  });

  test("a double click on Payer credits only one pack", async ({ page }) => {
    await resetAdminLedgerOnLettrePro();
    try {
      await signInAsAdmin(page);
      await page.goto("/lettre-pro/checkout/pack-10");

      const payButton = page.getByRole("button", { name: /Payer/ });
      // Two rapid clicks, not awaited between them: the button disables
      // itself synchronously (single dispatch, CheckoutFlow's own guard),
      // so the second click either hits nothing or a disabled button.
      await Promise.all([payButton.click(), payButton.click({ force: true }).catch(() => undefined)]);

      await expect(page.getByText("+10 crédits")).toBeVisible();

      const sql = postgres(requireDatabaseUrl(), { max: 1, onnotice: () => {} });
      const db = drizzle(sql, { schema: { products, users, purchases } });
      try {
        const product = await db.query.products.findFirst({ where: eq(products.slug, "lettre-pro") });
        const admin = await db.query.users.findFirst({ where: eq(users.email, SEED_ADMIN.email) });
        const rows = await db.query.purchases.findMany({
          where: and(eq(purchases.productId, product!.id), eq(purchases.userId, admin!.id)),
        });
        expect(rows).toHaveLength(1);
      } finally {
        await sql.end();
      }
    } finally {
      await resetAdminLedgerOnLettrePro();
    }
  });

  // QA1-P1-B3 (.claude/qa/reports/2026-09-25-full.md › B3, repro 5.7,
  // s57b.out.txt): paying from the modal opened over the full /pricing page
  // used to trigger a server refresh() that re-fetched the intercepted
  // /pricing background, mismatched the tree and forced a hard reload back
  // to the payment form (root cause detailed in
  // .claude/plans/QA1-P1-B3.plan.md). This journey reproduces it: the
  // confirmation must stay on screen, with zero `load` events, and Resume
  // must return to /pricing without a reload.
  test("QA1-P1-B3: pays from the pricing page, the confirmation stays, no reload, Reprendre returns to /pricing", async ({
    page,
  }) => {
    await resetAdminLedgerOnLettrePro();
    try {
      await signInAsAdmin(page);
      await page.goto("/lettre-pro/pricing");

      let loadCount = 0;
      page.on("load", () => {
        loadCount++;
      });

      await page.getByRole("link", { name: /Acheter 10 crédits/ }).click();
      await expect(page).toHaveURL("/lettre-pro/checkout/pack-10");
      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();

      await page.getByRole("button", { name: /Payer/ }).click();
      await expect(dialog.getByText("+10 crédits")).toBeVisible();

      await page.waitForTimeout(2000);
      await expect(dialog.getByText("+10 crédits")).toBeVisible();
      await expect(dialog.getByText("Nouveau solde")).toBeVisible();
      await expect(page.getByRole("button", { name: /Payer/ })).toHaveCount(0);
      await expect(dialog).toBeVisible();
      await expect(page).toHaveURL("/lettre-pro/checkout/pack-10");
      expect(loadCount).toBe(0);

      await page.getByRole("button", { name: "Reprendre ma génération →" }).click();
      await expect(page).toHaveURL("/lettre-pro/pricing");
      await expect(page.getByRole("dialog")).toHaveCount(0);
      expect(loadCount).toBe(0);
      await expect(page.getByText("10 crédits")).toBeVisible();

      const sql = postgres(requireDatabaseUrl(), { max: 1, onnotice: () => {} });
      const db = drizzle(sql, { schema: { products, users, purchases } });
      try {
        const product = await db.query.products.findFirst({ where: eq(products.slug, "lettre-pro") });
        const admin = await db.query.users.findFirst({ where: eq(users.email, SEED_ADMIN.email) });
        const rows = await db.query.purchases.findMany({
          where: and(eq(purchases.productId, product!.id), eq(purchases.userId, admin!.id)),
        });
        expect(rows).toHaveLength(1);
      } finally {
        await sql.end();
      }
    } finally {
      await resetAdminLedgerOnLettrePro();
    }
  });

  // Needs SA-02 (the outil, to reach a 0 balance) and LEDGER's real debit()
  // to actually exhaust the balance and trigger the paywall from the tool:
  // marked fixme so the file compiles and lists the journey without failing
  // the run, mirroring e2e/pricing.spec.ts's own fixme for the same reason.
  test.fixme("opens as a nested modal from the tool's paywall, through the pricing modal", async ({ page }) => {
    await resetAdminLedgerOnLettrePro();
    try {
      await signInAsAdmin(page);
      await page.goto("/lettre-pro/tool");
      // … exhaust the balance down to 0 here once SA-02 and LEDGER exist,
      // then trigger the paywall (e.g. attempting one more generation).

      await expect(page).toHaveURL("/lettre-pro/pricing");
      await page
        .getByRole("link", { name: /Acheter/ })
        .first()
        .click();

      await expect(page).toHaveURL(/\/lettre-pro\/checkout\/pack-\d+$/);
      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();
      await expect(dialog.getByText(/Paiement/)).toBeVisible();

      await dialog.getByRole("button", { name: /Payer/ }).click();
      await expect(dialog.getByText(/crédits/)).toBeVisible();
      await dialog.getByRole("button", { name: "Reprendre ma génération →" }).click();
      await expect(page).toHaveURL(/\/lettre-pro\/tool$/);
    } finally {
      await resetAdminLedgerOnLettrePro();
    }
  });
});
