import { listProductSlugs } from "@/lib/dal/products";
import Icon from "../icon";

// QA2-P1-B2 (specs/qa/QA2-P1-B2-og-icon-404.md): same fix and same reason
// as `../opengraph-image/route.tsx` — see that file's comment for the full
// explanation of `getMetadataRouteSuffix` and why a plain, folder-based
// Route Handler escapes it while the special `icon.tsx` convention file
// (kept unchanged, still auto-wiring the `<link rel="icon">` tag) doesn't.

// Same reason as `../icon.tsx`'s own `generateStaticParams` (code review
// MEDIUM): without it, this Route Handler is dynamic (`ƒ`) on every
// request instead of prerendered per slug.
export async function generateStaticParams() {
  const slugs = await listProductSlugs();
  return slugs.map((app) => ({ app }));
}

export async function GET(_request: Request, context: RouteContext<"/[app]/icon">) {
  return Icon(context);
}
