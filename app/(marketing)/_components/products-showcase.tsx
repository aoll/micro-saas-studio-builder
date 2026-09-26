import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";
import { listProducts } from "@/lib/dal/products";

// Public showcase of the studio's live products: `listProducts()` is the
// same public, cached, `products`-tagged read used by app/sitemap.ts and
// SA-08's "other products" list (app/(products)/_components/product-not-found.tsx),
// so this section stays in sync with the backoffice without a redeploy — a
// product created live during a demo, or a reset, shows up on its own. It
// never reads status or business metrics: those come from
// `getPortfolioMetrics`, which requires an admin session and has no place on
// a public page.
export async function ProductsShowcase() {
  const products = (await listProducts())
    .filter((product) => product.status !== "killed")
    .sort((a, b) => a.name.localeCompare(b.name, "fr"));

  if (products.length === 0) return null;

  return (
    <section id="produits" className="mx-auto max-w-5xl px-4 py-16">
      <h2 className="text-center text-2xl font-bold tracking-tight">Les produits du studio</h2>
      <p className="mx-auto mt-2 max-w-xl text-center text-muted-foreground">
        Chacun est une configuration du même socle, servie sur sa propre URL.
      </p>
      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {products.map((product) => (
          <Link
            key={product.slug}
            href={`/${product.slug}`}
            className="group block rounded-xl border bg-card p-6 shadow-sm transition-colors hover:bg-accent"
          >
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-semibold">{product.name}</h3>
              <ArrowRightIcon
                aria-hidden="true"
                className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
              />
            </div>
            <p className="mt-2 text-sm text-muted-foreground">{product.landing.headline}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
