import { z } from "zod";

// A credit pack, as it lives in `product_versions.config.pricing.packs`
// (docs/07-modele-de-donnees.md). A purchase copies `credits` and
// `priceCents` from the pack at the time of the purchase.
export const packSchema = z.object({
  id: z
    .string()
    .min(1)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "id must be a kebab-case slug"),
  credits: z.int().positive(),
  priceCents: z.int().positive(),
  recommended: z.boolean().optional(),
});

export type Pack = z.infer<typeof packSchema>;
