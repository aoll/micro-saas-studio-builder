import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { generations, products } from "../lib/db/schema";
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
const ANONYMOUS_ID_COOKIE = "anonymous_id";

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

  test("paginates: 'Générations plus anciennes' then 'Générations plus récentes' navigate between pages, with no entry repeated", async ({
    page,
    context,
  }) => {
    const anonymousId = randomUUID();
    await seedSucceededGenerations(21, anonymousId);

    try {
      // Server-authoritative cookie (readAnonymousId only trusts a
      // syntactically valid uuid, app/(products)/[app]/api/events/anonymous-id.ts):
      // set directly, bypassing a real free generation, since this test only
      // exercises pagination.
      await context.addCookies([{ name: ANONYMOUS_ID_COOKIE, value: anonymousId, domain: "localhost", path: "/" }]);

      await page.goto("/lettre-pro/history");
      await expect(page.getByText("21 générations")).toBeVisible();
      const firstPageEntries = await page.getByRole("listitem").allTextContents();
      expect(firstPageEntries).toHaveLength(20);
      await expect(page.getByRole("link", { name: "Générations plus récentes" })).toHaveCount(0);

      await page.getByRole("link", { name: "Générations plus anciennes" }).click();
      await expect(page).toHaveURL(/\/lettre-pro\/history\?page=2$/);
      const secondPageEntries = await page.getByRole("listitem").allTextContents();
      expect(secondPageEntries).toHaveLength(1);
      await expect(page.getByRole("link", { name: "Générations plus anciennes" })).toHaveCount(0);

      // Newest-first, 21 distinct seeded values (`Poste 0`…`Poste 20`): no
      // entry appears on both pages, and none is missing.
      const firstPageLabels = extractPosteLabels(firstPageEntries);
      const secondPageLabels = extractPosteLabels(secondPageEntries);
      expect(firstPageLabels).toHaveLength(20);
      expect(secondPageLabels).toHaveLength(1);
      expect(firstPageLabels.filter((label) => secondPageLabels.includes(label))).toHaveLength(0);
      expect(new Set([...firstPageLabels, ...secondPageLabels]).size).toBe(21);

      await page.getByRole("link", { name: "Générations plus récentes" }).click();
      await expect(page).toHaveURL(/\/lettre-pro\/history\?page=1$/);
      await expect(page.getByRole("listitem")).toHaveCount(20);
    } finally {
      await cleanupByAnonymousId(anonymousId);
    }
  });
});

function extractPosteLabels(entries: string[]): string[] {
  return entries.map((entry) => /Poste \d+/.exec(entry)?.[0]).filter((label): label is string => label !== undefined);
}

async function seedSucceededGenerations(count: number, anonymousId: string): Promise<void> {
  const sql = postgres(requireDatabaseUrl(), { max: 1, onnotice: () => {} });
  const db = drizzle(sql, { schema: { generations, products } });
  try {
    const product = await db.query.products.findFirst({ where: eq(products.slug, "lettre-pro") });
    if (!product) throw new Error("Seed missing: lettre-pro (run pnpm db:seed)");

    // Distinct `createdAt`s, newest first by insertion index, so pagination
    // ordering (`created_at DESC, id DESC`) is deterministic across the two
    // pages this test reads.
    const now = Date.now();
    await db.insert(generations).values(
      Array.from({ length: count }, (_, index) => ({
        productId: product.id,
        productVersion: product.currentVersion,
        userId: null,
        anonymousId,
        ipHash: E2E_IP_HASH,
        input: { poste: `Poste ${index}` },
        output: `Résultat généré pour Poste ${index}.`,
        status: "succeeded" as const,
        idempotencyKey: randomUUID(),
        createdAt: new Date(now - index * 1000),
      })),
    );
  } finally {
    await sql.end({ timeout: 5 });
  }
}

async function cleanupByAnonymousId(anonymousId: string): Promise<void> {
  const sql = postgres(requireDatabaseUrl(), { max: 1, onnotice: () => {} });
  const db = drizzle(sql, { schema: { generations } });
  try {
    await db.delete(generations).where(eq(generations.anonymousId, anonymousId));
  } finally {
    await sql.end({ timeout: 5 });
  }
}
