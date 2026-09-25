import { randomUUID } from "node:crypto";
import { eq, isNull, sql } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { users } from "@/lib/db/auth-schema";
import { decisionThresholds, productVersions, products, themes } from "@/lib/db/schema";
import { productConfigSchema, type ProductConfig } from "@/lib/schemas/product-config";
import { SEED_OWNER } from "@/scripts/seed";

const cacheLife = vi.fn();
const cacheTag = vi.fn();
vi.mock("next/cache", () => ({ cacheLife, cacheTag }));

// BO-09 (specs/BO-09-seuils.md): the write side's own admin session and
// demo-mode lock, spied the same way as lib/dal/product-editor.test.ts
// (mirrored by the plan's "Patterns to Mirror"). `getThresholds`'s own
// tests above never call either, so mocking them here is a no-op for those.
const requireAdmin = vi.fn();
vi.mock("./session", () => ({ requireAdmin: () => requireAdmin() }));

const mockAssertEditable = vi.fn();
vi.mock("./guards", async () => {
  const actual = await vi.importActual<typeof import("./guards")>("./guards");
  return { ...actual, assertEditable: (row: unknown) => mockAssertEditable(row) };
});

afterEach(() => {
  cacheLife.mockClear();
  cacheTag.mockClear();
  requireAdmin.mockReset();
  mockAssertEditable.mockReset();
});

let lettreProId: string;
let ownerId: string;

beforeAll(async () => {
  const row = await db.query.products.findFirst({ where: eq(products.slug, "lettre-pro") });
  lettreProId = row!.id;
  const owner = await db.query.users.findFirst({ where: eq(users.email, SEED_OWNER.email) });
  ownerId = owner!.id;
});

afterAll(async () => {
  await db.delete(decisionThresholds).where(eq(decisionThresholds.productId, lettreProId));
});

async function currentAdmin() {
  requireAdmin.mockResolvedValue({ user: { id: ownerId, role: "admin" } });
}

// A fresh, schema-valid product (never the seeded LettrePro row, so tests
// never touch its published config or status): mirrors
// lib/dal/product-editor.test.ts's `buildConfig` + a raw insert, since this
// file only needs the row to exist, not `createProduct`'s own admin check.
const createdProductIds: string[] = [];

async function createTestProduct(overrides: Partial<{ isSeed: boolean }> = {}): Promise<string> {
  const editorial = await db.query.themes.findFirst({ where: eq(themes.slug, "editorial") });
  const config: ProductConfig = productConfigSchema.parse({
    slug: `thresholds-test-${randomUUID()}`,
    name: "Thresholds test product",
    status: "test",
    themeId: editorial!.id,
    locale: "fr",
    branding: {},
    landing: {
      headline: "Headline",
      subheadline: "Subheadline",
      faq: [],
      seoTitle: "Title",
      seoDescription: "Description",
    },
    inputs: [{ key: "topic", label: "Topic", type: "text", required: true }],
    generation: {
      model: "anthropic/claude-haiku-4.5",
      promptTemplate: "Write about {{topic}}",
      outputType: "markdown",
    },
    pricing: {
      freeCreditsOnSignup: 3,
      anonymousFreeGenerations: 1,
      costPerGeneration: 1,
      packs: [{ id: "pack-10", credits: 10, priceCents: 490 }],
    },
  });
  const [product] = await db
    .insert(products)
    .values({
      slug: config.slug,
      status: config.status,
      themeId: config.themeId,
      currentVersion: 1,
      locale: config.locale,
      isSeed: overrides.isSeed ?? false,
      createdBy: ownerId,
    })
    .returning({ id: products.id });
  await db.insert(productVersions).values({ productId: product!.id, version: 1, config, createdBy: ownerId });
  createdProductIds.push(product!.id);
  return product!.id;
}

afterAll(async () => {
  for (const productId of createdProductIds) {
    await db.delete(decisionThresholds).where(eq(decisionThresholds.productId, productId));
    await db.delete(productVersions).where(eq(productVersions.productId, productId));
    await db.delete(products).where(eq(products.id, productId));
  }
});

