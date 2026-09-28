import { getTranslations } from "next-intl/server";
import NextLink from "next/link";
import { Link } from "@/i18n/marketing-navigation";
import { HeroCta } from "./hero-cta";

// A product's life in the studio, shown next to the pitch: the status the
// backoffice drives each product through (docs/01-produit.md). `badge` is a
// styling concern, not text: it stays keyed by the same ids as
// messages/{fr,en}/marketing.json's `hero.stages`.
const STAGE_KEYS = [
  { id: "test", badge: "bg-mk-chip text-mk-chip-ink" },
  { id: "learn", badge: "bg-mk-chip text-mk-chip-ink" },
  { id: "scale", badge: "mk-cta" },
  { id: "killed", badge: "border border-mk-line text-mk-muted line-through" },
] as const;

// Static content, entirely pre-rendered: the first thing a recruiter opens
// should ship almost no JavaScript (docs/04-nextjs.md). The primary CTA
// scrolls to ProductsShowcase's `#produits` instead of linking to one
// specific slug, so this component stays independent from the product list.
// `/admin/login` and `#produits` are outside the marketing i18n routing
// (proxy.ts's R4), so they stay plain `next/link`; `/making-of` uses the
// marketing `Link` to keep the current locale's prefix. `#produits` is
// `HeroCta`, a client leaf (hero-cta.tsx): a plain href only scrolls when
// the hash actually changes, so a browser Back from a product page (hash
// already `#produits`) needs an unconditional scroll on click.
export async function Hero() {
  const t = await getTranslations("marketing.hero");
  return (
    <section className="mx-auto grid max-w-6xl gap-12 px-4 pt-16 pb-12 sm:px-8 lg:grid-cols-12 lg:items-center lg:pt-24">
      <div className="flex flex-col items-start gap-6 lg:col-span-7">
        <p className="inline-flex items-center gap-2 rounded-full border border-mk-line bg-mk-surface/70 px-3 py-1.5 text-[13px] font-medium text-mk-muted">
          <span aria-hidden="true" className="size-2 rounded-full bg-mk-rose" />
          {t("eyebrow")}
        </p>
        <h1 className="font-[family-name:var(--font-mk-display)] text-4xl leading-[1.04] font-extrabold tracking-[-0.035em] text-balance sm:text-6xl">
          {t("title")}
        </h1>
        <p className="max-w-xl text-lg leading-relaxed text-mk-muted">{t("description")}</p>
        <div className="flex flex-wrap gap-3">
          <HeroCta className="mk-cta min-h-12 px-5 text-[15px]">{t("ctaProduct")}</HeroCta>
          <NextLink href="/admin/login" className="mk-button min-h-12 px-5 text-[15px]">
            {t("ctaAdmin")}
          </NextLink>
        </div>
        <p className="text-sm leading-relaxed text-mk-muted">
          {t("demoNote")}
          <br />
          {t("buildNote")}{" "}
          <Link href="/making-of" className="font-semibold text-mk-link hover:underline">
            {t("makingOfLink")}
          </Link>
        </p>
      </div>

      <aside aria-label={t("lifecycleLabel")} className="flex flex-col gap-3 mk-card p-5 lg:col-span-4 lg:col-start-9">
        <div className="flex items-center justify-between text-[13px] font-semibold">
          {t("lifecycleLabel")}
          <span className="font-[family-name:var(--font-mk-mono)] text-xs font-normal text-mk-muted">/{"{slug}"}</span>
        </div>
        <ol className="flex flex-col gap-2">
          {STAGE_KEYS.map((stage) => (
            <li key={stage.id} className="flex items-center gap-3 rounded-xl bg-mk-subtle p-3 text-sm">
              <span className={`min-w-16 rounded-full px-2.5 py-1 text-center text-xs font-bold ${stage.badge}`}>
                {t(`stages.${stage.id}.status`)}
              </span>
              {t(`stages.${stage.id}.meaning`)}
            </li>
          ))}
        </ol>
      </aside>
    </section>
  );
}
