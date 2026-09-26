import { Button } from "@/components/ui/button";

// docs/01-produit.md's "Méthode de delivery agentique" and
// docs/13-candidature.md's README outline, condensed to what a recruiter
// scans in a few seconds rather than the full section aimed at an agent.
const POINTS = [
  {
    title: "Specs avant le code",
    description:
      "Une spec par fonctionnalité, écrite avant l'implémentation : comportement, cas limites, critères d'acceptation.",
  },
  {
    title: "TDD sur le cœur métier",
    description: "Le ledger de crédits, l'idempotence, le paiement simulé : testés avant d'être codés.",
  },
  {
    title: "Une PR par spec, relue par un humain",
    description: "Chaque fonctionnalité passe par une revue avant d'être mergée ; rien n'est déployé sans relecture.",
  },
];

export function HowItsBuilt() {
  return (
    <section className="border-t bg-muted/30 py-16">
      <div className="mx-auto max-w-4xl px-4">
        <h2 className="text-center text-2xl font-bold tracking-tight">Comment c&apos;est construit</h2>
        <p className="mx-auto mt-2 max-w-xl text-center text-muted-foreground">
          « We develop with AI, not alongside it » : ce repo montre la méthode autant que le produit.
        </p>
        <ul className="mt-10 space-y-6">
          {POINTS.map((point) => (
            <li key={point.title} className="border-l-2 pl-4">
              <p className="font-semibold">{point.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{point.description}</p>
            </li>
          ))}
        </ul>
        <div className="mt-10 text-center">
          <Button asChild variant="outline">
            <a href="https://github.com/aoll/micro-saas-studio-builder" target="_blank" rel="noreferrer">
              Voir le code sur GitHub
            </a>
          </Button>
        </div>
      </div>
    </section>
  );
}
