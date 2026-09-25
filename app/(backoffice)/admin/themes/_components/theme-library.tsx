import { listThemeOptions } from "@/lib/dal/product-editor";
import { listProducts } from "@/lib/dal/products";
import { EmptyState } from "@/components/shared/empty-state";
import { ThemeCard } from "./theme-card";
import { productsByTheme } from "./theme-usage";

// BO-07 (specs/BO-07-themes.md): the async data component, guarded and
// laid out by page.tsx (plan's design decision 6). Both DAL reads run in
// parallel; a rejection from either propagates to the caller, never caught
// (plan's design decision 6, task 4 last bullet).
export async function ThemeLibrary() {
  const [themes, products] = await Promise.all([listThemeOptions(), listProducts()]);

  if (themes.length === 0) {
    return <EmptyState title="Aucun thème en base" />;
  }

  const grouped = productsByTheme(products);

  return (
    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {themes.map((theme) => (
        <li key={theme.id}>
          <ThemeCard theme={theme} productNames={grouped.get(theme.id) ?? []} />
        </li>
      ))}
    </ul>
  );
}
