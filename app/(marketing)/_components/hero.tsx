import Link from "next/link";

// A product's life in the studio, shown next to the pitch: the status the
// backoffice drives each product through (docs/01-produit.md).
const STAGES = [
  { status: "Test", meaning: "Lancé depuis un formulaire", badge: "bg-mk-chip text-mk-chip-ink" },
  { status: "Learn", meaning: "Funnel, coût IA, marge", badge: "bg-mk-chip text-mk-chip-ink" },
  { status: "Scale", meaning: "On investit", badge: "mk-cta" },
  { status: "Killed", meaning: "On coupe", badge: "border border-mk-line text-mk-muted line-through" },
];

// Static content, entirely pre-rendered: the first thing a recruiter opens
// should ship almost no JavaScript (docs/04-nextjs.md). The primary CTA
// scrolls to ProductsShowcase's `#produits` instead of linking to one
// specific slug, so this component stays independent from the product list.
export function Hero() {
  return (
    <section className="mx-auto grid max-w-6xl gap-12 px-4 pt-16 pb-12 sm:px-8 lg:grid-cols-12 lg:items-center lg:pt-24">
      <div className="flex flex-col items-start gap-6 lg:col-span-7">
        <p className="inline-flex items-center gap-2 rounded-full border border-mk-line bg-mk-surface/70 px-3 py-1.5 text-[13px] font-medium text-mk-muted">
          <span aria-hidden="true" className="size-2 rounded-full bg-mk-rose" />
          Petite démo — candidature chez Dotworld
        </p>
        <h1 className="font-[family-name:var(--font-mk-display)] text-4xl leading-[1.04] font-extrabold tracking-[-0.035em] text-balance sm:text-6xl">
          Un backoffice qui génère et pilote des micro-SaaS IA en quelques minutes
        </h1>
        <p className="max-w-xl text-lg leading-relaxed text-mk-muted">
          Depuis le backoffice, on crée un nouveau produit en remplissant un formulaire, et on pilote chacun par la
          donnée — funnel, coût IA, marge — jusqu&apos;à la décision : on scale, ou on coupe.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link href="#produits" className="mk-cta min-h-12 px-5 text-[15px]">
            Voir un produit en direct
          </Link>
          <Link href="/admin/login" className="mk-button min-h-12 px-5 text-[15px]">
            Ouvrir le backoffice admin
          </Link>
        </div>
        <p className="text-sm leading-relaxed text-mk-muted">
          Démo publique : le paiement et l&apos;email y sont simulés.
          <br />
          Développée avec Claude Code, specs et tests à l&apos;appui :{" "}
          <Link href="/making-of" className="font-semibold text-mk-link hover:underline">
            Découvrir le making-of
          </Link>
        </p>
      </div>

      <aside
        aria-label="Cycle de vie d'un produit"
        className="flex flex-col gap-3 mk-card p-5 lg:col-span-4 lg:col-start-9"
      >
        <div className="flex items-center justify-between text-[13px] font-semibold">
          Cycle de vie d&apos;un produit
          <span className="font-[family-name:var(--font-mk-mono)] text-xs font-normal text-mk-muted">/{"{slug}"}</span>
        </div>
        <ol className="flex flex-col gap-2">
          {STAGES.map((stage) => (
            <li key={stage.status} className="flex items-center gap-3 rounded-xl bg-mk-subtle p-3 text-sm">
              <span className={`min-w-16 rounded-full px-2.5 py-1 text-center text-xs font-bold ${stage.badge}`}>
                {stage.status}
              </span>
              {stage.meaning}
            </li>
          ))}
        </ol>
      </aside>
    </section>
  );
}
