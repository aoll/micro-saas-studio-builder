// Permanent contract tests (specs/CONTRACT-data.md, task 8): unlike
// stubs.test.ts (deleted in the next commit), these assertions check the
// *shape* of every frozen function's response, not a stub-specific
// constant. A real implementation (LEDGER, TRACKING, SECURITY, DEMO-mode,
// BO-05, BO-06…) must keep passing this file unchanged.
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { db } from "@/lib/db";
import { users } from "@/lib/db/auth-schema";
import { productVersions, products, themes } from "@/lib/db/schema";
import type { ProductConfig } from "@/lib/schemas/product-config";
import { SEED_OWNER } from "@/scripts/seed";

vi.mock("next/cache", () => ({ cacheLife: vi.fn(), cacheTag: vi.fn() }));

let ownerId: string;
let lettreProId: string;
let editorialThemeId: string;

vi.mock("./session", async () => {
  const actual = await vi.importActual<typeof import("./session")>("./session");
  return {
    ...actual,
    getSession: async () => ({ user: { id: ownerId, role: "owner" } }),
    requireAdmin: async () => ({ user: { id: ownerId, role: "owner" } }),
  };
});

const createdProductIds: string[] = [];

afterAll(async () => {
  for (const id of createdProductIds) {
    await db.delete(productVersions).where(eq(productVersions.productId, id));
    await db.delete(products).where(eq(products.id, id));
  }
});

beforeAll(async () => {
  const owner = await db.query.users.findFirst({ where: eq(users.email, SEED_OWNER.email) });
  ownerId = owner!.id;
  const lettrePro = await db.query.products.findFirst({ where: eq(products.slug, "lettre-pro") });
  lettreProId = lettrePro!.id;
  const editorial = await db.query.themes.findFirst({ where: eq(themes.slug, "editorial") });
  editorialThemeId = editorial!.id;
});

const debitResultSchema = z.union([
  z.object({ ok: z.literal(true), balance: z.int().min(0) }),
  z.object({ ok: z.literal(true), replay: z.literal(true) }),
  z.object({ ok: z.literal(false), reason: z.literal("insufficient_balance") }),
]);
const balanceResultSchema = z.object({ balance: z.int().min(0) });

describe("credits", () => {
  it("debit matches DebitResult", async () => {
    // A real ledger enforces the FK from credit_transactions.generation_id
    // to generations.id (LEDGER): pass a real generation instead of the
    // non-uuid "g1" no honest ledger could accept.
    const { recordGeneration } = await import("./generations");
    const { id: generationId } = await recordGeneration({
      productId: lettreProId,
      productVersion: 1,
      userId: ownerId,
      anonymousId: null,
      ipHash: "hash",
      input: {},
      idempotencyKey: randomUUID(),
    });
    const { debit } = await import("./credits");
    const result = await debit({
      userId: ownerId,
      productId: lettreProId,
      cost: 1,
      generationId,
      idempotencyKey: randomUUID(),
    });
    expect(debitResultSchema.safeParse(result).success).toBe(true);
  });

  it("getBalance matches a non-negative number", async () => {
    const { getBalance } = await import("./credits");
    expect(await getBalance(ownerId, lettreProId)).toBeGreaterThanOrEqual(0);
  });

  it("refund matches void", async () => {
    const { refund } = await import("./credits");
    expect(await refund("g1")).toBeUndefined();
  });

  it("grantSignupBonus matches { balance }", async () => {
    const { grantSignupBonus } = await import("./credits");
    const result = await grantSignupBonus({ userId: ownerId, productId: lettreProId });
    expect(balanceResultSchema.safeParse(result).success).toBe(true);
  });

  it("purchase matches { balance }", async () => {
    const { purchase } = await import("./credits");
    const result = await purchase({
      userId: ownerId,
      productId: lettreProId,
      packId: "pack-10",
      idempotencyKey: randomUUID(),
    });
    expect(balanceResultSchema.safeParse(result).success).toBe(true);
  });
});

describe("generations", () => {
  it("recordGeneration matches { id: uuid }", async () => {
    const { recordGeneration } = await import("./generations");
    const result = await recordGeneration({
      productId: lettreProId,
      productVersion: 1,
      userId: null,
      anonymousId: randomUUID(),
      ipHash: "hash",
      input: {},
      idempotencyKey: randomUUID(),
    });
    expect(z.object({ id: z.uuid() }).safeParse(result).success).toBe(true);

    const { markGenerationFailed } = await import("./generations");
    expect(await markGenerationFailed(result.id)).toBeUndefined();
  });
});

