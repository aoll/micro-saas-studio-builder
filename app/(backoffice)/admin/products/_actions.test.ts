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

const guardRequest = vi.fn();
vi.mock("@/lib/security", () => ({ guardRequest: (kind: string) => guardRequest(kind) }));

async function currentAdmin() {
  const owner = await db.query.users.findFirst({ where: eq(users.email, SEED_OWNER.email) });
  requireAdmin.mockResolvedValue({ user: { id: owner!.id, role: "admin" } });
  guardRequest.mockResolvedValue({ ok: true });
  return owner!.id;
}

afterEach(() => {
  requireAdmin.mockReset();
  updateTag.mockReset();
  put.mockReset();
  guardRequest.mockReset();
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

const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const JPEG_BYTES = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]);
const WEBP_BYTES = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);

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

  it("rejects a file whose declared type doesn't match its real bytes, without calling put", async () => {
    await currentAdmin();
    const { uploadLogo } = await import("./_actions");
    // Declared as a PNG, but the actual content is HTML: file.type alone
    // would have passed the old allow-list check.
    const html = new TextEncoder().encode("<html><body>not an image</body></html>");
    const file = new File([html], "logo.png", { type: "image/png" });
    const data = new FormData();
    data.set("file", file);
    const result = await uploadLogo({}, data);
    expect(result.error).toBeTruthy();
    expect(put).not.toHaveBeenCalled();
  });

  it.each([
    ["PNG", PNG_BYTES, "png"],
    ["JPEG", JPEG_BYTES, "jpg"],
    ["WEBP", WEBP_BYTES, "webp"],
  ])("uploads a real %s file and returns its url", async (_label, fileBytes, extension) => {
    await currentAdmin();
    put.mockResolvedValue({ url: "https://blob.example/logos/logo-abc" });
    const { uploadLogo } = await import("./_actions");
    const file = new File([fileBytes], "ignored-name.bin", { type: "application/octet-stream" });
    const data = new FormData();
    data.set("file", file);
    const result = await uploadLogo({}, data);
    expect(result.url).toBe("https://blob.example/logos/logo-abc");
    expect(put).toHaveBeenCalledWith(
      expect.stringMatching(new RegExp(`^logos/[^/]+\\.${extension}$`)),
      expect.anything(),
      expect.objectContaining({ access: "public", addRandomSuffix: true }),
    );
  });

  it("never uses the client-supplied file name as the blob pathname", async () => {
    await currentAdmin();
    put.mockResolvedValue({ url: "https://blob.example/logos/logo-abc.png" });
    const { uploadLogo } = await import("./_actions");
    const file = new File([PNG_BYTES], "../../etc/passwd.png", { type: "image/png" });
    const data = new FormData();
    data.set("file", file);
    await uploadLogo({}, data);
    const [pathname] = put.mock.calls[0]!;
    expect(pathname).not.toContain("passwd");
    expect(pathname).not.toContain("..");
  });

  it("logs and returns a generic error when put rejects", async () => {
    await currentAdmin();
    put.mockRejectedValue(new Error("blob store unavailable"));
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { uploadLogo } = await import("./_actions");
    const file = new File([PNG_BYTES], "logo.png", { type: "image/png" });
    const data = new FormData();
    data.set("file", file);
    const result = await uploadLogo({}, data);
    expect(result.error).toBeTruthy();
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});

const testInputsFixture: ProductConfig["inputs"] = [
  { key: "poste", label: "Poste visé", type: "text", required: true },
];
const testGenerationFixture: ProductConfig["generation"] = {
  model: "anthropic/claude-haiku-4.5",
  promptTemplate: "Rédige un texte pour {{poste}}",
  outputType: "markdown",
};

function testPromptForm({
  inputs = testInputsFixture,
  generation = testGenerationFixture,
  sample = { poste: "Développeur Frontend" },
}: Partial<{ inputs: unknown; generation: unknown; sample: Record<string, string> }> = {}): FormData {
  const data = new FormData();
  data.set("config", JSON.stringify({ inputs, generation }));
  data.set("sample", JSON.stringify(sample));
  return data;
}

