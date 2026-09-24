import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";

const cacheLife = vi.fn();
const cacheTag = vi.fn();
vi.mock("next/cache", () => ({ cacheLife, cacheTag }));

afterEach(() => {
  cacheLife.mockClear();
  cacheTag.mockClear();
});

describe("getProduct", () => {
  it("resolves the seeded demo product", async () => {
    const { getProduct } = await import("./products");
    const product = await getProduct("demo");
    expect(product).toMatchObject({ slug: "demo", name: "demo" });
    expect(product?.id).toBeTruthy();
  });

  it("resolves to null for an unknown slug", async () => {
    const { getProduct } = await import("./products");
    const product = await getProduct(`missing-${randomUUID()}`);
    expect(product).toBeNull();
  });

  it("tags and caches the response", async () => {
    const { getProduct } = await import("./products");
    await getProduct("demo");
    expect(cacheTag).toHaveBeenCalledWith("product:demo");
    expect(cacheLife).toHaveBeenCalledWith("max");
  });
});

describe("listProductSlugs", () => {
  it("contains the seeded demo slug", async () => {
    const { listProductSlugs } = await import("./products");
    const slugs = await listProductSlugs();
    expect(slugs).toContain("demo");
  });
});
