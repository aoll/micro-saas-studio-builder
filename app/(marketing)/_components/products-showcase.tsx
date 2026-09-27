import Link from "next/link";
import { ArrowRightIcon, PlusIcon } from "lucide-react";
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
        Chacun est une configuration du même socle, servie sur sa propre URL : cliquez une carte pour l&apos;essayer en
        direct.
      </p>
      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {products.map((product) => (
          <Link
            key={product.slug}
            href={`/${product.slug}`}
            className="group block rounded-xl border bg-card p-6 shadow-sm transition-colors hover:bg-accent"
          >
            <h3 className="font-semibold">{product.name}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{product.landing.headline}</p>
            <p className="mt-4 flex items-center gap-1 text-sm font-medium">
              Essayer en direct
              <ArrowRightIcon aria-hidden="true" className="size-4 transition-transform group-hover:translate-x-0.5" />
            </p>
          </Link>
        ))}
        <Link
          href="/admin/login"
          className="group block rounded-xl border border-dashed p-6 text-center transition-colors hover:bg-accent"
        >
          <PlusIcon aria-hidden="true" className="mx-auto size-5 text-muted-foreground" />
          <h3 className="mt-2 font-semibold">Créer un nouveau produit</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Un formulaire dans le backoffice suffit pour en lancer un nouveau, en quelques minutes.
          </p>
        </Link>
      </div>
    </section>
  );
}