describe("getThresholds", () => {
  it("returns the studio defaults for a product with no override", async () => {
    const { getThresholds } = await import("./thresholds");
    const thresholds = await getThresholds(lettreProId);
    expect(thresholds).toEqual({
      minVisits: 1000,
      killMaxConversion: 0.02,
      scaleMinConversion: 0.05,
      scaleRequiresPositiveMargin: true,
    });
    expect(cacheTag).toHaveBeenCalledWith("thresholds");
    expect(cacheLife).toHaveBeenCalledWith("max");
  });

  it("merges a partial per-product override field by field", async () => {
    await db.insert(decisionThresholds).values({ productId: lettreProId, killMaxConversion: 0.01 });
    const { getThresholds } = await import("./thresholds");
    const thresholds = await getThresholds(lettreProId);
    expect(thresholds).toEqual({
      minVisits: 1000,
      killMaxConversion: 0.01,
      scaleMinConversion: 0.05,
      scaleRequiresPositiveMargin: true,
    });
  });

  it("throws when the default thresholds row is missing", async () => {
    vi.resetModules();
    vi.doMock("@/lib/db", () => ({ db: { query: { decisionThresholds: { findMany: async () => [] } } } }));
    const { getThresholds } = await import("./thresholds");
    await expect(getThresholds(lettreProId)).rejects.toThrow("default thresholds missing");
    vi.doUnmock("@/lib/db");
    vi.resetModules();
  });

  it("throws when the default thresholds row has a null field (DB CHECK bypassed)", async () => {
    vi.resetModules();
    vi.doMock("@/lib/db", () => ({
      db: {
        query: {
          decisionThresholds: {
            findMany: async () => [
              {
                productId: null,
                minVisits: 1000,
                killMaxConversion: 0.02,
                scaleMinConversion: null, // should be impossible per the DB CHECK, but not visible to TS
                scaleRequiresPositiveMargin: true,
              },
            ],
          },
        },
      },
    }));
    const { getThresholds } = await import("./thresholds");
    await expect(getThresholds(lettreProId)).rejects.toThrow("default thresholds row incomplete");
    vi.doUnmock("@/lib/db");
    vi.resetModules();
  });
});

describe("getThresholdSettings", () => {
  it("requires an admin session", async () => {
    requireAdmin.mockRejectedValue(new Error("redirect:/admin/login"));
    const { getThresholdSettings } = await import("./thresholds");
    await expect(getThresholdSettings()).rejects.toThrow("redirect:/admin/login");
  });

  it("returns the studio defaults flagged as seed", async () => {
    await currentAdmin();
    const { getThresholdSettings } = await import("./thresholds");
    const settings = await getThresholdSettings();
    expect(settings.defaults).toEqual({
      values: { minVisits: 1000, killMaxConversion: 0.02, scaleMinConversion: 0.05, scaleRequiresPositiveMargin: true },
      isSeed: true,
    });
  });

  it("lists a fresh product with no override", async () => {
    await currentAdmin();
    const productId = await createTestProduct();
    const { getThresholdSettings } = await import("./thresholds");
    const settings = await getThresholdSettings();
    expect(settings.products).toContainEqual({ productId, isSeed: false, override: null });
  });

  it("returns a partial override field by field, the rest null", async () => {
    await currentAdmin();
    const productId = await createTestProduct();
    await db.insert(decisionThresholds).values({ productId, killMaxConversion: 0.01 });
    const { getThresholdSettings } = await import("./thresholds");
    const settings = await getThresholdSettings();
    expect(settings.products).toContainEqual({
      productId,
      isSeed: false,
      override: {
        minVisits: null,
        killMaxConversion: 0.01,
        scaleMinConversion: null,
        scaleRequiresPositiveMargin: null,
      },
    });
  });
});

