"use server";

import { randomUUID } from "node:crypto";
import { put } from "@vercel/blob";
import { updateTag } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { env } from "@/lib/env";
import { createProduct, isSlugAvailable, listThemeOptions, saveVersion } from "@/lib/dal/product-editor";
import { requireAdmin } from "@/lib/dal/session";
import { productConfigSchema, slugSchema } from "@/lib/schemas/product-config";
import { detectImageType, IMAGE_EXTENSIONS, type DetectedImageType } from "./_components/product-form/image-signature";
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

export async function saveProduct(
  slug: string | null,
  _prevState: SaveProductState,
  formData: FormData,
): Promise<SaveProductState> {
  await requireAdmin();

  let candidate: unknown;
  try {
    candidate = JSON.parse(String(formData.get("config") ?? ""));
  } catch {
    return { formError: "Configuration illisible" };
  }

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
