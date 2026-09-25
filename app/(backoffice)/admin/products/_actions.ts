"use server";

import { randomUUID } from "node:crypto";
import { put } from "@vercel/blob";
import { updateTag } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { toolInputSchema } from "@/app/(products)/[app]/tool/_lib/tool-input-schema";
import { costMicros, streamGeneration, type GenerationUsage } from "@/lib/ai/generate";
import {
  createProduct,
  getProductDraft,
  isSlugAvailable,
  listThemeOptions,
  publishProduct,
  saveVersion,
} from "@/lib/dal/product-editor";
import { requireAdmin } from "@/lib/dal/session";
import { env } from "@/lib/env";
import { guardRequest } from "@/lib/security";
import { generateInputSchema } from "@/lib/schemas/inputs";
import { productConfigSchema, slugSchema, templateVariables } from "@/lib/schemas/product-config";
import { detectImageType, IMAGE_EXTENSIONS, type DetectedImageType } from "./_components/product-form/image-signature";
import { MODEL_CATALOGUE_VALUES } from "./_components/product-form/model-catalogue";
import { issuesToErrors, stepOfPath } from "./_components/product-form/validation";

// BO-05a (specs/BO-05a-formulaire.md): one Server Action per domain
// (CLAUDE.md), used by both `/admin/products/new` (slug === null) and
// `/admin/products/[slug]/edit` (bound slug, `.bind(null, slug)` from the
// page). The form posts the already-cleaned config (product-form's
// `toConfig`) as a single JSON field: one shared schema, validated again
// here since a Server Action is a public POST endpoint (CLAUDE.md).
export type SaveProductState = {
  ok?: boolean;
  slug?: string;
  version?: number;
  errors?: Record<string, string>;
  step?: number;
  formError?: string;
};

const MAX_LOGO_BYTES = 512 * 1024;
const ALLOWED_LOGO_TYPES = new Set<DetectedImageType>(["image/png", "image/jpeg", "image/webp"]);

function isUniqueSlugViolation(err: unknown): boolean {
  return typeof err === "object" && err !== null && "code" in err && (err as { code?: unknown }).code === "23505";
}

// Shared by every action below that reads the form's "config" hidden field
// (product-form.tsx): unreadable JSON is a form-level error, not a
// validation issue on a specific field.
function parseConfigForm(formData: FormData): { ok: true; candidate: unknown } | { ok: false; formError: string } {
  try {
    return { ok: true, candidate: JSON.parse(String(formData.get("config") ?? "")) };
  } catch {
    return { ok: false, formError: "Configuration illisible" };
  }
}

// Security review (LOW): `generation.model`'s frozen schema only checks
// `z.string().min(1)` (lib/schemas/product-config.ts), so `testPrompt` and
// `publish` — both public POST endpoints — enforce the picker's own
// catalogue (model-catalogue.ts) themselves. The one exception is the
// model already stored on the product being edited: the picker shows it
// too (generation-step.tsx's modelOptions()), so a draft that hasn't
// touched step 5 yet must still be re-testable/re-publishable.
async function isAllowedModel(model: string, slug: string | null): Promise<boolean> {
  if (MODEL_CATALOGUE_VALUES.includes(model)) return true;
  if (slug === null) return false;
  const draft = await getProductDraft(slug);
  return draft?.config.generation.model === model;
}

