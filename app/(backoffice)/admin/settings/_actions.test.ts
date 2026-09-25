import { randomUUID } from "node:crypto";
import { eq, isNull } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { users } from "@/lib/db/auth-schema";
import { decisionThresholds, productVersions, products, themes } from "@/lib/db/schema";
import { productConfigSchema, type ProductConfig } from "@/lib/schemas/product-config";
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

let ownerId: string;

beforeAll(async () => {
  const owner = await db.query.users.findFirst({ where: eq(users.email, SEED_OWNER.email) });
  ownerId = owner!.id;
});

async function currentAdmin() {
  requireAdmin.mockResolvedValue({ user: { id: ownerId, role: "admin" } });
}

afterEach(() => {
  requireAdmin.mockReset();
  updateTag.mockReset();
});

const createdProductIds: string[] = [];

async function createTestProduct(): Promise<string> {
  const editorial = await db.query.themes.findFirst({ where: eq(themes.slug, "editorial") });
  const config: ProductConfig = productConfigSchema.parse({
    slug: `bo09-action-${randomUUID()}`,
    name: "Settings action test product",
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
  await db.update(decisionThresholds).set({ updatedBy: null }).where(isNull(decisionThresholds.productId));
});

function defaultForm(overrides: Partial<Record<string, string>> = {}): FormData {
  const formData = new FormData();
  formData.set("minVisits", overrides.minVisits ?? "1000");
  formData.set("killMaxConversion", overrides.killMaxConversion ?? "2");
  formData.set("scaleMinConversion", overrides.scaleMinConversion ?? "5");
  if ((overrides.scaleRequiresPositiveMargin ?? "on") === "on") formData.set("scaleRequiresPositiveMargin", "on");
  return formData;
}

describe("saveThresholdSettings", () => {
  it("redirects a non-admin caller", async () => {
    requireAdmin.mockRejectedValue(new RedirectMarker("/admin/login"));
    const { saveThresholdSettings } = await import("./_actions");
    await expect(saveThresholdSettings(null, {}, defaultForm())).rejects.toThrow("redirect:/admin/login");
  });

  it("saves the studio defaults and calls updateTag('thresholds')", async () => {
    await currentAdmin();
    const { saveThresholdSettings } = await import("./_actions");
    const state = await saveThresholdSettings(null, {}, defaultForm());
    expect(state).toEqual({ ok: true });
    expect(updateTag).toHaveBeenCalledWith("thresholds");
  });

  it("returns French field errors for kill >= scale, without calling updateTag", async () => {
    await currentAdmin();
    const { saveThresholdSettings } = await import("./_actions");
    const state = await saveThresholdSettings(
      null,
      {},
      defaultForm({ killMaxConversion: "6", scaleMinConversion: "5" }),
    );
    expect(state.errors).toEqual({
      scaleMinConversion: "Le seuil « à scaler » doit être supérieur au seuil « à couper »",
    });
    expect(updateTag).not.toHaveBeenCalled();
  });

  it("returns a French error for a cleared percent field", async () => {
    await currentAdmin();
    const { saveThresholdSettings } = await import("./_actions");
    const state = await saveThresholdSettings(null, {}, defaultForm({ killMaxConversion: "" }));
    expect(state.errors).toEqual({ killMaxConversion: "Valeur invalide" });
  });

  it("saves a per-product override and calls updateTag('thresholds')", async () => {
    await currentAdmin();
    const productId = await createTestProduct();
    const { saveThresholdSettings } = await import("./_actions");
    const state = await saveThresholdSettings(productId, {}, defaultForm({ minVisits: "500" }));
    expect(state).toEqual({ ok: true });
    expect(updateTag).toHaveBeenCalledWith("thresholds");
  });

  it("returns 'Produit introuvable' for an unknown product id", async () => {
    await currentAdmin();
    const { saveThresholdSettings } = await import("./_actions");
    const state = await saveThresholdSettings(randomUUID(), {}, defaultForm());
    expect(state).toEqual({ formError: "Produit introuvable" });
  });

  it("returns 'Produit invalide' for a malformed product id", async () => {
    await currentAdmin();
    const { saveThresholdSettings } = await import("./_actions");
    const state = await saveThresholdSettings("not-a-uuid", {}, defaultForm());
    expect(state).toEqual({ formError: "Produit invalide" });
  });
});

describe("resetProductThresholds", () => {
  it("redirects a non-admin caller", async () => {
    requireAdmin.mockRejectedValue(new RedirectMarker("/admin/login"));
    const { resetProductThresholds } = await import("./_actions");
    await expect(resetProductThresholds(randomUUID(), {}, new FormData())).rejects.toThrow("redirect:/admin/login");
  });

  it("deletes the override and calls updateTag('thresholds')", async () => {
    await currentAdmin();
    const productId = await createTestProduct();
    await db.insert(decisionThresholds).values({ productId, minVisits: 500 });
    const { resetProductThresholds } = await import("./_actions");
    const state = await resetProductThresholds(productId, {}, new FormData());
    expect(state).toEqual({ ok: true });
    expect(updateTag).toHaveBeenCalledWith("thresholds");
    const row = await db.query.decisionThresholds.findFirst({ where: eq(decisionThresholds.productId, productId) });
    expect(row).toBeUndefined();
  });

  it("returns 'Produit introuvable' for an unknown product id", async () => {
    await currentAdmin();
    const { resetProductThresholds } = await import("./_actions");
    const state = await resetProductThresholds(randomUUID(), {}, new FormData());
    expect(state).toEqual({ formError: "Produit introuvable" });
  });
});
