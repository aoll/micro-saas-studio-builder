import { useTranslations } from "next-intl";
import type { Route } from "next";
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
      <p className="font-medium">{t("pricing.title")}</p>
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
                {/* /{slug}/tool does not exist yet (SA-02); drop the cast once it ships. */}
                <Link href={`/${slug}/tool` as Route}>{t("pricing.cta")}</Link>
              </Button>
            }
          />
        ))}
      </div>
    </div>
  );
}
