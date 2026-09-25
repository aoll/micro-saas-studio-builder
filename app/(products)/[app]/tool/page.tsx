import { notFound } from "next/navigation";
import { getProduct } from "@/lib/dal/products";
import { ToolForm } from "./_components/tool-form";

// SA-02: the outil's shell (title, form) is entirely derived from the
// product's config — no cookies or session read here, so this page stays
// in the static shell (docs/04-nextjs.md's rendering table); only the
// balance badge in the layout's header streams.
export default async function ToolPage({ params }: PageProps<"/[app]/tool">) {
  const { app } = await params;
  const product = await getProduct(app);
  if (!product) notFound();

  return (
    <div className="mx-auto grid max-w-2xl gap-6 p-6">
      <h1 className="text-2xl font-semibold">{product.name}</h1>
      <ToolForm slug={product.slug} inputs={product.inputs} costPerGeneration={product.pricing.costPerGeneration} />
    </div>
  );
}
