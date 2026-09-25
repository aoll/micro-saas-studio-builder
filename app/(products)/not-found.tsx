import "@/app/globals.css";
import { app } from "next/root-params";
import { getProduct } from "@/lib/dal/products";
import { ProductNotFound } from "@/app/(products)/_components/product-not-found";

// SA-08 (specs/SA-08-introuvable.md, plan round 2, decisions 3-5): a
// `notFound()` thrown by app/(products)/[app]/layout.tsx (unknown slug or
// `killed` product) is rendered by *this* parent segment's not-found, not
// by [app]/not-found.tsx — confirmed on a clean build in a browser (task
// 1's spike, outcome 3; `global-not-found` only serves unmatched URLs like
// `/`). This file provides the full <html> document Next requires at this
// level; the SA-08 content itself lives in the shared ProductNotFound
// component. Known limit, stated in the PR: on this path the server HTML
// is an empty shell and the page renders client-side (same as Next's own
// 404); the HTTP status is still a real 404.
export default async function RootNotFound() {
  const slug = await app();
  const product = slug ? await getProduct(slug) : null;
  // Called directly, not as `<ProductNotFound />`: real React DOM (jsdom in
  // tests) can't render an async function component, only Next's RSC
  // renderer can — calling it here keeps this file's own not-found.test.tsx
  // able to render the result with @testing-library/react.
  const content = await ProductNotFound();

  return (
    <html lang={product?.locale ?? "fr"}>
      <body className="flex min-h-dvh flex-col">{content}</body>
    </html>
  );
}
