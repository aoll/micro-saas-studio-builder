import { ProductNotFound } from "@/app/(products)/_components/product-not-found";

// SA-08: reached for a missing page under an *active* product (a deeper
// page's own `notFound()`), the one case this segment's not-found still
// serves (specs/SA-08-introuvable.md, plan round 2, decision 4). The
// product-level cases (unknown slug, `killed` product) are served by
// `app/(products)/not-found.tsx` instead: the root layout's `notFound()`
// call never renders through this file, only through the parent segment's
// (task 1's spike, outcome 3 — see app/(products)/[app]/layout.tsx's and
// app/(products)/not-found.tsx's comments). All the content and its data
// fetch live in `ProductNotFound`, shared by both files.
export default async function NotFound() {
  return <ProductNotFound />;
}
