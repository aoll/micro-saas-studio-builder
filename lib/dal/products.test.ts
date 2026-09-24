import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { productConfigSchema } from "@/lib/schemas/product-config";

const cacheLife = vi.fn();
const cacheTag = vi.fn();
vi.mock("next/cache", () => ({ cacheLife, cacheTag }));

afterEach(() => {
  cacheLife.mockClear();
  cacheTag.mockClear();
});

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
});

describe("listProductSlugs", () => {
  it("contains the seeded lettre-pro slug", async () => {
    const { listProductSlugs } = await import("./products");
    const slugs = await listProductSlugs();
    expect(slugs).toContain("lettre-pro");
  });
});
