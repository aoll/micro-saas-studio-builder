import { z } from "zod";
import { eventTypeSchema } from "./event-type";
import { packSchema } from "./pack";
import { MAX_INPUTS, productStatusSchema } from "./product-config";

// Same key format as inputFieldSchema.key (product-config.ts): a field key
// is always a lowercase identifier.
const inputFieldKeySchema = z.string().regex(/^[a-z][a-z0-9_]*$/, "key must start with a lowercase letter");

// Input schemas of the Server Actions and Route Handlers of later specs
// (CLAUDE.md: "Every Server Action and Route Handler re-checks auth and
// parses input with the shared Zod schema from lib/schemas/"). Frozen here
// per specs/CONTRACT-types.md so no later spec needs lib/schemas in its
// Périmètre.

// SA-02 `api/generate`: the per-field check against `config.inputs` happens
// in the route, from the product config; this schema only bounds the shape
// and rejects an oversized payload before that comparison runs — a product
// declares at most MAX_INPUTS fields (product-config.ts), so the record
// can never legitimately carry more keys.
export const generateInputSchema = z.object({
  input: z
    .record(inputFieldKeySchema, z.string().max(5000))
    .refine((input) => Object.keys(input).length <= MAX_INPUTS, {
      error: `at most ${MAX_INPUTS} input keys`,
    }),
  idempotencyKey: z.uuid(),
});
export type GenerateInput = z.infer<typeof generateInputSchema>;

// SA-03 signup (magic link).
export const signupInputSchema = z.object({
  email: z.email(),
});
export type SignupInput = z.infer<typeof signupInputSchema>;

// SA-05 purchase: a pack id is only unique within a product, so `purchase`
// itself also takes `productId` (see lib/dal/credits.ts).
export const purchaseInputSchema = z.object({
  packId: packSchema.shape.id,
  idempotencyKey: z.uuid(),
});
export type PurchaseInput = z.infer<typeof purchaseInputSchema>;

// TRACKING beacon (`api/events`): the product comes from the route's
// `[app]`, not from the body. `metadata` is public, unauthenticated input
// (sendBeacon, docs/04-nextjs.md), so it is bounded: at most 10 keys, each
// at most 40 characters, and a string value at most 200 characters.
const metadataValueSchema = z.union([z.string().max(200), z.number(), z.boolean(), z.null()]);
export const trackEventInputSchema = z.object({
  type: eventTypeSchema,
  anonymousId: z.uuid(),
  metadata: z
    .record(z.string().max(40), metadataValueSchema)
    .refine((metadata) => Object.keys(metadata).length <= 10, { error: "at most 10 metadata keys" })
    .optional(),
});
export type TrackEventInput = z.infer<typeof trackEventInputSchema>;

// BO-06 status change.
export const statusChangeInputSchema = z.object({
  status: productStatusSchema,
  note: z.string().max(500).nullable(),
});
export type StatusChangeInput = z.infer<typeof statusChangeInputSchema>;

// BO-09 decision thresholds. Mirrors docs/07's
// `CHECK (kill_max_conversion < scale_min_conversion)`; BO-05's mockup
// (docs/02-ecrans.md): "Erreur si « à couper » ≥ « à scaler »".
export const thresholdsInputSchema = z
  .object({
    minVisits: z.int().min(0),
    killMaxConversion: z.number().min(0).max(1),
    scaleMinConversion: z.number().min(0).max(1),
    scaleRequiresPositiveMargin: z.boolean(),
  })
  .refine((thresholds) => thresholds.killMaxConversion < thresholds.scaleMinConversion, {
    error: "scaleMinConversion must be greater than killMaxConversion",
    path: ["scaleMinConversion"],
  });
export type ThresholdsInput = z.infer<typeof thresholdsInputSchema>;
