import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getProductDraft, listThemeOptions } from "@/lib/dal/product-editor";
import { requireAdmin } from "@/lib/dal/session";
import { Skeleton } from "@/components/ui/skeleton";
import { fromConfig } from "../../_components/product-form/form-values";
import { ProductForm } from "../../_components/product-form/product-form";

// BO-05a (specs/BO-05a-formulaire.md): same Suspense + own `requireAdmin()`
// shape as the `new` page (plan's orchestrator decision 6). `notFound()`
// for an unknown slug (docs/02-ecrans.md).
//
// `params` is awaited inside this Suspense-wrapped component, not in the
// page itself: reading it outside `<Suspense>` blocks the whole route from
// being prerendered (docs/04-nextjs.md's Cache Components model).
async function EditProductForm({ params }: { params: Promise<{ slug: string }> }) {
  await requireAdmin();
  const { slug } = await params;
  const [draft, themes] = await Promise.all([getProductDraft(slug), listThemeOptions()]);
  if (!draft) notFound();

  return (
    <ProductForm
      mode="edit"
      slug={slug}
      initialDraft={fromConfig(draft.config)}
      themes={themes}
      draftVersion={draft.version}
      publishedVersion={draft.publishedVersion}
    />
  );
}

export default function EditProductPage({ params }: PageProps<"/admin/products/[slug]/edit">) {
  return (
    <main className="p-6">
      <h1 className="mb-6 text-xl font-semibold">Modifier le produit</h1>
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <EditProductForm params={params} />
      </Suspense>
    </main>
  );
}