export async function saveProduct(
  slug: string | null,
  _prevState: SaveProductState,
  formData: FormData,
): Promise<SaveProductState> {
  await requireAdmin();

  const parsedForm = parseConfigForm(formData);
  if (!parsedForm.ok) return { formError: parsedForm.formError };
  const candidate = parsedForm.candidate;

  const parsed = productConfigSchema.safeParse(candidate);
  if (!parsed.success) {
    const step = Math.min(...parsed.error.issues.map((issue) => stepOfPath(issue.path)));
    return { errors: issuesToErrors(parsed.error.issues), step };
  }
  const config = parsed.data;

  const themeOptions = await listThemeOptions();
  if (!themeOptions.some((theme) => theme.id === config.themeId)) {
    return { errors: { themeId: "Thème introuvable" }, step: 2 };
  }

  try {
    if (slug === null) {
      if (!(await isSlugAvailable(config.slug))) {
        return { errors: { slug: "Ce slug est déjà utilisé" }, step: 1 };
      }
      const result = await createProduct(config);
      updateTag("products");
      updateTag(`product:${result.slug}`);
      return { ok: true, slug: result.slug, version: result.version };
    }

    if (!slugSchema.safeParse(slug).success) {
      return { formError: "Slug invalide" };
    }
    const result = await saveVersion(slug, config);
    if (!result) return { formError: "Produit introuvable" };
    return { ok: true, slug: result.slug, version: result.version };
  } catch (err) {
    unstable_rethrow(err);
    if (isUniqueSlugViolation(err)) {
      return { errors: { slug: "Ce slug est déjà utilisé" }, step: 1 };
    }
    console.error("[admin/products] saveProduct failed", err);
    throw err;
  }
}

// BO-05 step 1's live slug check, called on blur/typing from the client
// (docs/02-ecrans.md).
export async function checkSlug(candidate: string): Promise<{ available: boolean; error?: string }> {
  await requireAdmin();
  const parsed = slugSchema.safeParse(candidate);
  if (!parsed.success) {
    const reserved = parsed.error.issues.some((issue) => issue.message === "slug is reserved");
    return { available: false, error: reserved ? "Ce slug est réservé" : "Format de slug invalide" };
  }
  const available = await isSlugAvailable(parsed.data);
  return { available, error: available ? undefined : "Ce slug est déjà utilisé" };
}

// BO-05 step 2's logo upload (docs/06-vercel.md › Blob).
export async function uploadLogo(
  _prevState: { url?: string; error?: string },
  formData: FormData,
): Promise<{ url?: string; error?: string }> {
  await requireAdmin();

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Aucun fichier reçu" };
  }
  if (file.size > MAX_LOGO_BYTES) {
    return { error: "Le logo dépasse 512 Ko" };
  }

  // Never trust the client-declared `file.type` (any file can be labelled
  // `image/png`): the real format is read from the file's own magic bytes.
  const bytes = new Uint8Array(await file.arrayBuffer());
  const detectedType = detectImageType(bytes);
  if (!detectedType || !ALLOWED_LOGO_TYPES.has(detectedType)) {
    return { error: "Formats acceptés : PNG, JPEG, WebP" };
  }

  try {
    // Never use the client-supplied file name for the blob pathname
    // either: a random name with the detected type's own extension.
    const pathname = `logos/${randomUUID()}.${IMAGE_EXTENSIONS[detectedType]}`;
    const blob = await put(pathname, file, {
      access: "public",
      addRandomSuffix: true,
      contentType: detectedType,
      token: env.BLOB_READ_WRITE_TOKEN,
    });
    return { url: blob.url };
  } catch (err) {
    console.error("[admin/products] uploadLogo failed", err);
    return { error: "Échec de l'envoi du logo" };
  }
}

export type TestPromptState = {
  ok?: boolean;
  output?: string;
  inputTokens?: number;
  outputTokens?: number;
  costMicros?: number;
  error?: string;
};

// The form waits for streamGeneration's callbacks rather than for
// `consumeStream()` alone (see below): this bounds that wait so a stuck
// mock or a misbehaving provider still returns to the admin.
const TEST_PROMPT_TIMEOUT_MS = 20_000;

