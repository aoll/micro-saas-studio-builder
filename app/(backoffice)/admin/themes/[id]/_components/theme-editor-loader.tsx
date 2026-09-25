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
export async function ThemeEditorLoader({ id }: { id: string }) {
  const [themes, products] = await Promise.all([listThemeOptions(), listProducts()]);
  const theme = themes.find((candidate) => candidate.id === id);
  if (!theme) notFound();

  const productNames = productsByTheme(products).get(theme.id) ?? [];

  return (
    <div className="grid gap-6">
      <h1 className="text-xl font-semibold">Thème · {theme.name}</h1>
      <UsageWarning productNames={productNames} />
      <ThemeEditor theme={theme} sampleProductName={productNames[0]} />
    </div>
  );
}
