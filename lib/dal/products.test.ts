import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { users } from "@/lib/db/auth-schema";
import { products, themes } from "@/lib/db/schema";
import { productConfigSchema } from "@/lib/schemas/product-config";
import { SEED_OWNER } from "@/scripts/seed";

const cacheLife = vi.fn();
const cacheTag = vi.fn();
vi.mock("next/cache", () => ({ cacheLife, cacheTag }));

afterEach(() => {
  cacheLife.mockClear();
  cacheTag.mockClear();
});

// QA2-P1-B1 (specs/qa/QA2-P1-B1-brouillon-publie.md): a real "never
// published" row (current_version IS NULL) — created directly, bypassing
// createProduct()/requireAdmin(), since getProduct/listProducts read
// straight from the catalogue with no session check of their own.
async function insertNeverPublishedProduct(): Promise<{ id: string; slug: string }> {
  const owner = await db.query.users.findFirst({ where: eq(users.email, SEED_OWNER.email) });
  const editorial = await db.query.themes.findFirst({ where: eq(themes.slug, "editorial") });
  const productSlug = `never-published-${randomUUID()}`;
  const [row] = await db
    .insert(products)
    .values({ slug: productSlug, themeId: editorial!.id, locale: "fr", createdBy: owner!.id })
    .returning({ id: products.id });
  return { id: row!.id, slug: productSlug };
}

describe("getProduct", () => {
  it("resolves the seeded lettre-pro product (specs/CONTRACT-data.md: widened to Product | null)", async () => {
    const { getProduct } = await import("./products");
    const product = await getProduct("lettre-pro");
    expect(product).toMatchObject({
      slug: "lettre-pro",
      name: "LettrePro",
      status: "scale",
      locale: "fr",
      version: 1,
      isSeed: true,
    });
    expect(product?.id).toBeTruthy();
    expect(product?.pricing.packs).toHaveLength(2);
    expect(() => productConfigSchema.parse(product)).not.toThrow();
  });

  it("resolves to null for an unknown slug", async () => {
    const { getProduct } = await import("./products");
    const product = await getProduct(`missing-${randomUUID()}`);
    expect(product).toBeNull();
  });

  it("throws when the product_versions row for current_version is missing", async () => {
    vi.resetModules();
    vi.doMock("@/lib/db", () => ({
      db: {
        query: {
          products: {
            findFirst: async () => ({
              id: "p1",
              slug: "broken-product",
              status: "test",
              themeId: "t1",
              currentVersion: 1,
              locale: "fr",
              isSeed: false,
            }),
          },
          productVersions: { findFirst: async () => undefined },
        },
      },
    }));
    const { getProduct } = await import("./products");
    await expect(getProduct("broken-product")).rejects.toThrow(
      "getProduct(broken-product): missing product_versions row for current_version",
    );
    vi.doUnmock("@/lib/db");
    vi.resetModules();
  });

  it("tags and caches the response", async () => {
    const { getProduct } = await import("./products");
    await getProduct("lettre-pro");
    expect(cacheTag).toHaveBeenCalledWith("product:lettre-pro");
    expect(cacheLife).toHaveBeenCalledWith("max");
  });

  it("resolves to null for a never-published product (current_version IS NULL)", async () => {
    const created = await insertNeverPublishedProduct();
    const { getProduct } = await import("./products");
    const product = await getProduct(created.slug);
    expect(product).toBeNull();
    await db.delete(products).where(eq(products.id, created.id));
  });
});

describe("listProducts", () => {
  it("contains LettrePro, tags and caches the response", async () => {
    const { listProducts } = await import("./products");
    const products = await listProducts();
    expect(products.map((product) => product.slug)).toContain("lettre-pro");
    const lettrePro = products.find((product) => product.slug === "lettre-pro");
    expect(lettrePro).toMatchObject({ name: "LettrePro", version: 1, isSeed: true });
    expect(cacheTag).toHaveBeenCalledWith("products");
    expect(cacheLife).toHaveBeenCalledWith("max");
  });

  it("never includes a never-published product (current_version IS NULL)", async () => {
    const created = await insertNeverPublishedProduct();
    const { listProducts } = await import("./products");
    const result = await listProducts();
    expect(result.map((product) => product.slug)).not.toContain(created.slug);
    await db.delete(products).where(eq(products.id, created.id));
  });
});

describe("listProductSlugs", () => {
  it("contains the seeded lettre-pro slug", async () => {
    const { listProductSlugs } = await import("./products");
    const slugs = await listProductSlugs();
    expect(slugs).toContain("lettre-pro");
  });
});
