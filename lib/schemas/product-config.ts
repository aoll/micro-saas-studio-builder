import { z } from "zod";
import { packSchema } from "./pack";

// Slugs reserved by the routing (docs/09-arborescence.md › Deux pièges
// relevés en lisant la doc): `[app]` captures every top-level segment, so a
// product cannot use a name that collides with a static route or a
// public/ entry served without an extension.
export const RESERVED_SLUGS = ["admin", "api"] as const;

const MIN_SLUG_LENGTH = 2;
const MAX_SLUG_LENGTH = 60;
const MAX_NAME_LENGTH = 60;
const MAX_SEO_TITLE_LENGTH = 60;
const MAX_SEO_DESCRIPTION_LENGTH = 160;
const MIN_INPUTS = 1;
// Exported: reused by lib/schemas/inputs.ts to bound generateInputSchema's
// `input` record to the number of fields a product can actually declare.
export const MAX_INPUTS = 10;

export const slugSchema = z
  .string()
  .min(MIN_SLUG_LENGTH)
  .max(MAX_SLUG_LENGTH)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "slug must be lowercase, kebab-case")
  .refine((slug) => !(RESERVED_SLUGS as readonly string[]).includes(slug), {
    error: "slug is reserved",
  });

export const productStatusSchema = z.enum(["test", "learn", "scale", "killed"]);
export type ProductStatus = z.infer<typeof productStatusSchema>;

export const localeSchema = z.enum(["fr", "en"]);

export const inputFieldSchema = z.object({
  key: z.string().regex(/^[a-z][a-z0-9_]*$/, "key must start with a lowercase letter"),
  label: z.string().min(1),
  type: z.enum(["text", "textarea", "select"]),
  required: z.boolean(),
  options: z.array(z.string().min(1)).optional(),
  maxLength: z.int().positive().optional(),
});

// Extracts the deduplicated list of `{{variable}}` names referenced by a
// prompt template, in order of first appearance.
export function templateVariables(template: string): string[] {
  const matches = template.matchAll(/\{\{\s*([a-z][a-z0-9_]*)\s*\}\}/g);
  const seen = new Set<string>();
  for (const match of matches) {
    const name = match[1];
    if (name) seen.add(name);
  }
  return [...seen];
}

const brandingSchema = z.object({
  logoUrl: z.url().optional(),
  primaryColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "must be a #rrggbb color")
    .optional(),
});

const faqEntrySchema = z.object({
  question: z.string().min(1),
  answer: z.string().min(1),
});

const landingStepSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
});

const landingSchema = z.object({
  headline: z.string().min(1),
  subheadline: z.string().min(1),
  faq: z.array(faqEntrySchema),
  seoTitle: z.string().min(1).max(MAX_SEO_TITLE_LENGTH),
  seoDescription: z.string().min(1).max(MAX_SEO_DESCRIPTION_LENGTH),
  exampleOutput: z.string().optional(),
  steps: z.array(landingStepSchema).optional(),
});

const generationSchema = z.object({
  model: z.string().min(1),
  fallbackModels: z.array(z.string().regex(/^[a-z0-9-]+\/[a-z0-9.-]+$/i, "must be `provider/model`")).optional(),
  systemPrompt: z.string().optional(),
  promptTemplate: z.string().min(1),
  outputType: z.enum(["markdown", "image"]),
});

const pricingSchema = z.object({
  freeCreditsOnSignup: z.int().min(0),
  anonymousFreeGenerations: z.int().min(0),
  costPerGeneration: z.int().min(1),
  packs: z.array(packSchema).min(1),
});

// Unrefined base shape first: Zod 4 throws on `.pick`/`.omit`/`.extend` of a
// refined object (Zod 4 release notes), so the cross-field checks below are
// added last, with `.superRefine`.
const productConfigBaseSchema = z.object({
  slug: slugSchema,
  name: z.string().min(1).max(MAX_NAME_LENGTH),
  status: productStatusSchema,
  themeId: z.uuid(),
  locale: localeSchema,
  branding: brandingSchema,
  landing: landingSchema,
  inputs: z.array(inputFieldSchema).min(MIN_INPUTS).max(MAX_INPUTS),
  generation: generationSchema,
  pricing: pricingSchema,
});

function addDuplicateIssues(
  ctx: z.RefinementCtx,
  values: string[],
  pathFor: (index: number) => (string | number)[],
  message: string,
) {
  const seen = new Set<string>();
  values.forEach((value, index) => {
    if (seen.has(value)) {
      ctx.addIssue({ code: "custom", message, path: pathFor(index) });
    } else {
      seen.add(value);
    }
  });
}

// The single Zod schema that validates the backoffice form, types the
// database and drives the sub-app's rendering (docs/01-produit.md ›
// Configuration d'un produit).
export const productConfigSchema = productConfigBaseSchema.superRefine((config, ctx) => {
  const fieldKeys = new Set(config.inputs.map((input) => input.key));
  for (const variable of templateVariables(config.generation.promptTemplate)) {
    if (!fieldKeys.has(variable)) {
      ctx.addIssue({
        code: "custom",
        message: `Variable {{${variable}}} sans champ correspondant`,
        path: ["generation", "promptTemplate"],
      });
    }
  }

  addDuplicateIssues(
    ctx,
    config.inputs.map((input) => input.key),
    (index) => ["inputs", index, "key"],
    "key must be unique",
  );

  config.inputs.forEach((input, index) => {
    if (input.type === "select" && (!input.options || input.options.length === 0)) {
      ctx.addIssue({
        code: "custom",
        message: "a select field needs at least one option",
        path: ["inputs", index, "options"],
      });
    }
  });

  addDuplicateIssues(
    ctx,
    config.pricing.packs.map((pack) => pack.id),
    (index) => ["pricing", "packs", index, "id"],
    "pack id must be unique",
  );
});

export type ProductConfig = z.infer<typeof productConfigSchema>;
