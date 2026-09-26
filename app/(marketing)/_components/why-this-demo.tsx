import { Card, CardContent, CardHeader } from "@/components/ui/card";

// The 3 bullets of docs/01-produit.md's "Pourquoi pour Dotworld" and
// docs/00-accueil.md's "Pourquoi cette démo", condensed for the web.
const REASONS = [
  {
    title: "Plusieurs SaaS, un socle commun",
    description:
      "Même stack, mêmes thèmes, même système de crédits : un nouveau produit est une configuration, pas un projet.",
  },
  {
    title: "Test → Learn → Scale",
    description:
      "Chaque produit a son funnel, son coût IA, sa marge, et un statut qui aide à décider : on pousse, ou on coupe.",
  },
  {
    title: "Votre stack, votre méthode",
    description:
      "Next.js, TypeScript, Tailwind, shadcn, server actions ; développée avec Claude Code, specs et tests à l'appui.",
  },
];

export function WhyThisDemo() {
  return (
    <section className="mx-auto max-w-5xl px-4 py-16">
      <h2 className="text-center text-2xl font-bold tracking-tight">Pourquoi cette démo</h2>
      <p className="mx-auto mt-2 max-w-xl text-center text-muted-foreground">
        Elle reprend le métier d&apos;un SaaS studio en miniature.
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
