import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getProductDraft, listThemeOptions } from "@/lib/dal/product-editor";
import { isEditable } from "@/lib/dal/guards";
import { requireAdmin } from "@/lib/dal/session";
import type { ProductConfig } from "@/lib/schemas/product-config";
import { Skeleton } from "@/components/ui/skeleton";
import type { ProductDraft } from "../../_components/product-form/form-values";
import { ProductForm } from "../../_components/product-form/product-form";

// A client-only id is added to each input row for React keys (form-values.ts).
function toDraft(config: ProductConfig): ProductDraft {
  return { ...config, inputs: config.inputs.map((input) => ({ ...input, id: crypto.randomUUID() })) };
}

// BO-05a (specs/BO-05a-formulaire.md): same Suspense + own `requireAdmin()`
// shape as the `new` page (plan's orchestrator decision 6). `notFound()`
// for an unknown slug (docs/02-ecrans.md), `readOnly` for a seeded,
// demo-locked product (docs/01-produit.md › Mode démo public).
async function EditProductForm({ slug }: { slug: string }) {
  await requireAdmin();
  const [draft, themes] = await Promise.all([getProductDraft(slug), listThemeOptions()]);
  if (!draft) notFound();

  return (
    <ProductForm
      mode="edit"
      slug={slug}
      initialDraft={toDraft(draft.config)}
      themes={themes}
      readOnly={!isEditable({ isSeed: draft.isSeed })}
      draftVersion={draft.version}
      publishedVersion={draft.publishedVersion}
    />
  );
}

export default async function EditProductPage({ params }: PageProps<"/admin/products/[slug]/edit">) {
  const { slug } = await params;
  return (
    <main className="p-6">
      <h1 className="mb-6 text-xl font-semibold">Modifier le produit</h1>
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <EditProductForm slug={slug} />
      </Suspense>
    </main>
  );
}
