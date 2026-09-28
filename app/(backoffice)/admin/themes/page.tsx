import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { requireAdmin } from "@/lib/dal/session";
import { Skeleton } from "@/components/ui/skeleton";
import { ThemeLibrary } from "./_components/theme-library";

// BO-07 (specs/BO-07-themes.md): read-only, no Server Action, no
// updateTag (plan's design decision 7). Same page shape as
// products/new/page.tsx (docs/04-nextjs.md): requireAdmin() re-checked
// inside the Suspense-wrapped inner component.
async function GuardedThemeLibrary() {
  await requireAdmin();
  return <ThemeLibrary />;
}

// I18N-BACKOFFICE-STRINGS (lot 7): the h1 is outside the Suspense boundary
// (it never depends on the DAL reads below it), so it is translated here,
// directly in the async page component — mirrors pricing/page.tsx (ambient
// locale, no explicit argument needed).
export default async function ThemesPage() {
  const t = await getTranslations("backoffice-themes");
  return (
    <main className="p-6">
      <h1 className="mb-6 text-xl font-semibold">{t("library.title")}</h1>
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <GuardedThemeLibrary />
      </Suspense>
    </main>
  );
}
