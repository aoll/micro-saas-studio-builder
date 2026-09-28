// docs/01-produit.md's "Pourquoi pour Dotworld" and docs/00-accueil.md's
// "Pourquoi ce projet", condensed for the web.
export function WhyThisDemo() {
  return (
    <section className="mx-auto grid max-w-6xl gap-6 px-4 pt-24 sm:px-8 lg:grid-cols-12 lg:gap-x-6">
      <div className="flex flex-col gap-2 lg:col-span-4">
        <p className="text-[13px] font-semibold text-mk-link">Le contexte</p>
        <h2 className="font-[family-name:var(--font-mk-display)] text-3xl font-extrabold tracking-[-0.03em] sm:text-4xl">
          Pourquoi ce projet
        </h2>
      </div>
      <p className="text-lg leading-relaxed sm:text-xl lg:col-span-8">
        Plusieurs SaaS en parallèle, une stack moderne, l&apos;agentic au cœur du process de développement, autofinancé
        et rentable depuis la première année, passé de 1 à plus de 50 personnes en quatre ans : un modèle qui a fait ses
        preuves. Cette démo est ma façon de montrer, concrètement, l&apos;envie d&apos;apprendre ce modèle et d&apos;y
        contribuer, en explorant son cœur de métier à mon échelle.
      </p>
    </section>
  );
}