describe("testPrompt", () => {
  it("redirects a non-admin caller", async () => {
    requireAdmin.mockRejectedValue(new RedirectMarker("/admin/login"));
    const { testPrompt } = await import("./_actions");
    await expect(testPrompt(null, {}, testPromptForm())).rejects.toThrow("redirect:/admin/login");
  });

  it("returns an error without calling the AI when the guard refuses", async () => {
    await currentAdmin();
    guardRequest.mockResolvedValue({ ok: false, reason: "rate_limited" });
    const { testPrompt } = await import("./_actions");
    const result = await testPrompt(null, {}, testPromptForm());
    expect(result).toEqual({ error: expect.any(String) });
    expect(guardRequest).toHaveBeenCalledWith("test-prompt");
  });

  it("returns an error for a {{variable}} without a matching field", async () => {
    await currentAdmin();
    const { testPrompt } = await import("./_actions");
    const result = await testPrompt(
      null,
      {},
      testPromptForm({ generation: { ...testGenerationFixture, promptTemplate: "Pour {{inconnu}}" } }),
    );
    expect(result.error).toBe("Variable {{inconnu}} sans champ correspondant");
    expect(result.ok).toBeUndefined();
  });

  it("returns an error when a required sample field is left empty", async () => {
    await currentAdmin();
    const { testPrompt } = await import("./_actions");
    const result = await testPrompt(null, {}, testPromptForm({ sample: { poste: "" } }));
    expect(result.error).toBeTruthy();
    expect(result.ok).toBeUndefined();
  });

  it("returns an error for an image output type, without calling the AI", async () => {
    await currentAdmin();
    const { testPrompt } = await import("./_actions");
    const result = await testPrompt(
      null,
      {},
      testPromptForm({ generation: { ...testGenerationFixture, outputType: "image" } }),
    );
    expect(result.error).toBeTruthy();
    expect(result.ok).toBeUndefined();
  });

  it("returns an error for a model outside the catalogue, without calling the AI (create mode, no stored model to except)", async () => {
    await currentAdmin();
    const { testPrompt } = await import("./_actions");
    const result = await testPrompt(
      null,
      {},
      testPromptForm({ generation: { ...testGenerationFixture, model: "openai/gpt-5-mini" } }),
    );
    expect(result.error).toBeTruthy();
    expect(result.ok).toBeUndefined();
  });

  it("accepts a non-catalogue model when it matches the edited product's own stored model", async () => {
    await currentAdmin();
    const { createProduct } = await import("@/lib/dal/product-editor");
    const config = await buildConfig({
      generation: { model: "openai/gpt-5-mini", promptTemplate: "Écris sur {{topic}}", outputType: "markdown" },
      inputs: [{ key: "topic", label: "Topic", type: "text", required: true }],
    });
    const created = await createProduct(config);

    const { testPrompt } = await import("./_actions");
    const result = await testPrompt(
      created.slug,
      {},
      testPromptForm({
        inputs: [{ key: "topic", label: "Topic", type: "text", required: true }],
        generation: { model: "openai/gpt-5-mini", promptTemplate: "Écris sur {{topic}}", outputType: "markdown" },
        sample: { topic: "le café" },
      }),
    );
    expect(result.ok).toBe(true);

    await cleanupProduct(created.id);
  });

  it("returns an error for a non-catalogue model that doesn't match the edited product's stored model either", async () => {
    await currentAdmin();
    const { createProduct } = await import("@/lib/dal/product-editor");
    const config = await buildConfig({ generation: testGenerationFixture, inputs: testInputsFixture });
    const created = await createProduct(config);

    const { testPrompt } = await import("./_actions");
    const result = await testPrompt(
      created.slug,
      {},
      testPromptForm({ generation: { ...testGenerationFixture, model: "openai/gpt-5-mini" } }),
    );
    expect(result.error).toBeTruthy();
    expect(result.ok).toBeUndefined();

    await cleanupProduct(created.id);
  });

  it("mock mode: returns the fixture output, its token counts and its cost", async () => {
    await currentAdmin();
    const { testPrompt } = await import("./_actions");
    const result = await testPrompt(null, {}, testPromptForm());
    expect(result.ok).toBe(true);
    expect(typeof result.output).toBe("string");
    expect(result.output!.length).toBeGreaterThan(0);
    expect(result.inputTokens).toBeGreaterThan(0);
    expect(result.outputTokens).toBeGreaterThan(0);
    expect(result.costMicros).toBeGreaterThan(0);
  });

  it("on an AI failure, logs and returns a generic French error, never the raw error", async () => {
    await currentAdmin();
    vi.resetModules();
    vi.doMock("@/lib/ai/generate", async () => {
      const actual = await vi.importActual<typeof import("@/lib/ai/generate")>("@/lib/ai/generate");
      return {
        ...actual,
        streamGeneration: (args: { onError: (error: unknown) => void | Promise<void> }) => {
          queueMicrotask(() => {
            void args.onError(new Error("provider unavailable: secret leak in stack trace"));
          });
          return { consumeStream: async () => undefined };
        },
      };
    });
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { testPrompt } = await import("./_actions");
    const result = await testPrompt(null, {}, testPromptForm());
    expect(result).toEqual({ error: "La génération de test a échoué" });
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
    vi.doUnmock("@/lib/ai/generate");
    vi.resetModules();
  });
});

