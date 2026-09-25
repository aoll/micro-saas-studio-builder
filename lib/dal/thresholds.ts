import "server-only";
import { isNull, isNotNull, or, eq } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { decisionThresholds, products } from "@/lib/db/schema";
import { thresholdsInputSchema, type ThresholdsInput } from "@/lib/schemas/inputs";
import { assertEditable } from "./guards";
import { requireAdmin } from "./session";

// The default row's 4 fields are `CHECK (product_id IS NOT NULL OR all 4
// values NOT NULL)` in the database (docs/07), but the Drizzle column
// types stay nullable: this schema turns that DB invariant into a runtime
// check instead of an unchecked `!` assertion.
const defaultThresholdsRowSchema = z.object({
  minVisits: z.number(),
  killMaxConversion: z.number(),
  scaleMinConversion: z.number(),
  scaleRequiresPositiveMargin: z.boolean(),
});

// Frozen contract (specs/CONTRACT-types.md): the merged (default + product
// override) decision thresholds (docs/07 › decision_thresholds), read by
// `lib/decision.ts`'s pure `evaluate(metrics, thresholds)`. Cached, tag
// `thresholds` (docs/11's contract table). Real in V1 (reads the seeded
// setting); only the write arrives with BO-09. Studio-wide, non-sensitive,
// cached data: no session check here, unlike the write side (BO-09).
export type Thresholds = {
  minVisits: number;
  killMaxConversion: number;
  scaleMinConversion: number;
  scaleRequiresPositiveMargin: boolean;
};

export const getThresholds: (productId: string) => Promise<Thresholds> = async (productId) => {
  "use cache";
  cacheLife("max");
  cacheTag("thresholds");

  // One query for both rows (docs/07): the default (product_id IS NULL)
  // and this product's override, if any.
  const rows = await db.query.decisionThresholds.findMany({
    where: or(isNull(decisionThresholds.productId), eq(decisionThresholds.productId, productId)),
  });
  const defaultRow = rows.find((row) => row.productId === null);
  if (!defaultRow) throw new Error("default thresholds missing");
  const parsedDefault = defaultThresholdsRowSchema.safeParse(defaultRow);
  if (!parsedDefault.success) throw new Error("default thresholds row incomplete");
  const defaults = parsedDefault.data;
  const override = rows.find((row) => row.productId === productId);

  return {
    minVisits: override?.minVisits ?? defaults.minVisits,
    killMaxConversion: override?.killMaxConversion ?? defaults.killMaxConversion,
    scaleMinConversion: override?.scaleMinConversion ?? defaults.scaleMinConversion,
    scaleRequiresPositiveMargin: override?.scaleRequiresPositiveMargin ?? defaults.scaleRequiresPositiveMargin,
  };
};

// BO-09 (specs/BO-09-seuils.md): the admin-only per-product override, or
// `null` when the product follows the studio defaults as-is.
export type ThresholdOverride = { [K in keyof Thresholds]: Thresholds[K] | null };

// BO-09's /admin/settings read: the studio defaults plus every product's
// own override (or `null`), so the page can render both forms and the
// "surchargé" list without one round trip per product.
export type ThresholdSettings = {
  defaults: { values: Thresholds; isSeed: boolean };
  products: { productId: string; isSeed: boolean; override: ThresholdOverride | null }[];
};

export type ThresholdsWriteResult = { ok: true } | { ok: false; reason: "product_not_found" };

function toOverride(row: {
  minVisits: number | null;
  killMaxConversion: number | null;
  scaleMinConversion: number | null;
  scaleRequiresPositiveMargin: boolean | null;
}): ThresholdOverride {
  return {
    minVisits: row.minVisits,
    killMaxConversion: row.killMaxConversion,
    scaleMinConversion: row.scaleMinConversion,
    scaleRequiresPositiveMargin: row.scaleRequiresPositiveMargin,
  };
}

// BO-09's read side of `/admin/settings` (admin-gated, uncached: an admin
// editing the thresholds always sees the row it is about to write, unlike
// the public, cached `getThresholds` above).
export async function getThresholdSettings(): Promise<ThresholdSettings> {
  await requireAdmin();

  const defaultRow = await db.query.decisionThresholds.findFirst({
    where: isNull(decisionThresholds.productId),
  });
  if (!defaultRow) throw new Error("default thresholds missing");
  const parsedDefault = defaultThresholdsRowSchema.safeParse(defaultRow);
  if (!parsedDefault.success) throw new Error("default thresholds row incomplete");

  const productRows = await db.select({ id: products.id, isSeed: products.isSeed }).from(products);
  const overrideRows = await db.query.decisionThresholds.findMany({
    where: isNotNull(decisionThresholds.productId),
  });
  const overrideByProductId = new Map(overrideRows.map((row) => [row.productId as string, row]));

  return {
    defaults: { values: parsedDefault.data, isSeed: defaultRow.isSeed },
    products: productRows.map((product) => {
      const override = overrideByProductId.get(product.id);
      return { productId: product.id, isSeed: product.isSeed, override: override ? toOverride(override) : null };
    }),
  };
}

