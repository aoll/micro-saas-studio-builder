import type { z } from "zod";
import { productConfigSchema, type ProductConfig } from "@/lib/schemas/product-config";
import frMessages from "@/messages/fr/backoffice-product-form-b2.json";
import { DEFAULT_GENERATION, DEFAULT_PRICING } from "./form-values";

// I18N-BACKOFFICE-STRINGS (lot 6): the admin's locale. Re-exported so
// _actions.ts (and any future caller) shares a single definition instead of
// redeclaring `"fr" | "en"`.
export type Locale = ProductConfig["locale"];

// A translator compatible with both next-intl's `useTranslations()` (client
// components: product-form.tsx, this file's own callers) and the awaited
// result of `getTranslations()` (Server Actions, _actions.ts): both return a
// callable of at least this shape (plus `.rich`/`.raw`/`.has`, unused here).
// Kept as our own minimal type rather than importing next-intl's (whose
// generic per-key argument checking can't apply to a value threaded through
// a plain function parameter like this one).
export type MessageTranslator = (key: string, values?: Record<string, string | number>) => string;

// Default translator, used when a caller doesn't pass one (e.g.
// import-config.ts, lot 4's own file, which validates a pasted config
// outside any admin-locale context): reads the very same fr messages a real
// `t` would resolve, from this zone's committed JSON, so the fallback can
// never drift from the real French wording. `{min}`/`{max}`/… are the only
// ICU construct used in this zone (no plurals), so a plain
// find-and-replace is enough — no ICU engine needed for this pass-through.
function interpolate(template: string, values?: Record<string, string | number>): string {
  if (!values) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => (name in values ? String(values[name]) : match));
}

function readMessage(key: string): string | undefined {
  const node = key.split(".").reduce<unknown>((current, segment) => {
    return typeof current === "object" && current !== null ? (current as Record<string, unknown>)[segment] : undefined;
  }, frMessages);
  return typeof node === "string" ? node : undefined;
}

const defaultTranslator: MessageTranslator = (key, values) => interpolate(readMessage(key) ?? key, values);

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
  themeId: crypto.randomUUID(),
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

// Known Zod issue messages (English, shared with the runtime schema) mapped
// to this zone's `validation.*` translation keys (messages/{fr,en}/
// backoffice-product-form-b2.json) — a few Zod built-ins that read oddly
// translated generically are covered too.
const MESSAGE_KEYS: Record<string, string> = {
  "slug is reserved": "validation.slugReserved",
  "slug must be lowercase, kebab-case": "validation.slugFormat",
  "key must be unique": "validation.keyAlreadyUsed",
  "pack id must be unique": "validation.packIdAlreadyUsed",
  "a select field needs at least one option": "validation.selectNeedsOption",
  "key must start with a lowercase letter": "validation.keyMustStartLowercase",
  "must be `provider/model`": "validation.modelFormat",
  "must be a #rrggbb color": "validation.colorFormat",
  "id must be a kebab-case slug": "validation.idFormat",
};

// Translates a Zod issue to the message shown next to a field, via `t`
// (I18N-BACKOFFICE-STRINGS: a real `useTranslations`/`getTranslations`
// result from the caller, or `defaultTranslator` — kept a parameter with a
// default rather than imported directly, so this pure function stays
// testable and usable outside any next-intl context, e.g. import-config.ts,
// lot 4's own file). Falls back to the map above for custom/format issues
// whose message this schema already writes in English, and to the raw
// message for anything else (an as-yet-untranslated Zod built-in), so
// nothing is ever silently dropped.
export function toFrenchMessage(issue: z.core.$ZodIssue, t: MessageTranslator = defaultTranslator): string {
  if (issue.code === "too_big" && issue.origin === "string") {
    return t("validation.maxChars", { max: Number(issue.maximum) });
  }
  if (issue.code === "too_small" && issue.origin === "string") {
    return issue.minimum === 1
      ? t("validation.fieldRequired")
      : t("validation.minChars", { min: Number(issue.minimum) });
  }
  // QA1-P5-E2: every bounded numeric field (`z.int().min(…)`, `.positive()`,
  // a future `.max(…)`) reports a translated message instead of Zod's raw
  // "Too small: expected number to be >=…" — `inclusive` tells whether the
  // reported bound itself is allowed (`.min`) or not (`.positive`).
  if (issue.code === "too_small" && issue.origin === "number") {
    return issue.inclusive
      ? t("validation.minNumberInclusive", { min: Number(issue.minimum) })
      : t("validation.minNumberExclusive", { min: Number(issue.minimum) });
  }
  if (issue.code === "too_big" && issue.origin === "number") {
    return issue.inclusive
      ? t("validation.maxNumberInclusive", { max: Number(issue.maximum) })
      : t("validation.maxNumberExclusive", { max: Number(issue.maximum) });
  }
  if (issue.code === "invalid_type" && issue.expected === "int") return t("validation.mustBeInteger");
  const key = MESSAGE_KEYS[issue.message];
  return key ? t(key) : issue.message;
}

// First message per dotted path (e.g. `"inputs.1.key"`), shared by
// `validateStep` and the `saveProduct`/`publish` Server Actions so both
// report the same wording for the same issue.
export function issuesToErrors(
  issues: readonly z.core.$ZodIssue[],
  t: MessageTranslator = defaultTranslator,
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of issues) {
    const path = issue.path.join(".");
    if (path in errors) continue;
    errors[path] = toFrenchMessage(issue, t);
  }
  return errors;
}

// Validates one step's patch on top of `VALID_BASELINE`, returning only
// the issues that belong to that step, keyed by their dotted path (e.g.
// `"inputs.1.key"`), first message wins per path.
export function validateStep(
  step: number,
  patch: Partial<ProductConfig>,
  t: MessageTranslator = defaultTranslator,
): Record<string, string> {
  const merged = { ...VALID_BASELINE, ...patch };
  const result = productConfigSchema.safeParse(merged);
  if (result.success) return {};

  return issuesToErrors(
    result.error.issues.filter((issue) => stepOfPath(issue.path) === step),
    t,
  );
}