describe("saveThresholds(null, …) — studio defaults", () => {
  // Never changes the seeded values themselves (the shared DB rule): only
  // re-saves the exact seeded values, so `updatedBy` is the only visible
  // change, restored in `afterAll`.
  afterAll(async () => {
    await db.update(decisionThresholds).set({ updatedBy: null }).where(isNull(decisionThresholds.productId));
  });

  it("requires an admin session", async () => {
    requireAdmin.mockRejectedValue(new Error("redirect:/admin/login"));
    const { saveThresholds } = await import("./thresholds");
    await expect(
      saveThresholds(null, {
        minVisits: 1000,
        killMaxConversion: 0.02,
        scaleMinConversion: 0.05,
        scaleRequiresPositiveMargin: true,
      }),
    ).rejects.toThrow("redirect:/admin/login");
  });

  it("re-saves the seeded values, stamping updatedBy and calling assertEditable with the seed lock", async () => {
    await currentAdmin();
    const { saveThresholds } = await import("./thresholds");
    const result = await saveThresholds(null, {
      minVisits: 1000,
      killMaxConversion: 0.02,
      scaleMinConversion: 0.05,
      scaleRequiresPositiveMargin: true,
    });
    expect(result).toEqual({ ok: true });
    expect(mockAssertEditable).toHaveBeenCalledWith(expect.objectContaining({ isSeed: true, productId: null }));
    const row = await db.query.decisionThresholds.findFirst({ where: isNull(decisionThresholds.productId) });
    expect(row?.updatedBy).toBe(ownerId);
    expect(row?.minVisits).toBe(1000);
  });

  it("rejects kill ≥ scale with a ZodError before writing anything", async () => {
    await currentAdmin();
    const { saveThresholds } = await import("./thresholds");
    const before = await db.query.decisionThresholds.findFirst({ where: isNull(decisionThresholds.productId) });
    await expect(
      saveThresholds(null, {
        minVisits: 1000,
        killMaxConversion: 0.06,
        scaleMinConversion: 0.05,
        scaleRequiresPositiveMargin: true,
      }),
    ).rejects.toThrow(/scaleMinConversion/);
    const after = await db.query.decisionThresholds.findFirst({ where: isNull(decisionThresholds.productId) });
    expect(after).toEqual(before);
  });
});

