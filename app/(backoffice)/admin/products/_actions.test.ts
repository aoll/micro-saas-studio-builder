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
vi.mock("@/lib/dal/session", () => ({ requireAdmin: () => requireAdmin() }));

const updateTag = vi.fn();
vi.mock("next/cache", () => ({ updateTag: (tag: string) => updateTag(tag) }));

const put = vi.fn();
vi.mock("@vercel/blob", () => ({ put: (...args: unknown[]) => put(...args) }));

async function currentAdmin() {
  const owner = await db.query.users.findFirst({ where: eq(users.email, SEED_OWNER.email) });
  requireAdmin.mockResolvedValue({ user: { id: owner!.id, role: "admin" } });
  return owner!.id;
}

afterEach(() => {
  requireAdmin.mockReset();
  updateTag.mockReset();
  put.mockReset();
});

async function buildConfig(overrides: Partial<ProductConfig> = {}): Promise<ProductConfig> {
  const editorial = await db.query.themes.findFirst({ where: eq(themes.slug, "editorial") });
  return {
    slug: `bo05a-action-${randomUUID()}`,
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
    ...overrides,
  };
}

const configForm = (config: unknown): FormData => {
  const data = new FormData();
  data.set("config", JSON.stringify(config));
  return data;
};

async function cleanupProduct(id: string) {
  await db.delete(productVersions).where(eq(productVersions.productId, id));
  await db.delete(products).where(eq(products.id, id));
}

describe("saveProduct · create path", () => {
  it("redirects a non-admin caller without writing anything", async () => {
    requireAdmin.mockRejectedValue(new RedirectMarker("/admin/login"));
    const { saveProduct } = await import("./_actions");
    const config = await buildConfig();
    await expect(saveProduct(null, {}, configForm(config))).rejects.toThrow("redirect:/admin/login");
    const row = await db.query.products.findFirst({ where: eq(products.slug, config.slug) });
    expect(row).toBeUndefined();
  });

  it("returns a form error for unreadable JSON", async () => {
    await currentAdmin();
    const { saveProduct } = await import("./_actions");
    const data = new FormData();
    data.set("config", "{not json");
    const result = await saveProduct(null, {}, data);
    expect(result.formError).toBeTruthy();
  });

  it("returns step errors for an invalid config without creating a product", async () => {
    await currentAdmin();
    const { saveProduct } = await import("./_actions");
    const config = await buildConfig({ slug: "admin" });
    const result = await saveProduct(null, {}, configForm(config));
    expect(result.step).toBe(1);
    expect(result.errors?.slug).toBeTruthy();
    const row = await db.query.products.findFirst({ where: eq(products.slug, "admin") });
    expect(row).toBeUndefined();
  });

  it("returns a step 2 error for an unknown theme", async () => {
    await currentAdmin();
    const { saveProduct } = await import("./_actions");
    const config = await buildConfig({ themeId: randomUUID() });
    const result = await saveProduct(null, {}, configForm(config));
    expect(result.step).toBe(2);
    expect(result.errors?.themeId).toBeTruthy();
  });

  it("returns a step 1 error when the slug is already taken", async () => {
    await currentAdmin();
    const { saveProduct } = await import("./_actions");
    const config = await buildConfig({ slug: "lettre-pro" });
    const result = await saveProduct(null, {}, configForm(config));
    expect(result.step).toBe(1);
    expect(result.errors?.slug).toBeTruthy();
  });

  it("creates the product, tags the cache, and returns ok", async () => {
    await currentAdmin();
    const { saveProduct } = await import("./_actions");
    const config = await buildConfig();
    const result = await saveProduct(null, {}, configForm(config));
    expect(result).toMatchObject({ ok: true, slug: config.slug, version: 1 });
    expect(updateTag).toHaveBeenCalledWith("products");
    expect(updateTag).toHaveBeenCalledWith(`product:${config.slug}`);

    const row = await db.query.products.findFirst({ where: eq(products.slug, config.slug) });
    expect(row).toBeTruthy();
    await cleanupProduct(row!.id);
  });
});

