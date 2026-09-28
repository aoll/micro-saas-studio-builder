import { getFormatter, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/marketing-navigation";
import { LocaleSwitcher } from "../../_components/locale-switcher";
import { KEY_FIGURES } from "../_data/run";

export async function ControlRoomHeader() {
  const [t, format] = await Promise.all([getTranslations("making-of.header"), getFormatter()]);
  const tFigures = await getTranslations("making-of.keyFigures");
  return (
    <header className="flex flex-col gap-7">
      <div className="flex flex-wrap items-center justify-between gap-3 font-[family-name:var(--font-mk-mono)] text-xs tracking-[0.08em] text-mk-muted uppercase">
        <div className="flex items-center gap-4">
          <Link href="/" className="hover:text-mk-link hover:underline">
            {t("back")}
          </Link>
          <LocaleSwitcher pathname="/making-of" />
        </div>
        <span className="flex items-center gap-2">
          <span aria-hidden="true" className="size-2 rounded-full bg-mk-ok" />
          {t("status")}
        </span>
      </div>
      <p className="font-[family-name:var(--font-mk-mono)] text-xs tracking-[0.08em] text-mk-muted uppercase">
        {t("eyebrow")}
      </p>
      <h1 className="max-w-4xl font-[family-name:var(--font-mk-display)] text-4xl leading-[1.04] font-extrabold tracking-[-0.035em] text-balance sm:text-6xl">
        {t("title")}
      </h1>
      <p className="max-w-3xl text-lg leading-relaxed text-mk-muted sm:text-xl">{t("description")}</p>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {KEY_FIGURES.map((figure) => (
          <div key={figure.id} className="flex flex-col-reverse gap-1.5 mk-card px-4 py-4">
            <dt className="text-sm text-mk-muted">{tFigures(figure.id)}</dt>
            <dd className="font-[family-name:var(--font-mk-display)] text-3xl font-extrabold tracking-[-0.03em] tabular-nums">
              {format.number(figure.value)}
            </dd>
          </div>
        ))}
      </dl>
    </header>
  );
}
