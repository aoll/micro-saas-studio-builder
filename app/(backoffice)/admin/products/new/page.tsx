import { Suspense } from "react";
import { listThemeOptions } from "@/lib/dal/product-editor";
import { requireAdmin } from "@/lib/dal/session";
import { Skeleton } from "@/components/ui/skeleton";
import { newProductDraft } from "../_components/product-form/form-values";
import { ProductForm } from "../_components/product-form/product-form";

// BO-05a (specs/BO-05a-formulaire.md): data reads live inside a
// `<Suspense>`-wrapped inner component (docs/04-nextjs.md), and every
// admin page re-checks `requireAdmin()` on its own (plan's orchestrator
// decision 6), even though the `(backoffice)` layout also gates access.
async function NewProductForm() {
  await requireAdmin();
  const themes = await listThemeOptions();
  return <ProductForm mode="create" slug={null} initialDraft={newProductDraft(themes[0]?.id ?? "")} themes={themes} />;
}

export default function NewProductPage() {
  return (
    <main className="p-6">
      <h1 className="mb-6 text-xl font-semibold">Nouveau produit</h1>
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <NewProductForm />
      </Suspense>
    </main>
  );
}
