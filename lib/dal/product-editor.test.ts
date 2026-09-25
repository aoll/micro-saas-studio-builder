import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { afterEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { users } from "@/lib/db/auth-schema";
import { productVersions, products, themes } from "@/lib/db/schema";
import type { ProductConfig } from "@/lib/schemas/product-config";
import { themeTokensSchema } from "@/lib/schemas/theme-tokens";
import { SEED_OWNER } from "@/scripts/seed";

class RedirectMarker extends Error {
  constructor(public url: string) {
    super(`redirect:${url}`);
  }
}
const requireAdmin = vi.fn();
vi.mock("./session", () => ({ requireAdmin: () => requireAdmin() }));

const mockAssertEditable = vi.fn();
vi.mock("./guards", async () => {
  const actual = await vi.importActual<typeof import("./guards")>("./guards");
  return { ...actual, assertEditable: (row: unknown) => mockAssertEditable(row) };
});

async function currentAdmin() {
  const owner = await db.query.users.findFirst({ where: eq(users.email, SEED_OWNER.email) });
  requireAdmin.mockResolvedValue({ user: { id: owner!.id, role: "admin" } });
}

afterEach(() => {
  requireAdmin.mockReset();
  mockAssertEditable.mockReset();
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

describe("createProduct validation", () => {
  it("rejects a reserved slug without inserting a row", async () => {
    await currentAdmin();
    const { createProduct } = await import("./product-editor");
    const config = await buildConfig();
    await expect(createProduct({ ...config, slug: "admin" })).rejects.toThrow();
    const row = await db.query.products.findFirst({ where: eq(products.slug, "admin") });
    expect(row).toBeUndefined();
  });

  it("rejects duplicate input keys without inserting a row", async () => {
    await currentAdmin();
    const { createProduct } = await import("./product-editor");
    const config = await buildConfig();
    const slug = `dup-${randomUUID()}`;
    const bad = { ...config, slug, inputs: [config.inputs[0]!, config.inputs[0]!] };
    await expect(createProduct(bad)).rejects.toThrow();
    const row = await db.query.products.findFirst({ where: eq(products.slug, slug) });
    expect(row).toBeUndefined();
  });
});

describe("saveVersion", () => {
  it("redirects a non-admin caller", async () => {
    requireAdmin.mockRejectedValue(new RedirectMarker("/admin/login"));
    const { saveVersion } = await import("./product-editor");
    await expect(saveVersion("lettre-pro", await buildConfig())).rejects.toThrow("redirect:/admin/login");
  });

  it("returns null for an unknown slug", async () => {
    await currentAdmin();
    const { saveVersion } = await import("./product-editor");
    expect(await saveVersion(`missing-${randomUUID()}`, await buildConfig())).toBeNull();
  });

  it("inserts a new version without moving current_version, calling assertEditable first", async () => {
    await currentAdmin();
    const { createProduct, saveVersion } = await import("./product-editor");
    const config = await buildConfig();
    const created = await createProduct(config);

    const before = await db.query.products.findFirst({ where: eq(products.id, created.id) });

    const v2 = await saveVersion(created.slug, { ...config, name: "Renamed v2" });
    expect(v2).toMatchObject({ id: created.id, slug: created.slug, version: 2 });
    expect(mockAssertEditable).toHaveBeenCalledWith(expect.objectContaining({ isSeed: false }));

    const v3 = await saveVersion(created.slug, { ...config, name: "Renamed v3" });
    expect(v3).toMatchObject({ version: 3 });

    const after = await db.query.products.findFirst({ where: eq(products.id, created.id) });
    expect(after?.currentVersion).toBe(1);
    expect(after?.updatedAt).toEqual(before?.updatedAt);

    const v1 = await db.query.productVersions.findFirst({
      where: and(eq(productVersions.productId, created.id), eq(productVersions.version, 1)),
    });
    expect((v1?.config as ProductConfig).name).toBe(config.name);

    await db.delete(productVersions).where(eq(productVersions.productId, created.id));
    await db.delete(products).where(eq(products.id, created.id));
  });

  it("rejects when assertEditable throws, without inserting a version", async () => {
    await currentAdmin();
    const { createProduct, saveVersion } = await import("./product-editor");
    const config = await buildConfig();
    const created = await createProduct(config);

    mockAssertEditable.mockImplementation(() => {
      throw new Error("locked");
    });
    await expect(saveVersion(created.slug, config)).rejects.toThrow("locked");

    const versions = await db.query.productVersions.findMany({ where: eq(productVersions.productId, created.id) });
    expect(versions).toHaveLength(1);

    await db.delete(productVersions).where(eq(productVersions.productId, created.id));
    await db.delete(products).where(eq(products.id, created.id));
  });

  it("two concurrent saves each get a distinct version, no primary key error", async () => {
    await currentAdmin();
    const { createProduct, saveVersion } = await import("./product-editor");
    const config = await buildConfig();
    const created = await createProduct(config);

    const [a, b] = await Promise.all([saveVersion(created.slug, config), saveVersion(created.slug, config)]);
    const versions = [a?.version, b?.version].sort();
    expect(versions).toEqual([2, 3]);

    await db.delete(productVersions).where(eq(productVersions.productId, created.id));
    await db.delete(products).where(eq(products.id, created.id));
  });
});

describe("getProductDraft", () => {
  it("redirects a non-admin caller", async () => {
    requireAdmin.mockRejectedValue(new RedirectMarker("/admin/login"));
    const { getProductDraft } = await import("./product-editor");
    await expect(getProductDraft("lettre-pro")).rejects.toThrow("redirect:/admin/login");
  });

  it("returns null for an unknown slug", async () => {
    await currentAdmin();
    const { getProductDraft } = await import("./product-editor");
    expect(await getProductDraft(`missing-${randomUUID()}`)).toBeNull();
  });

  it("returns the latest version's config next to the published version", async () => {
    await currentAdmin();
    const { createProduct, saveVersion, getProductDraft } = await import("./product-editor");
    const config = await buildConfig();
    const created = await createProduct(config);
    await saveVersion(created.slug, { ...config, name: "Draft v2" });

    const draft = await getProductDraft(created.slug);
    expect(draft).toMatchObject({ productId: created.id, isSeed: false, version: 2, publishedVersion: 1 });
    expect(draft?.config.name).toBe("Draft v2");

    await db.delete(productVersions).where(eq(productVersions.productId, created.id));
    await db.delete(products).where(eq(products.id, created.id));
  });
});

describe("isSlugAvailable", () => {
  it("redirects a non-admin caller", async () => {
    requireAdmin.mockRejectedValue(new RedirectMarker("/admin/login"));
    const { isSlugAvailable } = await import("./product-editor");
    await expect(isSlugAvailable("lettre-pro")).rejects.toThrow("redirect:/admin/login");
  });

  it("is false for a taken slug, true for a free one", async () => {
    await currentAdmin();
    const { isSlugAvailable } = await import("./product-editor");
    expect(await isSlugAvailable("lettre-pro")).toBe(false);
    expect(await isSlugAvailable(`free-${randomUUID()}`)).toBe(true);
  });
});

describe("listThemeOptions", () => {
  it("redirects a non-admin caller", async () => {
    requireAdmin.mockRejectedValue(new RedirectMarker("/admin/login"));
    const { listThemeOptions } = await import("./product-editor");
    await expect(listThemeOptions()).rejects.toThrow("redirect:/admin/login");
  });

  it("returns the seeded themes with valid tokens, ordered by name", async () => {
    await currentAdmin();
    const { listThemeOptions } = await import("./product-editor");
    const themeOptions = await listThemeOptions();
    expect(themeOptions.length).toBeGreaterThanOrEqual(4);
    const names = themeOptions.map((theme) => theme.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
    for (const theme of themeOptions) {
      expect(themeTokensSchema.safeParse(theme.tokens).success).toBe(true);
    }
  });
});