describe("estimateGenerationCost", () => {
  it("redirects a non-admin caller", async () => {
    requireAdmin.mockRejectedValue(new RedirectMarker("/admin/login"));
    const { estimateGenerationCost } = await import("./_actions");
    await expect(estimateGenerationCost("anthropic/claude-haiku-4.5")).rejects.toThrow("redirect:/admin/login");
  });

  it("returns a plausible cost for an empty model, without throwing", async () => {
    await currentAdmin();
    const { estimateGenerationCost } = await import("./_actions");
    const result = await estimateGenerationCost("");
    expect(result.costMicros).toBeGreaterThan(0);
  });

  it("returns the reference cost for the Haiku model", async () => {
    await currentAdmin();
    const { estimateGenerationCost } = await import("./_actions");
    const { costMicros } = await import("@/lib/ai/generate");
    const result = await estimateGenerationCost("anthropic/claude-haiku-4.5");
    expect(result.costMicros).toBe(
      costMicros("anthropic/claude-haiku-4.5", { inputTokens: 1000, outputTokens: 500, cachedInputTokens: 0 }),
    );
  });
});

describe("publish · create path", () => {
  it("redirects a non-admin caller without writing anything", async () => {
    requireAdmin.mockRejectedValue(new RedirectMarker("/admin/login"));
    const { publish } = await import("./_actions");
    const config = await buildConfig();
    await expect(publish(null, {}, configForm(config))).rejects.toThrow("redirect:/admin/login");
    const row = await db.query.products.findFirst({ where: eq(products.slug, config.slug) });
    expect(row).toBeUndefined();
  });

  it("returns step errors for an invalid config without creating a product", async () => {
    await currentAdmin();
    const { publish } = await import("./_actions");
    const config = await buildConfig({ slug: "admin" });
    const result = await publish(null, {}, configForm(config));
    expect(result.step).toBe(1);
    expect(result.errors?.slug).toBeTruthy();
    const row = await db.query.products.findFirst({ where: eq(products.slug, "admin") });
    expect(row).toBeUndefined();
  });

  it("returns a step 2 error for an unknown theme", async () => {
    await currentAdmin();
    const { publish } = await import("./_actions");
    const config = await buildConfig({ themeId: randomUUID() });
    const result = await publish(null, {}, configForm(config));
    expect(result.step).toBe(2);
    expect(result.errors?.themeId).toBeTruthy();
  });

  it("returns a step 1 error when the slug is already taken", async () => {
    await currentAdmin();
    const { publish } = await import("./_actions");
    const config = await buildConfig({ slug: "lettre-pro" });
    const result = await publish(null, {}, configForm(config));
    expect(result.step).toBe(1);
    expect(result.errors?.slug).toBeTruthy();
  });

  it("returns a step 5 field error for a model outside the catalogue, without creating a product", async () => {
    await currentAdmin();
    const { publish } = await import("./_actions");
    const config = await buildConfig({
      generation: { ...testGenerationFixture, model: "openai/gpt-5-mini" },
      inputs: testInputsFixture,
    });
    const result = await publish(null, {}, configForm(config));
    expect(result.step).toBe(5);
    expect(result.errors?.["generation.model"]).toBeTruthy();
    const row = await db.query.products.findFirst({ where: eq(products.slug, config.slug) });
    expect(row).toBeUndefined();
  });

  it("creates and publishes the product as v1, tags the cache, and returns the url", async () => {
    await currentAdmin();
    const { publish } = await import("./_actions");
    const config = await buildConfig();
    const result = await publish(null, {}, configForm(config));
    expect(result).toMatchObject({ ok: true, slug: config.slug, version: 1, url: `/${config.slug}` });
    expect(updateTag).toHaveBeenCalledWith("products");
    expect(updateTag).toHaveBeenCalledWith(`product:${config.slug}`);

    const row = await db.query.products.findFirst({ where: eq(products.slug, config.slug) });
    expect(row).toMatchObject({ currentVersion: 1 });
    await cleanupProduct(row!.id);
  });
});

