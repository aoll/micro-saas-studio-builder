import { expect, test } from "@playwright/test";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { generations } from "../lib/db/schema";
import { requireDatabaseUrl } from "../lib/require-database-url";

// SA-06 acceptance, played end to end against /lettre-pro/history. Not run
// yet (written now, run in the E2E phase, docs/11-implementation.md › V4
// Package): needs a real browser to exercise cookies, navigation and the
// <details> disclosure together, and no entry point links here yet (plan's
// Orchestrator decision 3: header/tool are other specs' files) so each test
// navigates by URL.
//
// Notes for whoever runs this:
// - Cleanup here is by `ip_hash` (the free anonymous generation's identity
//   before signup), the same approach as e2e/tool.spec.ts, so repeated runs
//   don't accumulate history rows or exhaust the anonymous free-generation
//   limit.
// - The "signed-in user only sees their own generations" journey needs
//   LEDGER and SA-03 (signup) merged: a second account and a real session
//   are required to assert isolation end to end; until then it is left as a
//   placeholder.

const E2E_IP_HASH = "e2e-history-spec";

test.describe("History (/lettre-pro/history)", () => {
  test.beforeEach(async () => {
    const sql = postgres(requireDatabaseUrl(), { max: 1, onnotice: () => {} });
    const db = drizzle(sql, { schema: { generations } });
    try {
      await db.delete(generations).where(eq(generations.ipHash, E2E_IP_HASH));
    } finally {
      await sql.end({ timeout: 5 });
    }
  });

  test("shows the empty state with a link to the tool when there is no generation yet", async ({ page }) => {
    await page.goto("/lettre-pro/history");
    await expect(page.getByText("Aucune génération pour le moment")).toBeVisible();
    await page.getByRole("link", { name: "Aller à l'outil" }).click();
    await expect(page).toHaveURL(/\/lettre-pro\/tool$/);
  });

  test("an anonymous visitor's free generation appears in the history, reopens and can be copied", async ({ page }) => {
    await page.goto("/lettre-pro/tool");
    await page.getByLabel("Poste visé").fill("Développeur Frontend");
    await page.getByLabel("Entreprise").fill("Dotworld");
    await page.getByLabel("Votre expérience").fill("3 ans en React et TypeScript");
    await page.getByLabel("Ton").selectOption("dynamique");
    await page.getByRole("button", { name: /Générer/ }).click();
    await expect(page.getByText(/Bonjour/)).toBeVisible();

    await page.goto("/lettre-pro/history");
    await expect(page.getByText("1 génération")).toBeVisible();
    await expect(page.getByText(/Poste visé : Développeur Frontend/)).toBeVisible();

    await page.getByText("Ouvrir").click();
    await expect(page.getByRole("button", { name: "Copier" })).toBeVisible();
    await page.getByRole("button", { name: "Copier" }).click();
    await expect(page.getByText("Copié")).toBeVisible();
  });

  test("paginates: with more than 20 generations, 'Générations plus anciennes' then 'Générations plus récentes' navigate between pages", async () => {
    // Placeholder for the E2E phase: seeding 21+ succeeded generations
    // directly in the database (bypassing the anonymous limit and the
    // credit ledger) belongs here, then this test drives the two
    // pagination links and asserts the entry sets on each page don't
    // overlap.
    test.skip(true, "seeds 21+ generations directly in the database once the E2E phase writes that helper");
  });
});