describe("saveThresholds(productId, …) — per-product override", () => {
  it("stores only the fields that differ from the default", async () => {
    await currentAdmin();
    const productId = await createTestProduct();
    const { saveThresholds, getThresholds } = await import("./thresholds");
    const result = await saveThresholds(productId, {
      minVisits: 500,
      killMaxConversion: 0.02,
      scaleMinConversion: 0.05,
      scaleRequiresPositiveMargin: true,
    });
    expect(result).toEqual({ ok: true });
    const row = await db.query.decisionThresholds.findFirst({ where: eq(decisionThresholds.productId, productId) });
    expect(row).toMatchObject({
      minVisits: 500,
      killMaxConversion: null,
      scaleMinConversion: null,
      scaleRequiresPositiveMargin: null,
    });
    await expect(getThresholds(productId)).resolves.toEqual({
      minVisits: 500,
      killMaxConversion: 0.02,
      scaleMinConversion: 0.05,
      scaleRequiresPositiveMargin: true,
    });
  });

  it("stores both conversions when only one differs from the default (the pair rule)", async () => {
    await currentAdmin();
    const productId = await createTestProduct();
    const { saveThresholds } = await import("./thresholds");
    await saveThresholds(productId, {
      minVisits: 1000,
      killMaxConversion: 0.03,
      scaleMinConversion: 0.05,
      scaleRequiresPositiveMargin: true,
    });
    const row = await db.query.decisionThresholds.findFirst({ where: eq(decisionThresholds.productId, productId) });
    expect(row).toMatchObject({ killMaxConversion: 0.03, scaleMinConversion: 0.05 });
  });

  it("deletes the override row when every field is saved back to the default", async () => {
    await currentAdmin();
    const productId = await createTestProduct();
    const { saveThresholds } = await import("./thresholds");
    await saveThresholds(productId, {
      minVisits: 500,
      killMaxConversion: 0.02,
      scaleMinConversion: 0.05,
      scaleRequiresPositiveMargin: true,
    });
    await saveThresholds(productId, {
      minVisits: 1000,
      killMaxConversion: 0.02,
      scaleMinConversion: 0.05,
      scaleRequiresPositiveMargin: true,
    });
    const row = await db.query.decisionThresholds.findFirst({ where: eq(decisionThresholds.productId, productId) });
    expect(row).toBeUndefined();
  });

  it("returns product_not_found for an unknown product, without calling assertEditable", async () => {
    await currentAdmin();
    const { saveThresholds } = await import("./thresholds");
    const result = await saveThresholds(randomUUID(), {
      minVisits: 1000,
      killMaxConversion: 0.02,
      scaleMinConversion: 0.05,
      scaleRequiresPositiveMargin: true,
    });
    expect(result).toEqual({ ok: false, reason: "product_not_found" });
    expect(mockAssertEditable).not.toHaveBeenCalled();
  });

  it("calls assertEditable with the product's own lock", async () => {
    await currentAdmin();
    const productId = await createTestProduct({ isSeed: true });
    const { saveThresholds } = await import("./thresholds");
    await saveThresholds(productId, {
      minVisits: 500,
      killMaxConversion: 0.02,
      scaleMinConversion: 0.05,
      scaleRequiresPositiveMargin: true,
    });
    expect(mockAssertEditable).toHaveBeenCalledWith(expect.objectContaining({ isSeed: true, id: productId }));
  });

  // Review round (DB MEDIUM): the default row is now locked with
  // `.for("update")` on this path too, so a concurrent default save cannot
  // interleave with the diff computation. Pinned by a real overlap: a
  // default-save transaction holds the row's lock (`pg_sleep` while locked)
  // and changes `minVisits` to 750; a concurrent product override submits
  // `minVisits: 750` too. If the override read the *old* default (1000)
  // without waiting for the lock, 750 !== 1000 and it would be stored as a
  // spurious override; having waited for the *new* default (750), 750 ===
  // 750 and no override is stored for that field.
  it("waits for a concurrent default save's lock before diffing (no dirty read)", async () => {
    await currentAdmin();
    const productId = await createTestProduct();
    const { saveThresholds } = await import("./thresholds");

    try {
      const defaultSave = db.transaction(async (tx) => {
        await tx.select().from(decisionThresholds).where(isNull(decisionThresholds.productId)).for("update");
        await tx.execute(sql`select pg_sleep(0.3)`);
        await tx
          .update(decisionThresholds)
          .set({ minVisits: 750, updatedBy: ownerId, updatedAt: new Date() })
          .where(isNull(decisionThresholds.productId));
      });

      const overrideSave = (async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        return saveThresholds(productId, {
          minVisits: 750,
          killMaxConversion: 0.02,
          scaleMinConversion: 0.05,
          scaleRequiresPositiveMargin: true,
        });
      })();

      const [, result] = await Promise.all([defaultSave, overrideSave]);
      expect(result).toEqual({ ok: true });

      const row = await db.query.decisionThresholds.findFirst({
        where: eq(decisionThresholds.productId, productId),
      });
      expect(row?.minVisits ?? null).toBeNull();
    } finally {
      await db
        .update(decisionThresholds)
        .set({ minVisits: 1000, updatedBy: null, updatedAt: new Date() })
        .where(isNull(decisionThresholds.productId));
    }
  });
});

describe("resetThresholds", () => {
  it("deletes an existing override", async () => {
    await currentAdmin();
    const productId = await createTestProduct();
    await db.insert(decisionThresholds).values({ productId, minVisits: 500 });
    const { resetThresholds } = await import("./thresholds");
    const result = await resetThresholds(productId);
    expect(result).toEqual({ ok: true });
    const row = await db.query.decisionThresholds.findFirst({ where: eq(decisionThresholds.productId, productId) });
    expect(row).toBeUndefined();
  });

  it("is idempotent when there is no override to delete", async () => {
    await currentAdmin();
    const productId = await createTestProduct();
    const { resetThresholds } = await import("./thresholds");
    await expect(resetThresholds(productId)).resolves.toEqual({ ok: true });
  });

  it("returns product_not_found for an unknown product", async () => {
    await currentAdmin();
    const { resetThresholds } = await import("./thresholds");
    await expect(resetThresholds(randomUUID())).resolves.toEqual({ ok: false, reason: "product_not_found" });
  });
});

describe("decision_thresholds DB CHECK on an override row (both conversions present)", () => {
  it("rejects kill ≥ scale with Postgres error code 23514", async () => {
    const productId = await createTestProduct();
    await expect(
      db.insert(decisionThresholds).values({ productId, killMaxConversion: 0.06, scaleMinConversion: 0.05 }),
    ).rejects.toMatchObject({ cause: { code: "23514" } });
  });
});
