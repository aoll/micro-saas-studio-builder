import { getTranslations } from "next-intl/server";
import { listThemeOptions } from "@/lib/dal/product-editor";
import { listProducts } from "@/lib/dal/products";
import { EmptyState } from "@/components/shared/empty-state";
import { ThemeCard } from "./theme-card";
import { productsByTheme } from "./theme-usage";

// BO-07 (specs/BO-07-themes.md): the async data component, guarded and
// laid out by page.tsx (plan's design decision 6). Both DAL reads run in
// parallel; a rejection from either propagates to the caller, never caught
// (plan's design decision 6, task 4 last bullet).
//
// I18N-BACKOFFICE-STRINGS (lot 7): the admin's ambient locale (the
// admin_locale cookie, branch 3 of i18n/request.ts), read once here and
// passed down to every ThemeCard — mirrors pricing/page.tsx.
export async function ThemeLibrary() {
  const [themes, products, t] = await Promise.all([
    listThemeOptions(),
    listProducts(),
    getTranslations("backoffice-themes"),
  ]);

  if (themes.length === 0) {
    return <EmptyState title={t("library.empty")} />;
  }

  const grouped = productsByTheme(products);

  return (
    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {themes.map((theme) => (
        <li key={theme.id} className="flex">
          <ThemeCard theme={theme} productNames={grouped.get(theme.id) ?? []} t={t} />
        </li>
      ))}
    </ul>
  );
}
