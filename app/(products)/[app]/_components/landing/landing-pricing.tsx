import { useTranslations } from "next-intl";
import Link from "next/link";
import type { Pack } from "@/lib/schemas/pack";
import { Button } from "@/components/ui/button";
import { PackCard } from "@/components/product/pack-card";

// SA-01: pricing / paywall preview on the landing (docs/02-ecrans.md ›
// SA-04's packs, reused here). Every action links to the tool page:
// generating is what starts the credits flow (SA-02).
export function LandingPricing({
  slug,
  packs,
  costPerGeneration,
  freeCreditsOnSignup,
}: {
  slug: string;
  packs: Pack[];
  costPerGeneration: number;
  freeCreditsOnSignup: number;
}) {
  const t = useTranslations("landing");

  return (
    <div>
      <h2 className="font-medium">{t("pricing.title")}</h2>
      {freeCreditsOnSignup > 0 ? (
        <p className="mt-1 text-sm text-muted-foreground">{t("pricing.signupBonus", { count: freeCreditsOnSignup })}</p>
      ) : null}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {packs.map((pack) => (
          <PackCard
            key={pack.id}
            pack={pack}
            costPerGeneration={costPerGeneration}
            action={
              <Button asChild variant="outline" className="w-full">
                <Link href={`/${slug}/tool`}>{t("pricing.cta")}</Link>
              </Button>
            }
          />
        ))}
      </div>
    </div>
  );
}
