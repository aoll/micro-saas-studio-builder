import Link from "next/link";

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
    title: "TDD sur toute l'implémentation",
    description: "Chaque comportement d'acceptation est testé avant d'être codé, rouge puis vert.",
  },
  {
    title: "Une spec, une revue agentique sous plusieurs angles, une PR",
    description:
      "Chaque fonctionnalité passe par plusieurs agents de revue spécialisés — correction, Next.js, base de données, sécurité — avant d'être mergée.",
  },
];

export function HowItsBuilt() {
  return (
    <section className="mx-auto max-w-6xl px-4 pt-24 sm:px-8">
      <div className="flex flex-col gap-8 rounded-[20px] border border-mk-line bg-mk-surface/60 p-6 sm:p-12">
        <div className="grid gap-4 lg:grid-cols-12 lg:items-end lg:gap-x-6">
          <div className="flex flex-col gap-2 lg:col-span-5">
            <p className="text-[13px] font-semibold text-mk-link">La méthode</p>
            <h2 className="font-[family-name:var(--font-mk-display)] text-3xl font-extrabold tracking-[-0.03em] sm:text-4xl">
              Comment c&apos;est construit
            </h2>
          </div>
          <p className="text-lg leading-relaxed text-mk-muted lg:col-span-6 lg:col-start-7">
            « We develop with AI, not alongside it » : ce repo montre la méthode autant que le produit.
          </p>
        </div>
        <ol className="grid gap-4 lg:grid-cols-3">
          {POINTS.map((point, index) => (
            <li key={point.title} className="flex flex-col gap-3 rounded-xl border border-mk-line bg-mk-surface p-6">
              <span className="flex size-9 items-center justify-center rounded-[10px] bg-mk-chip font-[family-name:var(--font-mk-display)] font-extrabold text-mk-chip-ink">
                {index + 1}
              </span>
              <p className="font-[family-name:var(--font-mk-display)] text-lg font-bold">{point.title}</p>
              <p className="text-[15px] leading-relaxed text-mk-muted">{point.description}</p>
            </li>
          ))}
        </ol>
        <div className="flex flex-wrap gap-3">
          <Link href="/making-of" className="mk-cta min-h-11 px-5 text-sm">
            Voir le making-of
          </Link>
          <a
            href="https://github.com/aoll/micro-saas-studio-builder"
            target="_blank"
            rel="noreferrer"
            className="mk-button min-h-11 px-5 text-sm"
          >
            Voir le code sur GitHub
          </a>
          <a
            href="/architecture/index.html"
            target="_blank"
            rel="noreferrer"
            className="mk-button min-h-11 px-5 text-sm"
          >
            Explorer l&apos;architecture technique
          </a>
        </div>
      </div>
    </section>
  );
}
