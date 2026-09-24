import { useTranslations } from "next-intl";
import type { Route } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";

// SA-01 (specs/SA-01-landing.md): hero section, all copy read from the
// product config, the CTA generic (`landing.hero.cta`).
export function Hero({
  slug,
  headline,
  subheadline,
  eyebrow,
  anonymousFreeGenerations,
  align = "start",
}: {
  slug: string;
  headline: string;
  subheadline: string;
  eyebrow: string;
  anonymousFreeGenerations: number;
  align?: "start" | "center";
}) {
  const t = useTranslations("landing");

  return (
    <div data-align={align} className={align === "center" ? "text-center" : undefined}>
      <p className="text-sm font-medium text-muted-foreground">{eyebrow}</p>
      <h1 className="text-4xl font-bold tracking-tight text-balance">{headline}</h1>
      <p className="mt-4 text-lg text-balance text-muted-foreground">{subheadline}</p>
      <div className="mt-6 flex flex-col items-start gap-2">
        {/* /{slug}/tool does not exist yet (SA-02); drop the cast once it ships. */}
        <Button asChild size="lg">
          <Link href={`/${slug}/tool` as Route}>{t("hero.cta")}</Link>
        </Button>
        {anonymousFreeGenerations > 0 ? (
          <p className="text-sm text-muted-foreground">{t("hero.freeHint", { count: anonymousFreeGenerations })}</p>
        ) : null}
      </div>
    </div>
  );
}
