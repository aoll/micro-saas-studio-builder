import "server-only";
import { isNull, or, eq } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { decisionThresholds } from "@/lib/db/schema";

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
