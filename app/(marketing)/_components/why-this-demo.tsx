import { Card, CardContent, CardHeader } from "@/components/ui/card";

// The 3 bullets of docs/01-produit.md's "Pourquoi pour Dotworld" and
// docs/00-accueil.md's "Pourquoi ce projet", condensed for the web.
const REASONS = [
  {
    title: "Un socle commun, à petite échelle",
    description:
      "Même stack, mêmes thèmes, même système de crédits pour les quelques produits de la démo : une façon d'explorer l'idée d'un socle partagé, pas de la démontrer à votre échelle.",
  },
  {
    title: "Test → Learn → Scale, en mécanique",
    description:
      "Chaque produit a son funnel, son coût IA, sa marge, et un statut qui aide à décider ; les chiffres sont ceux d'une démo de quelques jours, pas d'un vrai historique.",
  },
  {
    title: "Une stack proche, une méthode encore à apprendre",
    description:
      "Next.js, TypeScript, Tailwind, shadcn, server actions ; développée avec Claude Code, specs et tests à l'appui, en essayant de se rapprocher de vos outils.",
  },
];

export function WhyThisDemo() {
  return (
    <section className="mx-auto max-w-5xl px-4 py-16">
      <h2 className="text-center text-2xl font-bold tracking-tight">Pourquoi ce projet</h2>
      <p className="mx-auto mt-2 max-w-xl text-center text-muted-foreground">
        Dotworld, ce sont 50 personnes autofinancées et plusieurs SaaS qui marchent déjà. Cette démo est ma façon de
        montrer, concrètement, l&apos;envie d&apos;apprendre ce modèle et d&apos;y contribuer, en explorant son cœur de
        métier à mon échelle.
      </p>
      <div className="mt-10 grid gap-6 sm:grid-cols-3">
        {REASONS.map((reason) => (
          <Card key={reason.title}>
            <CardHeader>
              <h3 className="font-semibold">{reason.title}</h3>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">{reason.description}</CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
