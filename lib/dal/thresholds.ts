import "server-only";

// Frozen contract (specs/CONTRACT-types.md): the merged (default + product
// override) decision thresholds (docs/07 › decision_thresholds), read by
// `lib/decision.ts`'s pure `evaluate(metrics, thresholds)`. Cached, tag
// `thresholds` (docs/11's contract table). Real in V1 (reads the seeded
// setting); only the write arrives with BO-09.
export type Thresholds = {
  minVisits: number;
  killMaxConversion: number;
  scaleMinConversion: number;
  scaleRequiresPositiveMargin: boolean;
};

export const getThresholds: (productId: string) => Promise<Thresholds> = async () => {
  throw new Error("not implemented");
};
