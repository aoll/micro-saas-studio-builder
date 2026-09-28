import { getTranslations } from "next-intl/server";

// docs/01-produit.md's "Pourquoi pour Dotworld" and docs/00-accueil.md's
// "Pourquoi ce projet", condensed for the web.
export async function WhyThisDemo() {
  const t = await getTranslations("marketing.whyThisDemo");
  return (
    <section className="mx-auto grid max-w-6xl gap-6 px-4 pt-24 sm:px-8 lg:grid-cols-12 lg:gap-x-6">
      <div className="flex flex-col gap-2 lg:col-span-4">
        <p className="text-[13px] font-semibold text-mk-link">{t("eyebrow")}</p>
        <h2 className="font-[family-name:var(--font-mk-display)] text-3xl font-extrabold tracking-[-0.03em] sm:text-4xl">
          {t("title")}
        </h2>
      </div>
      <p className="text-lg leading-relaxed sm:text-xl lg:col-span-8">{t("description")}</p>
    </section>
  );
}
