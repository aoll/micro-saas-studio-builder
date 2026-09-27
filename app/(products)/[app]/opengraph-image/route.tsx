import { listProductSlugs } from "@/lib/dal/products";
import OpengraphImage from "../opengraph-image";

// QA2-P1-B2 (specs/qa/QA2-P1-B2-og-icon-404.md): confirmed locally
// (`pnpm build && pnpm start`) that the real root cause has nothing to do
// with `generateStaticParams` or Cache Components. It's
// `next/dist/lib/metadata/get-metadata-route.js`'s `getMetadataRouteSuffix`:
// any Next.js metadata convention file (`icon.tsx`, `opengraph-image.tsx`,
// …) whose route sits under a route group like `(products)` gets a content
// hash appended to its *served* path (e.g. `/lettre-pro/opengraph-image`
// becomes `/lettre-pro/opengraph-image-1rxrqy`) — by design, to avoid
// collisions between same-named metadata files in different route groups.
// The `<meta property="og:image">` tag Next.js generates itself already
// points at that hashed path and works fine in a browser or for a real
// share-preview crawler that follows the tag — but the literal, documented
// URL (`/{slug}/opengraph-image`, no hash) 404s for anyone who requests it
// directly, which is exactly the QA report's `curl` repro.
//
// A plain, folder-based Route Handler (this file) isn't discovered by
// Next.js's metadata-file file-scanner (only a *file* literally named
// `opengraph-image.tsx` at the segment root is), so it never gets that
// hash suffix — confirmed by this route showing up (before its own
// `generateStaticParams` below was added) as `ƒ /[app]/opengraph-image` in
// the build output, alongside the original, still-hashed and already
// prerendered `● /[app]/opengraph-image-1rxrqy`. Delegating to the sibling
// `../opengraph-image` module (unchanged, still exports
// `generateStaticParams` and still auto-wires the `<meta>` tag) keeps a
// single implementation and avoids any regression on the working path,
// while this file makes the literal path itself respond too.

// Same reason as `../opengraph-image.tsx`'s own `generateStaticParams`
// (code review MEDIUM): without it, this Route Handler is dynamic (`ƒ`) on
// every request instead of prerendered per slug — confirmed by a fresh
// `pnpm build` now showing both `● /[app]/opengraph-image` and
// `● /[app]/opengraph-image-1rxrqy` as prerendered.
export async function generateStaticParams() {
  const slugs = await listProductSlugs();
  return slugs.map((app) => ({ app }));
}

export async function GET(_request: Request, context: RouteContext<"/[app]/opengraph-image">) {
  return OpengraphImage(context);
}
