// specs/CONTRACT-data.md (orchestrator decision 1): SETUP-skeleton's `demo`
// placeholder product is replaced by LettrePro, seeded from
// fixtures/lettre-pro.config.json against the full data model.
import { eq, isNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { productConfigSchema } from "../lib/schemas/product-config";
import { themeTokensSchema } from "../lib/schemas/theme-tokens";
import { accounts, users } from "../lib/db/auth-schema";
import { decisionThresholds, productVersions, products, themes } from "../lib/db/schema";
import { requireDatabaseUrl } from "../lib/require-database-url";
import { SEED_ADMIN, SEED_OWNER, seed } from "./seed";

const sql = postgres(requireDatabaseUrl(), { max: 1, onnotice: () => {} });
const db = drizzle(sql, { schema: { products, productVersions, themes, decisionThresholds, users, accounts } });

beforeAll(async () => {
  await seed();
  await seed(); // idempotent: run twice on purpose
});

afterAll(async () => {
  await sql.end({ timeout: 5 });
});

describe("seed", () => {
  it("creates no demo product", async () => {
    const rows = await db.select().from(products).where(eq(products.slug, "demo"));
    expect(rows).toHaveLength(0);
  });

  it("creates exactly the 4 seeded themes, each with valid tokens", async () => {
    const rows = await db.select().from(themes).where(eq(themes.isSeed, true));
    expect(rows).toHaveLength(4);
    expect(rows.map((row) => row.slug).sort()).toEqual(["corporate", "editorial", "neon", "playful"]);
    for (const row of rows) {
      expect(themeTokensSchema.safeParse(row.tokens).success).toBe(true);
    }
  });

  it("creates exactly one lettre-pro product, seeded, scale, editorial theme, fr", async () => {
    const rows = await db.select().from(products).where(eq(products.slug, "lettre-pro"));
    expect(rows).toHaveLength(1);
    const product = rows[0]!;
    expect(product.status).toBe("scale");
    expect(product.isSeed).toBe(true);
    expect(product.currentVersion).toBe(1);
    expect(product.locale).toBe("fr");

    const editorial = await db.query.themes.findFirst({ where: eq(themes.slug, "editorial") });
    expect(product.themeId).toBe(editorial?.id);

    const versionRows = await db.select().from(productVersions).where(eq(productVersions.productId, product.id));
    expect(versionRows).toHaveLength(1);
    const version = versionRows[0]!;
    expect(version.version).toBe(1);
    const parsed = productConfigSchema.safeParse({ ...(version.config as object), themeId: product.themeId });
    expect(parsed.success).toBe(true);
  });

  it("creates exactly one admin user with a credential account", async () => {
    const userRows = await db.select().from(users).where(eq(users.email, SEED_ADMIN.email));
    expect(userRows).toHaveLength(1);
    expect(userRows[0]?.role).toBe("admin");

    const accountRows = await db.select().from(accounts).where(eq(accounts.providerId, "credential"));
    const seededAccounts = accountRows.filter((row) => row.userId === userRows[0]?.id);
    expect(seededAccounts).toHaveLength(1);
    expect(seededAccounts[0]?.password).toBeTruthy();
  });

  it("creates exactly one owner user with a credential account", async () => {
    const userRows = await db.select().from(users).where(eq(users.email, SEED_OWNER.email));
    expect(userRows).toHaveLength(1);
    expect(userRows[0]?.role).toBe("owner");

    const accountRows = await db.select().from(accounts).where(eq(accounts.providerId, "credential"));
    const seededAccounts = accountRows.filter((row) => row.userId === userRows[0]?.id);
    expect(seededAccounts).toHaveLength(1);
    expect(seededAccounts[0]?.password).toBeTruthy();
  });

  it("creates exactly one default decision thresholds row", async () => {
    const rows = await db.select().from(decisionThresholds).where(isNull(decisionThresholds.productId));
    expect(rows).toHaveLength(1);
    const row = rows[0]!;
    expect(row.minVisits).toBe(1000);
    expect(row.killMaxConversion).toBe(0.02);
    expect(row.scaleMinConversion).toBe(0.05);
    expect(row.scaleRequiresPositiveMargin).toBe(true);
    expect(row.isSeed).toBe(true);
  });
});
