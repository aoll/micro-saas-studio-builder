import { getTranslations } from "next-intl/server";
import Image, { type StaticImageData } from "next/image";
import portfolio from "@/public/landing/backoffice-portfolio.jpg";
import product from "@/public/landing/backoffice-product.jpg";
import productForm from "@/public/landing/backoffice-product-form.jpg";

// Key backoffice screens, as screenshots: the backoffice's figures are
// admin-only (lib/dal), so the landing shows it captured on the seeded demo
// data rather than live. Regenerate the images with
// `pnpm screenshots:backoffice` (scripts/backoffice-screenshots.ts) after a
// visible change to these screens — the screenshots themselves stay the
// French captures (plan step 7), only their alt text is translated. Static
// imports: a missing file fails the build, and next/image gets each
// image's size and blur placeholder.
type Screen = { image: StaticImageData; url: string; key: "portfolio" | "product" | "productForm" };

const PORTFOLIO: Screen = { image: portfolio, url: "/admin", key: "portfolio" };

const DETAIL_SCREENS: Screen[] = [
  { image: product, url: "/admin/products/lettre-pro", key: "product" },
  { image: productForm, url: "/admin/products/new", key: "productForm" },
];

async function ScreenFigure({ screen, sizes }: { screen: Screen; sizes: string }) {
  const t = await getTranslations(`marketing.backofficeScreens.${screen.key}`);
  return (
    <figure className="flex flex-col gap-4">
      <div className="overflow-hidden mk-card bg-mk-surface">
        <div className="flex items-center gap-3 border-b border-mk-line px-4 py-2.5">
          <span aria-hidden="true" className="flex gap-1.5">
            <span className="size-2.5 rounded-full bg-mk-line" />
            <span className="size-2.5 rounded-full bg-mk-line" />
            <span className="size-2.5 rounded-full bg-mk-line" />
          </span>
          <span className="truncate font-[family-name:var(--font-mk-mono)] text-xs text-mk-muted">{screen.url}</span>
        </div>
        <Image src={screen.image} alt={t("alt")} sizes={sizes} placeholder="blur" className="h-auto w-full" />
      </div>
      <figcaption className="flex flex-col gap-1">
        <span className="font-[family-name:var(--font-mk-display)] text-lg font-bold">{t("title")}</span>
        <span className="text-[15px] leading-relaxed text-mk-muted">{t("description")}</span>
      </figcaption>
    </figure>
  );
}

export async function BackofficeScreens() {
  const t = await getTranslations("marketing.backofficeScreens");
  return (
    <section aria-labelledby="backoffice-screens" className="mx-auto flex max-w-6xl flex-col gap-10 px-4 pt-24 sm:px-8">
      <div className="flex flex-col gap-2">
        <p className="text-[13px] font-semibold text-mk-link">{t("eyebrow")}</p>
        <h2
          id="backoffice-screens"
          className="font-[family-name:var(--font-mk-display)] text-3xl font-extrabold tracking-[-0.03em] sm:text-4xl"
        >
          {t("title")}
        </h2>
      </div>
      <ScreenFigure screen={PORTFOLIO} sizes="(min-width: 1152px) 1088px, 100vw" />
      <div className="grid gap-10 lg:grid-cols-2 lg:gap-6">
        {DETAIL_SCREENS.map((screen) => (
          <ScreenFigure
            key={screen.url}
            screen={screen}
            sizes="(min-width: 1152px) 532px, (min-width: 1024px) 50vw, 100vw"
          />
        ))}
      </div>
    </section>
  );
}
