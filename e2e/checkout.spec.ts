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

  // Found running the suite with fullyParallel + 2 workers (orchestrator
  // report): these four tests all reset and reuse the same
  // SEED_ADMIN/lettre-pro balance (resetAdminLedgerOnLettrePro), so two
  // running at once race on the same rows — one worker's purchase or reset
  // lands mid another's assertions (observed: a purchase test reading a
  // stale "20 crédits" header, the sum of two concurrent +10 purchases).
  // Grouped and serialized so each test's before/after reset stays
  // exclusive, without slowing down the tests above that don't touch this
  // shared state (an unauthenticated visitor, the /pricing → Escape modal).
  test.describe("admin-ledger purchases on lettre-pro", () => {
    test.describe.configure({ mode: "serial" });

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
        // Scoped to the <header> tag (docs/02-ecrans.md › Header produit):
        // /pricing's own pack-10 card also reads "10 crédits" (PackCard), so
        // an unscoped query is ambiguous regardless of timing. A CSS/tag
        // locator, not getByRole("banner"): Radix's Dialog marks background
        // content aria-hidden while open (here it already isn't, but the A2
        // test below hits this while its dialog is still open), which would
        // drop <header> from the accessibility tree despite it staying
        // visible in the DOM.
        await expect(page.locator("header").getByText("10 crédits")).toBeVisible();

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

    // QA1-P1-B3 (.claude/plans/QA1-P1-B3.plan.md, step 7, A2): un-fixmed now
    // that resetAdminLedgerOnLettrePro leaves the admin at a 0 balance on
    // lettre-pro (no `balances` row: debit() refuses, docs/07-modele-de-
    // donnees.md), so a single "Générer" reaches the paywall directly — no
    // need to exhaust several paid generations first.
    test("opens as a nested modal from the tool's paywall, through the pricing modal", async ({ page }) => {
      await resetAdminLedgerOnLettrePro();
      try {
        await signInAsAdmin(page);
        await page.goto("/lettre-pro/tool");
        await page.getByLabel("Poste visé").fill("Développeur Frontend");
        await page.getByLabel("Entreprise").fill("Dotworld");
        await page.getByLabel("Votre expérience").fill("3 ans en React et TypeScript");
        await page.getByLabel("Ton").selectOption("dynamique");
        await page.getByRole("button", { name: /Générer/ }).click();

        await expect(page).toHaveURL("/lettre-pro/pricing");
        const pricingDialog = page.getByRole("dialog");
        await expect(pricingDialog).toBeVisible();

        let loadCount = 0;
        page.on("load", () => {
          loadCount++;
        });

        await pricingDialog.getByRole("link", { name: /Acheter 10 crédits/ }).click();

        await expect(page).toHaveURL("/lettre-pro/checkout/pack-10");
        const checkoutDialog = page.getByRole("dialog");
        await expect(checkoutDialog).toBeVisible();
        // The dialog's own notice ("Paiement simulé pour la démo…") also
        // matches a broad /Paiement/ text query, alongside the title; the
        // title (RouteModal's DialogTitle) is what this line means to check.
        await expect(checkoutDialog.getByRole("heading", { name: "Paiement" })).toBeVisible();

        await checkoutDialog.getByRole("button", { name: /Payer/ }).click();
        await expect(checkoutDialog.getByText("+10 crédits")).toBeVisible();
        // Scoped to <header> (see the A1 test above for why an unscoped
        // "10 crédits" query is ambiguous, and why this is a tag locator,
        // not getByRole("banner")): the checkout dialog is still open here,
        // and Radix marks the rest of the page aria-hidden while a Dialog
        // is open, which a role query would honor and a tag locator won't.
        await expect(page.locator("header").getByText("10 crédits")).toBeVisible();
        expect(loadCount).toBe(0);

        await checkoutDialog.getByRole("button", { name: "Reprendre ma génération →" }).click();
        await expect(page).toHaveURL(/\/lettre-pro\/tool$/);
        await expect(page.getByRole("dialog")).toHaveCount(0);
        expect(loadCount).toBe(0);
      } finally {
        await resetAdminLedgerOnLettrePro();
      }
    });

    // Ordered last in this serial group (pre-existing failure, unrelated to
    // QA1-P1-B3: a Playwright click-retry hang on the already-detached
    // "Payer" button, reported to the orchestrator separately), so it never
    // blocks the two B3 tests above from running in a full suite pass.
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
  });
});
