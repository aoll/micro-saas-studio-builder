import { useFormatter, useTranslations } from "next-intl";
import Link from "next/link";
import type { Product } from "@/lib/dal/products";
import { Button } from "@/components/ui/button";
import { PackCard } from "@/components/product/pack-card";

// SA-04 (docs/02-ecrans.md): the packs of the product config, each with a
// buy link to checkout (SA-05, decision 1 of the plan: one link per card,
// not the mockup's select-then-buy). Shared between the full page
// (pricing/page.tsx) and the intercepted modal (@modal/(.)pricing/page.tsx),
// hence no <h1> here: the page owns the title, RouteModal owns the modal's.
export function PricingContent({ slug, pricing }: { slug: string; pricing: Product["pricing"] }) {
  const t = useTranslations("pricing");
  const format = useFormatter();

  return (
    // QA1-P1-B3 (.claude/plans/QA1-P1-B3.plan.md, step 4): the marker
    // CheckoutFlow looks for (main [data-slot="pricing-content"]) to tell
    // whether the checkout modal sits over the full /pricing page — the one
    // background where a router refresh mid-modal reproduces B3 (see
    // checkout-flow.tsx). Present only when this component renders inside
    // the layout's <main>, i.e. the full page, not the (.)pricing modal.
    <div data-slot="pricing-content" className="grid gap-6">
      <p className="text-muted-foreground">{t("subtitle")}</p>
      <div className="grid gap-4">
        {pricing.packs.map((pack) => (
          <PackCard
            key={pack.id}
            pack={pack}
            costPerGeneration={pricing.costPerGeneration}
            action={
              <Button asChild variant={pack.recommended ? "default" : "outline"} className="w-full">
                <Link
                  href={`/${slug}/checkout/${pack.id}`}
                  aria-label={t("buyLabel", {
                    count: pack.credits,
                    price: format.number(pack.priceCents / 100, { style: "currency", currency: "EUR" }),
                  })}
                >
                  {t("buy")}
                </Link>
              </Button>
            }
          />
        ))}
      </div>
      <p className="text-sm text-muted-foreground">{t("note")}</p>
      <ul className="grid gap-1 text-sm text-muted-foreground">
        <li>{t("benefits.history")}</li>
        <li>{t("benefits.refund")}</li>
      </ul>
    </div>
  );
}
