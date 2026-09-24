import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { products } from "@/lib/db/schema";

// V1 stub (docs/11 › Les contrats gelés en V1: "chiffres fixes
// plausibles"), fixed and internally consistent LettrePro numbers.
// Replaced by TRACKING's real aggregation over `events`.

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

describe("getPortfolioMetrics", () => {
  it("requires an admin session", async () => {
    requireAdmin.mockRejectedValue(new RedirectMarker("/admin/login"));
    const { getPortfolioMetrics } = await import("./metrics");
    await expect(getPortfolioMetrics({ days: 30 })).rejects.toThrow("redirect:/admin/login");
  });

  it("returns internally consistent, fixed LettrePro numbers, and totals = sum over products", async () => {
    requireAdmin.mockResolvedValue({ user: { role: "admin" } });
    const { getPortfolioMetrics } = await import("./metrics");
    const metrics = await getPortfolioMetrics({ days: 30 });

    expect(metrics.products).toHaveLength(1);
    const lettrePro = metrics.products[0]!;
    expect(lettrePro.slug).toBe("lettre-pro");
    expect(lettrePro.visits).toBe(4200);
    expect(lettrePro.firstGenerations).toBe(1260);
    expect(lettrePro.signups).toBe(520);
    expect(lettrePro.creditsExhausted).toBe(180);
    expect(lettrePro.purchases).toBe(36);
    expect(lettrePro.generations).toBe(2900);
    expect(lettrePro.revenueCents).toBe(29640);
    expect(lettrePro.aiCostMicros).toBe(2900 * 4000);
    expect(lettrePro.signupToPurchaseRate).toBeCloseTo(36 / 520);
    expect(lettrePro.marginPerGenerationMicros).toBeGreaterThan(0);

    expect(metrics.totals.visits).toBe(metrics.products.reduce((sum, product) => sum + product.visits, 0));
    expect(metrics.totals.revenueCents).toBe(metrics.products.reduce((sum, product) => sum + product.revenueCents, 0));
    expect(metrics.totals.aiCostMicros).toBe(metrics.products.reduce((sum, product) => sum + product.aiCostMicros, 0));
  });
});

describe("getFunnel", () => {
  it("requires an admin session", async () => {
    requireAdmin.mockRejectedValue(new RedirectMarker("/admin/login"));
    const { getFunnel } = await import("./metrics");
    await expect(getFunnel("p1", { days: 30 })).rejects.toThrow("redirect:/admin/login");
  });

  it("echoes the productId and returns the 5 ordered funnel steps", async () => {
    requireAdmin.mockResolvedValue({ user: { role: "admin" } });
    const product = await db.query.products.findFirst({ where: eq(products.slug, "lettre-pro") });
    const { getFunnel } = await import("./metrics");
    const funnel = await getFunnel(product!.id, { days: 30 });

    expect(funnel.metrics.productId).toBe(product!.id);
    expect(funnel.steps.map((step) => step.type)).toEqual([
      "visit",
      "first_generation",
      "signup",
      "credits_exhausted",
      "purchase",
    ]);
    expect(funnel.steps[0]!.rateFromPrevious).toBeNull();
    for (const step of funnel.steps.slice(1)) {
      expect(step.rateFromPrevious).not.toBeNull();
      expect(step.rateFromPrevious).toBeGreaterThan(0);
      expect(step.rateFromPrevious).toBeLessThanOrEqual(1);
    }
  });

  it("caps daily points to the requested range, at most 30", async () => {
    requireAdmin.mockResolvedValue({ user: { role: "admin" } });
    const { getFunnel } = await import("./metrics");
    const funnel = await getFunnel("any-product-id", { days: 7 });
    expect(funnel.daily.length).toBeLessThanOrEqual(7);
    expect(funnel.daily.length).toBeGreaterThan(0);
  });
});
