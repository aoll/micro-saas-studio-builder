import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { users } from "@/lib/db/auth-schema";
import { productVersions, products, themes } from "@/lib/db/schema";
import type { ProductConfig } from "@/lib/schemas/product-config";
import { SEED_OWNER } from "@/scripts/seed";

class RedirectMarker extends Error {
  constructor(public url: string) {
    super(`redirect:${url}`);
  }
}
const requireAdmin = vi.fn();
vi.mock("./session", () => ({ requireAdmin: () => requireAdmin() }));

afterEach(() => {
  requireAdmin.mockReset();
});

async function buildConfig(): Promise<ProductConfig> {
  const editorial = await db.query.themes.findFirst({ where: eq(themes.slug, "editorial") });
  return {
    slug: `contract-editor-${randomUUID()}`,
    name: "Test product",
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
  };
}

describe("createProduct", () => {
  it("redirects a non-admin caller", async () => {
    requireAdmin.mockRejectedValue(new RedirectMarker("/admin/login"));
    const { createProduct } = await import("./product-editor");
    await expect(createProduct(await buildConfig())).rejects.toThrow("redirect:/admin/login");
  });

  it("inserts the product and its first version in one transaction", async () => {
    const owner = await db.query.users.findFirst({ where: eq(users.email, SEED_OWNER.email) });
    requireAdmin.mockResolvedValue({ user: { id: owner!.id, role: "admin" } });
    const config = await buildConfig();

    const { createProduct } = await import("./product-editor");
    const result = await createProduct(config);
    expect(result).toMatchObject({ slug: config.slug, version: 1 });
    expect(result.id).toBeTruthy();

    const productRow = await db.query.products.findFirst({ where: eq(products.id, result.id) });
    expect(productRow).toMatchObject({ slug: config.slug, status: "test", currentVersion: 1 });

    const versionRow = await db.query.productVersions.findFirst({
      where: eq(productVersions.productId, result.id),
    });
    expect(versionRow).toMatchObject({ version: 1 });

    await db.delete(productVersions).where(eq(productVersions.productId, result.id));
    await db.delete(products).where(eq(products.id, result.id));
  });
});
