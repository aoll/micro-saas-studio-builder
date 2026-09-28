import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { listThemeOptions } from "@/lib/dal/product-editor";
import { listProducts } from "@/lib/dal/products";
import { productsByTheme } from "../../_components/theme-usage";
import { ThemeEditor } from "./theme-editor";
import { UsageWarning } from "./usage-warning";

// BO-08 (specs/BO-08-editeur-theme.md): the editor's async data component,
// guarded and laid out by page.tsx (plan's design decisions 3 and 9),
// mirroring BO-07's ThemeLibrary. The editor's own read is uncached
// (`listThemeOptions().find`, plan's orchestrator decision 4): the admin who
// just saved must see the fresh row, and `getTheme` (the cached, tagged
// read used by the sub-app) stays untouched.
//
// I18N-BACKOFFICE-STRINGS (lot 7): `t` is resolved here (ambient locale,
// like ThemeLibrary) and passed to UsageWarning, a fellow Server Component
// — but never to ThemeEditor, a 'use client' component: a function prop
// cannot cross that boundary (only a Server Action can), so ThemeEditor
// resolves its own translations client-side via useTranslations().
export async function ThemeEditorLoader({ id }: { id: string }) {
  const [themes, products, t] = await Promise.all([
    listThemeOptions(),
    listProducts(),
    getTranslations("backoffice-themes"),
  ]);
  const theme = themes.find((candidate) => candidate.id === id);
  if (!theme) notFound();

  const productNames = productsByTheme(products).get(theme.id) ?? [];

  return (
    <div className="grid gap-6">
      <h1 className="text-xl font-semibold">{t("editor.title", { name: theme.name })}</h1>
      <UsageWarning productNames={productNames} t={t} />
      <ThemeEditor theme={theme} sampleProductName={productNames[0]} />
    </div>
  );
}