describe("events", () => {
  it("track matches void", async () => {
    const { track } = await import("./events");
    expect(
      await track({ type: "visit", productId: lettreProId, userId: null, anonymousId: randomUUID() }),
    ).toBeUndefined();
  });
});

describe("products", () => {
  it("getProduct matches Product | null", async () => {
    const { getProduct } = await import("./products");
    expect(await getProduct("lettre-pro")).not.toBeNull();
    expect(await getProduct(`missing-${randomUUID()}`)).toBeNull();
  });
});

describe("themes", () => {
  it("getTheme matches Theme | null", async () => {
    const { getTheme } = await import("./themes");
    expect(await getTheme(editorialThemeId)).not.toBeNull();
    expect(await getTheme(randomUUID())).toBeNull();
  });
});

describe("product-editor", () => {
  it("createProduct matches { id, slug, version }", async () => {
    const { createProduct } = await import("./product-editor");
    const config: ProductConfig = {
      slug: `contract-shape-${randomUUID()}`,
      name: "Contract shape test",
      status: "test",
      themeId: editorialThemeId,
      locale: "fr",
      branding: {},
      landing: { headline: "H", subheadline: "S", faq: [], seoTitle: "T", seoDescription: "D" },
      inputs: [{ key: "topic", label: "Topic", type: "text", required: true }],
      generation: { model: "anthropic/claude-haiku-4.5", promptTemplate: "About {{topic}}", outputType: "markdown" },
      pricing: {
        freeCreditsOnSignup: 3,
        anonymousFreeGenerations: 1,
        costPerGeneration: 1,
        packs: [{ id: "pack-10", credits: 10, priceCents: 490 }],
      },
    };
    const result = await createProduct(config);
    createdProductIds.push(result.id);
    expect(z.object({ id: z.uuid(), slug: z.string(), version: z.int() }).safeParse(result).success).toBe(true);
  });
});

describe("product-status", () => {
  it("updateStatus matches void", async () => {
    const { updateStatus } = await import("./product-status");
    expect(await updateStatus(lettreProId, "scale", null)).toBeUndefined();
  });
});

describe("magic-link", () => {
  it("getLatestMagicLink matches { url, createdAt } | null", async () => {
    const { getLatestMagicLink } = await import("./magic-link");
    expect(await getLatestMagicLink(`missing-${randomUUID()}@example.test`)).toBeNull();
  });
});

describe("metrics", () => {
  it("getPortfolioMetrics matches PortfolioMetrics", async () => {
    const { getPortfolioMetrics } = await import("./metrics");
    const metrics = await getPortfolioMetrics({ days: 30 });
    expect(typeof metrics.totals.visits).toBe("number");
    expect(Array.isArray(metrics.products)).toBe(true);
  });

  it("getFunnel matches Funnel: 5 ordered steps, rates null or >= 0, daily.length <= days", async () => {
    const { getFunnel } = await import("./metrics");
    const funnel = await getFunnel(lettreProId, { days: 14 });
    expect(funnel.steps.map((step) => step.type)).toEqual([
      "visit",
      "first_generation",
      "signup",
      "credits_exhausted",
      "purchase",
    ]);
    for (const step of funnel.steps) {
      expect(step.rateFromPrevious === null || step.rateFromPrevious >= 0).toBe(true);
    }
    expect(funnel.daily.length).toBeLessThanOrEqual(14);
  });
});

describe("thresholds", () => {
  it("getThresholds matches Thresholds in [0,1] with kill < scale", async () => {
    const { getThresholds } = await import("./thresholds");
    const thresholds = await getThresholds(lettreProId);
    expect(thresholds.killMaxConversion).toBeGreaterThanOrEqual(0);
    expect(thresholds.killMaxConversion).toBeLessThanOrEqual(1);
    expect(thresholds.scaleMinConversion).toBeGreaterThanOrEqual(0);
    expect(thresholds.scaleMinConversion).toBeLessThanOrEqual(1);
    expect(thresholds.killMaxConversion).toBeLessThan(thresholds.scaleMinConversion);
  });
});

describe("guards", () => {
  it("isEditable matches boolean", async () => {
    const { isEditable } = await import("./guards");
    expect(typeof isEditable({ isSeed: true })).toBe("boolean");
  });

  it("assertEditable is undefined for a non-seed row", async () => {
    const { assertEditable } = await import("./guards");
    expect(assertEditable({ isSeed: false })).toBeUndefined();
  });
});

describe("security", () => {
  it("guardRequest matches GuardResult", async () => {
    const { guardRequest } = await import("@/lib/security");
    const result = await guardRequest("generate");
    expect(result.ok === true || (result.ok === false && ["bot", "rate_limited"].includes(result.reason))).toBe(true);
  });
});
