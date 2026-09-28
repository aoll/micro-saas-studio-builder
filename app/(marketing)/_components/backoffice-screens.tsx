import Image, { type StaticImageData } from "next/image";
import portfolio from "@/public/landing/backoffice-portfolio.jpg";
import product from "@/public/landing/backoffice-product.jpg";
import productForm from "@/public/landing/backoffice-product-form.jpg";

// Key backoffice screens, as screenshots: the backoffice's figures are
// admin-only (lib/dal), so the landing shows it captured on the seeded demo
// data rather than live. Regenerate the images with
// `pnpm screenshots:backoffice` (scripts/backoffice-screenshots.ts) after a
// visible change to these screens. Static imports: a missing file fails the
// build, and next/image gets each image's size and blur placeholder.
type Screen = { image: StaticImageData; url: string; title: string; description: string; alt: string };

const PORTFOLIO: Screen = {
  image: portfolio,
  url: "/admin",
  title: "Le portefeuille",
  description:
    "Tous les produits d'un coup d'œil : visites, conversion, revenu, coût IA, marge, et la suggestion « à scaler » ou « à couper ».",
  alt: "Portefeuille du backoffice : quatre KPI du studio sur 30 jours et le tableau des produits avec leur statut.",
};

const DETAIL_SCREENS: Screen[] = [
  {
    image: product,
    url: "/admin/products/lettre-pro",
    title: "La fiche produit",
    description: "Le funnel de chaque produit, de la visite à l'achat, et sa courbe de visites et d'achats.",
    alt: "Fiche du produit LettrePro : revenu, ARPU, coût IA, marge par génération et funnel de conversion.",
  },
  {
    image: productForm,
    url: "/admin/products/new",
    title: "La création d'un produit",
    description: "Un formulaire en 7 étapes, avec l'aperçu de la landing qui se met à jour en direct.",
    alt: "Formulaire de création d'un produit, étape Landing et SEO, avec l'aperçu de la landing à droite.",
  },
];

function ScreenFigure({ screen, sizes }: { screen: Screen; sizes: string }) {
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
        <Image src={screen.image} alt={screen.alt} sizes={sizes} placeholder="blur" className="h-auto w-full" />
      </div>
      <figcaption className="flex flex-col gap-1">
        <span className="font-[family-name:var(--font-mk-display)] text-lg font-bold">{screen.title}</span>
        <span className="text-[15px] leading-relaxed text-mk-muted">{screen.description}</span>
      </figcaption>
    </figure>
  );
}

export function BackofficeScreens() {
  return (
    <section aria-labelledby="backoffice-screens" className="mx-auto flex max-w-6xl flex-col gap-10 px-4 pt-24 sm:px-8">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div className="flex flex-col gap-2">
          <p className="text-[13px] font-semibold text-mk-link">Le backoffice</p>
          <h2
            id="backoffice-screens"
            className="font-[family-name:var(--font-mk-display)] text-3xl font-extrabold tracking-[-0.03em] sm:text-4xl"
          >
            Le backoffice en images
          </h2>
        </div>
        <p className="max-w-md leading-relaxed text-mk-muted">
          Trois écrans clés, capturés sur les données de la démo : on lance un produit, on le mesure, on décide.
        </p>
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
