import { Suspense } from "react";
import { requireAdmin } from "@/lib/dal/session";
import { Skeleton } from "@/components/ui/skeleton";
import { ThemeEditorLoader } from "./_components/theme-editor-loader";

// BO-08 (specs/BO-08-editeur-theme.md): same Suspense + own `requireAdmin()`
// shape as the other admin pages (docs/04-nextjs.md): `params` is awaited
// inside the Suspense-wrapped component, not the page itself, so reading it
// does not block the whole route from being prerendered.
async function GuardedThemeEditor({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  return <ThemeEditorLoader id={id} />;
}

export default function ThemeEditorPage({ params }: PageProps<"/admin/themes/[id]">) {
  return (
    <main className="p-6">
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <GuardedThemeEditor params={params} />
      </Suspense>
    </main>
  );
}
