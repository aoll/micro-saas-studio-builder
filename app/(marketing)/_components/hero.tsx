import Link from "next/link";
import { Button } from "@/components/ui/button";

// Static content, entirely pre-rendered: the first thing a recruiter opens
// should ship almost no JavaScript (docs/04-nextjs.md). The primary CTA
// scrolls to ProductsShowcase's `#produits` instead of linking to one
// specific slug, so this component stays independent from the product list.
export function Hero() {
  return (
    <section className="mx-auto max-w-3xl px-4 pt-20 pb-16 text-center">
      <p className="text-sm font-medium text-muted-foreground">Démo — candidature chez Dotworld</p>
      <h1 className="mt-4 text-4xl font-bold tracking-tight text-balance sm:text-5xl">
        Un SaaS studio qui lance un micro-SaaS IA en quelques minutes, et le pilote par la donnée
      </h1>
      <p className="mt-6 text-lg text-balance text-muted-foreground">
        Chaque produit est un outil IA avec crédits, généré depuis un formulaire, habillé d&apos;un thème partagé, et
        suivi jusqu&apos;à la décision : on scale, ou on coupe.
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
    </section>
  );
}
