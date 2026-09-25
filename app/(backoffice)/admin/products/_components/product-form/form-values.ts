import type { ProductConfig } from "@/lib/schemas/product-config";

// The starting point for BO-05 steps 5 and 6 (GenerationStep, PricingStep)
// on a brand-new product: sensible defaults the admin edits from there.
// Also what a step-4 draft save falls back to before steps 5-6 have been
// touched at all, so the config stays valid end to end.
export const DEFAULT_GENERATION: ProductConfig["generation"] = {
  model: "anthropic/claude-haiku-4.5",
  promptTemplate: "Rédige une réponse claire et utile à partir des informations fournies.",
  outputType: "markdown",
};

export const DEFAULT_PRICING: ProductConfig["pricing"] = {
  freeCreditsOnSignup: 3,
  anonymousFreeGenerations: 1,
  costPerGeneration: 1,
  packs: [
    { id: "pack-10", credits: 10, priceCents: 490 },
    { id: "pack-50", credits: 50, priceCents: 1490, recommended: true },
  ],
};

// A field of step 4, with a client-only `id` for stable React keys: an
// input's `key` can change while the admin edits it (or briefly collide
// while typing), so the row's identity in the list cannot rely on it.
// `toConfig` strips this id back out before validation and save.
export type FieldDraft = ProductConfig["inputs"][number] & { id: string };

export type ProductDraft = Omit<ProductConfig, "inputs"> & { inputs: FieldDraft[] };

// The in-progress form state for a brand-new product (BO-05's "new"
// route). An edited product's draft comes from `getProductDraft` instead,
// mapped the same way (a client-only id added to each input row).
export function newProductDraft(themeId: string): ProductDraft {
  return {
    slug: "",
    name: "",
    status: "test",
    themeId,
    locale: "fr",
    branding: {},
    landing: { headline: "", subheadline: "", faq: [], seoTitle: "", seoDescription: "" },
    inputs: [{ id: crypto.randomUUID(), key: "champ_1", label: "Champ 1", type: "text", required: true }],
    generation: DEFAULT_GENERATION,
    pricing: DEFAULT_PRICING,
  };
}

function cleanBranding(branding: ProductConfig["branding"]): ProductConfig["branding"] {
  const cleaned: ProductConfig["branding"] = {};
  if (branding.logoUrl?.trim()) cleaned.logoUrl = branding.logoUrl.trim();
  if (branding.primaryColor?.trim()) cleaned.primaryColor = branding.primaryColor.trim();
  return cleaned;
}

function cleanField(field: FieldDraft): ProductConfig["inputs"][number] {
  const { id: _id, options, label, key, ...rest } = field;
  const cleanedOptions =
    field.type === "select" ? options?.map((option) => option.trim()).filter((option) => option.length > 0) : undefined;
  return {
    ...rest,
    key: key.trim(),
    label: label.trim(),
    ...(cleanedOptions ? { options: cleanedOptions } : {}),
  };
}

// Converts the form's draft into the shape `productConfigSchema` validates
// and the DAL stores: strips the client-only ids, trims text values, and
// drops values the schema would otherwise reject (an empty branding
// override, options on a non-select field, blank option lines). Never
// mutates its argument.
export function toConfig(draft: ProductDraft): ProductConfig {
  return {
    ...draft,
    name: draft.name.trim(),
    branding: cleanBranding(draft.branding),
    landing: {
      ...draft.landing,
      headline: draft.landing.headline.trim(),
      subheadline: draft.landing.subheadline.trim(),
      seoTitle: draft.landing.seoTitle.trim(),
      seoDescription: draft.landing.seoDescription.trim(),
    },
    inputs: draft.inputs.map(cleanField),
  };
}

// BO-05's up/down reordering (docs/02-ecrans.md): swaps an item with its
// neighbour, a no-op at either edge, always returning a new array.
export function moveItem<T>(items: T[], index: number, direction: "up" | "down"): T[] {
  const target = direction === "up" ? index - 1 : index + 1;
  if (target < 0 || target >= items.length) return items;
  const next = [...items];
  const [item] = next.splice(index, 1);
  // `index` itself may be out of range (e.g. beyond the array's length)
  // even when `target` lands in bounds: splice(index, 1) then removes
  // nothing and `item` is undefined. Splicing it back in would grow the
  // array with a hole instead of leaving it untouched.
  if (item === undefined) return items;
  next.splice(target, 0, item);
  return next;
}
