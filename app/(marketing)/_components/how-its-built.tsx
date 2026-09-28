import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/marketing-navigation";

// docs/01-produit.md's "Méthode de delivery agentique" and
// docs/13-candidature.md's README outline, condensed to what a recruiter
// scans in a few seconds rather than the full section aimed at an agent.
// Order only — text lives in messages/{fr,en}/marketing.json's
// `howItsBuilt.points`.
const POINT_IDS = ["specs", "tdd", "review"] as const;

export async function HowItsBuilt() {
  const t = await getTranslations("marketing.howItsBuilt");
  return (
    <section className="mx-auto max-w-6xl px-4 pt-24 sm:px-8">
      <div className="flex flex-col gap-8 rounded-[20px] border border-mk-line bg-mk-surface/60 p-6 sm:p-12">
        <div className="grid gap-4 lg:grid-cols-12 lg:items-end lg:gap-x-6">
          <div className="flex flex-col gap-2 lg:col-span-5">
            <p className="text-[13px] font-semibold text-mk-link">{t("eyebrow")}</p>
            <h2 className="font-[family-name:var(--font-mk-display)] text-3xl font-extrabold tracking-[-0.03em] sm:text-4xl">
              {t("title")}
            </h2>
          </div>
          <p className="text-lg leading-relaxed text-mk-muted lg:col-span-6 lg:col-start-7">{t("tagline")}</p>
        </div>
        <ol className="grid gap-4 lg:grid-cols-3">
          {POINT_IDS.map((id, index) => (
            <li key={id} className="flex flex-col gap-3 rounded-xl border border-mk-line bg-mk-surface p-6">
              <span className="flex size-9 items-center justify-center rounded-[10px] bg-mk-chip font-[family-name:var(--font-mk-display)] font-extrabold text-mk-chip-ink">
                {index + 1}
              </span>
              <p className="font-[family-name:var(--font-mk-display)] text-lg font-bold">{t(`points.${id}.title`)}</p>
              <p className="text-[15px] leading-relaxed text-mk-muted">{t(`points.${id}.description`)}</p>
            </li>
          ))}
        </ol>
        <div className="flex flex-wrap gap-3">
          <Link href="/making-of" className="mk-cta min-h-11 px-5 text-sm">
            {t("ctaMakingOf")}
          </Link>
          <a
            href="https://github.com/aoll/micro-saas-studio-builder"
            target="_blank"
            rel="noreferrer"
            className="mk-button min-h-11 px-5 text-sm"
          >
            {t("ctaGithub")}
          </a>
          <a
            href="/architecture/index.html"
            target="_blank"
            rel="noreferrer"
            className="mk-button min-h-11 px-5 text-sm"
          >
            {t("ctaArchitecture")}
          </a>
        </div>
      </div>
    </section>
  );
}
