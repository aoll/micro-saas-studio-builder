import Image from "next/image";
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
// a public page. Each card previews its product with the product's own Open
// Graph image (app/(products)/[app]/opengraph-image.tsx): name and headline
// on the product's theme colours, already prerendered per slug, so a product
// created live gets its preview too.
export async function ProductsShowcase() {
  const products = (await listProducts())
    .filter((product) => product.status !== "killed")
    .sort((a, b) => a.name.localeCompare(b.name, "fr"));

  if (products.length === 0) return null;

  return (
    <section id="produits" className="mx-auto flex max-w-6xl flex-col gap-8 px-4 pt-24 sm:px-8">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div className="flex flex-col gap-2">
          <p className="text-[13px] font-semibold text-mk-link">En ligne</p>
          <h2 className="font-[family-name:var(--font-mk-display)] text-3xl font-extrabold tracking-[-0.03em] sm:text-4xl">
            Les produits du studio
          </h2>
        </div>
        <p className="max-w-md leading-relaxed text-mk-muted">
          Chacun est une configuration du même socle, servie sur sa propre URL : cliquez une carte pour l&apos;essayer
          en direct.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {products.map((product) => (
          <Link
            key={product.slug}
            href={`/${product.slug}`}
            className="group flex flex-col overflow-hidden mk-card bg-mk-surface transition-colors hover:border-mk-dash"
          >
            <Image
              src={`/${product.slug}/opengraph-image`}
              alt=""
              width={1200}
              height={630}
              sizes="(min-width: 1024px) 18rem, (min-width: 640px) 50vw, 100vw"
              className="aspect-[1200/630] w-full border-b border-mk-line object-cover"
            />
            <div className="flex flex-1 flex-col items-start gap-3 p-5">
              <span className="rounded-full bg-mk-chip px-2.5 py-0.5 font-[family-name:var(--font-mk-mono)] text-xs text-mk-chip-ink">
                /{product.slug}
              </span>
              <h3 className="font-[family-name:var(--font-mk-display)] text-xl font-bold">{product.name}</h3>
              <p className="flex-1 text-[15px] leading-relaxed text-mk-muted">{product.landing.headline}</p>
              <p className="flex items-center gap-1 text-sm font-bold text-mk-link">
                Essayer en direct
                <ArrowRightIcon
                  aria-hidden="true"
                  className="size-4 transition-transform group-hover:translate-x-0.5"
                />
              </p>
            </div>
          </Link>
        ))}
        <Link
          href="/admin/login"
          className="group flex flex-col overflow-hidden rounded-xl border border-dashed border-mk-dash bg-mk-surface/40 transition-colors hover:bg-mk-surface/80"
        >
          <span className="flex aspect-[1200/630] w-full items-center justify-center border-b border-dashed border-mk-dash">
            <span className="mk-cta size-10">
              <PlusIcon aria-hidden="true" className="size-5" />
            </span>
          </span>
          <div className="flex flex-1 flex-col items-start gap-3 p-5">
            <h3 className="font-[family-name:var(--font-mk-display)] text-xl font-bold">Créer un nouveau produit</h3>
            <p className="flex-1 text-[15px] leading-relaxed text-mk-muted">
              Un formulaire dans le backoffice suffit pour en lancer un nouveau, en quelques minutes.
            </p>
            <p className="text-sm font-bold text-mk-chip-ink">Ouvrir le backoffice →</p>
          </div>
        </Link>
      </div>
    </section>
  );
}