describe("publish · slug race", () => {
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
    const { publish } = await import("./_actions");
    const config = await buildConfig();
    const result = await publish(null, {}, configForm(config));
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
    const { publish } = await import("./_actions");
    const config = await buildConfig();
    await expect(publish(null, {}, configForm(config))).rejects.toThrow("connection reset by peer");
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});

describe("publish · edit path", () => {
  it("returns a form error for an invalid bound slug", async () => {
    await currentAdmin();
    const { publish } = await import("./_actions");
    const config = await buildConfig();
    const result = await publish("Not A Slug", {}, configForm(config));
    expect(result.formError).toBeTruthy();
  });

  it("returns 'Produit introuvable' when saveVersion finds nothing, without an updateTag", async () => {
    await currentAdmin();
    const { publish } = await import("./_actions");
    const config = await buildConfig();
    const result = await publish(`missing-${randomUUID()}`, {}, configForm(config));
    expect(result.formError).toBe("Produit introuvable");
    expect(updateTag).not.toHaveBeenCalled();
  });

  it("saves a new version, publishes it as v2, and tags the cache", async () => {
    await currentAdmin();
    const { publish, saveProduct } = await import("./_actions");
    const config = await buildConfig();
    const created = await saveProduct(null, {}, configForm(config));
    expect(created.ok).toBe(true);
    updateTag.mockReset();

    const result = await publish(config.slug, {}, configForm({ ...config, name: "Renamed" }));
    expect(result).toMatchObject({ ok: true, slug: config.slug, version: 2, url: `/${config.slug}` });
    expect(updateTag).toHaveBeenCalledWith("products");
    expect(updateTag).toHaveBeenCalledWith(`product:${config.slug}`);

    const row = await db.query.products.findFirst({ where: eq(products.slug, config.slug) });
    expect(row).toMatchObject({ currentVersion: 2 });
    await cleanupProduct(row!.id);
  });

  it("accepts a non-catalogue model when it matches the product's own stored model", async () => {
    await currentAdmin();
    const { createProduct } = await import("@/lib/dal/product-editor");
    const config = await buildConfig({
      generation: { ...testGenerationFixture, model: "openai/gpt-5-mini" },
      inputs: testInputsFixture,
    });
    const created = await createProduct(config);

    const { publish } = await import("./_actions");
    const result = await publish(created.slug, {}, configForm(config));
    expect(result).toMatchObject({ ok: true, slug: config.slug, version: 2 });

    await cleanupProduct(created.id);
  });

  it("returns a step 5 error for a non-catalogue model that doesn't match the product's stored model either", async () => {
    await currentAdmin();
    const { createProduct } = await import("@/lib/dal/product-editor");
    const config = await buildConfig({ generation: testGenerationFixture, inputs: testInputsFixture });
    const created = await createProduct(config);

    const { publish } = await import("./_actions");
    const result = await publish(
      created.slug,
      {},
      configForm({ ...config, generation: { ...testGenerationFixture, model: "openai/gpt-5-mini" } }),
    );
    expect(result.step).toBe(5);
    expect(result.errors?.["generation.model"]).toBeTruthy();

    await cleanupProduct(created.id);
  });
});
