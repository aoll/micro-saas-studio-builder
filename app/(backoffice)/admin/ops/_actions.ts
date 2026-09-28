"use server";

import { getTranslations } from "next-intl/server";
import { updateTag } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { listThemeOptions } from "@/lib/dal/product-editor";
import { listProducts } from "@/lib/dal/products";
import { requireAdmin } from "@/lib/dal/session";
import type { ProductConfig } from "@/lib/schemas/product-config";
// The one accepted exception to "only lib/dal touches the database"
// (docs/09, plan's orchestrator decision 7): scripts/reset-demo.ts owns
// its own Postgres client, exactly like scripts/seed.ts, so it stays
// usable from the CLI (`pnpm tsx scripts/reset-demo.ts`) and from here.
import { resetDemo } from "@/scripts/reset-demo";

export type ResetDemoState = { ok?: boolean; error?: string };
type Locale = ProductConfig["locale"];

// BO-01's admin/ops page (specs/DEMO-mode.md): owner-only, re-checked here
// too (a Server Action is a public POST endpoint, CLAUDE.md), never just
// on the page. `listProducts`/`listThemeOptions` are read *before*
// resetDemo runs, so every slug and seeded theme that existed a moment
// ago (visitor-created products included) gets its cache tag cleared too,
// not only the ones that survive the reset.
// I18N-BACKOFFICE-STRINGS (spec "Server Actions"): `locale` is bound
// client-side by ResetForm (useLocale()) as the first argument, right
// after requireAdmin() — never before it (require-admin-coverage.test.ts's
// convention: the guard stays the action's first call).
export async function resetDemoAction(
  locale: Locale,
  _prevState: ResetDemoState,
  _formData: FormData,
): Promise<ResetDemoState> {
  const session = await requireAdmin();
  const t = await getTranslations({ locale, namespace: "backoffice-portfolio" });
  if (session.user.role !== "owner") {
    return { error: t("ops.ownerOnlyError") };
  }

  try {
    const [productsBefore, themes] = await Promise.all([listProducts(), listThemeOptions()]);

    await resetDemo();

    updateTag("products");
    updateTag("thresholds");
    for (const product of productsBefore) updateTag(`product:${product.slug}`);
    for (const theme of themes.filter((candidate) => candidate.isSeed)) updateTag(`theme:${theme.id}`);

    return { ok: true };
  } catch (err) {
    unstable_rethrow(err);
    console.error("[admin/ops] resetDemoAction failed", err);
    return { error: t("ops.failedError") };
  }
}
