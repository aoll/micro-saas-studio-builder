import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { decisionThresholds, products } from "@/lib/db/schema";

const cacheLife = vi.fn();
const cacheTag = vi.fn();
vi.mock("next/cache", () => ({ cacheLife, cacheTag }));

afterEach(() => {
  cacheLife.mockClear();
  cacheTag.mockClear();
});

let lettreProId: string;

beforeAll(async () => {
  const row = await db.query.products.findFirst({ where: eq(products.slug, "lettre-pro") });
  lettreProId = row!.id;
});

afterAll(async () => {
  await db.delete(decisionThresholds).where(eq(decisionThresholds.productId, lettreProId));
});

describe("getThresholds", () => {
  it("returns the studio defaults for a product with no override", async () => {
    const { getThresholds } = await import("./thresholds");
    const thresholds = await getThresholds(lettreProId);
    expect(thresholds).toEqual({
      minVisits: 1000,
      killMaxConversion: 0.02,
      scaleMinConversion: 0.05,
      scaleRequiresPositiveMargin: true,
    });
    expect(cacheTag).toHaveBeenCalledWith("thresholds");
    expect(cacheLife).toHaveBeenCalledWith("max");
  });

  it("merges a partial per-product override field by field", async () => {
    await db.insert(decisionThresholds).values({ productId: lettreProId, killMaxConversion: 0.01 });
    const { getThresholds } = await import("./thresholds");
    const thresholds = await getThresholds(lettreProId);
    expect(thresholds).toEqual({
      minVisits: 1000,
      killMaxConversion: 0.01,
      scaleMinConversion: 0.05,
      scaleRequiresPositiveMargin: true,
    });
  });

  it("throws when the default thresholds row is missing", async () => {
    vi.resetModules();
    vi.doMock("@/lib/db", () => ({ db: { query: { decisionThresholds: { findMany: async () => [] } } } }));
    const { getThresholds } = await import("./thresholds");
    await expect(getThresholds(lettreProId)).rejects.toThrow("default thresholds missing");
    vi.doUnmock("@/lib/db");
    vi.resetModules();
  });

  it("throws when the default thresholds row has a null field (DB CHECK bypassed)", async () => {
    vi.resetModules();
    vi.doMock("@/lib/db", () => ({
      db: {
        query: {
          decisionThresholds: {
            findMany: async () => [
              {
                productId: null,
                minVisits: 1000,
                killMaxConversion: 0.02,
                scaleMinConversion: null, // should be impossible per the DB CHECK, but not visible to TS
                scaleRequiresPositiveMargin: true,
              },
            ],
          },
        },
      },
    }));
    const { getThresholds } = await import("./thresholds");
    await expect(getThresholds(lettreProId)).rejects.toThrow("default thresholds row incomplete");
    vi.doUnmock("@/lib/db");
    vi.resetModules();
  });
});