describe("saveProduct · slug race", () => {
  afterEach(() => {
    vi.doUnmock("@/lib/dal/product-editor");
    vi.resetModules();
  });

  it("returns a step 1 slug error when createProduct hits a unique constraint violation", async () => {
    await currentAdmin();
    vi.resetModules();
    vi.doMock("@/lib/dal/product-editor", async () => {
      const actual = await vi.importActual<typeof import("@/lib/dal/product-editor")>("@/lib/dal/product-editor");
      return {
        ...actual,
        // isSlugAvailable said yes, but another request won the race and
        // inserted first: the database's own unique constraint on
        // products.slug is the real guarantee (docs/07-modele-de-donnees.md).
        isSlugAvailable: async () => true,
        createProduct: async () => {
          const err = new Error('duplicate key value violates unique constraint "products_slug_unique"') as Error & {
            code: string;
          };
          err.code = "23505";
          throw err;
        },
      };
    });
    const { saveProduct } = await import("./_actions");
    const config = await buildConfig();
    const result = await saveProduct(null, {}, configForm(config));
    expect(result).toEqual({ errors: { slug: "Ce slug est déjà utilisé" }, step: 1 });
  });

  it("rethrows an unrelated database error instead of reporting a slug conflict", async () => {
    await currentAdmin();
    vi.resetModules();
    vi.doMock("@/lib/dal/product-editor", async () => {
      const actual = await vi.importActual<typeof import("@/lib/dal/product-editor")>("@/lib/dal/product-editor");
      return {
        ...actual,
        isSlugAvailable: async () => true,
        createProduct: async () => {
          throw new Error("connection reset by peer");
        },
      };
    });
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { saveProduct } = await import("./_actions");
    const config = await buildConfig();
    await expect(saveProduct(null, {}, configForm(config))).rejects.toThrow("connection reset by peer");
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});

describe("saveProduct · edit path", () => {
  it("returns a form error for an invalid bound slug", async () => {
    await currentAdmin();
    const { saveProduct } = await import("./_actions");
    const config = await buildConfig();
    const result = await saveProduct("Not A Slug", {}, configForm(config));
    expect(result.formError).toBeTruthy();
  });

  it("returns 'Produit introuvable' when saveVersion finds nothing, without an updateTag", async () => {
    await currentAdmin();
    const { saveProduct } = await import("./_actions");
    const config = await buildConfig();
    const result = await saveProduct(`missing-${randomUUID()}`, {}, configForm(config));
    expect(result.formError).toBe("Produit introuvable");
    expect(updateTag).not.toHaveBeenCalled();
  });

  it("saves a new version and returns ok without tagging the cache", async () => {
    await currentAdmin();
    const { saveProduct } = await import("./_actions");
    const config = await buildConfig();
    const created = await saveProduct(null, {}, configForm(config));
    expect(created.ok).toBe(true);
    updateTag.mockReset();

    const result = await saveProduct(config.slug, {}, configForm({ ...config, name: "Renamed" }));
    expect(result).toMatchObject({ ok: true, slug: config.slug, version: 2 });
    expect(updateTag).not.toHaveBeenCalled();

    const row = await db.query.products.findFirst({ where: eq(products.slug, config.slug) });
    await cleanupProduct(row!.id);
  });
});

describe("checkSlug", () => {
  it("redirects a non-admin caller", async () => {
    requireAdmin.mockRejectedValue(new RedirectMarker("/admin/login"));
    const { checkSlug } = await import("./_actions");
    await expect(checkSlug("lettre-pro")).rejects.toThrow("redirect:/admin/login");
  });

  it("reports a format error for a name that is not a slug", async () => {
    await currentAdmin();
    const { checkSlug } = await import("./_actions");
    expect(await checkSlug("Lettre Pro")).toMatchObject({ available: false });
  });

  it("reports a reserved slug", async () => {
    await currentAdmin();
    const { checkSlug } = await import("./_actions");
    expect(await checkSlug("api")).toMatchObject({ available: false });
  });

  it("reports an unavailable slug", async () => {
    await currentAdmin();
    const { checkSlug } = await import("./_actions");
    expect(await checkSlug("lettre-pro")).toMatchObject({ available: false });
  });

  it("reports a free slug as available", async () => {
    await currentAdmin();
    const { checkSlug } = await import("./_actions");
    expect(await checkSlug(`free-${randomUUID()}`)).toMatchObject({ available: true });
  });
});

describe("uploadLogo", () => {
  it("redirects a non-admin caller", async () => {
    requireAdmin.mockRejectedValue(new RedirectMarker("/admin/login"));
    const { uploadLogo } = await import("./_actions");
    const data = new FormData();
    await expect(uploadLogo({}, data)).rejects.toThrow("redirect:/admin/login");
  });

  it("errors without calling put when no file is given", async () => {
    await currentAdmin();
    const { uploadLogo } = await import("./_actions");
    const result = await uploadLogo({}, new FormData());
    expect(result.error).toBeTruthy();
    expect(put).not.toHaveBeenCalled();
  });

  it("errors without calling put for a file over 512 KB", async () => {
    await currentAdmin();
    const { uploadLogo } = await import("./_actions");
    const big = new File([new Uint8Array(512 * 1024 + 1)], "logo.png", { type: "image/png" });
    const data = new FormData();
    data.set("file", big);
    const result = await uploadLogo({}, data);
    expect(result.error).toBeTruthy();
    expect(put).not.toHaveBeenCalled();
  });

  it("errors without calling put for a disallowed file type", async () => {
    await currentAdmin();
    const { uploadLogo } = await import("./_actions");
    const file = new File([new Uint8Array(10)], "logo.svg", { type: "image/svg+xml" });
    const data = new FormData();
    data.set("file", file);
    const result = await uploadLogo({}, data);
    expect(result.error).toBeTruthy();
    expect(put).not.toHaveBeenCalled();
  });

  it("uploads a valid file and returns its url", async () => {
    await currentAdmin();
    put.mockResolvedValue({ url: "https://blob.example/logos/logo-abc.png" });
    const { uploadLogo } = await import("./_actions");
    const file = new File([new Uint8Array(10)], "logo.png", { type: "image/png" });
    const data = new FormData();
    data.set("file", file);
    const result = await uploadLogo({}, data);
    expect(result.url).toBe("https://blob.example/logos/logo-abc.png");
    expect(put).toHaveBeenCalledWith(
      expect.stringContaining("logos/"),
      expect.anything(),
      expect.objectContaining({ access: "public", addRandomSuffix: true }),
    );
  });

  it("logs and returns a generic error when put rejects", async () => {
    await currentAdmin();
    put.mockRejectedValue(new Error("blob store unavailable"));
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { uploadLogo } = await import("./_actions");
    const file = new File([new Uint8Array(10)], "logo.png", { type: "image/png" });
    const data = new FormData();
    data.set("file", file);
    const result = await uploadLogo({}, data);
    expect(result.error).toBeTruthy();
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});