// BO-05 step 5's « Tester le prompt » (docs/02-ecrans.md): a generation
// run from the backoffice, without touching credits or `generations`
// (docs/05-ia.md's `testPrompt` row: "Appel IA sans débit"). Reads the
// same "config" field as `saveProduct`/`publish`, but only needs its
// `inputs` and `generation` parts to be valid — the rest of the draft can
// still have errors on other steps.
export async function testPrompt(
  slug: string | null,
  _prevState: TestPromptState,
  formData: FormData,
): Promise<TestPromptState> {
  await requireAdmin();

  const guard = await guardRequest("test-prompt");
  if (!guard.ok) {
    return { error: "Trop de tests pour le moment, réessayez dans un instant." };
  }

  const parsedForm = parseConfigForm(formData);
  if (!parsedForm.ok) return { error: parsedForm.formError };
  const candidate = parsedForm.candidate as { inputs?: unknown; generation?: unknown };

  const inputsResult = productConfigSchema.shape.inputs.safeParse(candidate.inputs);
  if (!inputsResult.success) return { error: "Les champs de l'outil sont invalides" };
  const generationResult = productConfigSchema.shape.generation.safeParse(candidate.generation);
  if (!generationResult.success) return { error: "La configuration de génération est invalide" };
  const inputs = inputsResult.data;
  const generation = generationResult.data;

  if (!(await isAllowedModel(generation.model, slug))) {
    return { error: "Modèle non autorisé" };
  }

  const fieldKeys = new Set(inputs.map((field) => field.key));
  for (const variable of templateVariables(generation.promptTemplate)) {
    if (!fieldKeys.has(variable)) {
      return { error: `Variable {{${variable}}} sans champ correspondant` };
    }
  }

  // Bonus per docs/01 (image output), out of this spec's Périmètre (plan's
  // orchestrator decision 5): shown disabled in the picker, refused here
  // too rather than silently mis-handled as markdown.
  if (generation.outputType === "image") {
    return { error: "La sortie image n'est pas encore disponible" };
  }

  let sampleCandidate: unknown;
  try {
    sampleCandidate = JSON.parse(String(formData.get("sample") ?? "{}"));
  } catch {
    return { error: "Échantillon illisible" };
  }
  const sampleResult = generateInputSchema.shape.input.safeParse(sampleCandidate);
  if (!sampleResult.success) return { error: "Échantillon invalide" };

  const fields = toolInputSchema(inputs, sampleResult.data);
  if (!fields.success) return { error: "Complétez les champs obligatoires de l'échantillon" };

  // `resolveModel` (lib/ai/model.ts) picks a mock fixture by slug in
  // AI_MODE=mock; a brand-new product (create mode, no slug yet) falls
  // back to the same default fixture as an unknown slug.
  const effectiveSlug = slug ?? "test-prompt-draft";

  let settle!: (state: TestPromptState) => void;
  const settled = new Promise<TestPromptState>((resolvePromise) => {
    settle = resolvePromise;
  });

  const result = streamGeneration({
    product: { slug: effectiveSlug, generation },
    inputs: fields.data,
    onSuccess: (generationResult) => {
      settle({
        ok: true,
        output:
          typeof generationResult.output === "string"
            ? generationResult.output
            : JSON.stringify(generationResult.output),
        inputTokens: generationResult.inputTokens,
        outputTokens: generationResult.outputTokens,
        costMicros: generationResult.costMicros,
      });
    },
    onError: (error) => {
      console.error("[admin/products] testPrompt failed", error);
      settle({ error: "La génération de test a échoué" });
    },
  });

  // Registered with after() in the real generation route (api/generate);
  // here the action itself is the caller waiting on it, so it is awaited
  // directly instead.
  await result.consumeStream();

  const timeout = new Promise<TestPromptState>((resolveTimeout) => {
    setTimeout(() => resolveTimeout({ error: "La génération de test a échoué" }), TEST_PROMPT_TIMEOUT_MS);
  });

  return Promise.race([settled, timeout]);
}

