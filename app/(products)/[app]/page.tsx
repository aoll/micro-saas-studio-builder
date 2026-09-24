import { notFound } from "next/navigation";
import { getProduct } from "@/lib/dal/products";

export default async function ProductPage({ params }: PageProps<"/[app]">) {
  const { app } = await params;
  const product = await getProduct(app);
  if (!product) notFound();

  return <h1>{product.name}</h1>;
}
