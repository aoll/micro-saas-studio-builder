import Link from "next/link";
import { Button } from "@/components/ui/button";

// Static content, entirely pre-rendered: the first thing a recruiter opens
// should ship almost no JavaScript (docs/04-nextjs.md). The primary CTA
// scrolls to ProductsShowcase's `#produits` instead of linking to one
// specific slug, so this component stays independent from the product list.
export function Hero() {
  return (
    <section className="mx-auto max-w-3xl px-4 pt-20 pb-16 text-center">
      <p className="text-sm font-medium text-muted-foreground">Petite démo — candidature chez Dotworld</p>
      <h1 className="mt-4 text-4xl font-bold tracking-tight text-balance sm:text-5xl">
        Un backoffice qui génère un micro-SaaS IA en quelques minutes, et le pilote par la donnée
      </h1>
      <p className="mt-6 text-lg text-balance text-muted-foreground">
        Depuis le backoffice, on crée un nouveau produit en remplissant un formulaire, et on pilote chacun par la
        donnée — funnel, coût IA, marge — jusqu&apos;à la décision : on scale, ou on coupe.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Button asChild size="lg">
          <Link href="#produits">Voir un produit en direct</Link>
        </Button>
        <Button asChild size="lg" variant="outline">
          <Link href="/admin/login">Ouvrir le backoffice admin</Link>
        </Button>
      </div>
      <p className="mt-4 text-sm text-muted-foreground">Démo publique : le paiement et l&apos;email y sont simulés.</p>
      <p className="mt-2 text-sm">
        Développée avec Claude Code, specs et tests à l&apos;appui :{" "}
        <Link href="/making-of" className="font-medium underline underline-offset-4 hover:text-foreground/80">
          Découvrir le making-of
        </Link>
      </p>
    </section>
  );
}
