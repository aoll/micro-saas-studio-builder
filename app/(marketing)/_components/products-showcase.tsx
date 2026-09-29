import { getLocale, getTranslations } from "next-intl/server";
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
// created live gets its preview too. Since the image already shows them, the
// card doesn't repeat name and headline as text: they go to its alt text,
// built from the same product data. `/{slug}` and `/admin/login` are outside
// the marketing i18n routing (proxy.ts's R4), so they stay plain `next/link`.
export async function ProductsShowcase() {
  const [rows, locale, t] = await Promise.all([
    listProducts(),
    getLocale(),
    getTranslations("marketing.productsShowcase"),
  ]);
  const products = rows
    .filter((product) => product.status !== "killed")
    .sort((a, b) => a.name.localeCompare(b.name, locale));

  if (products.length === 0) return null;

  return (
    <section id="produits" className="mx-auto flex max-w-6xl flex-col gap-8 px-4 pt-24 sm:px-8">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div className="flex flex-col gap-2">
          <p className="text-[13px] font-semibold text-mk-link">{t("eyebrow")}</p>
          <h2 className="font-[family-name:var(--font-mk-display)] text-3xl font-extrabold tracking-[-0.03em] sm:text-4xl">
            {t("title")}
          </h2>
        </div>
        <p className="max-w-md leading-relaxed text-mk-muted">{t("description")}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {products.map((product) => (
          <Link
            key={product.slug}
            href={`/${product.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex flex-col overflow-hidden mk-card bg-mk-surface transition-colors hover:border-mk-dash"
          >
            <Image
              src={`/${product.slug}/opengraph-image`}
              alt={t("imageAlt", { name: product.name, headline: product.landing.headline })}
              width={1200}
              height={630}
              sizes="(min-width: 1024px) 18rem, (min-width: 640px) 50vw, 100vw"
              className="aspect-[1200/630] w-full border-b border-mk-line object-cover"
            />
            <div className="mt-auto flex flex-wrap items-center justify-between gap-2 p-4">
              <span className="rounded-full bg-mk-chip px-2.5 py-0.5 font-[family-name:var(--font-mk-mono)] text-xs text-mk-chip-ink">
                /{product.slug}
              </span>
              <span className="flex items-center gap-1 text-sm font-bold text-mk-link">
                {t("tryLive")}
                <ArrowRightIcon
                  aria-hidden="true"
                  className="size-4 transition-transform group-hover:translate-x-0.5"
                />
              </span>
            </div>
          </Link>
        ))}
        <Link
          href="/admin/login"
          className="group flex flex-col overflow-hidden rounded-xl border border-dashed border-mk-dash bg-mk-surface/40 transition-colors hover:bg-mk-surface/80"
        >
          <span className="flex aspect-[1200/630] w-full flex-col items-center justify-center gap-2 border-b border-dashed border-mk-dash p-4 text-center">
            <span className="mk-cta size-8">
              <PlusIcon aria-hidden="true" className="size-4" />
            </span>
            <span className="font-[family-name:var(--font-mk-display)] text-base font-bold">{t("createTitle")}</span>
            <span className="text-[13px] leading-snug text-mk-muted">{t("createDescription")}</span>
          </span>
          <span className="mt-auto p-4 text-sm font-bold text-mk-chip-ink">{t("createCta")}</span>
        </Link>
      </div>
    </section>
  );
}