// docs/05-ia.md's reference usage for BO-05 step 6's estimated margin,
// before any real test has run (the plan's orchestrator decision 2):
// ~1000 input / ~500 output tokens, the order of magnitude of the demo's
// text generations (docs/05: "1 000 / 600" for the largest example).
const REFERENCE_USAGE: GenerationUsage = { inputTokens: 1000, outputTokens: 500, cachedInputTokens: 0 };

// BO-05 step 6's margin panel, before "Tester le prompt" has run: no AI
// call, just the reference usage priced at the chosen model's rate
// (lib/ai/generate.ts's `costMicros`, which already prices an unrecognized
// model at the highest known rate rather than under-billing it).
export async function estimateGenerationCost(model: string): Promise<{ costMicros: number }> {
  await requireAdmin();
  return { costMicros: costMicros(model, REFERENCE_USAGE) };
}

export type PublishState = {
  ok?: boolean;
  slug?: string;
  version?: number;
  url?: string;
  errors?: Record<string, string>;
  step?: number;
  formError?: string;
};

// BO-05 step 7's « Publier » (docs/02-ecrans.md): "what you see goes live"
// (the plan's orchestrator decision 1) — saves the current form as a new
// version, then publishes that very version, in create mode as well as
// edit mode (a create-mode publish never requires a prior "Enregistrer").
// Same full-config validation as `saveProduct` (a product only goes live
// once every step is valid), plus `publishProduct`'s cache-visible move of
// `current_version`.
export async function publish(
  slug: string | null,
  _prevState: PublishState,
  formData: FormData,
): Promise<PublishState> {
  await requireAdmin();

  const parsedForm = parseConfigForm(formData);
  if (!parsedForm.ok) return { formError: parsedForm.formError };

  const parsed = productConfigSchema.safeParse(parsedForm.candidate);
  if (!parsed.success) {
    const step = Math.min(...parsed.error.issues.map((issue) => stepOfPath(issue.path)));
    return { errors: issuesToErrors(parsed.error.issues), step };
  }
  const config = parsed.data;

  const themeOptions = await listThemeOptions();
  if (!themeOptions.some((theme) => theme.id === config.themeId)) {
    return { errors: { themeId: "Thème introuvable" }, step: 2 };
  }

  if (!(await isAllowedModel(config.generation.model, slug))) {
    return { errors: { "generation.model": "Modèle non autorisé" }, step: 5 };
  }

  try {
    let publishedSlug: string;
    let publishedVersion: number;

    if (slug === null) {
      if (!(await isSlugAvailable(config.slug))) {
        return { errors: { slug: "Ce slug est déjà utilisé" }, step: 1 };
      }
      const created = await createProduct(config);
      const published = await publishProduct(created.slug, created.version);
      if (!published) {
        // createProduct just returned this very (id, version): publishProduct
        // not finding it would be a database inconsistency, not a normal
        // "not found" the admin can act on.
        throw new Error(
          `publish: publishProduct(${created.slug}, ${created.version}) returned null right after createProduct`,
        );
      }
      publishedSlug = published.slug;
      publishedVersion = published.version;
    } else {
      if (!slugSchema.safeParse(slug).success) {
        return { formError: "Slug invalide" };
      }
      const saved = await saveVersion(slug, config);
      if (!saved) return { formError: "Produit introuvable" };
      const published = await publishProduct(slug, saved.version);
      if (!published) {
        throw new Error(`publish: publishProduct(${slug}, ${saved.version}) returned null right after saveVersion`);
      }
      publishedSlug = published.slug;
      publishedVersion = published.version;
    }

    updateTag("products");
    updateTag(`product:${publishedSlug}`);
    return { ok: true, slug: publishedSlug, version: publishedVersion, url: `/${publishedSlug}` };
  } catch (err) {
    unstable_rethrow(err);
    if (isUniqueSlugViolation(err)) {
      return { errors: { slug: "Ce slug est déjà utilisé" }, step: 1 };
    }
    console.error("[admin/products] publish failed", err);
    throw err;
  }
}