// docs/07's `numeric(5,4)` stores 4 decimals; compares rounded to the same
// precision so a value merely re-saved unchanged is treated as equal to
// the default, never stored as a spurious override.
const RATE_SCALE = 1e4;
function sameRate(a: number, b: number): boolean {
  return Math.round(a * RATE_SCALE) === Math.round(b * RATE_SCALE);
}

// BO-09's diff-against-default override storage (plan design decision 2):
// `minVisits` and `scaleRequiresPositiveMargin` are stored only when they
// differ from the default; the two conversions are stored as a pair (both
// or neither) so an override can never silently pair one edited rate with
// the studio's own other rate and violate `kill < scale` behind the
// admin's back. All 4 null means "no override left": the row is deleted.
function buildOverrideValues(
  candidate: ThresholdsInput,
  defaults: Thresholds,
): {
  minVisits: number | null;
  killMaxConversion: number | null;
  scaleMinConversion: number | null;
  scaleRequiresPositiveMargin: boolean | null;
} {
  const conversionsDiffer =
    !sameRate(candidate.killMaxConversion, defaults.killMaxConversion) ||
    !sameRate(candidate.scaleMinConversion, defaults.scaleMinConversion);
  return {
    minVisits: candidate.minVisits === defaults.minVisits ? null : candidate.minVisits,
    killMaxConversion: conversionsDiffer ? candidate.killMaxConversion : null,
    scaleMinConversion: conversionsDiffer ? candidate.scaleMinConversion : null,
    scaleRequiresPositiveMargin:
      candidate.scaleRequiresPositiveMargin === defaults.scaleRequiresPositiveMargin
        ? null
        : candidate.scaleRequiresPositiveMargin,
  };
}

function isAllNull(values: {
  minVisits: number | null;
  killMaxConversion: number | null;
  scaleMinConversion: number | null;
  scaleRequiresPositiveMargin: boolean | null;
}): boolean {
  return (
    values.minVisits === null &&
    values.killMaxConversion === null &&
    values.scaleMinConversion === null &&
    values.scaleRequiresPositiveMargin === null
  );
}

// BO-09's save, for the studio defaults (`productId === null`) or a single
// product's override. `values` is already Zod-valid (`ThresholdsInput`,
// `kill < scale`); this function re-validates it (a DAL function is never
// the only line of defense, CLAUDE.md) and lets a `ZodError` propagate to
// the caller.
export async function saveThresholds(
  productId: string | null,
  values: ThresholdsInput,
): Promise<ThresholdsWriteResult> {
  const session = await requireAdmin();
  const parsed = thresholdsInputSchema.parse(values);

  if (productId === null) {
    await db.transaction(async (tx) => {
      const [row] = await tx
        .select()
        .from(decisionThresholds)
        .where(isNull(decisionThresholds.productId))
        .for("update");
      if (!row) throw new Error("saveThresholds: default thresholds row missing");
      assertEditable(row);
      await tx
        .update(decisionThresholds)
        .set({
          minVisits: parsed.minVisits,
          killMaxConversion: parsed.killMaxConversion,
          scaleMinConversion: parsed.scaleMinConversion,
          scaleRequiresPositiveMargin: parsed.scaleRequiresPositiveMargin,
          updatedBy: session.user.id,
          updatedAt: new Date(),
        })
        .where(isNull(decisionThresholds.productId));
    });
    return { ok: true };
  }

  return db.transaction(async (tx) => {
    const [productRow] = await tx.select().from(products).where(eq(products.id, productId)).for("update");
    if (!productRow) return { ok: false, reason: "product_not_found" as const };
    assertEditable(productRow);

    // Locked too (review round, DB MEDIUM): without `.for("update")` here, a
    // concurrent default save (which does lock this row) could commit its
    // own new default in between this read and this override's insert,
    // leaving the diff computed against a stale default — this blocks
    // until that other transaction commits and reads its fresh values.
    const [defaultRow] = await tx
      .select()
      .from(decisionThresholds)
      .where(isNull(decisionThresholds.productId))
      .for("update");
    if (!defaultRow) throw new Error("saveThresholds: default thresholds row missing");
    const defaults = defaultThresholdsRowSchema.parse(defaultRow);

    const overrideValues = buildOverrideValues(parsed, defaults);
    if (isAllNull(overrideValues)) {
      await tx.delete(decisionThresholds).where(eq(decisionThresholds.productId, productId));
      return { ok: true };
    }

    await tx
      .insert(decisionThresholds)
      .values({ productId, ...overrideValues, updatedBy: session.user.id })
      .onConflictDoUpdate({
        target: decisionThresholds.productId,
        set: { ...overrideValues, updatedBy: session.user.id, updatedAt: new Date() },
      });
    return { ok: true };
  });
}

// BO-09's « Réinitialiser » (spec bullet 2): deletes the product's override
// row so it falls back to the studio defaults. Idempotent: a product with
// no override row returns `{ ok: true }` too.
export async function resetThresholds(productId: string): Promise<ThresholdsWriteResult> {
  await requireAdmin();
  return db.transaction(async (tx) => {
    const [productRow] = await tx.select().from(products).where(eq(products.id, productId)).for("update");
    if (!productRow) return { ok: false, reason: "product_not_found" as const };
    assertEditable(productRow);
    await tx.delete(decisionThresholds).where(eq(decisionThresholds.productId, productId));
    return { ok: true };
  });
}
