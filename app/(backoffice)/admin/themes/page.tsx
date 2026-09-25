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

export default function ThemesPage() {
  return (
    <main className="p-6">
      <h1 className="mb-6 text-xl font-semibold">Bibliothèque de thèmes</h1>
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <GuardedThemeLibrary />
      </Suspense>
    </main>
  );
}
