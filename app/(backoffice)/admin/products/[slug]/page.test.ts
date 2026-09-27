import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { users } from "@/lib/db/auth-schema";
import { products, themes } from "@/lib/db/schema";
import { SEED_OWNER } from "@/scripts/seed";

// QA2-P1-B1 code review (MEDIUM finding, specs/qa/QA2-P1-B1-brouillon-publie.md): BO-03's
// fiche page resolves its product through `getProduct(slug)` — the same public, cached DAL
// function this spec changed to return `null` for a never-published product (current_version
// IS NULL), not through a separate admin-facing query. This test is real (a real inserted row,
// the real getProduct), not the mocked-getProduct unit style of other page.test.tsx files in
// this codebase, because the question is specifically what getProduct itself does for this
// row today, end to end through the page.
const requireAdmin = vi.fn();
vi.mock("@/lib/dal/session", () => ({ requireAdmin: () => requireAdmin() }));

const getFunnel = vi.fn();
vi.mock("@/lib/dal/metrics", () => ({ getFunnel: (...args: unknown[]) => getFunnel(...args) }));

const getThresholds = vi.fn();
vi.mock("@/lib/dal/thresholds", () => ({ getThresholds: (...args: unknown[]) => getThresholds(...args) }));

// getProduct is "use cache" (lib/dal/products.ts): left unmocked here (real db, real function),
// but cacheLife/cacheTag need a request-free stand-in outside a cacheComponents request
// (docs/09 test pattern, same as lib/dal/metrics.test.ts).
vi.mock("next/cache", () => ({ cacheLife: vi.fn(), cacheTag: vi.fn() }));

class NotFoundError extends Error {}
const notFound = vi.fn(() => {
  throw new NotFoundError("NEXT_NOT_FOUND");
});
vi.mock("next/navigation", () => ({ notFound: () => notFound() }));

afterEach(() => {
  requireAdmin.mockReset();
  getFunnel.mockReset();
  getThresholds.mockReset();
  notFound.mockClear();
});

// Mirrors lib/dal/products.test.ts's insertNeverPublishedProduct(): created directly,
// bypassing createProduct()/requireAdmin(), a real "never published" row.
async function insertNeverPublishedProduct(): Promise<{ id: string; slug: string }> {
  const owner = await db.query.users.findFirst({ where: eq(users.email, SEED_OWNER.email) });
  const editorial = await db.query.themes.findFirst({ where: eq(themes.slug, "editorial") });
  const slug = `bo03-never-published-${randomUUID()}`;
  const [row] = await db
    .insert(products)
    .values({ slug, themeId: editorial!.id, locale: "fr", createdBy: owner!.id })
    .returning({ id: products.id });
  return { id: row!.id, slug };
}

describe("ProductSheet (BO-03)", () => {
  it("404s for a never-published product (current_version IS NULL) instead of a silent 200 or a crash", async () => {
    requireAdmin.mockResolvedValue({ user: { id: "admin-id", role: "admin" } });
    const created = await insertNeverPublishedProduct();

    const { ProductSheet } = await import("./page");
    await expect(ProductSheet({ params: Promise.resolve({ slug: created.slug }) })).rejects.toThrow("NEXT_NOT_FOUND");
    expect(getFunnel).not.toHaveBeenCalled();
    expect(getThresholds).not.toHaveBeenCalled();

    await db.delete(products).where(eq(products.id, created.id));
  });
});
