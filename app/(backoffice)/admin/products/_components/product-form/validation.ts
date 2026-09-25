import { randomUUID } from "node:crypto";
import type { z } from "zod";
import { productConfigSchema, type ProductConfig } from "@/lib/schemas/product-config";
import { DEFAULT_GENERATION, DEFAULT_PRICING } from "./form-values";

// BO-05's step index (docs/02-ecrans.md › BO-05 en détail): every field of
// `productConfigSchema` belongs to exactly one step of this spec's four
// (5 and 6 are BO-05b's, kept here so a stray issue on those fields still
// routes somewhere instead of being silently dropped).
export function stepOfPath(path: readonly PropertyKey[]): number {
  switch (path[0]) {
    case "themeId":
    case "branding":
      return 2;
    case "landing":
      return 3;
    case "inputs":
      return 4;
    case "generation":
      return 5;
    case "pricing":
      return 6;
    case "slug":
    case "name":
    case "status":
    case "locale":
    default:
      return 1;
  }
}

// A structurally valid config: every step's fields pass on their own, so
// merging a single step's patch on top of it keeps the whole object valid
// except for whatever the patch itself breaks. Necessary because Zod 4
// skips `.superRefine` entirely when the base object already has issues
// (the duplicate-key and unused-variable checks live in `productConfigSchema`'s
// `.superRefine`): validating a step in isolation, on top of an otherwise
// empty draft, would silently hide those cross-field errors.
const VALID_BASELINE: ProductConfig = {
  slug: "produit-exemple",
  name: "Produit exemple",
  status: "test",
  themeId: randomUUID(),
  locale: "fr",
  branding: {},
  landing: {
    headline: "Un titre qui donne envie",
    subheadline: "Un sous-titre clair",
    faq: [],
    seoTitle: "Produit exemple",
    seoDescription: "Description SEO du produit exemple.",
  },
  inputs: [{ key: "sujet", label: "Sujet", type: "text", required: true }],
  generation: DEFAULT_GENERATION,
  pricing: DEFAULT_PRICING,
};

// Known messages translated to French: the schema's own `.refine`/`.regex`
// messages (in English, shared with the runtime) and a few Zod built-ins
// that read oddly translated generically.
const FRENCH_MESSAGES: Record<string, string> = {
  "slug is reserved": "Ce slug est réservé",
  "slug must be lowercase, kebab-case": "Le slug doit être en minuscules, séparé par des tirets",
  "key must be unique": "Clé déjà utilisée",
  "pack id must be unique": "Identifiant de pack déjà utilisé",
  "a select field needs at least one option": "Un champ liste déroulante doit avoir au moins une option",
  "key must start with a lowercase letter": "La clé doit commencer par une lettre minuscule",
  "must be `provider/model`": "Doit être au format « fournisseur/modèle »",
  "must be a #rrggbb color": "Doit être une couleur au format #rrggbb",
  "id must be a kebab-case slug": "Doit être un identifiant en minuscules, séparé par des tirets",
};

// Translates a Zod issue to the message shown next to a field. Falls back
// to the map above for custom/format issues whose message this schema
// already writes in English, and to the raw message for anything else
// (an as-yet-untranslated Zod built-in), so nothing is ever silently
// dropped.
export function toFrenchMessage(issue: z.core.$ZodIssue): string {
  if (issue.code === "too_big" && issue.origin === "string") return `${issue.maximum} caractères maximum`;
  if (issue.code === "too_small" && issue.origin === "string") {
    return issue.minimum === 1 ? "Ce champ est requis" : `${issue.minimum} caractères minimum`;
  }
  return FRENCH_MESSAGES[issue.message] ?? issue.message;
}

// First French message per dotted path (e.g. `"inputs.1.key"`), shared by
// `validateStep` and the `saveProduct` Server Action so both report the
// same wording for the same issue.
export function issuesToErrors(issues: readonly z.core.$ZodIssue[]): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of issues) {
    const path = issue.path.join(".");
    if (path in errors) continue;
    errors[path] = toFrenchMessage(issue);
  }
  return errors;
}

// Validates one step's patch on top of `VALID_BASELINE`, returning only
// the issues that belong to that step, keyed by their dotted path (e.g.
// `"inputs.1.key"`), first message wins per path.
export function validateStep(step: number, patch: Partial<ProductConfig>): Record<string, string> {
  const merged = { ...VALID_BASELINE, ...patch };
  const result = productConfigSchema.safeParse(merged);
  if (result.success) return {};

  return issuesToErrors(result.error.issues.filter((issue) => stepOfPath(issue.path) === step));
}
