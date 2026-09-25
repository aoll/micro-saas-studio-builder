import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { products } from "@/lib/db/schema";

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
